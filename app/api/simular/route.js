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
    const cpf = (body?.cpf || '').toString().trim()
    const onlyBank = body?.bankKey || null
    if (!cpf) return NextResponse.json({ error: 'CPF é obrigatório' }, { status: 400 })

    const settings = await readSettings()
    const banks = Array.isArray(settings?.banks) ? settings.banks : []
    const targetBanks = banks.filter(b => (b.forSimular || false) && b.webhookSimulador && (!onlyBank || b.key === onlyBank))

    // Load credentials for user
    const { data: credsRows } = await supabaseAdmin
      .from('bank_credentials')
      .select('bank_key, credentials')
      .eq('user_id', user.id)

    const credsMap = new Map()
    for (const r of (credsRows || [])) credsMap.set(r.bank_key, r.credentials || {})

    const out = []
    for (const b of targetBanks) {
      let result = { bankKey: b.key, bankName: b.name || b.key }
      try {
        const credentials = credsMap.get(b.key) || {}
        const payload = { cpf, email: user.email, credentials }
        const res = await fetch(b.webhookSimulador, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        const ctype = (res.headers.get('content-type') || '').toLowerCase()
        let bodyVal = null
        if (ctype.includes('application/json')) {
          bodyVal = await res.json().catch(() => ({}))
        } else {
          const txt = await res.text().catch(() => '')
          // try to JSON-parse text, else keep as message
          try { bodyVal = JSON.parse(txt) } catch { bodyVal = txt ? { mensagem: txt } : {} }
        }
        if (!res.ok) {
          const msg = (typeof bodyVal === 'object' && bodyVal) ? (bodyVal.error || bodyVal.mensagem || bodyVal.message) : String(bodyVal || '')
          result.error = msg || `HTTP ${res.status}`
        } else {
          // Normalize common keys (support spaces/accents variations)
          const src = (typeof bodyVal === 'object' && bodyVal) ? bodyVal : { mensagem: String(bodyVal || '') }
          const norm = (s) => {
            try {
              return String(s || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '')
            } catch { return String(s || '').toLowerCase() }
          }
          const getBySyn = (obj, syns) => {
            const map = new Map(Object.keys(obj || {}).map(k => [norm(k), k]))
            for (const s of syns) {
              const key = map.get(norm(s))
              if (key && typeof obj[key] !== 'undefined' && obj[key] !== null) return obj[key]
            }
            return undefined
          }
          const normalized = {
            mensagem: getBySyn(src, ['mensagem','message','msg']),
            valor_cliente: getBySyn(src, ['valor_cliente','valor cliente','valorCliente','valor','valor recomendado','valor_cliente_recomendado']),
            valor_liberado: getBySyn(src, ['valor_liberado','valor liberado','valorLiberado','liberado']),
            taxa: getBySyn(src, ['taxa','taxa efetiva','taxa_efetiva']),
            tabela: getBySyn(src, ['tabela','modalidade']),
            prazo: getBySyn(src, ['prazo','parcelas','periodo']),
            valor_bloqueado: getBySyn(src, ['valor_bloqueado','valor bloqueado','valorBloqueado','bloqueado']),
          }
          // Keep original as _raw for display fallback
          normalized._raw = src
          result.data = normalized
        }
      } catch (e) {
        result.error = e.message
      }
      out.push(result)
    }
    return NextResponse.json({ results: out })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}
