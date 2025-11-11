import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
const credits = require('@/lib/credits')

export const dynamic = 'force-dynamic'

/**
 * Endpoint para processar cobranças mensais de assinaturas
 * Deve ser chamado via cron job ou webhook externo diariamente
 * 
 * Autenticação: x-api-key header com INTERNAL_API_KEY
 */

function getApiKey(request){
  return request.headers.get('x-api-key') || request.headers.get('X-Api-Key') || ''
}

export async function POST(request){
  try{
    // Valida API key para chamadas externas
    const apiKey = getApiKey(request)
    if (!process.env.INTERNAL_API_KEY || apiKey !== process.env.INTERNAL_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Subscriptions] Iniciando processamento de cobranças mensais...')

    // Busca assinaturas ativas com data de cobrança vencida
    const today = new Date().toISOString().split('T')[0]
    const { data: subscriptions, error: fetchError } = await supabaseAdmin
      .from('product_subscriptions')
      .select('id, user_id, product_id, credit_price_cents, next_charge_date, failed_charges, products(*)')
      .eq('status', 'active')
      .lte('next_charge_date', today)
    
    if (fetchError) {
      console.error('[Subscriptions] Erro ao buscar assinaturas:', fetchError)
      return NextResponse.json({ error: 'Database error', details: fetchError.message }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[Subscriptions] Nenhuma assinatura para processar hoje')
      return NextResponse.json({ ok: true, processed: 0, message: 'Nenhuma cobrança pendente' })
    }

    console.log(`[Subscriptions] Encontradas ${subscriptions.length} assinaturas para processar`)

    const results = {
      total: subscriptions.length,
      success: 0,
      insufficient_balance: 0,
      errors: 0,
      details: []
    }

    // Processa cada assinatura
    for (const sub of subscriptions) {
      try {
        const { id, user_id, product_id, credit_price_cents, failed_charges, products: product } = sub
        
        console.log(`[Subscriptions] Processando assinatura ${id} - Usuário ${user_id}`)

        // Tenta cobrar créditos - MÉTODO DIRETO
        const { data: link } = await supabaseAdmin.from('empresa_users').select('empresa_id').eq('user_id', user_id).single()
        const empresaId = link?.empresa_id || null
        
        let chargeResult = { success: false, error: 'Usuário não vinculado a empresa' }
        
        if (empresaId) {
          const valueBRL = credit_price_cents / 100.0
          const { data: empresaData } = await supabaseAdmin.from('empresa').select('credits').eq('id', empresaId).single()
          const currentCredits = parseFloat(empresaData?.credits) || 0
          
          if (currentCredits < valueBRL) {
            chargeResult = { success: false, error: 'Saldo insuficiente', newBalance: Math.round(currentCredits * 100) }
          } else {
            const newCredits = Math.max(0, currentCredits - valueBRL)
            const { error: updateError } = await supabaseAdmin.from('empresa').update({ credits: newCredits }).eq('id', empresaId)
            
            if (updateError) {
              chargeResult = { success: false, error: 'Erro ao atualizar créditos' }
            } else {
              chargeResult = { success: true, newBalance: Math.round(newCredits * 100) }
            }
          }
        }

        if (chargeResult.success) {
          // Cobrança bem-sucedida
          console.log(`[Subscriptions] ✅ Cobrança bem-sucedida: ${id}`)
          
          // Calcula próxima data de cobrança (30 dias)
          const nextCharge = new Date()
          nextCharge.setDate(nextCharge.getDate() + 30)
          const nextChargeDate = nextCharge.toISOString().split('T')[0]

          // Atualiza assinatura
          await supabaseAdmin
            .from('product_subscriptions')
            .update({
              last_charge_date: today,
              last_charge_status: 'success',
              next_charge_date: nextChargeDate,
              failed_charges: 0,
              updated_at: new Date().toISOString()
            })
            .eq('id', id)

          // Busca dados do usuário para webhook
          const { data: userData } = await supabaseAdmin.auth.admin.getUserById(user_id)
          const user = userData?.user

          // Chama webhook do produto se configurado
          if (product?.webhook_url) {
            try {
              const webhookPayload = {
                event: 'subscription_renewed',
                subscriptionId: id,
                productId: product_id,
                productName: product.name,
                userId: user_id,
                email: user?.email,
                chargedCents: credit_price_cents,
                chargedBRL: credits.formatBRL(credit_price_cents),
                newBalance: chargeResult.newBalance,
                empresaId,
                nextChargeDate: nextChargeDate,
                timestamp: new Date().toISOString()
              }

              await fetch(product.webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(webhookPayload)
              })
              console.log(`[Subscriptions] Webhook enviado para produto ${product.name}`)
            } catch (webhookError) {
              console.error(`[Subscriptions] Erro ao enviar webhook:`, webhookError)
            }
          }

          results.success++
          results.details.push({
            subscriptionId: id,
            userId: user_id,
            status: 'success',
            charged: credits.formatBRL(credit_price_cents)
          })

        } else {
          // Saldo insuficiente
          console.log(`[Subscriptions] ⚠️ Saldo insuficiente: ${id}`)
          
          const newFailedCount = (failed_charges || 0) + 1
          
          // Se falhou 3 vezes, pausa a assinatura
          const newStatus = newFailedCount >= 3 ? 'paused' : 'active'
          
          // Próxima tentativa em 7 dias se ainda ativo, senão mantém a data
          const nextCharge = new Date()
          nextCharge.setDate(nextCharge.getDate() + 7)
          const nextChargeDate = newStatus === 'active' 
            ? nextCharge.toISOString().split('T')[0]
            : sub.next_charge_date // mantém a mesma se pausado

          await supabaseAdmin
            .from('product_subscriptions')
            .update({
              last_charge_date: today,
              last_charge_status: 'insufficient_balance',
              failed_charges: newFailedCount,
              status: newStatus,
              next_charge_date: nextChargeDate,
              updated_at: new Date().toISOString()
            })
            .eq('id', id)

          results.insufficient_balance++
          results.details.push({
            subscriptionId: id,
            userId: user_id,
            status: 'insufficient_balance',
            failedAttempts: newFailedCount,
            subscriptionStatus: newStatus
          })
        }

      } catch (subError) {
        console.error(`[Subscriptions] Erro ao processar assinatura ${sub.id}:`, subError)
        results.errors++
        results.details.push({
          subscriptionId: sub.id,
          userId: sub.user_id,
          status: 'error',
          error: subError.message
        })
      }
    }

    console.log(`[Subscriptions] Processamento concluído:`, results)

    return NextResponse.json({ 
      ok: true, 
      processed: results.total,
      results 
    })

  }catch(e){
    console.error('[Subscriptions] Erro geral:', e)
    return NextResponse.json({ error: 'Failed to process subscriptions', details: e.message }, { status: 500 })
  }
}

export async function GET(request){
  // Endpoint de teste para ver quais assinaturas seriam processadas
  const apiKey = getApiKey(request)
  if (!process.env.INTERNAL_API_KEY || apiKey !== process.env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = new Date().toISOString().split('T')[0]
  const { data: subscriptions } = await supabaseAdmin
    .from('product_subscriptions')
    .select('id, user_id, product_id, credit_price_cents, next_charge_date, status, products(name)')
    .eq('status', 'active')
    .lte('next_charge_date', today)

  return NextResponse.json({ 
    today,
    pending: subscriptions?.length || 0,
    subscriptions: subscriptions || []
  })
}
