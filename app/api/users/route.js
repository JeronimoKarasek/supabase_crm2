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

export async function GET(request) {
  try {
    const caller = await getUserFromRequest(request)
    if (!caller) return unauthorized()
    const role = caller.user_metadata?.role || 'viewer'
    const sectors = Array.isArray(caller.user_metadata?.sectors) && caller.user_metadata.sectors.length > 0 ? caller.user_metadata.sectors : ['Clientes', 'Usuários']
    if (!(role === 'admin' || sectors.includes('Usuários'))) return forbidden('Acesso ao setor Usuários não permitido')

    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 100 })
    if (error) {
      console.error('Error listing users:', error)
      return NextResponse.json({ error: 'Failed to list users', details: error.message }, { status: 500 })
    }
    const users = data?.users?.map(u => ({ id: u.id, email: u.email, user_metadata: u.user_metadata })) || []
    return NextResponse.json({ users })
  } catch (err) {
    console.error('Unexpected error listing users:', err)
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const caller = await getUserFromRequest(request)
    if (!caller) return unauthorized()
    const roleCaller = caller.user_metadata?.role || 'viewer'
    const sectorsCaller = Array.isArray(caller.user_metadata?.sectors) && caller.user_metadata.sectors.length > 0 ? caller.user_metadata.sectors : ['Clientes', 'Usuários']
    if (!(roleCaller === 'admin' || sectorsCaller.includes('Usuários'))) return forbidden('Acesso ao setor Usuários não permitido')

    const body = await request.json()
    const { email, password, role = 'viewer', allowedTables = [], filter = null, filters, filtersByTable, sectors } = body || {}

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 })
    }

    // Normalize filters into filtersByTable dict
    let normalizedFiltersByTable = {}
    if (filtersByTable && typeof filtersByTable === 'object') {
      normalizedFiltersByTable = filtersByTable
    } else if (Array.isArray(filters)) {
      // convert array of {table, column, type, value} to dict
      for (const f of filters) {
        if (!f?.table) continue
        const t = f.table
        normalizedFiltersByTable[t] = normalizedFiltersByTable[t] || []
        normalizedFiltersByTable[t].push({ column: f.column, type: f.type, value: f.value })
      }
    } else if (filter && filter.table) {
      normalizedFiltersByTable[filter.table] = [ { column: filter.column, type: filter.type, value: filter.value } ]
    }

    const sectorsArr = Array.isArray(sectors) ? sectors : (role === 'admin' ? ['Clientes', 'Usuários'] : ['Clientes'])

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { 
        role,
        permissions: {
          allowedTables: Array.isArray(allowedTables) ? allowedTables : [],
          // keep legacy field for backward compatibility, but prefer filtersByTable
          filter: filter ?? null,
          filtersByTable: normalizedFiltersByTable,
        },
        sectors: sectorsArr,
      },
    })

    if (error) {
      console.error('Error creating user:', error)
      return NextResponse.json({ error: 'Falha ao criar usuário', details: error.message }, { status: 400 })
    }

    const user = data?.user ? { id: data.user.id, email: data.user.email, user_metadata: data.user.user_metadata } : null
    return NextResponse.json({ user })
  } catch (err) {
    console.error('Unexpected error creating user:', err)
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const caller = await getUserFromRequest(request)
    if (!caller) return unauthorized()
    const roleCaller = caller.user_metadata?.role || 'viewer'
    const sectorsCaller = Array.isArray(caller.user_metadata?.sectors) && caller.user_metadata.sectors.length > 0 ? caller.user_metadata.sectors : ['Clientes', 'Usuários']
    if (!(roleCaller === 'admin' || sectorsCaller.includes('Usuários'))) return forbidden('Acesso ao setor Usuários não permitido')

    const body = await request.json()
    const { id, role, allowedTables, filter, filters, filtersByTable, sectors } = body || {}

    if (!id) {
      return NextResponse.json({ error: 'ID do usuário é obrigatório' }, { status: 400 })
    }

    // fetch current user to merge metadata
    const { data: getData, error: getErr } = await supabaseAdmin.auth.admin.getUserById(id)
    if (getErr) {
      console.error('Error fetching user before update:', getErr)
      return NextResponse.json({ error: 'Falha ao buscar usuário', details: getErr.message }, { status: 404 })
    }

    const currentMeta = getData?.user?.user_metadata || {}

    // Normalize incoming filters
    let normalizedFiltersByTable = {}
    if (filtersByTable && typeof filtersByTable === 'object') {
      normalizedFiltersByTable = filtersByTable
    } else if (Array.isArray(filters)) {
      for (const f of filters) {
        if (!f?.table) continue
        const t = f.table
        normalizedFiltersByTable[t] = normalizedFiltersByTable[t] || []
        normalizedFiltersByTable[t].push({ column: f.column, type: f.type, value: f.value })
      }
    } else if (filter && filter.table) {
      normalizedFiltersByTable[filter.table] = [ { column: filter.column, type: filter.type, value: filter.value } ]
    } else {
      // if nothing provided, keep existing
      normalizedFiltersByTable = currentMeta?.permissions?.filtersByTable || {}
    }

    const newMeta = {
      ...currentMeta,
      ...(role ? { role } : {}),
      permissions: {
        allowedTables: Array.isArray(allowedTables) ? allowedTables : (currentMeta?.permissions?.allowedTables || []),
        // keep legacy
        filter: filter ?? (currentMeta?.permissions?.filter ?? null),
        filtersByTable: normalizedFiltersByTable,
      },
      ...(Array.isArray(sectors) ? { sectors } : {}),
    }

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, {
      user_metadata: newMeta,
    })

    if (error) {
      console.error('Error updating user:', error)
      return NextResponse.json({ error: 'Falha ao atualizar usuário', details: error.message }, { status: 400 })
    }

    const user = data?.user ? { id: data.user.id, email: data.user.email, user_metadata: data.user.user_metadata } : null
    return NextResponse.json({ user })
  } catch (err) {
    console.error('Unexpected error updating user:', err)
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 })
  }
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
