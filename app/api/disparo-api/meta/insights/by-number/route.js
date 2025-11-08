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

function toISODateOnly(d) {
  const x = new Date(d)
  return x.toISOString().slice(0,10)
}

export async function GET(request) {
  const user = await getUserFromRequest(request)
  if (!user) return unauthorized()
  try {
    const { searchParams } = new URL(request.url)
    const credential_id = searchParams.get('credential_id')
    const startParam = searchParams.get('start')
    const endParam = searchParams.get('end')
    if (!credential_id) return NextResponse.json({ error: 'credential_id obrigatório' }, { status: 400 })

    // Resolve credential
    const { data: credRow, error: credErr } = await supabaseAdmin
      .from('whatsapp_credentials')
      .select('*')
      .eq('id', credential_id)
      .eq('user_id', user.id)
      .single()
    if (credErr || !credRow?.access_token) return NextResponse.json({ error: 'Credencial não encontrada ou sem token' }, { status: 404 })

    const token = credRow.access_token
    const wabaId = credRow.waba_id
    const appId = credRow.app_id || null
    const appSecret = credRow.app_secret || null
    let appProof = null
    try { if (appSecret && token) { const { createHmac } = await import('crypto'); appProof = createHmac('sha256', appSecret).update(token).digest('hex') } } catch {}
    const withProof = (url) => { if (!appProof) return url; const sep = url.includes('?') ? '&' : '?'; const idp = appId ? `&app_id=${encodeURIComponent(appId)}` : ''; return `${url}${sep}appsecret_proof=${appProof}${idp}` }

    const start = startParam ? new Date(startParam) : new Date(Date.now() - 6*24*60*60*1000)
    const end = endParam ? new Date(endParam) : new Date()
    const since = toISODateOnly(start)
    const until = toISODateOnly(end)

    const errors = []
    const byPhone = new Map()
    const add = (id, key, val) => {
      if (!id) return
      const row = byPhone.get(id) || { phone_number_id: id, sent: 0, delivered: 0, received: 0 }
      row[key] += (Number(val) || 0)
      byPhone.set(id, row)
    }

    // 1) Tentar Insights (WABA com dimensão PHONE_NUMBER)
    try {
      const dims = encodeURIComponent('["PHONE_NUMBER"]')
      const url = withProof(`https://graph.facebook.com/v19.0/${encodeURIComponent(wabaId)}/insights?metric=messages&since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}&granularity=DAILY&dimensions=${dims}`)
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const j = await r.json().catch(()=>({}))
      if (r.ok && Array.isArray(j?.data)) {
        const item = j.data.find(it => (it?.name || it?.metric) === 'messages') || j.data[0]
        const values = Array.isArray(item?.values) ? item.values : []
        for (const v of values) {
          const val = v?.value || v
          // extrair phone_number_id de diversas formas possíveis
          let pid = v?.phone_number_id || v?.phone || v?.phone_number
          pid = pid || val?.phone_number_id || val?.phone || val?.phone_number
          const dim = v?.dimensions || val?.dimensions || v?.dimension_values
          if (!pid && Array.isArray(dim)) {
            for (const d of dim) {
              pid = d?.phone_number_id || d?.phone || d?.value || pid
            }
          }
          if (typeof val?.sent === 'number') add(pid, 'sent', val.sent)
          if (typeof val?.delivered === 'number') add(pid, 'delivered', val.delivered)
          if (typeof val?.received === 'number') add(pid, 'received', val.received)
          if (typeof v?.sent === 'number') add(pid, 'sent', v.sent)
          if (typeof v?.delivered === 'number') add(pid, 'delivered', v.delivered)
          if (typeof v?.received === 'number') add(pid, 'received', v.received)
        }
      } else if (!r.ok) {
        errors.push(j?.error?.message || 'insights by-number failed')
      }
    } catch (e) { errors.push(e.message) }

    // 2) Fallback: agrupar por número via eventos do webhook (sent/delivered/read) e inbound (received)
    const needFallback = byPhone.size === 0 || (errors || []).some(e => String(e || '').toLowerCase().includes('nonexisting field'))
    if (needFallback) {
      const startISO = start.toISOString()
      const endISO = end.toISOString()
      // sent/delivered/read
      for (const st of ['sent','delivered','read']) {
        try {
          let q = supabaseAdmin
            .from('whatsapp_status_events')
            .select('phone_number_id', { head: false })
            .eq('user_id', user.id)
            .eq('status', st)
            .gte('event_ts', startISO)
            .lte('event_ts', endISO)
            .limit(100000)
          if (credential_id) q = q.eq('credential_id', credential_id)
          const { data, error } = await q
          if (!error) {
            for (const r of data || []) add(r.phone_number_id || 'unknown', st === 'sent' ? 'sent' : (st === 'delivered' ? 'delivered' : 'received'), 1)
          }
        } catch {}
      }
      // received table
      try {
        let qi = supabaseAdmin
          .from('whatsapp_inbound')
          .select('phone_number_id', { head: false })
          .eq('user_id', user.id)
          .gte('received_at', startISO)
          .lte('received_at', endISO)
          .limit(100000)
        if (credential_id) qi = qi.eq('credential_id', credential_id)
        const { data } = await qi
        for (const r of data || []) add(r.phone_number_id || 'unknown', 'received', 1)
      } catch {}
    }

    const rows = Array.from(byPhone.values()).sort((a,b)=>b.sent - a.sent)
    return NextResponse.json({ rows, since, until, errors, source: byPhone.size ? (needFallback ? 'crm_fallback' : 'meta_insights') : 'empty' })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno', details: e.message }, { status: 500 })
  }
}

