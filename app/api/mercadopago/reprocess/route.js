import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getMercadoPagoAccessToken, mpFetch } from '@/lib/mercadopago'
import { setNX } from '@/lib/redis'

export const dynamic = 'force-dynamic'

async function getUser(request){
  const auth = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return null
  const token = auth.split(' ')[1]
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error) return null
  return data?.user || null
}

/**
 * Reprocessa um pagamento PIX aprovado adicionando créditos à empresa vinculada ao usuário.
 * Uso: POST /api/mercadopago/reprocess { paymentId }
 * Proteção: requer usuário autenticado (admin) ou INTERNAL_API_KEY.
 */
export async function POST(request){
  try {
    const body = await request.json().catch(()=>({}))
    const paymentId = String(body.paymentId || '').trim()
    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId obrigatório' }, { status: 400 })
    }

    // Auth ou API Key
    const apiKey = request.headers.get('x-api-key') || request.headers.get('X-Api-Key')
    let user = null
    if (apiKey) {
      if (!process.env.INTERNAL_API_KEY || apiKey !== process.env.INTERNAL_API_KEY) {
        return NextResponse.json({ error: 'Unauthorized (invalid api key)' }, { status: 401 })
      }
    } else {
      user = await getUser(request)
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { token: accessToken } = await getMercadoPagoAccessToken()
    if (!accessToken) return NextResponse.json({ error: 'Mercado Pago não configurado' }, { status: 500 })

    // Busca detalhes do pagamento
    const payRes = await mpFetch(`https://api.mercadopago.com/v1/payments/${paymentId}`)
    if (!payRes.ok) {
      return NextResponse.json({ error: 'Pagamento não encontrado no Mercado Pago', statusCode: payRes.status }, { status: 404 })
    }
    const payment = await payRes.json()
    const { status, external_reference: externalReference, transaction_amount: amount } = payment

    if (status !== 'approved') {
      return NextResponse.json({ error: 'Pagamento não está aprovado', currentStatus: status }, { status: 400 })
    }
    if (!externalReference || !externalReference.startsWith('credits_')) {
      return NextResponse.json({ error: 'Pagamento não é de créditos (external_reference inválido)' }, { status: 400 })
    }

    // Extrai userId do external_reference: credits_{userId}_{timestamp}
    const parts = externalReference.split('_')
    const extractedUserId = parts.slice(1, -1).join('_')
    if (!extractedUserId) {
      return NextResponse.json({ error: 'Não foi possível extrair userId do reference' }, { status: 400 })
    }

    // Busca empresa vinculada ao userId
    const { data: empresaLink, error: empresaErr } = await supabaseAdmin
      .from('empresa_users')
      .select('empresa_id')
      .eq('user_id', extractedUserId)
      .single()
    if (empresaErr || !empresaLink?.empresa_id) {
      return NextResponse.json({ error: 'Usuário sem empresa vinculada', details: empresaErr?.message }, { status: 400 })
    }
    const empresaId = empresaLink.empresa_id

    // Deduplicação
    const dedupeKey = `mp:credits_applied:${paymentId}`
    const firstTime = await setNX(dedupeKey, 60 * 60 * 24)
    if (!firstTime) {
      return NextResponse.json({ error: 'Créditos já aplicados para este pagamento', paymentId }, { status: 409 })
    }

    // Adiciona créditos via RPC
    const cents = Math.round(Number(amount) * 100)
    const { data: newBalance, error: addErr } = await supabaseAdmin.rpc('empresa_add_credits', { p_empresa: empresaId, p_cents: cents })
    if (addErr) {
      return NextResponse.json({ error: 'Falha ao adicionar créditos à empresa', details: addErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, paymentId, externalReference, userId: extractedUserId, empresaId, addedCents: cents, addedBRL: (cents/100).toFixed(2), newBalance })
  } catch (e) {
    return NextResponse.json({ error: 'Falha no reprocessamento', details: e.message }, { status: 500 })
  }
}

export async function GET(){
  return NextResponse.json({ ok: true, hint: 'Use POST { paymentId } para reprocessar créditos aprovados.' })
}
