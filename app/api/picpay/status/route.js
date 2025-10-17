import { NextResponse } from 'next/server'

export async function GET(request) {
  try {
    const token = process.env.PICPAY_SELLER_TOKEN
    if (!token) return NextResponse.json({ error: 'PicPay seller token not configured' }, { status: 500 })
    const ref = new URL(request.url).searchParams.get('ref')
    if (!ref) return NextResponse.json({ error: 'Missing ref' }, { status: 400 })
    const res = await fetch(`https://appws.picpay.com/ecommerce/public/payments/${encodeURIComponent(ref)}/status`, {
      headers: { 'x-picpay-token': token },
    })
    const json = await res.json()
    if (!res.ok) return NextResponse.json({ error: json?.message || 'PicPay error', details: json }, { status: res.status })
    return NextResponse.json(json)
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request', details: e.message }, { status: 400 })
  }
}

export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

