import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
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
    if (!userId || !Array.isArray(sectors) || sectors.length === 0) {
      console.warn('[grantSectorsToUser] Invalid parameters', { userId, sectors })
      return false
    }

    console.info('[grantSectorsToUser] Step 1: Getting user data', { userId })
    const { data: userData, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId)
    
    if (getUserError) {
      console.error('[grantSectorsToUser] Error getting user', { userId, error: getUserError })
      return false
    }

    if (!userData || !userData.user) {
      console.error('[grantSectorsToUser] User not found', { userId })
      return false
    }

    const user = userData.user
    console.info('[grantSectorsToUser] Step 2: User found', { 
      userId, 
      userEmail: user.email,
      currentMetadata: user.user_metadata 
    })

    const meta = user.user_metadata || {}
    const current = Array.isArray(meta.sectors) ? meta.sectors : []
    const merged = Array.from(new Set([ ...current, ...sectors ]))
    
    console.info('[grantSectorsToUser] Step 3: Sectors to merge', { 
      userId, 
      currentSectors: current, 
      newSectors: sectors, 
      mergedSectors: merged 
    })

    // Preserva todos os metadados existentes e adiciona/atualiza os setores
    const updatedMetadata = {
      ...meta,
      sectors: merged
    }

    console.info('[grantSectorsToUser] Step 4: Updating user with new metadata', { 
      userId,
      updatedMetadata 
    })

    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId, 
      { user_metadata: updatedMetadata }
    )

    if (updateError) {
      console.error('[grantSectorsToUser] Error updating user', { 
        userId, 
        error: updateError,
        errorMessage: updateError.message,
        errorDetails: updateError
      })
      return false
    }

    console.info('[grantSectorsToUser] Step 5: User updated successfully!', { 
      userId, 
      sectors: merged,
      updateResult: updateData 
    })
    
    return true
  } catch (e) {
    console.error('[grantSectorsToUser] Exception caught', { 
      userId, 
      error: e,
      errorMessage: e?.message,
      errorStack: e?.stack
    })
    return false
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    // Log seguro e estruturado
    console.info('[MP Webhook] ========== WEBHOOK RECEIVED ==========')
    console.info('[MP Webhook] Received', { type: body?.type || body?.topic, id: body?.data?.id || body?.id, fullBody: body })
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
        console.info('[MP Webhook] Duplicate payment notification ignored', { paymentId: dataId })
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
      const statusDetail = payment.status_detail
      console.info('[MP Webhook] Payment detail', { externalReference, status, statusDetail })
      
      if (!externalReference) return NextResponse.json({ ok: true })

      // Detecta se é adição de créditos (referenceId inicia com "credits_" e não é compra de produto)
      // Produtos usam padrão "product_*" então não entram nesta condição
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
                  console.info('[MP Webhook] Calling addCreditsWebhook', { url: addCreditsWebhook, payload: webhookPayload })
                  const whRes = await fetch(addCreditsWebhook, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(webhookPayload)
                  })
                  console.info('[MP Webhook] Webhook response', { status: whRes.status })
                } catch (webhookError) {
                  console.error('[MP Webhook] Error calling addCreditsWebhook', webhookError)
                }
              }

              // Atualiza créditos no Redis (independente do webhook externo)
              try {
                const cents = Math.round(Number(amount) * 100)
                await credits.addCents(user.id, cents)
                console.info('[MP Webhook] Credits added to balance', { userId: user.id, cents })
              } catch (err) {
                console.error('[MP Webhook] Error adding credits', err)
              }
            }
          }
        } catch (creditsError) {
          console.error('[MP Webhook] Error processing credits add', creditsError)
        }
        
        return NextResponse.json({ ok: true })
      }

      // Busca compra no banco pela referenceId (fluxo de produtos)
      console.info('[MP Webhook] Searching for purchase', { externalReference })
      const { data: purchase, error: purchaseError } = await supabaseAdmin
        .from('product_purchases')
        .select('id,user_id,product_id,status')
        .eq('reference_id', externalReference)
        .single()
      
      if (purchaseError) {
        console.warn('[MP Webhook] Purchase not found or error', { externalReference, error: purchaseError })
      }
      
      if (purchase) {
        console.info('[MP Webhook] Purchase found', { purchaseId: purchase.id, userId: purchase.user_id, productId: purchase.product_id, currentStatus: purchase.status })
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
          .update({ status: dbStatus, status_detail: statusDetail })
          .eq('id', purchase.id)
        
        // Se pagamento aprovado, concede acesso ao produto
        if (status === 'approved') {
          console.info('[MP Webhook] Payment APPROVED! Processing product access...')
          const { data: prod, error: prodError } = await supabaseAdmin
            .from('products')
            .select('sectors, webhook_url, name, key')
            .eq('id', purchase.product_id)
            .single()
          
          if (prodError) {
            console.error('[MP Webhook] Error fetching product', { productId: purchase.product_id, error: prodError })
          }
          
          if (prod) {
            console.info('[MP Webhook] Product found', { productKey: prod.key, productName: prod.name, sectors: prod.sectors })
            
            // Concede setores do produto ao usuário
            console.info('[MP Webhook] Granting sectors to user', { userId: purchase.user_id, sectors: prod.sectors })
            const sectorsGranted = await grantSectorsToUser(purchase.user_id, prod.sectors)
            
            if (sectorsGranted) {
              console.info('[MP Webhook] ✅ Sectors granted successfully!')
            } else {
              console.error('[MP Webhook] ❌ Failed to grant sectors to user')
            }
            
            // REMOVIDO: Não adiciona créditos ao comprar produto (apenas setores)
            // Créditos só são adicionados em transações com referenceId "credits_*"
            
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
    console.error('[MP Webhook] Exception', e)
    return NextResponse.json({ ok: true }) // Sempre retorna 200 para evitar reenvios
  }
}

export async function GET(request) {
  // Mercado Pago pode fazer GET para validar a URL do webhook
  return NextResponse.json({ ok: true })
}
