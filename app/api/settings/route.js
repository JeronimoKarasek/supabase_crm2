import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase-admin.js'

function unauthorized(msg = 'Unauthorized') { return NextResponse.json({ error: msg }, { status: 401 }) }
function forbidden(msg = 'Forbidden') { return NextResponse.json({ error: msg }, { status: 403 }) }

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
  const user = await getUserFromRequest(request)
  if (!user) return unauthorized()
  const settings = user.user_metadata?.settings || {}
  return NextResponse.json({ settings })
}

export async function PUT(request) {
  const user = await getUserFromRequest(request)
  if (!user) return unauthorized()
  try {
    const body = await request.json()
    const { valorPago, valorPagoList } = body || {}
    const current = user.user_metadata || {}
    const merged = {
      ...current,
      settings: {
        ...(current.settings || {}),
        ...(valorPago ? { valorPago } : {}),
        ...(Array.isArray(valorPagoList) ? { valorPagoList } : {}),
      },
    }
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { user_metadata: merged })
    if (error) return NextResponse.json({ error: 'Failed to update settings', details: error.message }, { status: 400 })
    return NextResponse.json({ settings: data?.user?.user_metadata?.settings || {} })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}
