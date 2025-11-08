import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

async function parseJsonSafe(res) {
  try {
    const text = await res.text()
    try { return JSON.parse(text) } catch { return text ? { raw: text } : {} }
  } catch { return {} }
}

async function callShiftDataWithFallbacks(endpoint, bearerToken, payload) {
  const key = Object.keys(payload || {})[0]
  const value = payload ? payload[key] : undefined
  const headersJson = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${bearerToken}`
  }
  const headersGet = {
    'Accept': 'application/json',
    'Authorization': `Bearer ${bearerToken}`
  }
  const attempts = [
    { method: 'POST', url: endpoint, headers: headersJson, body: JSON.stringify(payload) },
    key ? { method: 'POST', url: endpoint, headers: headersJson, body: JSON.stringify({ [key.toUpperCase()]: value }) } : null,
    (value !== undefined) ? { method: 'GET', url: `${endpoint}/${encodeURIComponent(value)}`, headers: headersGet } : null,
    (value !== undefined && key) ? { method: 'GET', url: `${endpoint}?${encodeURIComponent(key)}=${encodeURIComponent(value)}`, headers: headersGet } : null,
  ].filter(Boolean)
  let lastErr = 'Erro na consulta'
  for (const att of attempts) {
    try {
      const res = await fetch(att.url, { method: att.method, headers: att.headers, body: att.body })
      const data = await parseJsonSafe(res)
      if (res.ok) return { ok: true, data }
      lastErr = (typeof data === 'string' ? data : (data?.message || res.statusText || lastErr))
    } catch (e) {
      lastErr = e.message || lastErr
    }
  }
  return { ok: false, error: lastErr }
}

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function unauthorized(msg = 'Unauthorized') {
  return NextResponse.json({ error: msg }, { status: 401 })
}

async function getUserFromRequest(request) {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return null
  const token = auth.split(' ')[1]
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error) return null
  return data?.user || null
}

function getApiConfig(queryType, value) {
  const clean = (v) => (v || '').replace(/\D/g, '')
  switch ((queryType || '').toLowerCase()) {
    case 'cpf': {
      const cpf = clean(value)
      if (!cpf || cpf.length !== 11) throw new Error('CPF inválido (11 dígitos)')
      return { endpoint: 'https://api.shiftdata.com.br/api/PessoaFisica', payload: { cpf }, label: 'CPF' }
    }
    case 'cnpj': {
      const cnpj = clean(value)
      if (!cnpj || cnpj.length !== 14) throw new Error('CNPJ inválido (14 dígitos)')
      return { endpoint: 'https://api.shiftdata.com.br/api/PessoaJuridica', payload: { cnpj }, label: 'CNPJ' }
    }
    case 'placa': {
      const placa = String(value || '').replace(/[^A-Z0-9]/gi, '').toUpperCase()
      if (!placa || placa.length !== 7) throw new Error('Placa inválida (7 caracteres)')
      return { endpoint: 'https://api.shiftdata.com.br/api/Veiculos', payload: { placa }, label: 'Placa' }
    }
    case 'telefone': {
      const telefone = clean(value)
      if (!telefone || telefone.length < 10) throw new Error('Telefone inválido (mínimo 10 dígitos)')
      return { endpoint: 'https://api.shiftdata.com.br/api/Telefone', payload: { telefone }, label: 'Telefone' }
    }
    default:
      throw new Error(`Tipo inválido: ${queryType}`)
  }
}

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return unauthorized()

    const body = await request.json()
    const { type, value } = body || {}
    if (!type || !value) return NextResponse.json({ error: 'Informe type e value' }, { status: 400 })

    // Buscar configurações
    const { data: settingsRow } = await supabaseAdmin.from('global_settings').select('data').eq('id', 'global').single()
    const settings = settingsRow?.data || {}
    const accessKey = (settings.shiftDataAccessKey || '96FA65CEC7234FFDA72D2D97EA6A457B')

    // Login na Shift Data
    const loginRes = await fetch('https://api.shiftdata.com.br/api/Login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ accessKey, AccessKey: accessKey })
    })
    const loginData = await parseJsonSafe(loginRes)
    if (!loginRes.ok) {
      return NextResponse.json({ error: loginData?.message || 'Falha no login' }, { status: 500 })
    }
    const tokenCandidates = [
      loginData?.token,
      loginData?.Token,
      loginData?.access_token,
      loginData?.accessToken,
      loginData?.data?.token,
      loginData?.data?.Token,
      loginData?.data?.access_token,
      loginData?.data?.accessToken,
    ]
    let token = tokenCandidates.find(Boolean)
    if (!token) {
      console.warn('⚠️ [Enrich Individual] Login sem token. Usando AccessKey como Bearer fallback. Body:', loginData)
      token = accessKey // fallback
    }

    // Determinar endpoint
    let cfg
    try { cfg = getApiConfig(type, value) } catch (e) { return NextResponse.json({ error: e.message }, { status: 400 }) }

    // Chamar endpoint com fallbacks de método e payload
    const result = await callShiftDataWithFallbacks(cfg.endpoint, token, cfg.payload)
    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Erro na consulta' }, { status: 502 })
    }

    return NextResponse.json({ success: true, type, value, data: result.data })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
