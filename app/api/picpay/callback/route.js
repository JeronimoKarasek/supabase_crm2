import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * PicPay Callback API
 * 
 * Webhook chamado pelo PicPay quando o status de um pagamento muda.
 * 
 * Fluxo:
 * 1. PicPay envia POST com { referenceId, status } quando pagamento é processado
 * 2. Backend busca a compra no product_purchases pela referenceId
 * 3. Atualiza o status da compra no banco
 * 4. Se status = 'paid':
 *    - Concede setores do produto ao usuário (atualiza user_metadata.sectors)
 *    - Chama webhook do produto se configurado (product.webhook_url)
 * 5. Retorna { ok: true } para o PicPay
 * 
 * Nota: Sempre retorna 200 OK para evitar reenvios desnecessários do PicPay
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
    const ref = body?.referenceId || body?.reference || null
    const status = (body?.status || '').toLowerCase()
    if (!ref) return NextResponse.json({ ok: true })

    // Detecta se é adição de créditos (referenceId inicia com "credits_")
    if (ref.startsWith('credits_') && status === 'paid') {
      try {
        // Extrai userId do referenceId: credits_{userId}_{timestamp}
        const parts = ref.split('_')
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
            
            const addCreditsWebhook = settings?.data?.addCreditsWebhook
            
            // Extrai valor do body do PicPay (se disponível) ou tenta obter de outra fonte
            const amount = body?.value || body?.amount || 0
            
            if (addCreditsWebhook) {
              try {
                // Chama webhook com informações do usuário e valor
                const webhookPayload = {
                  event: 'credits_added',
                  referenceId: ref,
                  status: status,
                  amount: amount,
                  userId: user.id,
                  email: user.email,
                  userMetadata: user.user_metadata || {},
                  timestamp: new Date().toISOString()
                }
                
                await fetch(addCreditsWebhook, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(webhookPayload)
                })
              } catch (webhookError) {
                console.error('Erro ao chamar webhook de créditos:', webhookError)
              }
            }
          }
        }
      } catch (creditsError) {
        console.error('Erro ao processar adição de créditos:', creditsError)
      }
      
      return NextResponse.json({ ok: true })
    }

    // Busca compra no banco pela referenceId (fluxo de produtos)
    const { data: purchase } = await supabaseAdmin.from('product_purchases').select('id,user_id,product_id,status').eq('reference_id', ref).single()
    if (purchase) {
      // Atualiza status da compra
      await supabaseAdmin.from('product_purchases').update({ status }).eq('id', purchase.id)
      
      // Se pagamento confirmado, concede acesso ao produto
      if (status === 'paid') {
        const { data: prod } = await supabaseAdmin.from('products').select('sectors, webhook_url, name, key').eq('id', purchase.product_id).single()
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
                referenceId: ref,
                product: prod,
                purchaseId: purchase.id,
                userId: user?.id,
                email: user?.email,
                userMetadata: user?.user_metadata || {},
                timestamp: new Date().toISOString()
              }
              
              await fetch(prod.webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(webhookPayload)
              })
              await supabaseAdmin.from('product_purchases').update({ webhook_status: 'sent_ok' }).eq('id', purchase.id)
            } catch {
              await supabaseAdmin.from('product_purchases').update({ webhook_status: 'sent_error' }).eq('id', purchase.id)
            }
          }
        }
      }
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: true })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true })
}
