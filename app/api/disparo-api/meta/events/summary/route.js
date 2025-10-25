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

async function countStatus({ userId, credential_id, phone_number_id, status, startISO, endISO }) {
  let q = supabaseAdmin.from('whatsapp_status_events').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', status)
  if (credential_id) q = q.eq('credential_id', credential_id)
  if (phone_number_id) q = q.eq('phone_number_id', phone_number_id)
  const { count } = await q.gte('event_ts', startISO).lte('event_ts', endISO)
  return count || 0
}

export async function GET(request) {
  const user = await getUserFromRequest(request)
  if (!user) return unauthorized()
  try {
    const { searchParams } = new URL(request.url)
    const credential_id = searchParams.get('credential_id') || null
    const phone_number_id = searchParams.get('phone_number_id') || null
    const startParam = searchParams.get('start')
    const endParam = searchParams.get('end')
    const start = startParam ? new Date(startParam) : new Date(Date.now() - 6*24*60*60*1000)
    const end = endParam ? new Date(endParam) : new Date()
    const startISO = start.toISOString()
    const endISO = end.toISOString()

    const sent = await countStatus({ userId: user.id, credential_id, phone_number_id, status: 'sent', startISO, endISO })
    const delivered = await countStatus({ userId: user.id, credential_id, phone_number_id, status: 'delivered', startISO, endISO })
    const read = await countStatus({ userId: user.id, credential_id, phone_number_id, status: 'read', startISO, endISO })

    // received via inbound table if exists
    let received = 0
    try {
      let qi = supabaseAdmin.from('whatsapp_inbound').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      if (credential_id) qi = qi.eq('credential_id', credential_id)
      if (phone_number_id) qi = qi.eq('phone_number_id', phone_number_id)
      const { count } = await qi.gte('received_at', startISO).lte('received_at', endISO)
      received = count || 0
    } catch {}

    // top numbers por envios (status sent)
    let top_numbers = []
    try {
      let qs = supabaseAdmin
        .from('whatsapp_status_events')
        .select('phone_number_id', { head: false })
        .eq('user_id', user.id)
        .eq('status', 'sent')
        .gte('event_ts', startISO)
        .lte('event_ts', endISO)
        .limit(100000)
      if (credential_id) qs = qs.eq('credential_id', credential_id)
      if (phone_number_id) qs = qs.eq('phone_number_id', phone_number_id)
      const { data, error } = await qs
      if (!error) {
        const map = new Map()
        for (const r of data || []) {
          const k = r.phone_number_id || 'unknown'
          map.set(k, (map.get(k) || 0) + 1)
        }
        top_numbers = Array.from(map.entries()).map(([id, count]) => ({ id, count })).sort((a,b)=>b.count-a.count).slice(0, 20)
      }
    } catch {}

    return NextResponse.json({ counts: { sent, delivered, read, received }, top_numbers, source: 'meta_events' })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno', details: e.message }, { status: 500 })
  }
}

