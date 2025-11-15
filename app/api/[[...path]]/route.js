import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin.js'

export const dynamic = 'force-dynamic'

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
  if (!column) return query
  
  // Para isBlank e isNotBlank, não precisa de valor
  if (type === 'isBlank') {
    return query.or(`${column}.is.null,${column}.eq.`)
  }
  if (type === 'isNotBlank') {
    return query.not(column, 'is', null).neq(column, '')
  }
  
  // Para outros tipos, precisa de valor
  if (typeof value === 'undefined' || value === null) return query
  
  switch (type) {
    case 'contains':
      return query.ilike(column, `%${value}%`)
    case 'notContains':
      return query.not(column, 'ilike', `%${value}%`)
    case 'equals':
      return query.eq(column, value)
    case 'notEquals':
      return query.neq(column, value)
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
  const { searchParams, pathname } = new URL(request.url)
  const path = pathname.replace('/api/', '')

  try {
    // Identify user for authorization
    const user = await getUserFromRequest(request)
    if (!user) return unauthorized()
    const meta = user.user_metadata || {}
    const role = meta.role || 'viewer'
    const sectors = Array.isArray(meta.sectors) && meta.sectors.length > 0 ? meta.sectors : ['Clientes', 'Usuários']
    const perms = meta.permissions || {}
    const allowedTables = Array.isArray(perms.allowedTables) ? perms.allowedTables : []
    const filtersByTable = perms.filtersByTable || {}

    // Get list of all tables
    if (path === 'tables') {
      // Require Clientes, Dashboard or Usuários sector
      if (role !== 'admin' && !(sectors.includes('Clientes') || sectors.includes('Dashboard') || sectors.includes('Usuários'))) {
        return forbidden('Acesso ao setor Clientes não permitido')
      }

      // If not admin, return only allowed tables
      if (role !== 'admin') {
        // Bootstrap: if caller tem setor Usuários e ainda não configurou allowedTables, permita listar todas para configurar
        if ((sectors || []).includes('Usuários') && (!allowedTables || allowedTables.length === 0)) {
          // continue para consultar todas
        } else {
          return NextResponse.json({ tables: allowedTables })
        }
      }

      try {
        // First try the information_schema approach
        const { data, error } = await supabaseAdmin
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public')
          .neq('table_name', 'spatial_ref_sys') // Exclude PostGIS table

        if (!error && data) {
          let tables = data?.map(t => t.table_name) || []
          // If non-admin, intersect with allowedTables to be safe
          if (role !== 'admin') {
            tables = tables.filter(t => allowedTables.includes(t))
          }
          return NextResponse.json({ tables })
        }

        // If information_schema fails, try to get tables by attempting to query common table names
        // or use a different approach
        console.log('Information schema query failed, trying alternative approach:', error)
        
        // Try to use the suggested RPC function if it exists
        const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('rpc_list_crm_tables')
        
        if (!rpcError && rpcData) {
          const t = rpcData || []
          const names = t.map(x => (typeof x === 'string' ? x : x.table_name || x))
          const safe = role === 'admin'
            ? names
            : ((sectors || []).includes('Usuários') && (!allowedTables || allowedTables.length === 0))
              ? names
              : names.filter(n => allowedTables.includes(n))
          return NextResponse.json({ tables: safe })
        }

        // If both methods fail, return an empty array with a warning
        console.log('Both table listing methods failed. RPC error:', rpcError)
        return NextResponse.json({ 
          tables: [], 
          warning: 'Could not fetch table list. This might be due to database permissions or configuration.' 
        })

      } catch (err) {
        console.error('Unexpected error fetching tables:', err)
        return NextResponse.json({ error: 'Failed to fetch tables', details: err.message }, { status: 500 })
      }
    }

    // Get data from a specific table with optional filters
    if (path === 'table-data') {
      const tableName = searchParams.get('table')
      const filterColumn = searchParams.get('filterColumn')
      const filterValue = searchParams.get('filterValue')
      const filterType = searchParams.get('filterType') || 'contains'
      // Optional multiple filters as JSON array passed via `filters`
      let multiFilters = []
      const filtersParam = searchParams.get('filters')
      if (filtersParam) {
        try {
          const parsed = JSON.parse(filtersParam)
          if (Array.isArray(parsed)) {
            multiFilters = parsed.filter(f => f && f.column && typeof f.value !== 'undefined')
          }
        } catch {}
      }
      const periodStart = searchParams.get('periodStart')
      const periodEnd = searchParams.get('periodEnd')
      const dateColumn = searchParams.get('dateColumn') || 'horario da ultima resposta'
      const pageParam = parseInt(searchParams.get('page') || '1', 10)
      const pageSizeParam = parseInt(searchParams.get('pageSize') || '100', 10)
      const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam
      const pageSize = isNaN(pageSizeParam) || pageSizeParam < 1 ? 100 : Math.min(pageSizeParam, 100)

      if (!tableName) {
        return NextResponse.json({ error: 'Table name is required' }, { status: 400 })
      }

      // Require Clientes or Dashboard sector and table permission for non-admins
      // Admin bypasses all permission checks
      if (role !== 'admin') {
        if (!(sectors.includes('Clientes') || sectors.includes('Dashboard') || sectors.includes('Usuários'))) return forbidden('Acesso ao setor Clientes não permitido')
        if (!allowedTables.includes(tableName)) {
          // Permitir se ainda não configurou allowedTables e tem setor Usuários (para bootstrap/configuração)
          if (!((sectors || []).includes('Usuários') && (!allowedTables || allowedTables.length === 0))) {
            return forbidden('Tabela não permitida')
          }
        }
      }

      console.log(`[table-data] Fetching from table: "${tableName}", role: ${role}, page: ${page}`)
      
      let query = supabaseAdmin.from(tableName).select('*', { count: 'exact' })

      // Apply filters if provided (single)
      if (filterColumn && filterValue) {
        query = applyFilterToQuery(query, { column: filterColumn, type: filterType, value: filterValue })
      }
      // Apply multiple filters if provided
      if (multiFilters.length > 0) {
        for (const f of multiFilters) {
          query = applyFilterToQuery(query, { column: f.column, type: f.type || 'contains', value: f.value })
        }
      }

      // Period filter (if provided)
      if (periodStart && dateColumn) query = query.gte(dateColumn, periodStart)
      if (periodEnd && dateColumn) query = query.lte(dateColumn, periodEnd)

      // Enforce user-required filters (only for non-admins)
      if (role !== 'admin') {
        const requiredFilters = Array.isArray(filtersByTable[tableName]) ? filtersByTable[tableName] : []
        for (const rf of requiredFilters) {
          query = applyFilterToQuery(query, rf)
        }
      }

      // Pagination via range
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) {
        console.error(`[table-data] Error fetching from "${tableName}":`, error)
        return NextResponse.json({ error: 'Failed to fetch table data', details: error.message, table: tableName }, { status: 500 })
      }
      
      console.log(`[table-data] Success: ${data?.length || 0} rows from "${tableName}"`)

      const total = count ?? (data?.length || 0)
      const totalPages = Math.max(1, Math.ceil(total / pageSize))
      return NextResponse.json({ data: data || [], page, pageSize, count: total, totalPages })
    }

    // Get columns for a specific table
    if (path === 'table-columns') {
      const tableName = searchParams.get('table')

      if (!tableName) {
        return NextResponse.json({ error: 'Table name is required' }, { status: 400 })
      }

      if (role !== 'admin') {
        if (!(sectors.includes('Clientes') || sectors.includes('Dashboard') || sectors.includes('Usuários'))) return forbidden('Acesso ao setor Clientes não permitido')
        if (!allowedTables.includes(tableName)) {
          if (!((sectors || []).includes('Usuários') && (!allowedTables || allowedTables.length === 0))) {
            return forbidden('Tabela não permitida')
          }
        }
      }

      try {
        // First try information_schema approach
        const { data, error } = await supabaseAdmin
          .from('information_schema.columns')
          .select('column_name, data_type')
          .eq('table_schema', 'public')
          .eq('table_name', tableName)
          .order('ordinal_position')

        if (!error && data) {
          return NextResponse.json({ columns: data || [] })
        }

        console.log('Information schema columns query failed, trying alternative approach:', error)

        // Alternative approach: Try to get a sample row and extract column names
        const { data: sampleData, error: sampleError } = await supabaseAdmin
          .from(tableName)
          .select('*')
          .limit(1)

        if (sampleError) {
          console.error('Error fetching sample data for columns:', sampleError)
          return NextResponse.json({ error: 'Failed to fetch columns', details: sampleError.message }, { status: 500 })
        }

        // Extract column names from the sample data
        const columns = sampleData && sampleData.length > 0 
          ? Object.keys(sampleData[0]).map(key => ({
              column_name: key,
              data_type: typeof sampleData[0][key] === 'number' ? 'numeric' : 'text'
            }))
          : []

        return NextResponse.json({ columns })

      } catch (err) {
        console.error('Unexpected error fetching columns:', err)
        return NextResponse.json({ error: 'Failed to fetch columns', details: err.message }, { status: 500 })
      }
    }

    return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export async function PUT(request) {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export async function DELETE(request) {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
