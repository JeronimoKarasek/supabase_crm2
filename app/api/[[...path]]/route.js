import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase.js'

export async function GET(request) {
  const { searchParams, pathname } = new URL(request.url)
  const path = pathname.replace('/api/', '')

  try {
    // Get list of all tables
    if (path === 'tables') {
      const { data, error } = await supabaseAdmin
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .neq('table_name', 'spatial_ref_sys') // Exclude PostGIS table

      if (error) {
        // Fallback: try alternative method using raw SQL
        const { data: tablesData, error: sqlError } = await supabaseAdmin.rpc('get_tables')
        
        if (sqlError) {
          console.error('Error fetching tables:', sqlError)
          return NextResponse.json({ error: 'Failed to fetch tables', details: sqlError.message }, { status: 500 })
        }
        
        return NextResponse.json({ tables: tablesData || [] })
      }

      const tables = data?.map(t => t.table_name) || []
      return NextResponse.json({ tables })
    }

    // Get data from a specific table with optional filters
    if (path === 'table-data') {
      const tableName = searchParams.get('table')
      const filterColumn = searchParams.get('filterColumn')
      const filterValue = searchParams.get('filterValue')
      const filterType = searchParams.get('filterType') || 'contains'

      if (!tableName) {
        return NextResponse.json({ error: 'Table name is required' }, { status: 400 })
      }

      let query = supabaseAdmin.from(tableName).select('*')

      // Apply filters if provided
      if (filterColumn && filterValue) {
        switch (filterType) {
          case 'contains':
            query = query.ilike(filterColumn, `%${filterValue}%`)
            break
          case 'equals':
            query = query.eq(filterColumn, filterValue)
            break
          case 'greaterThan':
            query = query.gt(filterColumn, filterValue)
            break
          case 'lessThan':
            query = query.lt(filterColumn, filterValue)
            break
          case 'greaterThanOrEqual':
            query = query.gte(filterColumn, filterValue)
            break
          case 'lessThanOrEqual':
            query = query.lte(filterColumn, filterValue)
            break
        }
      }

      // Limit to 1000 rows for performance
      query = query.limit(1000)

      const { data, error } = await query

      if (error) {
        console.error('Error fetching table data:', error)
        return NextResponse.json({ error: 'Failed to fetch table data', details: error.message }, { status: 500 })
      }

      return NextResponse.json({ data: data || [] })
    }

    // Get columns for a specific table
    if (path === 'table-columns') {
      const tableName = searchParams.get('table')

      if (!tableName) {
        return NextResponse.json({ error: 'Table name is required' }, { status: 400 })
      }

      const { data, error } = await supabaseAdmin
        .from('information_schema.columns')
        .select('column_name, data_type')
        .eq('table_schema', 'public')
        .eq('table_name', tableName)
        .order('ordinal_position')

      if (error) {
        console.error('Error fetching columns:', error)
        return NextResponse.json({ error: 'Failed to fetch columns', details: error.message }, { status: 500 })
      }

      return NextResponse.json({ columns: data || [] })
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