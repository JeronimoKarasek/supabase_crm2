import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase-admin.js'
export const dynamic = 'force-dynamic'

async function getUserFromRequest(request) {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return null
  const token = auth.split(' ')[1]
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error) return null
  return data?.user || null
}

// Normaliza saida unificada: credentials (compat) + users por banco
export async function GET(request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Legacy single credentials
  const legacyPromise = supabaseAdmin
    .from('bank_credentials')
    .select('bank_key, credentials')
    .eq('user_id', user.id)
    .limit(200)

  // Multi users
  const multiPromise = supabaseAdmin
    .from('bank_user_credentials')
    .select('id, bank_key, alias, credentials, is_default')
    .eq('user_id', user.id)
    .limit(500)

  const [legacyRes, multiRes] = await Promise.all([legacyPromise, multiPromise])
  if (legacyRes.error) return NextResponse.json({ error: 'Failed legacy fetch', details: legacyRes.error.message }, { status: 500 })
  if (multiRes.error) return NextResponse.json({ error: 'Failed multi fetch', details: multiRes.error.message }, { status: 500 })

  const legacyRows = legacyRes.data || []
  const multiRows = multiRes.data || []

  // Map multi users by bank
  const usersByBank = {}
  for (const r of multiRows) {
    if (!usersByBank[r.bank_key]) usersByBank[r.bank_key] = []
    usersByBank[r.bank_key].push({ id: r.id, alias: r.alias, credentials: r.credentials || {}, is_default: r.is_default })
  }

  // Determine credentials map for backward compatibility:
  // Use default multi-user credentials if exists else fallback to legacy
  const outCreds = {}
  // Add defaults from multi
  for (const [bankKey, arr] of Object.entries(usersByBank)) {
    const def = arr.find(u => u.is_default) || arr[0]
    if (def) outCreds[bankKey] = def.credentials || {}
  }
  // Add legacy only if no multi default
  for (const row of legacyRows) {
    if (!outCreds[row.bank_key]) outCreds[row.bank_key] = row.credentials || {}
  }

  return NextResponse.json({ credentials: outCreds, users: usersByBank })
}

// Mantém rota PUT para atualizar legacy (não mexe multi-user aqui)
export async function PUT(request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json()
    const creds = body?.credentials || {}
    const rows = Object.entries(creds).map(([bank_key, credentials]) => ({ user_id: user.id, bank_key, credentials }))
    if (rows.length) {
      const { error } = await supabaseAdmin
        .from('bank_credentials')
        .upsert(rows, { onConflict: 'user_id,bank_key' })
      if (error) return NextResponse.json({ error: 'Failed to save', details: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}
