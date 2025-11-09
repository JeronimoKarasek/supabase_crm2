import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { supabaseAdmin } from '../../../lib/supabase-admin.js'

export const dynamic = 'force-dynamic'

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
  // Robust CSV parser supporting ";" or "," delimiter and quotes
  const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const lines = (text || '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0)
  if (!lines.length) return []
  // Detect delimiter on header
  const headerRaw = lines[0]
  const delim = (headerRaw.match(/;/g)?.length || 0) > (headerRaw.match(/,/g)?.length || 0) ? ';' : ','
  const splitLine = (line) => {
    const out = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i+1] === '"') { cur += '"'; i++; continue }
        inQuotes = !inQuotes
      } else if (ch === delim && !inQuotes) {
        out.push(cur)
        cur = ''
      } else {
        cur += ch
      }
    }
    out.push(cur)
    return out
  }
  const headers = splitLine(headerRaw).map(h => h.trim())
  const rows = []
  for (let idx = 1; idx < lines.length; idx++) {
    const cols = splitLine(lines[idx])
    const obj = {}
    headers.forEach((h, i) => { obj[h] = (cols[i] ?? '').toString().trim() })
    rows.push(obj)
  }
  // Attempt to normalize keys for nome/telefone/cpf/nb
  const headerMap = {}
  headers.forEach((h) => {
    const hn = norm(h).toLowerCase()
    if (hn.includes('nome') && !headerMap.nome) headerMap.nome = h
    if ((hn.includes('telefone') || hn.includes('celular') || hn === 'fone' || hn.includes('phone')) && !headerMap.telefone) headerMap.telefone = h
    if (hn === 'cpf' && !headerMap.cpf) headerMap.cpf = h
    if (hn === 'nb' && !headerMap.nb) headerMap.nb = h
  })
  return rows.map(r => ({
    ...r,
    __nome: headerMap.nome ? r[headerMap.nome] : (r.nome ?? ''),
    __telefone: headerMap.telefone ? r[headerMap.telefone] : (r.telefone ?? ''),
    __cpf: headerMap.cpf ? r[headerMap.cpf] : (r.cpf ?? ''),
    __nb: headerMap.nb ? r[headerMap.nb] : (r.nb ?? ''),
  }))
}

