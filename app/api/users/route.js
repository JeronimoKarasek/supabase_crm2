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

async function getCallerEmpresaId(userId) {
  const { data: link } = await supabaseAdmin.from('empresa_users').select('empresa_id').eq('user_id', userId).single()
  return link?.empresa_id || null
}

async function checkEmpresaUserLimit(empresaId) {
  if (!empresaId) return { allowed: true, count: 0, limit: Infinity }
  // get limit
  const { data: emp, error: empErr } = await supabaseAdmin.from('empresa').select('user_limit').eq('id', empresaId).single()
  if (empErr || !emp) return { allowed: false, count: 0, limit: 0, error: 'Empresa não encontrada' }
  const limit = Number(emp.user_limit) || 1
  // count current users in empresa
  const { count, error: cntErr } = await supabaseAdmin
    .from('empresa_users')
    .select('*', { count: 'exact', head: true })
    .eq('empresa_id', empresaId)
  if (cntErr) return { allowed: false, count: 0, limit, error: 'Falha ao contar usuários' }
  const allowed = (count || 0) < limit
  return { allowed, count: count || 0, limit }
}

export async function GET(request) {
  try {
    const caller = await getUserFromRequest(request)
    if (!caller) return unauthorized()
    const role = caller.user_metadata?.role || 'user'
    // Hierarquia:
    // admin -> todos os usuários
    // gestor -> somente usuários da mesma empresa
    // user   -> apenas ele mesmo

    // Garantir promoção se estiver em adminEmails
    try {
      const { data: gsRow } = await supabaseAdmin.from('global_settings').select('data').eq('id','global').single()
      const adminEmails = gsRow?.data?.adminEmails || []
      if (adminEmails.includes(caller.email) && role !== 'admin') {
        await supabaseAdmin.auth.admin.updateUserById(caller.id, { user_metadata: { ...caller.user_metadata, role: 'admin' } })
      }
    } catch {}

    if (role === 'admin') {
      // Admin: listar todos
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 500 })
      if (error) {
        console.error('Error listing users:', error)
        return NextResponse.json({ error: 'Failed to list users', details: error.message }, { status: 500 })
      }
      const users = data?.users?.map(u => ({ id: u.id, email: u.email, user_metadata: u.user_metadata })) || []
      return NextResponse.json({ users })
    }

    if (role === 'gestor') {
      // Gestor: obter empresa do caller
      const { data: link, error: linkErr } = await supabaseAdmin.from('empresa_users').select('empresa_id').eq('user_id', caller.id).single()
      if (linkErr || !link?.empresa_id) {
        return NextResponse.json({ users: [] })
      }
      const empresaId = link.empresa_id
      const { data: rels, error: usersRelErr } = await supabaseAdmin.from('empresa_users').select('user_id').eq('empresa_id', empresaId)
      if (usersRelErr) return NextResponse.json({ users: [] })
      const ids = (rels || []).map(r => r.user_id)
      const out = []
      for (const id of ids) {
        try {
          const { data: udata, error: uerr } = await supabaseAdmin.auth.admin.getUserById(id)
          if (!uerr && udata?.user) {
            out.push({ id: udata.user.id, email: udata.user.email, user_metadata: udata.user.user_metadata })
          }
        } catch {}
      }
      return NextResponse.json({ users: out })
    }

    // user comum: retorna apenas ele mesmo
    return NextResponse.json({ users: [ { id: caller.id, email: caller.email, user_metadata: caller.user_metadata } ] })
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
  const { email, password, role = 'viewer', allowedTables = [], filter = null, filters, filtersByTable, sectors, empresaId } = body || {}

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

    // Restrição: gestores não podem criar admin
    if (roleCaller !== 'admin' && role === 'admin') {
      return forbidden('Gestor não pode criar usuário admin')
    }

    // Validar setores: gestores não podem liberar setores que não possuem
    if (roleCaller !== 'admin' && Array.isArray(sectors) && sectors.length > 0) {
      const invalid = sectors.filter(s => !(sectorsCaller || []).includes(s))
      if (invalid.length) {
        return forbidden(`Gestor não pode liberar setores: ${invalid.join(', ')}`)
      }
    }

    const sectorsArr = Array.isArray(sectors) ? (roleCaller === 'admin' ? sectors : sectors.filter(s => (sectorsCaller || []).includes(s))) : (role === 'admin' ? ['Clientes', 'Usuários'] : ['Clientes'])

    // Enforce empresa user_limit if empresaId provided
    if (empresaId) {
      // If not admin, force empresaId to caller's empresa
      if (roleCaller !== 'admin') {
        const callerEmp = await getCallerEmpresaId(caller.id)
        if (!callerEmp || callerEmp !== empresaId) return forbidden('Gestor só pode criar usuários para sua própria empresa')
      }
      const limitInfo = await checkEmpresaUserLimit(empresaId)
      if (!limitInfo.allowed) {
        return forbidden(`Limite de usuários da empresa atingido (${limitInfo.count}/${limitInfo.limit})`)
      }
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { 
        role,
        ...(empresaId ? { empresaId } : {}),
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

    // Vincular empresa ao usuário (empresa_users)
    if (user && empresaId) {
      try {
        await supabaseAdmin.from('empresa_users').upsert({ user_id: user.id, empresa_id: empresaId, role: role || 'user' }, { onConflict: 'user_id' })
      } catch (e) {
        console.error('Falha ao vincular empresa ao usuário:', e)
      }
    }
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
  const { id, role, allowedTables, filter, filters, filtersByTable, sectors, password, empresaId } = body || {}

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

    // Restrição: gestores não podem promover a admin
    if (roleCaller !== 'admin' && role === 'admin') {
      return forbidden('Gestor não pode promover usuário a admin')
    }

    // Validar setores: gestores não podem liberar setores que não possuem
    if (roleCaller !== 'admin' && Array.isArray(sectors) && sectors.length > 0) {
      const invalid = sectors.filter(s => !(sectorsCaller || []).includes(s))
      if (invalid.length) {
        return forbidden(`Gestor não pode liberar setores: ${invalid.join(', ')}`)
      }
    }

    const newMeta = {
      ...currentMeta,
      ...(role ? { role } : {}),
      ...(empresaId ? { empresaId } : {}),
      permissions: {
        allowedTables: Array.isArray(allowedTables) ? allowedTables : (currentMeta?.permissions?.allowedTables || []),
        // keep legacy
        filter: filter ?? (currentMeta?.permissions?.filter ?? null),
        filtersByTable: normalizedFiltersByTable,
      },
      ...(Array.isArray(sectors) ? { sectors: (roleCaller === 'admin' ? sectors : sectors.filter(s => (sectorsCaller || []).includes(s))) } : {}),
    }

    const updatePayload = { user_metadata: newMeta }
    if (typeof password === 'string' && password.length >= 8) {
      updatePayload.password = password
    }
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(id, updatePayload)

    if (error) {
      console.error('Error updating user:', error)
      return NextResponse.json({ error: 'Falha ao atualizar usuário', details: error.message }, { status: 400 })
    }

    const user = data?.user ? { id: data.user.id, email: data.user.email, user_metadata: data.user.user_metadata } : null

    // Atualizar vínculo empresa_users se fornecido
    if (user && (empresaId !== undefined)) {
      try {
        if (empresaId) {
          // If not admin, restrict to caller's empresa
          if (roleCaller !== 'admin') {
            const callerEmp = await getCallerEmpresaId(caller.id)
            if (!callerEmp || callerEmp !== empresaId) return forbidden('Gestor só pode mover usuários para sua própria empresa')
          }
          // Check if changing empresa increases usage; enforce limit
          const { data: currentLink } = await supabaseAdmin.from('empresa_users').select('empresa_id').eq('user_id', user.id).single()
          const currentEmp = currentLink?.empresa_id || null
          if (!currentEmp || currentEmp !== empresaId) {
            const limitInfo = await checkEmpresaUserLimit(empresaId)
            if (!limitInfo.allowed) {
              return forbidden(`Limite de usuários da empresa atingido (${limitInfo.count}/${limitInfo.limit})`)
            }
          }
          await supabaseAdmin.from('empresa_users').upsert({ user_id: user.id, empresa_id: empresaId, role: (role || user.user_metadata?.role || 'user') }, { onConflict: 'user_id' })
        } else {
          // se empresaId vazio, desvincula
          await supabaseAdmin.from('empresa_users').delete().eq('user_id', user.id)
        }
      } catch (e) {
        console.error('Falha ao atualizar vínculo empresa_users:', e)
      }
    }
    return NextResponse.json({ user })
  } catch (err) {
    console.error('Unexpected error updating user:', err)
    return NextResponse.json({ error: 'Internal server error', details: err.message }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const caller = await getUserFromRequest(request)
    if (!caller) return unauthorized()
    const roleCaller = caller.user_metadata?.role || 'viewer'
    const sectorsCaller = Array.isArray(caller.user_metadata?.sectors) && caller.user_metadata.sectors.length > 0 ? caller.user_metadata.sectors : ['Clientes', 'Usuários']
    if (!(roleCaller === 'admin' || sectorsCaller.includes('Usuários'))) return forbidden('Acesso ao setor Usuários não permitido')

    const body = await request.json()
    const { id } = body || {}
    if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
    if (error) return NextResponse.json({ error: 'Falha ao deletar usuário', details: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error', details: e.message }, { status: 500 })
  }
}
