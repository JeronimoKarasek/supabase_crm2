import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin.js'

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

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return unauthorized()
    const meta = user.user_metadata || {}
    const role = meta.role || 'viewer'
    const sectors = Array.isArray(meta.sectors) && meta.sectors.length > 0 ? meta.sectors : ['Clientes']
    const perms = meta.permissions || {}
    const allowedTables = Array.isArray(perms.allowedTables) ? perms.allowedTables : []

    const body = await request.json()
    const table = body?.table
    const row = body?.row
    const rows = Array.isArray(body?.rows) ? body.rows : null
    if (!table) return NextResponse.json({ error: 'Missing table' }, { status: 400 })

    // Authorization: require Clientes sector and table permission for non-admins
    if (role !== 'admin') {
      if (!(sectors.includes('Clientes') || sectors.includes('Dashboard') || sectors.includes('Usuários') || sectors.includes('Usurios'))) return forbidden('Acesso ao setor Clientes não permitido')
      if (!allowedTables.includes(table)) {
        // Bootstrap: permitir se ainda não configurou allowedTables e tem setor Usuários
        if (!((sectors || []).includes('Usuários') || (sectors || []).includes('Usurios')) || (allowedTables && allowedTables.length > 0)) {
          return forbidden('Tabela não permitida')
        }
      }
    }

    // Normalize payload
    let payload = []
    if (rows && rows.length) payload = rows.filter(r => r && typeof r === 'object')
    else if (row && typeof row === 'object') payload = [row]
    else return NextResponse.json({ error: 'Missing row(s)' }, { status: 400 })

    // Remove empty fields and id if present
    payload = payload.map((r) => {
      const out = {}
      for (const [k, v] of Object.entries(r)) {
        if (k === 'id') continue
        if (v === '' || typeof v === 'undefined') continue
        out[k] = v
      }
      return out
    })

    if (payload.length === 0) return NextResponse.json({ error: 'No valid rows' }, { status: 400 })

    // Insert (batch)
    const { data, error } = await supabaseAdmin.from(table).insert(payload).select('*')
    if (error) return NextResponse.json({ error: 'Insert failed', details: error.message }, { status: 500 })
    return NextResponse.json({ inserted: data?.length || 0, rows: data || [] })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

