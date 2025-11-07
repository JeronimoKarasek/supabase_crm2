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
    const { data, error } = await supabaseAdmin
      .from('sms_disparo')
      .select('batch_id, credential_id, status, reference, tenant_segment_id, created_at, sent_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10000)

    if (error) {
      if (error?.message?.toLowerCase()?.includes('does not exist') || error?.code === '42P01') {
        return NextResponse.json({ batches: [], missingTable: true })
      }
      return NextResponse.json({ error: 'Falha ao listar batches', details: error.message }, { status: 400 })
    }

    // Agrupar por batch_id
    const map = new Map()
    for (const r of data || []) {
      const key = r.batch_id
      if (!map.has(key)) {
        map.set(key, {
          batch_id: key,
          credential_id: r.credential_id,
          tenant_segment_id: r.tenant_segment_id,
          reference: r.reference,
          created_at: r.created_at,
          counts: { total: 0, queued: 0, sent: 0, delivered: 0, failed: 0, blacklist: 0, not_disturb: 0 },
        })
      }
      const b = map.get(key)
      b.counts.total++
      const s = (r.status || 'queued').toLowerCase()
      if (s in b.counts) b.counts[s]++
      else b.counts[s] = 1
      if (new Date(r.created_at) < new Date(b.created_at)) b.created_at = r.created_at
    }

    const batches = Array.from(map.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    return NextResponse.json({ batches })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno', details: e.message }, { status: 500 })
  }
}
