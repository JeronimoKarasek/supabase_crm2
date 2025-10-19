import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

function unauthorized(msg = 'Unauthorized') { return NextResponse.json({ error: msg }, { status: 401 }) }

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
  try {
    const start = new Date()
    start.setHours(0,0,0,0)
    const { data, error } = await supabaseAdmin
      .from('disparo_crm_api')
      .select('phone_number_id, sent_at')
      .eq('user_id', user.id)
      .gte('sent_at', start.toISOString())
      .limit(10000)
    if (error) return NextResponse.json({ error: 'Falha ao buscar envios de hoje', details: error.message }, { status: 400 })
    const counts = {}
    for (const r of data || []) {
      const k = r.phone_number_id
      counts[k] = (counts[k] || 0) + 1
    }
    return NextResponse.json({ counts })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno', details: e.message }, { status: 500 })
  }
}

