import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase-admin.js'

async function getUserFromRequest(request) {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return null
  const token = auth.split(' ')[1]
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error) return null
  return data?.user || null
}

async function readSettings() {
  const { data } = await supabaseAdmin.from('global_settings').select('data').eq('id', 'global').single()
  return data?.data || {}
}

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json()
    const { bankKey, cpf, payload } = body || {}
    if (!bankKey || !cpf) return NextResponse.json({ error: 'bankKey e cpf são obrigatórios' }, { status: 400 })
    const settings = await readSettings()
    const banks = Array.isArray(settings?.banks) ? settings.banks : []
    const bank = banks.find(b => b.key === bankKey)
    if (!bank || !bank.webhookDigitar) return NextResponse.json({ error: 'Webhook digitar não configurado' }, { status: 400 })

    // Load user credentials for this bank
    const { data: credRow } = await supabaseAdmin
      .from('bank_credentials')
      .select('credentials')
      .eq('user_id', user.id)
      .eq('bank_key', bankKey)
      .single()
    const credentials = credRow?.credentials || {}

    const res = await fetch(bank.webhookDigitar, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cpf, email: user.email, credentials, data: payload || {} }) })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return NextResponse.json({ error: json?.error || 'Falha no webhook' }, { status: 400 })
    return NextResponse.json({ ok: true, response: json })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}

