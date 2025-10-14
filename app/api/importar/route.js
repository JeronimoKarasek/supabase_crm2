import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { supabaseAdmin } from '../../../lib/supabase-admin.js'

const storePath = path.join(process.cwd(), '.emergent', 'importar.json')
function ensureDir() { const dir = path.dirname(storePath); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }) }
function readStore() { try { ensureDir(); if (!fs.existsSync(storePath)) return { items: [] }; return JSON.parse(fs.readFileSync(storePath,'utf8')) } catch { return { items: [] } } }
function writeStore(obj) { ensureDir(); fs.writeFileSync(storePath, JSON.stringify(obj, null, 2), 'utf8') }

async function getUserFromRequest(request) {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return null
  const token = auth.split(' ')[1]
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error) return null
  return data?.user || null
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (!lines.length) return []
  const headers = lines[0].split(',').map(h => h.trim())
  return lines.slice(1).map((line) => {
    const cols = line.split(',')
    const obj = {}
    headers.forEach((h, i) => obj[h] = (cols[i] || '').trim())
    return obj
  })
}

export async function GET(request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = new URL(request.url)
  const downloadId = url.searchParams.get('downloadId')
  if (downloadId) {
    // Export from Supabase table 'importar' for this user's lote_id
    const { data, error } = await supabaseAdmin
      .from('importar')
      .select('nome,telefone,cpf,cliente,produto,banco_simulado,lote_id')
      .eq('cliente', user.email)
      .eq('lote_id', downloadId)
      .limit(100000)
    if (error) return NextResponse.json({ error: 'Export failed', details: error.message }, { status: 500 })
    const headers = ['nome','telefone','cpf','cliente','produto','banco_simulado']
    const rows = Array.isArray(data) ? data : []
    const csv = [headers.join(',')].concat(rows.map(r => [r.nome,r.telefone,r.cpf,r.cliente,r.produto,r.banco_simulado].join(','))).join('\n')
    return new NextResponse(csv, { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8' } })
  }
  // List lots for this user
  const { data, error } = await supabaseAdmin
    .from('importar')
    .select('lote_id, produto, banco_simulado, status, created_at')
    .eq('cliente', user.email)
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) return NextResponse.json({ error: 'List failed', details: error.message }, { status: 500 })
  // Reduce to unique lote_id
  const seen = new Set()
  const items = []
  for (const r of (data || [])) {
    if (r.lote_id && !seen.has(r.lote_id)) {
      seen.add(r.lote_id)
      items.push({ id: r.lote_id, produto: r.produto, bancoName: r.banco_simulado, status: r.status || 'pendente' })
    }
  }
  return NextResponse.json({ items })
}

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json()
    const rows = parseCsv(body.csv || '')
    const produto = body.produto || ''
    const bancoKey = body.banco || ''

    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`

    // Map bank key -> bank name from global settings
    let bancoName = bancoKey
    try {
      const gs = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.emergent', 'global_settings.json'), 'utf8'))
      const banks = Array.isArray(gs?.banks) ? gs.banks : []
      const bank = banks.find(b => (b.key === bancoKey))
      if (bank?.name) bancoName = bank.name
    } catch {}

    // Insert into Supabase table 'importar'
    const payload = rows.map(r => ({
      nome: r.nome || '',
      telefone: r.telefone || '',
      cpf: r.cpf || '',
      cliente: user.email,
      produto,
      banco_simulado: bancoName,
      status: 'pendente',
      lote_id: id,
    }))
    if (payload.length > 0) {
      const { error: insErr } = await supabaseAdmin.from('importar').insert(payload)
      if (insErr) return NextResponse.json({ error: 'Insert failed', details: insErr.message }, { status: 500 })
    }

    // Trigger webhook if configured
    try {
      const gs = JSON.parse(fs.readFileSync(path.join(process.cwd(), '.emergent', 'global_settings.json'), 'utf8'))
      const banks = Array.isArray(gs?.banks) ? gs.banks : []
      const bank = banks.find(b => (b.key === bancoKey))
      if (bank?.webhookUrl) {
        // Load user credentials
        const credsStorePath = path.join(process.cwd(), '.emergent', 'credentials.json')
        let creds = {}
        try { creds = JSON.parse(fs.readFileSync(credsStorePath, 'utf8')) } catch {}
        const userCreds = creds?.[user.id]?.[bancoKey] || {}
        // Provide return webhook for completion callback
        const returnWebhook = bank.returnWebhookUrl || `${new URL(request.url).origin}/api/importar/status`
        await fetch(bank.webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credentials: userCreds, itemId: id, returnWebhook }) })
      }
    } catch {}

    // Return updated lots list
    const { data, error } = await supabaseAdmin
      .from('importar')
      .select('lote_id, produto, banco_simulado, status, created_at')
      .eq('cliente', user.email)
      .order('created_at', { ascending: false })
      .limit(1000)
    if (error) return NextResponse.json({ error: 'List failed', details: error.message }, { status: 500 })
    const seen = new Set()
    const items = []
    for (const r of (data || [])) {
      if (r.lote_id && !seen.has(r.lote_id)) {
        seen.add(r.lote_id)
        items.push({ id: r.lote_id, produto: r.produto, bancoName: r.banco_simulado, status: r.status || 'pendente' })
      }
    }
    return NextResponse.json({ items })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}
