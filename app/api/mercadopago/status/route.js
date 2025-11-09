import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getMercadoPagoAccessToken, mpFetch } from '@/lib/mercadopago'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const paymentId = searchParams.get('paymentId')
    if (!paymentId) return NextResponse.json({ error: 'paymentId obrigatório' }, { status: 400 })

    // Busca access token do Mercado Pago (env > global settings)
    const { token: accessToken } = await getMercadoPagoAccessToken()
    if (!accessToken) return NextResponse.json({ error: 'Mercado Pago access token não configurado' }, { status: 500 })

    const res = await mpFetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, {})
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
