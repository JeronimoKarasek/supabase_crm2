import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase-admin.js'

function unauthorized(msg = 'Unauthorized') {
  return NextResponse.json({ error: msg }, { status: 401 })
}

function forbidden(msg = 'Forbidden') {
  return NextResponse.json({ error: msg }, { status: 403 })
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

function applyFilterToQuery(query, filter) {
  const { column, type, value } = filter || {}
  if (!column || typeof value === 'undefined' || value === null) return query
  switch (type) {
    case 'contains':
      return query.ilike(column, `%${value}%`)
    case 'equals':
      return query.eq(column, value)
    case 'greaterThan':
      return query.gt(column, value)
    case 'lessThan':
      return query.lt(column, value)
    case 'greaterThanOrEqual':
      return query.gte(column, value)
    case 'lessThanOrEqual':
      return query.lte(column, value)
    default:
      return query
  }
}

export async function GET(request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return unauthorized()
    const meta = user.user_metadata || {}
    const role = meta.role || 'viewer'
    const sectors = Array.isArray(meta.sectors) && meta.sectors.length > 0 ? meta.sectors : ['Clientes', 'Usuários', 'Dashboard']
    const perms = meta.permissions || {}
    const allowedTables = Array.isArray(perms.allowedTables) ? perms.allowedTables : []
    const filtersByTable = perms.filtersByTable || {}

    const { searchParams } = new URL(request.url)
    const table = searchParams.get('table')
    const sumColumn = searchParams.get('sumColumn')
    const condColumn = searchParams.get('condColumn')
    const condType = searchParams.get('condType') || 'contains'
    const condValue = searchParams.get('condValue') || ''
    const maxRows = Math.min(parseInt(searchParams.get('maxRows') || '100000', 10) || 100000, 200000)
    const periodStart = searchParams.get('periodStart')
    const periodEnd = searchParams.get('periodEnd')
    const dateColumn = searchParams.get('dateColumn') || 'horario da ultima resposta'

    if (!table || !sumColumn) {
      return NextResponse.json({ error: 'Missing table or sumColumn' }, { status: 400 })
    }

    if (role !== 'admin') {
      if (!(sectors.includes('Clientes') || sectors.includes('Dashboard'))) return forbidden('Setor sem permissão')
      if (!allowedTables.includes(table)) {
        if (!((sectors || []).includes('Usuários') && (!allowedTables || allowedTables.length === 0))) {
          return forbidden('Tabela não permitida')
        }
      }
    }

    let total = 0
    const parseMoney = (val) => {
      if (typeof val === 'number') return val
      if (val === null || typeof val === 'undefined') return 0
      const s = String(val).trim()
      if (!s) return 0
      const cleaned = s
        .replace(/\./g, '')   // remove thousand separators
        .replace(/,/g, '.')    // decimal comma -> dot
        .replace(/[^0-9.\-]/g, '')
      const n = parseFloat(cleaned)
      return isNaN(n) ? 0 : n
    }
    const pageSize = 1000
    for (let offset = 0; offset < maxRows; offset += pageSize) {
      let query = supabaseAdmin.from(table).select(`${sumColumn}`, { count: 'exact' })
      if (condColumn && condValue) {
        query = applyFilterToQuery(query, { column: condColumn, type: condType, value: condValue })
      }
      if (periodStart && dateColumn) query = query.gte(dateColumn, periodStart)
      if (periodEnd && dateColumn) query = query.lte(dateColumn, periodEnd)
      const requiredFilters = Array.isArray(filtersByTable[table]) ? filtersByTable[table] : []
      for (const rf of requiredFilters) query = applyFilterToQuery(query, rf)
      query = query.range(offset, offset + pageSize - 1)
      const { data, error } = await query
      if (error) return NextResponse.json({ error: 'Aggregate failed', details: error.message }, { status: 500 })
      const rows = Array.isArray(data) ? data : []
      for (const r of rows) {
        const v = parseMoney(r[sumColumn])
        total += v
      }
      if (rows.length < pageSize) break
    }

    return NextResponse.json({ total })
  } catch (e) {
    console.error('Aggregate error', e)
    return NextResponse.json({ error: 'Internal server error', details: e.message }, { status: 500 })
  }
}
