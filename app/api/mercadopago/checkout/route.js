import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getMercadoPagoAccessToken, mpFetch, ensureCreditsReference, getValidCPF } from '@/lib/mercadopago'

export const dynamic = 'force-dynamic'
/**
 * Mercado Pago Checkout API
 * 
 * Melhorias implementadas:
 * - Idempotência reforçada com persistência da referência em product_purchases
 * - Validação dos campos obrigatórios do payload
 * - Campos metadata enriquecidos para auditoria
 * - Tratamento explícito de erros com categorias
 * - Logging estruturado através de console.info/console.error
 * 
 * Documentação base: https://www.mercadopago.com.br/developers/pt/docs/checkout-api/landing
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
    const body = await request.json().catch(()=> ({}))
    // Validação mínima
    const amountRaw = body.amount
    if (amountRaw === undefined) return NextResponse.json({ error: 'amount required' }, { status: 400 })
    const amount = Number(amountRaw)
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'invalid amount' }, { status: 400 })

    // Busca access token do Mercado Pago (env > global settings) com helper
    const { token: accessToken, source } = await getMercadoPagoAccessToken()
    if (!accessToken) return NextResponse.json({ error: 'Mercado Pago access token not configured' }, { status: 500 })

    const baseUrl = process.env.APP_BASE_URL || new URL(request.url).origin
  let referenceId = (body.referenceId || `mp_${Date.now()}_${Math.random().toString(36).slice(2,8)}`).replace(/[^a-zA-Z0-9_\-]/g,'_')
    const productKey = body.productKey || null
    const isCredits = body.isCredits === true || (typeof body.productType === 'string' && body.productType === 'credits')
  referenceId = ensureCreditsReference(referenceId, isCredits)
    const paymentMethod = body.paymentMethod || 'pix'
    const buyer = body.buyer || {}
    const user = await getUser(request)

    // Verifica duplicidade prévia (idempotência) pelo referenceId
    const { data: existing } = await supabaseAdmin
      .from('product_purchases')
      .select('id,status')
      .eq('reference_id', referenceId)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({
        reused: true,
        referenceId,
        status: existing.status,
        warning: 'Reference already used'
      })
    }
    
    // Resolve product id se não for créditos
    let productId = null
    if (!isCredits && productKey) {
      const { data: prod } = await supabaseAdmin.from('products').select('id').eq('key', productKey).single()
      productId = prod?.id || null
    }
    // Persiste tentativa inicial
    await supabaseAdmin.from('product_purchases').insert({
      user_id: user?.id || null,
      product_id: productId,
      reference_id: referenceId,
      amount: amount,
      status: 'initiated',
      buyer: body.buyerForm || buyer || null,
      metadata: {
        ...(body.metadata || {}),
        product_key: productKey,
        is_credits: isCredits,
        payment_method: paymentMethod,
        created_at: new Date().toISOString(),
        user_id: user?.id
      }
    }).catch(()=>{})

    // Prepara payload para criar pagamento direto (Pix ou Débito)
    // CRÍTICO: Mercado Pago exige CPF VÁLIDO (com dígito verificador) para PIX
    const cpfValido = getValidCPF(buyer?.document || user?.user_metadata?.cpf || user?.user_metadata?.document)
    
    const payment = {
      transaction_amount: amount,
      description: body.title || body.description || 'Produto',
      payment_method_id: paymentMethod, // 'pix', 'debit_card', etc
      payer: {
        email: buyer?.email || user?.email || 'contato@faroltech.com',
        first_name: buyer?.firstName || buyer?.name || user?.user_metadata?.name?.split(' ')[0] || 'Cliente',
        last_name: buyer?.lastName || user?.user_metadata?.name?.split(' ').slice(1).join(' ') || 'FarolTech',
        identification: {
          type: (buyer?.documentType || 'CPF'),
          number: cpfValido // CPF válido obrigatório para PIX
        }
      },
      notification_url: `${baseUrl}/api/mercadopago/webhook`,
      external_reference: referenceId,
      statement_descriptor: 'FAROLTECH',
      metadata: {
        ...(body.metadata || {}),
        product_key: productKey,
        is_credits: isCredits,
        user_id: user?.id,
        env: process.env.NODE_ENV,
        app_version: process.env.APP_VERSION || 'v1'
      }
    }

    // Se for débito, precisa de token do cartão
    if (body.paymentMethod === 'debit_card' && body.token) {
      payment.token = body.token
      payment.installments = 1
    }

    // Chama API do Mercado Pago para criar pagamento
    console.info('[MP Checkout] Creating payment', { referenceId, amount, paymentMethod, isCredits, productKey })
    const res = await mpFetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Idempotency-Key': referenceId
      },
      body: JSON.stringify(payment),
    })
    
    const json = await res.json()
    if (!res.ok) {
      console.error('[MP Checkout] Error', json)
      // Atualiza status para failed
      await supabaseAdmin.from('product_purchases').update({ status: 'failed', error: json?.message || json?.error || 'mp_error' }).eq('reference_id', referenceId)
      return NextResponse.json({ 
        error: json?.message || json?.error || 'Mercado Pago error', 
        details: json,
        referenceId
      }, { status: res.status })
    }
    
    // Atualiza status da purchase para created
    await supabaseAdmin.from('product_purchases').update({ status: 'created', payment_id: json.id }).eq('reference_id', referenceId).catch(()=>{})
    console.info('[MP Checkout] Payment created', { id: json.id, status: json.status })
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
      isCredits
    })
  } catch (e) {
    console.error('[MP Checkout] Exception', e)
    return NextResponse.json({ error: 'Invalid payload', details: e.message || String(e) }, { status: 400 })
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
