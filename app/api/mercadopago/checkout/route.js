import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase-admin'


export const dynamic = 'force-dynamic'
/**
 * Mercado Pago Checkout API
 * 
 * API de Pagamentos (Payment API) - Pagamento à vista
 * Documentação: https://www.mercadopago.com.br/developers/pt/docs/checkout-api/landing
 * 
 * Fluxo:
 * 1. Cliente chama POST com dados do produto e comprador
 * 2. Backend cria pagamento direto (Pix ou Débito)
 * 3. Retorna dados do pagamento (QR Code Pix, link, etc)
 * 4. Mercado Pago envia webhook quando pagamento confirma
 * 5. Callback atualiza status e concede acesso
 * 
 * Métodos aceitos: Pix, Débito (SEM Crédito)
 */

async function getUser(request){
  const auth = request.headers.get('authorization') || request.headers.get('Authorization')
  if(!auth || !auth.toLowerCase().startsWith('bearer ')) return null
  const token = auth.split(' ')[1]
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if(error) return null
  return data?.user || null
}

export async function POST(request) {
  try {
    const body = await request.json()
    
    // Busca access token do Mercado Pago
    let accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    if (!accessToken) {
      try {
        const { data } = await supabaseAdmin.from('global_settings').select('data').eq('id','global').single()
        accessToken = data?.data?.payments?.mercadopagoAccessToken || ''
      } catch {}
    }
    if (!accessToken) return NextResponse.json({ error: 'Mercado Pago access token not configured' }, { status: 500 })

    const baseUrl = process.env.APP_BASE_URL || new URL(request.url).origin
    const referenceId = body.referenceId || `mp_${Date.now()}`
    const amount = Number(body.amount || 0)
    
    // Persiste compra no banco antes de chamar Mercado Pago
    const user = await getUser(request)
    const productKey = body.productKey || null
    if(user && productKey){
      const { data: prod } = await supabaseAdmin.from('products').select('id').eq('key', productKey).single()
      if (prod) {
        await supabaseAdmin.from('product_purchases').insert({
          user_id: user.id,
          product_id: prod.id,
          reference_id: referenceId,
          amount: amount,
          status: 'created',
          buyer: body.buyerForm || body.buyer || null,
          metadata: body.metadata || null,
        })
      }
    }

    // Prepara payload para criar pagamento direto (Pix ou Débito)
    const payment = {
      transaction_amount: amount,
      description: body.title || body.description || 'Produto',
      payment_method_id: body.paymentMethod || 'pix', // 'pix', 'debit_card', etc
      payer: {
        email: body.buyer?.email || '',
        first_name: body.buyer?.firstName || body.buyer?.name || '',
        last_name: body.buyer?.lastName || '',
        identification: {
          type: 'CPF',
          number: body.buyer?.document || ''
        }
      },
      notification_url: `${baseUrl}/api/mercadopago/webhook`,
      external_reference: referenceId,
      statement_descriptor: 'FAROLTECH',
      metadata: {
        ...(body.metadata || {}),
        product_key: productKey,
        user_id: user?.id
      }
    }

    // Se for débito, precisa de token do cartão
    if (body.paymentMethod === 'debit_card' && body.token) {
      payment.token = body.token
      payment.installments = 1
    }

    // Chama API do Mercado Pago para criar pagamento
    const res = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'X-Idempotency-Key': referenceId
      },
      body: JSON.stringify(payment),
    })
    
    const json = await res.json()
    if (!res.ok) {
      return NextResponse.json({ 
        error: json?.message || 'Mercado Pago error', 
        details: json 
      }, { status: res.status })
    }
    
    // Retorna dados do pagamento criado
    // Para Pix: json.point_of_interaction.transaction_data contém QR Code
    // Para Débito: json.status indica o status
    return NextResponse.json({
      paymentId: json.id,
      status: json.status, // pending, approved, rejected, etc
      referenceId: referenceId,
      paymentMethod: json.payment_method_id,
      amount: json.transaction_amount,
      currency: json.currency_id,
      // Dados específicos do Pix
      qrCode: json.point_of_interaction?.transaction_data?.qr_code,
      qrCodeBase64: json.point_of_interaction?.transaction_data?.qr_code_base64,
      ticketUrl: json.point_of_interaction?.transaction_data?.ticket_url,
      // Dados gerais
      dateCreated: json.date_created,
      expirationDate: json.date_of_expiration,
    })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
