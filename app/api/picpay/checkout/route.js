import { NextResponse } from 'next/server'

import { supabaseAdmin } from '@/lib/supabase-admin'

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
    let token = process.env.PICPAY_SELLER_TOKEN
    if (!token) {
      try {
        const { data } = await supabaseAdmin.from('global_settings').select('data').eq('id','global').single()
        token = data?.data?.payments?.picpaySellerToken || ''
      } catch {}
    }
    if (!token) return NextResponse.json({ error: 'PicPay seller token not configured' }, { status: 500 })

    const baseUrl = process.env.APP_BASE_URL || new URL(request.url).origin
    const payload = {
      referenceId: body.referenceId,
      callbackUrl: `${baseUrl}/api/picpay/callback`,
      returnUrl: `${baseUrl}${body.returnPath || '/produtos'}`,
      value: Number(body.amount || 0),
      buyer: body.buyer || {},
    }
    if (!payload.referenceId || !(payload.value > 0)) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    // persist purchase (productKey optional)
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

    const res = await fetch('https://appws.picpay.com/ecommerce/public/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-picpay-token': token },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) return NextResponse.json({ error: json?.message || 'PicPay error', details: json }, { status: res.status })
    return NextResponse.json(json)
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
