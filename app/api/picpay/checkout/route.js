import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * PicPay Checkout API
 * 
 * Fluxo de pagamento:
 * 1. Cliente chama POST /api/picpay/checkout com dados do produto e comprador
 * 2. Backend cria referenceId único e persiste em product_purchases
 * 3. Chama API PicPay para gerar link de pagamento (não precisa de token)
 * 4. Retorna paymentUrl e qrcode para o cliente
 * 5. Cliente redireciona usuário para paymentUrl
 * 6. PicPay envia webhook para /api/picpay/callback quando pagamento é confirmado
 * 7. Callback atualiza status da compra e concede setores ao usuário
 * 
 * Nota: Token do PicPay é usado apenas para consultar status do pagamento, 
 * não para criar o link de pagamento (endpoint público)
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

    // Prepara payload para API do PicPay (não precisa de token para criar pagamento)
    const baseUrl = process.env.APP_BASE_URL || new URL(request.url).origin
    const payload = {
      referenceId: body.referenceId,
      callbackUrl: `${baseUrl}/api/picpay/callback`, // PicPay enviará notificações de status aqui
      returnUrl: `${baseUrl}${body.returnPath || '/produtos'}`, // Usuário volta aqui após pagamento
      value: Number(body.amount || 0),
      buyer: body.buyer || {},
    }
    if (!payload.referenceId || !(payload.value > 0)) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    
    // Persiste compra no banco antes de chamar PicPay
    const user = await getUser(request)
    const productKey = body.productKey || null
    if(user && productKey){
      const { data: prod } = await supabaseAdmin.from('products').select('id').eq('key', productKey).single()
      if (prod) {
        await supabaseAdmin.from('product_purchases').insert({
          user_id: user.id,
          product_id: prod.id,
          reference_id: payload.referenceId,
          amount: payload.value,
          status: 'created',
          buyer: body.buyerForm || body.buyer || null,
          metadata: body.metadata || null,
        })
      }
    }

    // Chama API do PicPay para criar link de pagamento (não precisa de token)
    const res = await fetch('https://appws.picpay.com/ecommerce/public/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) return NextResponse.json({ error: json?.message || 'PicPay error', details: json }, { status: res.status })
    
    // Retorna paymentUrl e qrcode para o cliente redirecionar o usuário
    return NextResponse.json(json)
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