export async function GET(request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = new URL(request.url)
  const downloadId = url.searchParams.get('downloadId')
  if (downloadId) {
    console.log(`📥 Download - Lote: ${downloadId}, User: ${user.email}`)
    
    // Busca TODOS os registros deste lote
    const { data, error } = await supabaseAdmin
      .from('importar')
      .select('*')
      .eq('lote_id', downloadId)
      .eq('cliente', user.email)
    
    if (error) {
      console.error('❌ Erro ao buscar dados:', error)
      return NextResponse.json({ error: 'Export failed', details: error.message }, { status: 500 })
    }
    
    const rows = Array.isArray(data) ? data : []
    console.log(`📊 Total de registros encontrados: ${rows.length}`)
    
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Nenhum dado encontrado para este lote' }, { status: 404 })
    }
    
    // Coleta TODAS as colunas de TODAS as linhas
    const allColumnsSet = new Set()
    for (const row of rows) {
      if (row) Object.keys(row).forEach(k => allColumnsSet.add(k))
    }
    
    // Converte para array mantendo ordem: colunas base primeiro
    const baseColumns = ['id', 'created_at', 'lote_id', 'cliente', 'produto', 'banco_simulado', 
                         'nome', 'telefone', 'cpf', 'nb', 'status', 'consultado']
    const otherColumns = Array.from(allColumnsSet).filter(c => !baseColumns.includes(c))
    const headers = [...baseColumns.filter(c => allColumnsSet.has(c)), ...otherColumns]
    
    console.log(`📊 Total de colunas no CSV: ${headers.length}`)
    console.log(`📋 Colunas: ${headers.join(', ')}`)
    
    // Função para escapar valores CSV
    const esc = (val) => {
      if (val === null || typeof val === 'undefined') return ''
      const s = String(val)
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
      return s
    }
    
    // Monta CSV com TODAS as colunas
    const lines = []
    if (headers.length) {
      lines.push(headers.map(esc).join(','))
    }
    
    for (const row of rows) {
      const line = headers.map((h) => esc(row[h]))
      lines.push(line.join(','))
    }
    
    const csv = lines.join('\n')
    
    console.log(`✅ CSV gerado com sucesso: ${lines.length} linhas (incluindo cabeçalho)`)
    
    return new NextResponse(csv, { 
      status: 200, 
      headers: { 
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="lote_${downloadId}.csv"`
      } 
    })
  }
  
  // List lots (agregação da tabela importar - SEM LIMIT para não desaparecer)
  const { data, error } = await supabaseAdmin
    .from('importar')
    .select('lote_id, produto, banco_simulado, status, created_at')
    .eq('cliente', user.email)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('❌ Erro ao listar lotes:', error)
    return NextResponse.json({ error: 'List failed', details: error.message }, { status: 500 })
  }
  
  const seen = new Set()
  const items = []
  for (const r of (data || [])) {
    if (r.lote_id && !seen.has(r.lote_id)) {
      seen.add(r.lote_id)
      items.push({ 
        id: r.lote_id, 
        produto: r.produto, 
        bancoName: r.banco_simulado, 
        status: r.status || 'pendente', 
        createdAt: r.created_at 
      })
    }
  }
  
  // Compute progress (consultado true/total) per lote_id
  for (const it of items) {
    try {
      const { count: total } = await supabaseAdmin
        .from('importar')
        .select('*', { count: 'exact', head: true })
        .eq('cliente', user.email)
        .eq('lote_id', it.id)
      const { count: done } = await supabaseAdmin
        .from('importar')
        .select('*', { count: 'exact', head: true })
        .eq('cliente', user.email)
        .eq('lote_id', it.id)
        .eq('consultado', true)
      const percent = total ? Math.round(((done || 0) / total) * 100) : 0
      it.progress = { done: done || 0, total: total || 0, percent }
      if (percent === 100 && it.status !== 'concluido') it.status = 'concluido'
    } catch {}
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
    let webhookUrl = null
    try {
      const { data: gsRow } = await supabaseAdmin
        .from('global_settings')
        .select('data')
        .eq('id', 'global')
        .single()
      const banks = Array.isArray(gsRow?.data?.banks) ? gsRow.data.banks : []
      const bank = banks.find(b => (b.key === bancoKey))
      if (bank?.name) bancoName = bank.name
      if (bank?.webhookUrl) webhookUrl = bank.webhookUrl
    } catch {}

    // Insert into Supabase table 'importar'
    const payload = rows.map(r => ({
      nome: (r.__nome ?? r.nome ?? '').toString(),
      telefone: (r.__telefone ?? r.telefone ?? '').toString(),
      cpf: (r.__cpf ?? r.cpf ?? '').toString(),
      nb: (r.__nb ?? r.nb ?? '').toString(),
      cliente: user.email,
      produto,
      banco_simulado: bancoName,
      status: 'pendente',
      lote_id: id,
    }))
    if (payload.length > 0) {
      const { error: insErr } = await supabaseAdmin.from('importar').insert(payload)
      if (insErr) {
        return NextResponse.json({ error: 'Insert failed', details: insErr.message }, { status: 500 })
      }
    }

    // Trigger webhook if configured
    if (webhookUrl) {
      try {
        // Load user credentials from Supabase table
        const { data: credsRows } = await supabaseAdmin
          .from('bank_credentials')
          .select('credentials')
          .eq('user_id', user.id)
          .eq('bank_key', bancoKey)
          .single()
        const userCreds = credsRows?.credentials || {}
        
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            banco: bancoKey,
            produto,
            credentials: userCreds,
            itemId: id,
            email: user.email,
            userId: user.id
          })
        })
      } catch (webhookError) {
        console.error('❌ Erro ao chamar webhook:', webhookError)
        // Não retorna erro para não bloquear criação do lote
      }
    }

    // Return updated lots list (agregação da tabela importar)
    const { data, error } = await supabaseAdmin
      .from('importar')
      .select('lote_id, produto, banco_simulado, status, created_at')
      .eq('cliente', user.email)
      .order('created_at', { ascending: false })
    
    if (error) return NextResponse.json({ error: 'List failed', details: error.message }, { status: 500 })
    
    const seen = new Set()
    const items = []
    for (const r of (data || [])) {
      if (r.lote_id && !seen.has(r.lote_id)) {
        seen.add(r.lote_id)
        items.push({ id: r.lote_id, produto: r.produto, bancoName: r.banco_simulado, status: r.status || 'pendente', createdAt: r.created_at })
      }
    }
    
    // compute progress (consultado true/total) per lote_id
    for (const it of items) {
      try {
        const { count: total } = await supabaseAdmin
          .from('importar')
          .select('*', { count: 'exact', head: true })
          .eq('cliente', user.email)
          .eq('lote_id', it.id)
        const { count: done } = await supabaseAdmin
          .from('importar')
          .select('*', { count: 'exact', head: true })
          .eq('cliente', user.email)
          .eq('lote_id', it.id)
          .eq('consultado', true)
        const percent = total ? Math.round(((done || 0) / total) * 100) : 0
        it.progress = { done: done || 0, total: total || 0, percent }
        if (percent === 100 && it.status !== 'concluido') it.status = 'concluido'
      } catch {}
    }
    
    return NextResponse.json({ items })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}

export async function DELETE(request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json()
    const { id } = body || {}
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    const { error } = await supabaseAdmin
      .from('importar')
      .delete()
      .eq('cliente', user.email)
      .eq('lote_id', id)
    if (error) return NextResponse.json({ error: 'Delete failed', details: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}

export async function PUT(request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json().catch(() => ({}))
    const id = body?.id
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    // Busca informações do lote na tabela importar (primeiro registro do lote_id)
    const { data: loteRows, error: loteErr } = await supabaseAdmin
      .from('importar')
      .select('produto, banco_simulado')
      .eq('lote_id', id)
      .eq('cliente', user.email)
      .limit(1)

    if (loteErr || !loteRows || loteRows.length === 0) {
      return NextResponse.json({ error: 'Lote not found', details: loteErr?.message }, { status: 404 })
    }

    const lote = loteRows[0]
    const bancoKey = lote.banco_simulado

    // Busca configuração do banco
    const { data: gsRow } = await supabaseAdmin
      .from('global_settings')
      .select('data')
      .eq('id', 'global')
      .single()
    
    const banks = Array.isArray(gsRow?.data?.banks) ? gsRow.data.banks : []
    let bank = banks.find(b => b.key === bancoKey)
    if (!bank) bank = banks.find(b => (b.name || '').toLowerCase() === String(bancoKey).toLowerCase())
    
    if (!bank?.webhookUrl) {
      return NextResponse.json({ error: 'Webhook not configured for this bank' }, { status: 400 })
    }

    // Load user credentials using bank key
    const { data: credsRows } = await supabaseAdmin
      .from('bank_credentials')
      .select('credentials')
      .eq('user_id', user.id)
      .eq('bank_key', bank.key)
      .single()
    const userCreds = credsRows?.credentials || {}

    // Fire webhook again (status tracked via importar records)
    await fetch(bank.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        banco: bank.key,
        produto: lote.produto,
        credentials: userCreds,
        itemId: id,
        email: user.email,
        userId: user.id
      })
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}
