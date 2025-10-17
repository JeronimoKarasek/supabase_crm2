import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const body = await request.json()
    const token = process.env.PICPAY_SELLER_TOKEN
    if (!token) return NextResponse.json({ error: 'PicPay seller token not configured (PICPAY_SELLER_TOKEN)' }, { status: 500 })

    const baseUrl = process.env.APP_BASE_URL || new URL(request.url).origin
    const payload = {
      referenceId: body.referenceId,
      callbackUrl: `${baseUrl}/api/picpay/callback`,
      returnUrl: `${baseUrl}/produtos/farolchat/assinar`,
      value: Number(body.amount || 0),
      buyer: body.buyer || {},
    }
    if (!payload.referenceId || !(payload.value > 0)) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })

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

