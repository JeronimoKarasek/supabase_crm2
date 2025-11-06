import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * PicPay Status API
 * 
 * Consulta o status de um pagamento no PicPay
 * 
 * Uso: GET /api/picpay/status?ref=REFERENCE_ID
 * 
 * Retorna o status atual do pagamento:
 * - created: Pagamento criado, aguardando
 * - expired: Pagamento expirou
 * - paid: Pagamento confirmado
 * - completed: Pagamento completado
 * - refunded: Pagamento estornado
 * - chargeback: Chargeback solicitado
 */

export async function GET(request) {
  try {
    let token = process.env.PICPAY_SELLER_TOKEN
    if (!token) {
      try {
        const { data } = await supabaseAdmin.from('global_settings').select('data').eq('id','global').single()
        token = data?.data?.payments?.picpaySellerToken || ''
      } catch {}
    }
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

