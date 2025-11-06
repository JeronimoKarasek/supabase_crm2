import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
const credits = require('@/lib/credits')
import { setNX } from '@/lib/redis'


export const dynamic = 'force-dynamic'
/**
 * Mercado Pago Webhook
 * 
 * Recebe notificações do Mercado Pago sobre mudanças de status de pagamento
 * 
 * Documentação: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 * 
 * Tipos de notificação:
 * - payment: Notificação sobre pagamentos
 * - merchant_order: Notificação sobre pedidos
 * 
 * Fluxo:
 * 1. Mercado Pago envia POST com { type, data: { id } }
 * 2. Backend consulta API do Mercado Pago para obter detalhes do pagamento
 * 3. Atualiza status da compra no banco
 * 4. Se approved, concede acesso ao produto
 */

async function grantSectorsToUser(userId, sectors){
  try {
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId)
    const meta = u?.user?.user_metadata || {}
    const current = Array.isArray(meta.sectors) ? meta.sectors : []
    const merged = Array.from(new Set([ ...current, ...(sectors || []) ]))
    await supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: { ...meta, sectors: merged } })
  } catch {}
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    // Log básico para rastrear notificações recebidas (safe)
    console.log('[MP Webhook] Received:', JSON.stringify({ type: body?.type || body?.topic, id: body?.data?.id || body?.id }, null, 2))
    const notificationType = body?.type || body?.topic
    const dataId = body?.data?.id || body?.id
    
    if (!notificationType || !dataId) {
      return NextResponse.json({ ok: true }) // Ignora notificações incompletas
    }

    // Busca access token do Mercado Pago
    let accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    if (!accessToken) {
      try {
        const { data } = await supabaseAdmin.from('global_settings').select('data').eq('id','global').single()
        accessToken = data?.data?.payments?.mercadopagoAccessToken || ''
      } catch {}
    }
    if (!accessToken) return NextResponse.json({ ok: true })

    // Processa notificação de pagamento
    if (notificationType === 'payment') {
      // Deduplicação: evita processar o mesmo pagamento mais de uma vez
      const dedupeKey = `mp:payment:${dataId}`
      const firstTime = await setNX(dedupeKey, 60 * 60 * 24) // 24h
      if (!firstTime) {
        console.log('[MP Webhook] Duplicate payment notification ignored:', dataId)
        return NextResponse.json({ ok: true })
      }

      // Consulta detalhes do pagamento na API do Mercado Pago
      const paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      
      if (!paymentRes.ok) return NextResponse.json({ ok: true })
      
      const payment = await paymentRes.json()
      const externalReference = payment.external_reference
      const status = payment.status // approved, pending, in_process, rejected, cancelled, refunded, charged_back
      
      if (!externalReference) return NextResponse.json({ ok: true })

      // Detecta se é adição de créditos (referenceId inicia com "credits_")
      if (externalReference.startsWith('credits_') && status === 'approved') {
        try {
          // Extrai userId do referenceId: credits_{userId}_{timestamp}
          const parts = externalReference.split('_')
          const userId = parts[1]
          
          if (userId) {
            // Busca dados do usuário
            const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId)
            const user = userData?.user
            
            if (user) {
              // Busca webhook de add credits das configurações globais
              const { data: settings } = await supabaseAdmin
                .from('global_settings')
                .select('data')
                .eq('id', 'global')
                .single()
              // Ajuste: campos de pagamentos ficam aninhados em data.payments
              const addCreditsWebhook = settings?.data?.payments?.addCreditsWebhook
              const amount = payment.transaction_amount || 0
              
              if (addCreditsWebhook) {
                try {
                  // Chama webhook com informações do usuário e valor
                  const webhookPayload = {
                    event: 'credits_added',
                    referenceId: externalReference,
                    status: status,
                    amount: amount,
                    userId: user.id,
                    email: user.email,
                    userMetadata: user.user_metadata || {},
                    timestamp: new Date().toISOString(),
                    paymentId: dataId,
                    provider: 'mercadopago'
                  }
                  console.log('[MP Webhook] Calling addCreditsWebhook:', addCreditsWebhook, webhookPayload)
                  const whRes = await fetch(addCreditsWebhook, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(webhookPayload)
                  })
                  console.log('[MP Webhook] Webhook response status:', whRes.status)
                } catch (webhookError) {
                  console.error('Erro ao chamar webhook de créditos:', webhookError)
                }
              }

              // Atualiza créditos no Redis (independente do webhook externo)
              try {
                const cents = Math.round(Number(amount) * 100)
                await credits.addCents(user.id, cents)
                console.log('[MP Webhook] Créditos somados no Redis:', user.id, cents)
              } catch (err) {
                console.error('Erro ao somar créditos no Redis:', err)
              }
            }
          }
        } catch (creditsError) {
          console.error('Erro ao processar adição de créditos:', creditsError)
        }
        
        return NextResponse.json({ ok: true })
      }

      // Busca compra no banco pela referenceId (fluxo de produtos)
      const { data: purchase } = await supabaseAdmin
        .from('product_purchases')
        .select('id,user_id,product_id,status')
        .eq('reference_id', externalReference)
        .single()
      
      if (purchase) {
        // Mapeia status do Mercado Pago para o banco
        const dbStatus = {
          'approved': 'paid',
          'pending': 'pending',
          'in_process': 'pending',
          'rejected': 'failed',
          'cancelled': 'cancelled',
          'refunded': 'refunded',
          'charged_back': 'refunded'
        }[status] || status
        
        // Atualiza status da compra
        await supabaseAdmin
          .from('product_purchases')
          .update({ status: dbStatus })
          .eq('id', purchase.id)
        
        // Se pagamento aprovado, concede acesso ao produto
        if (status === 'approved') {
          const { data: prod } = await supabaseAdmin
            .from('products')
            .select('sectors, webhook_url, name, key')
            .eq('id', purchase.product_id)
            .single()
          
          if (prod) {
            // Concede setores do produto ao usuário
            await grantSectorsToUser(purchase.user_id, prod.sectors)
            
            // Chama webhook do produto se configurado
            if (prod.webhook_url) {
              try {
                // Busca dados do usuário para incluir no webhook
                const { data: userData } = await supabaseAdmin.auth.admin.getUserById(purchase.user_id)
                const user = userData?.user
                
                const webhookPayload = {
                  event: 'purchase_paid',
                  referenceId: externalReference,
                  product: prod,
                  purchaseId: purchase.id,
                  userId: user?.id,
                  email: user?.email,
                  userMetadata: user?.user_metadata || {},
                  timestamp: new Date().toISOString(),
                  paymentId: dataId,
                  provider: 'mercadopago'
                }
                
                await fetch(prod.webhook_url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(webhookPayload)
                })
                
                await supabaseAdmin
                  .from('product_purchases')
                  .update({ webhook_status: 'sent_ok' })
                  .eq('id', purchase.id)
              } catch {
                await supabaseAdmin
                  .from('product_purchases')
                  .update({ webhook_status: 'sent_error' })
                  .eq('id', purchase.id)
              }
            }
          }
        }
      }
    }
    
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Webhook error:', e)
    return NextResponse.json({ ok: true }) // Sempre retorna 200 para evitar reenvios
  }
}

export async function GET(request) {
  // Mercado Pago pode fazer GET para validar a URL do webhook
  return NextResponse.json({ ok: true })
}
