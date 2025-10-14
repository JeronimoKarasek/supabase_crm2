import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase-admin.js'

async function getUserFromRequest(request) {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return null
  const token = auth.split(' ')[1]
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error) return null
  return data?.user || null
}

export async function GET(request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabaseAdmin
    .from('bank_credentials')
    .select('bank_key, credentials')
    .eq('user_id', user.id)
    .limit(100)
  if (error) return NextResponse.json({ error: 'Failed to fetch', details: error.message }, { status: 500 })
  const out = {}
  for (const row of (data || [])) out[row.bank_key] = row.credentials || {}
  return NextResponse.json({ credentials: out })
}

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
