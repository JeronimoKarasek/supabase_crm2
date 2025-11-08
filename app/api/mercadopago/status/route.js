import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const paymentId = searchParams.get('paymentId')
    if (!paymentId) return NextResponse.json({ error: 'paymentId obrigatório' }, { status: 400 })

    // Busca access token do Mercado Pago (env > global settings)
    let accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    if (!accessToken) {
      try {
        const { data } = await supabaseAdmin.from('global_settings').select('data').eq('id','global').single()
        accessToken = data?.data?.payments?.mercadopagoAccessToken || ''
      } catch {}
    }
    if (!accessToken) return NextResponse.json({ error: 'Mercado Pago access token não configurado' }, { status: 500 })

    const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ error: 'Erro ao consultar status', details: json }, { status: res.status })

    return NextResponse.json({
      paymentId: json.id,
      status: json.status,
      statusDetail: json.status_detail,
      dateApproved: json.date_approved,
      dateCreated: json.date_created,
      provider: 'mercadopago',
    })
  } catch (e) {
    return NextResponse.json({ error: 'Falha ao consultar status', details: e.message }, { status: 500 })
  }
}
