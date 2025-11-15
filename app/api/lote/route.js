import { NextResponse } from 'next/server'
import redis from '../../../lib/redis.js'
import { supabaseAdmin } from '../../../lib/supabase-admin.js'
import { getEmpresaForUser } from '../../../lib/empresa.js'

export const dynamic = 'force-dynamic'

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
  const pageParam = url.searchParams.get('page')
  const limitParam = url.searchParams.get('limit')
  const page = Math.max(1, parseInt(pageParam || '1', 10) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(limitParam || '10', 10) || 10))
  if (downloadId) {
    console.log(`📥 Download - Lote: ${downloadId}, User: ${user.email}`)
    // Busca o schema completo da tabela lote_items
    const { data: schemaData, error: schemaError } = await supabaseAdmin
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'lote_items')
      .order('ordinal_position', { ascending: true })

    let allSchemaColumns = []
    if (!schemaError && Array.isArray(schemaData)) {
      allSchemaColumns = schemaData.map(c => c.column_name)
      console.log(`📋 Schema da tabela lote_items: ${allSchemaColumns.length} colunas`)
    } else {
      console.warn('⚠️ Não foi possível buscar schema, usando colunas base')
      // Fallback para colunas base conhecidas
      allSchemaColumns = ['id', 'created_at', 'lote_id', 'cliente', 'produto', 'banco_simulado', 
                          'nome', 'telefone', 'cpf', 'nb', 'status', 'consultado']
    }

    // Busca TODOS os registros deste lote (sem limite - usa paginação interna)
    const rows = []
    const pageSize = 1000
    let from = 0
    let hasMore = true
    
    while (hasMore) {
      const { data, error } = await supabaseAdmin
        .from('lote_items')
        .select('*')
        .eq('lote_id', downloadId)
        .range(from, from + pageSize - 1)

      if (error) {
        console.error('❌ Erro ao buscar dados:', error)
        return NextResponse.json({ error: 'Export failed', details: error.message }, { status: 500 })
      }

      const chunk = Array.isArray(data) ? data : []
      rows.push(...chunk)
      
      if (chunk.length < pageSize) {
        hasMore = false
      } else {
        from += pageSize
      }
    }
    
    console.log(`📊 Total de registros encontrados: ${rows.length}`)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Nenhum dado encontrado para este lote' }, { status: 404 })
    }

    // Coleta colunas extras que não estão no schema (caso existam)
    const allColumnsSet = new Set(allSchemaColumns)
    for (const row of rows) {
      if (row) Object.keys(row).forEach(k => allColumnsSet.add(k))
    }

    // Converte para array mantendo ordem: colunas base primeiro, depois outras do schema, depois extras
    const baseColumns = ['id', 'created_at', 'lote_id', 'cliente', 'produto', 'banco_simulado', 
                         'nome', 'telefone', 'cpf', 'nb', 'status', 'consultado']
    const schemaColumns = allSchemaColumns.filter(c => !baseColumns.includes(c))
    const extraColumns = Array.from(allColumnsSet).filter(c => !allSchemaColumns.includes(c))
    const headers = [
      ...baseColumns.filter(c => allColumnsSet.has(c)),
      ...schemaColumns,
      ...extraColumns
    ]

    console.log(`📊 Total de colunas no CSV: ${headers.length}`)
    console.log(`📋 Colunas: ${headers.join(', ')}`)

    // Função para escapar valores CSV (padrão pt-BR usando ';')
    const esc = (val) => {
      if (val === null || typeof val === 'undefined') return ''
      const s = String(val)
      // Se contém delimitador, aspas ou quebras, envolve em aspas e duplica aspas internas
      if (/[";\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
      return s
    }

    const DELIM = ';'
    // Monta CSV com TODAS as colunas (semicolon) + linha sep=; para Excel
    const lines = []
    if (headers.length) {
      lines.push(headers.map(esc).join(DELIM))
    }
    for (const row of rows) {
      const line = headers.map((h) => esc(row[h]))
      lines.push(line.join(DELIM))
    }
    const csvCore = lines.join('\r\n')
    const BOM = '\uFEFF'
    const finalCsv = BOM + 'sep=;' + '\r\n' + csvCore

    console.log(`✅ CSV gerado com sucesso: ${lines.length} linhas (incluindo cabeçalho) | Delimitador: ${DELIM} | Com BOM e sep=;`)

    return new NextResponse(finalCsv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="lote_${downloadId}.csv"`
      }
    })
  }
  
  // Cleanup diário: remove dados com mais de 7 dias (uma vez a cada 24h)
  try {
    const fired = await redis.setNX('lote:cleanup:daily', 24 * 60 * 60)
    if (fired) {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      console.log(`[Cleanup] Removendo registros de lote_items antes de ${cutoff}`)
      try { await supabaseAdmin.from('lote_items').delete().lt('created_at', cutoff) } catch (e) { console.warn('[Cleanup] Erro ao remover registros antigos:', e?.message) }
    }
  } catch {}

  // List lots paginados no servidor: agrega por lote_id/minuto sem varrer tudo
  const isAdmin = user.email === 'junior.karaseks@gmail.com'
  console.log(`🔍 Buscando lotes para usuário: ${user.email}${isAdmin ? ' (ADMIN - vendo todos)' : ''}`)

  const rawPageSize = 1000 // quantidade de linhas por busca no banco
  const targetStart = (page - 1) * limit
  const targetEnd = targetStart + limit

  let from = 0
  let to = rawPageSize - 1
  let fetched = 0
  let loops = 0
  const seen = new Set()
  const groups = []

  while (groups.length < targetEnd) {
    let query = supabaseAdmin
      .from('lote_items')
      .select('id, lote_id, produto, banco_simulado, status, created_at, consultado, cliente, base_filename')
    if (!isAdmin) query = query.eq('cliente', user.email)
    const { data: chunk, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to)
    if (error) {
      console.error('❌ Erro ao listar lotes (paginado):', error)
      return NextResponse.json({ error: 'List failed', details: error.message }, { status: 500 })
    }
    const chunkLen = chunk?.length || 0
    if (!chunkLen) break
    fetched += chunkLen
    loops += 1

    for (const r of chunk) {
      let loteKey = r.lote_id
      const hasReal = !!(loteKey && String(loteKey).trim() !== '')
      if (!hasReal) {
        const dateObj = new Date(r.created_at)
        const minuto = Math.floor(dateObj.getTime() / 60000)
        loteKey = `temp_${minuto}_${r.produto || '-'}_${r.banco_simulado || '-'}`.replace(/\s+/g, '_')
      }
      if (!seen.has(loteKey)) {
        seen.add(loteKey)
        groups.push({
          id: loteKey,
          originalLoteId: hasReal ? r.lote_id : null,
          produto: r.produto || '-',
          bancoName: r.banco_simulado || '-',
          status: r.status || 'pendente',
          createdAt: r.created_at,
          userEmail: r.cliente || '-',
          count: 1,
          base: hasReal ? (r.base_filename || null) : null,
        })
      }
    }

    if (chunkLen < rawPageSize) break // chegou ao fim
    from += rawPageSize
    to += rawPageSize
    if (loops >= 50) break // guarda-chuva de segurança
  }

  const pageItems = groups.slice(targetStart, targetEnd)

  // Enriquecer progresso apenas para os itens desta página
  for (const it of pageItems) {
    try {
      if (it.originalLoteId) {
        const loteOwnerEmail = it.userEmail || user.email
        const { count: total } = await supabaseAdmin
          .from('lote_items')
          .select('*', { count: 'exact', head: true })
          .eq('cliente', loteOwnerEmail)
          .eq('lote_id', it.originalLoteId)
        const { count: done } = await supabaseAdmin
          .from('lote_items')
          .select('*', { count: 'exact', head: true })
          .eq('cliente', loteOwnerEmail)
          .eq('lote_id', it.originalLoteId)
          .eq('consultado', true)
        const percent = total ? Math.round(((done || 0) / total) * 100) : 0
        it.progress = { done: done || 0, total: total || 0, percent }
        if (percent === 100 && it.status !== 'concluido') it.status = 'concluido'
      } else {
        it.progress = { done: 0, total: it.count || 0, percent: 0 }
      }
    } catch {}
  }

  const hasMore = groups.length > targetEnd
  console.log(`📦 Página ${page} | Lotes retornados: ${pageItems.length} | hasMore=${hasMore}`)
  return NextResponse.json({ items: pageItems, page, limit, hasMore })
}

export async function POST(request) {
  console.log('[Lote POST] Iniciando requisição...')
  try {
    const user = await getUserFromRequest(request)
    console.log('[Lote POST] User autenticado:', user?.email || 'null')
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    // Parse body com fallback para texto bruto (caso não seja application/json)
    let body
    const contentType = request.headers.get('content-type') || ''
    console.log('[Lote POST] Content-Type:', contentType)
    
    try {
      body = await request.json()
      console.log('[Lote POST] Body parseado via json():', { hasBody: !!body, keys: body ? Object.keys(body) : [] })
    } catch (jsonErr) {
      console.log('[Lote POST] Falha ao parsear json(), tentando text():', jsonErr.message)
      try {
        const raw = await request.text()
        console.log('[Lote POST] Raw text length:', raw?.length || 0)
        body = JSON.parse(raw)
        console.log('[Lote POST] Body parseado via text():', { hasBody: !!body, keys: body ? Object.keys(body) : [] })
      } catch (e) {
        console.error('[Lote POST] Falha total ao parsear body:', e.message)
        return NextResponse.json({ error: 'Payload deve ser JSON', hint: 'Envie Content-Type: application/json', required: ['csv','produto','banco'], debug: e.message }, { status: 400 })
      }
    }
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Corpo inválido', required: ['csv','produto','banco'] }, { status: 400 })
    }
    const rows = parseCsv(body.csv || '')
    const produto = body.produto || ''
    const bancoKey = body.banco || ''
    const bankUserIds = Array.isArray(body.bankUserIds) ? body.bankUserIds.filter(id => typeof id === 'string') : []

    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`
  const fileName = (body.fileName || '').toString().trim() || null

    // Valida campos obrigatórios
    const problems = []
    if (!body.csv || typeof body.csv !== 'string' || !body.csv.trim()) problems.push('csv')
    if (!produto) problems.push('produto')
    if (!bancoKey) problems.push('banco')
    if (problems.length) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes', missing: problems }, { status: 400 })
    }

    console.info(`[Lote] Recebido payload: banco=${bancoKey} produto=${produto} csvLen=${body.csv.length} fileName=${fileName || 'N/A'} users=${bankUserIds.length}`)

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

    // Insert into Supabase table 'lote_items'
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
      base_filename: fileName,
    }))
  if (payload.length > 0) {
      const { error: insErr } = await supabaseAdmin.from('lote_items').insert(payload)
      if (insErr) {
        return NextResponse.json({ error: 'Insert failed', details: insErr.message }, { status: 500 })
      }
    }

    // Trigger webhook if configured
    if (webhookUrl) {
      try {
        // Multi-user credentials list (if provided)
        let credentialsList = []
        if (bankUserIds.length) {
          console.info(`[Lote] Buscando credenciais: user=${user.id} banco=${bancoKey} ids=[${bankUserIds.join(', ')}]`)
          const { data: multiRows, error: credErr } = await supabaseAdmin
            .from('bank_user_credentials')
            .select('id, alias, credentials')
            .eq('user_id', user.id)
            .eq('bank_key', bancoKey)
            .in('id', bankUserIds)
          if (credErr) {
            console.error(`[Lote] Erro ao buscar credenciais:`, credErr)
          }
          if (Array.isArray(multiRows)) {
            credentialsList = multiRows.map(r => ({ id: r.id, alias: r.alias, credentials: r.credentials || {} }))
            console.info(`[Lote] Credenciais encontradas: ${credentialsList.length} de ${bankUserIds.length} solicitados`)
          }
        }
        // Empresa (nome)
        let empresaName = null
        try {
          const { empresaId } = await getEmpresaForUser(user.id)
          if (empresaId) {
            const { data: emp } = await supabaseAdmin.from('empresa').select('name').eq('id', empresaId).single()
            empresaName = emp?.name || null
          }
        } catch {}

        const webhookPayload = {
          banco: bancoKey,
          nomeBanco: bancoName,
          produto,
          credencialList: credentialsList,
          itemId: id,
          email: user.email,
          userId: user.id,
          userName: user.user_metadata?.nome || null,
          empresaName
        }
        
        // Log payload (mascarando senhas)
        const safePayload = {
          ...webhookPayload,
          credencialList: credentialsList.map(c => ({ ...c, credentials: Object.keys(c.credentials || {}).reduce((acc, k) => ({ ...acc, [k]: k.toLowerCase().includes('senha') ? '***' : c.credentials[k] }), {}) }))
        }
        console.info(`[Lote] Enviando webhook para ${webhookUrl}:`, JSON.stringify(safePayload, null, 2))
        
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookPayload)
        })
      } catch (webhookError) {
        console.error('❌ Erro ao chamar webhook:', webhookError)
        // Não retorna erro para não bloquear criação do lote
      }
    }

    // Return updated lots list (agregação da tabela importar)
    // Admin (junior.karaseks@gmail.com) vê todos os lotes
    const isAdmin = user.email === 'junior.karaseks@gmail.com'
    let query = supabaseAdmin
      .from('lote_items')
      .select('lote_id, produto, banco_simulado, status, created_at, cliente, base_filename')
    
    if (!isAdmin) {
      query = query.eq('cliente', user.email)
    }
    
    const { data, error } = await query.order('created_at', { ascending: false })
    
    if (error) return NextResponse.json({ error: 'List failed', details: error.message }, { status: 500 })
    
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
          createdAt: r.created_at,
          userEmail: r.cliente, // Email do usuário que criou o lote
          base: r.base_filename || null
        })
      }
    }
    
    // compute progress (consultado true/total) per lote_id
    for (const it of items) {
      try {
        const { count: total } = await supabaseAdmin
          .from('lote_items')
          .select('*', { count: 'exact', head: true })
          .eq('cliente', it.userEmail)
          .eq('lote_id', it.id)
        const { count: con } = await supabaseAdmin
          .from('lote_items')
          .select('*', { count: 'exact', head: true })
          .eq('cliente', it.userEmail)
          .eq('lote_id', it.id)
          .eq('consultado', true)
        const percent = total ? Math.round(((con || 0) / total) * 100) : 0
        it.progress = { done: con || 0, total: total || 0, percent }
        if (percent === 100 && it.status !== 'concluido') it.status = 'concluido'
      } catch {}
    }
    
    console.log('[Lote POST] ✅ Sucesso! Lote criado:', id)
    return NextResponse.json({ items })
  } catch (e) {
    console.error('[Lote POST] ❌ Erro:', e)
    return NextResponse.json({ 
      error: 'POST failed', 
      details: e.message, 
      stack: process.env.NODE_ENV === 'development' ? e.stack : undefined 
    }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json()
    const { id } = body || {}
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    const { error} = await supabaseAdmin
      .from('lote_items')
      .delete()
      .eq('cliente', user.email)
      .eq('lote_id', id)
    if (error) return NextResponse.json({ error: 'Delete failed', details: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Request failed', details: e.message }, { status: 400 })
  }
}

export async function PUT(request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json().catch(() => ({}))
    const id = body?.id
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    // Deduplicação: evita disparar duas vezes para o mesmo clique
    try {
      const key = `importar:reprocess:${user.id}:${id}`
      const first = await redis.setNX(key, 15) // 15s de janela
      if (!first) {
        return NextResponse.json({ ok: true, dedup: true })
      }
    } catch {}

    // Busca informações do lote na tabela lote_items (primeiro registro do lote_id)
    const { data: loteRows, error: loteErr } = await supabaseAdmin
      .from('lote_items')
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

    // Multi-user credentials list (fallback ao default)
    let credentialsList = []
    try {
      const { data: defRows } = await supabaseAdmin
        .from('bank_user_credentials')
        .select('id, alias, credentials, is_default')
        .eq('user_id', user.id)
        .eq('bank_key', bank.key)
        .eq('is_default', true)
        .limit(1)
      if (Array.isArray(defRows) && defRows.length) {
        credentialsList = defRows.map(r => ({ id: r.id, alias: r.alias, credentials: r.credentials || {} }))
      }
    } catch {}

    // Empresa (nome)
    let empresaName = null
    try {
      const { empresaId } = await getEmpresaForUser(user.id)
      if (empresaId) {
        const { data: emp } = await supabaseAdmin.from('empresa').select('name').eq('id', empresaId).single()
        empresaName = emp?.name || null
      }
    } catch {}

    // Fire webhook again (status tracked via lote_items records)
    await fetch(bank.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        banco: bank.key,
        nomeBanco: bank.name,
        produto: lote.produto,
        credencialList: credentialsList,
        itemId: id,
        email: user.email,
        userId: user.id,
        empresaName
      })
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Request failed', details: e.message }, { status: 400 })
  }
}

