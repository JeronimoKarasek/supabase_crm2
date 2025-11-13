import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../../lib/supabase-admin.js'
export const dynamic = 'force-dynamic'

async function getUserFromRequest(request) {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return null
  const token = auth.split(' ')[1]
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error) return null
  return data?.user || null
}

function sanitizeCredentials(obj) {
  if (!obj || typeof obj !== 'object') return {}
  // Evita salvar campos vazios
  const out = {}
  for (const [k,v] of Object.entries(obj)) {
    if (v !== null && typeof v !== 'undefined' && String(v).trim() !== '') out[k] = v
  }
  return out
}

export async function GET(request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = new URL(request.url)
  const bankKey = url.searchParams.get('bank_key')
  let query = supabaseAdmin.from('bank_user_credentials').select('id, bank_key, alias, credentials, is_default, created_at').eq('user_id', user.id)
  if (bankKey) query = query.eq('bank_key', bankKey)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Fetch failed', details: error.message }, { status: 500 })
  return NextResponse.json({ items: data || [] })
}

export async function POST(request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json()
    const bank_key = String(body.bank_key || '').trim()
    const alias = String(body.alias || '').trim()
    const credentials = sanitizeCredentials(body.credentials || {})
    if (!bank_key || !alias) return NextResponse.json({ error: 'Missing bank_key or alias' }, { status: 400 })

    // Verifica se já existem usuários neste banco (para definir default caso seja o primeiro)
    const { data: existing } = await supabaseAdmin
      .from('bank_user_credentials')
      .select('id')
      .eq('user_id', user.id)
      .eq('bank_key', bank_key)
      .limit(1)
    const is_default = !existing || existing.length === 0

    const { error } = await supabaseAdmin
      .from('bank_user_credentials')
      .insert({ user_id: user.id, bank_key, alias, credentials, is_default })
    if (error) return NextResponse.json({ error: 'Insert failed', details: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}

export async function PUT(request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json()
    const id = body.id
    const alias = body.alias ? String(body.alias).trim() : undefined
    const credentials = body.credentials ? sanitizeCredentials(body.credentials) : undefined
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    const update = {}
    if (alias !== undefined) update.alias = alias
    if (credentials !== undefined) update.credentials = credentials
    if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('bank_user_credentials')
      .update(update)
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) return NextResponse.json({ error: 'Update failed', details: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}

// Definir padrão
export async function PATCH(request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json()
    const id = body.id
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    // Recupera o registro para pegar bank_key
    const { data: row, error: fetchErr } = await supabaseAdmin
      .from('bank_user_credentials')
      .select('bank_key')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    if (fetchErr || !row) return NextResponse.json({ error: 'Not found', details: fetchErr?.message }, { status: 404 })
    const bank_key = row.bank_key

    // Define default e remove default dos outros (trigger também garante)
    const { error } = await supabaseAdmin
      .from('bank_user_credentials')
      .update({ is_default: true })
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) return NextResponse.json({ error: 'Set default failed', details: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}

export async function DELETE(request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json()
    const id = body.id
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

    // Verifica se registro é default antes de remover
    const { data: row } = await supabaseAdmin
      .from('bank_user_credentials')
      .select('bank_key, is_default')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    const { error } = await supabaseAdmin
      .from('bank_user_credentials')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) return NextResponse.json({ error: 'Delete failed', details: error.message }, { status: 500 })

    // Se era default, define outro como default (primeiro disponível)
    if (row?.is_default) {
      const { data: others } = await supabaseAdmin
        .from('bank_user_credentials')
        .select('id')
        .eq('user_id', user.id)
        .eq('bank_key', row.bank_key)
        .order('created_at', { ascending: true })
        .limit(1)
      const fallback = others?.[0]
      if (fallback) {
        await supabaseAdmin
          .from('bank_user_credentials')
          .update({ is_default: true })
          .eq('id', fallback.id)
          .eq('user_id', user.id)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}
