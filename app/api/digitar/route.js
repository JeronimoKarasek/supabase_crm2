import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '../../../lib/supabase-admin.js'


export const dynamic = 'force-dynamic'
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
    const { bankKey, cpf, payload, product } = body || {}
    if (!bankKey || !cpf) return NextResponse.json({ error: 'bankKey e cpf são obrigatórios' }, { status: 400 })

    const settings = await readSettings()
    const banks = Array.isArray(settings?.banks) ? settings.banks : []
    const bank = banks.find(b => b.key === bankKey)
    if (!bank) return NextResponse.json({ error: 'Banco não configurado' }, { status: 400 })

    let target = bank.webhookDigitar || null
    if (product && Array.isArray(bank.productConfigs)) {
      const pc = bank.productConfigs.find(p => p.product === product)
      if (pc && pc.webhookDigitar) target = pc.webhookDigitar
    }
    if (!target) return NextResponse.json({ error: 'Webhook digitar não configurado' }, { status: 400 })

    // Load user credentials for this bank
    const { data: credRow } = await supabaseAdmin
      .from('bank_credentials')
      .select('credentials')
      .eq('user_id', user.id)
      .eq('bank_key', bankKey)
      .single()
    const credentials = credRow?.credentials || {}

    const res = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cpf,
        email: user.email,
        credentials,
        data: payload || {},
        product,
        userId: user.id,
        userMetadata: user.user_metadata || {},
        timestamp: new Date().toISOString()
      }),
    })
    const ctype = (res.headers.get('content-type') || '').toLowerCase()
    let bodyVal = null
    if (ctype.includes('application/json')) bodyVal = await res.json().catch(() => ({}))
    else { const txt = await res.text().catch(() => ''); try { bodyVal = JSON.parse(txt) } catch { bodyVal = txt ? { mensagem: txt } : {} } }
    if (!res.ok) return NextResponse.json({ error: (typeof bodyVal==='object' ? (bodyVal.error || bodyVal.mensagem || bodyVal.message) : String(bodyVal||'')) || 'Falha no webhook' }, { status: 400 })
    return NextResponse.json({ ok: true, response: bodyVal })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}

