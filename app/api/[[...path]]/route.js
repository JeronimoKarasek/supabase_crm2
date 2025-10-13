import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase.js'

export async function GET(request) {
  const { searchParams, pathname } = new URL(request.url)
  const path = pathname.replace('/api/', '')

  try {
    // Get list of all tables
    if (path === 'tables') {
      try {
        // First try the information_schema approach
        const { data, error } = await supabaseAdmin
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public')
          .neq('table_name', 'spatial_ref_sys') // Exclude PostGIS table

        if (!error && data) {
          const tables = data?.map(t => t.table_name) || []
          return NextResponse.json({ tables })
        }

        // If information_schema fails, try to get tables by attempting to query common table names
        // or use a different approach
        console.log('Information schema query failed, trying alternative approach:', error)
        
        // Try to use the suggested RPC function if it exists
        const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('rpc_list_crm_tables')
        
        if (!rpcError && rpcData) {
          return NextResponse.json({ tables: rpcData || [] })
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