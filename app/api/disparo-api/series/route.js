import { NextResponse } from 'next/server'
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
    const metric = (searchParams.get('metric') || 'sent').toLowerCase()
    const startParam = searchParams.get('start')
    const endParam = searchParams.get('end')

    // Default: last 7 days
    let start = startParam ? new Date(startParam) : new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
    let end = endParam ? new Date(endParam) : new Date()

    // Map metric -> timestamp column
    const metricToColumn = {
      sent: 'sent_at',
      delivered: 'delivered_at',
      read: 'read_at',
    }
    const column = metricToColumn[metric] || 'sent_at'

    // Fetch timestamps within range
    let query = supabaseAdmin
      .from('disparo_crm_api')
      .select(`${column}`)
      .eq('user_id', user.id)
      .gte(column, start.toISOString())
      .lte(column, end.toISOString())
      .not(column, 'is', null)
      .limit(100000)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: 'Falha ao buscar série', details: error.message }, { status: 400 })

    // Group by UTC day
    const byDay = new Map()
    for (const r of data || []) {
      const ts = r[column]
      if (!ts) continue
      const d = new Date(ts)
      const key = d.toISOString().slice(0,10) // YYYY-MM-DD (UTC)
      byDay.set(key, (byDay.get(key) || 0) + 1)
    }

    // Fill missing days from start..end
    const series = []
    const dayMs = 24 * 60 * 60 * 1000
    const s0 = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))
    const e0 = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))
    for (let t = s0.getTime(); t <= e0.getTime(); t += dayMs) {
      const d = new Date(t)
      const key = d.toISOString().slice(0,10)
      series.push({ date: key, value: byDay.get(key) || 0 })
    }

    const total = series.reduce((a,b)=>a+(b.value||0),0)
    return NextResponse.json({ metric, series, total, start: s0.toISOString(), end: e0.toISOString() })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno', details: e.message }, { status: 500 })
  }
}

