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
    const webhookTokenUrl = settings.shiftDataWebhookToken || 'https://weebserver6.farolchat.com/webhook/gerarToken'
    const costPerQuery = parseFloat(settings.shiftDataCostPerQuery) || 0.07

    // Buscar empresa do usuário
    const { data: empresaLink, error: linkError } = await supabaseAdmin
      .from('empresa_users')
      .select('empresa_id')
      .eq('user_id', user.id)
      .single()

    if (linkError || !empresaLink?.empresa_id) {
      return NextResponse.json({ 
        error: 'Usuário não está vinculado a nenhuma empresa' 
      }, { status: 404 })
    }

    // Verificar saldo da empresa antes da consulta
    const { data: empresaData, error: empresaError } = await supabaseAdmin
      .from('empresa')
      .select('credits')
      .eq('id', empresaLink.empresa_id)
      .single()

    if (empresaError || !empresaData) {
      return NextResponse.json({ 
        error: 'Empresa não encontrada no sistema' 
      }, { status: 404 })
    }

    const currentCredits = parseFloat(empresaData.credits) || 0
    if (currentCredits < costPerQuery) {
      return NextResponse.json({ 
        error: `Saldo insuficiente. Necessário: R$ ${costPerQuery.toFixed(2)} | Disponível: R$ ${currentCredits.toFixed(2)}`,
        requiredCredits: costPerQuery,
        availableCredits: currentCredits
      }, { status: 402 })
    }

    // Buscar token via webhook
    const tokenRes = await fetch(webhookTokenUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    })
    const tokenData = await parseJsonSafe(tokenRes)
    if (!tokenRes.ok) {
      return NextResponse.json({ error: tokenData?.message || tokenData?.error || 'Falha ao obter token' }, { status: 500 })
    }
    const tokenCandidates = [
      tokenData?.token,
      tokenData?.Token,
      tokenData?.access_token,
      tokenData?.accessToken,
      tokenData?.data?.token,
      tokenData?.data?.Token,
      typeof tokenData === 'string' ? tokenData : null
    ]
    let token = tokenCandidates.find(Boolean)
    if (!token) {
      return NextResponse.json({ error: 'Token não encontrado na resposta do webhook' }, { status: 500 })
    }

    // Determinar endpoint
    let cfg
    try { cfg = getApiConfig(type, value) } catch (e) { return NextResponse.json({ error: e.message }, { status: 400 }) }

    // Chamar endpoint com fallbacks de método e payload
    const result = await callShiftDataWithFallbacks(cfg.endpoint, token, cfg.payload)
    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Erro na consulta' }, { status: 502 })
    }

    // Descontar créditos da empresa
    const newCredits = Math.max(0, currentCredits - costPerQuery)
    
    const { error: updateError } = await supabaseAdmin
      .from('empresa')
      .update({ credits: newCredits })
      .eq('id', empresaLink.empresa_id)

    if (updateError) {
      console.error('❌ [Enrich Individual] Erro ao descontar créditos:', updateError)
    } else {
      console.log(`💰 [Enrich Individual] Créditos descontados: Empresa ${empresaLink.empresa_id} | ${currentCredits.toFixed(2)} → ${newCredits.toFixed(2)} (R$ ${costPerQuery.toFixed(2)})`)
    }

    return NextResponse.json({ 
      success: true, 
      type, 
      value, 
      data: result.data,
      cost: costPerQuery
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
