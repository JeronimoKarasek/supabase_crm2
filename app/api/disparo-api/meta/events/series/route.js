import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase-admin'


export const dynamic = 'force-dynamic'
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
    const { searchParams } = new URL(request.url)
    const credential_id = searchParams.get('credential_id') || null
    const phone_number_id = searchParams.get('phone_number_id') || null
    const status = (searchParams.get('status') || 'sent').toLowerCase()
    const startParam = searchParams.get('start')
    const endParam = searchParams.get('end')
    const start = startParam ? new Date(startParam) : new Date(Date.now() - 6*24*60*60*1000)
    const end = endParam ? new Date(endParam) : new Date()

    let q = supabaseAdmin
      .from('whatsapp_status_events')
      .select('event_ts', { head: false })
      .eq('user_id', user.id)
      .eq('status', status)
      .gte('event_ts', start.toISOString())
      .lte('event_ts', end.toISOString())
      .limit(100000)
    if (credential_id) q = q.eq('credential_id', credential_id)
    if (phone_number_id) q = q.eq('phone_number_id', phone_number_id)

    const { data, error } = await q
    if (error) return NextResponse.json({ error: 'Falha ao buscar série (Meta events)', details: error.message }, { status: 400 })

    const byDay = new Map()
    for (const r of data || []) {
      const d = new Date(r.event_ts)
      const key = d.toISOString().slice(0,10)
      byDay.set(key, (byDay.get(key) || 0) + 1)
    }
    const dayMs = 24*60*60*1000
    const s0 = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))
    const e0 = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))
    const series = []
    for (let t = s0.getTime(); t <= e0.getTime(); t += dayMs) {
      const d = new Date(t)
      const key = d.toISOString().slice(0,10)
      series.push({ date: key, value: byDay.get(key) || 0 })
    }
    const total = series.reduce((a,b)=>a+(b.value||0),0)
    return NextResponse.json({ status, series, total, start: s0.toISOString(), end: e0.toISOString(), source: 'meta_events' })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno', details: e.message }, { status: 500 })
  }
}

