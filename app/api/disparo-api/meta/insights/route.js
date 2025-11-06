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

function toISODateOnly(d) {
  const x = new Date(d)
  return x.toISOString().slice(0,10)
}
function toEpoch(d) { return Math.floor(new Date(d).getTime() / 1000) }

function parseMessagesAnalytics(json, phoneFilter) {
  // Try a few shapes that Meta may return
  try {
    const data = json?.data
    if (!Array.isArray(data)) return null
    let values = []
    // Case A: find item named 'messages'
    const item = data.find((it) => (it?.name || it?.metric) === 'messages') || data[0]
    if (item?.values && Array.isArray(item.values)) values = item.values
    if (!values.length && Array.isArray(item?.data)) values = item.data
    if (!values.length) return null
    const out = { sent: 0, delivered: 0, received: 0 }
    const eq = (a,b) => String(a||'') === String(b||'')
    const matchPhone = (v) => {
      if (!phoneFilter) return true
      const pv = v?.phone || v?.phone_number || v?.phone_number_id
      const pvv = v?.value?.phone || v?.value?.phone_number || v?.value?.phone_number_id
      if (eq(pv, phoneFilter) || eq(pvv, phoneFilter)) return true
      const dims = v?.dimensions || v?.value?.dimensions || v?.dimension_values
      if (Array.isArray(dims)) {
        for (const d of dims) {
          if (eq(d?.phone || d?.phone_number_id || d?.value, phoneFilter)) return true
        }
      }
      return false
    }
    for (const v of values) {
      if (!matchPhone(v)) continue
      const val = v?.value || v
      if (typeof val?.sent === 'number') out.sent += val.sent
      if (typeof val?.delivered === 'number') out.delivered += val.delivered
      if (typeof val?.received === 'number') out.received += val.received
      // Alternative keys
      if (typeof v?.sent === 'number') out.sent += v.sent
      if (typeof v?.delivered === 'number') out.delivered += v.delivered
      if (typeof v?.received === 'number') out.received += v.received
    }
    return out
  } catch {
    return null
  }
}

export async function GET(request) {
  const user = await getUserFromRequest(request)
  if (!user) return unauthorized()
  try {
    const { searchParams } = new URL(request.url)
    const credential_id = searchParams.get('credential_id')
    const phone_number_id = searchParams.get('phone_number_id')
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
    if (credErr || !credRow?.access_token) return NextResponse.json({ error: 'Credencial nÃ£o encontrada ou sem token' }, { status: 404 })

    const token = credRow.access_token
    const appId = credRow.app_id || null
    const appSecret = credRow.app_secret || null
    let appProof = null
    try {
      if (appSecret && token) {
        const { createHmac } = await import('crypto')
        appProof = createHmac('sha256', appSecret).update(token).digest('hex')
      }
    } catch {}
    const withProof = (url) => {
      if (!appProof) return url
      const sep = url.includes('?') ? '&' : '?'
      const idp = appId ? `&app_id=${encodeURIComponent(appId)}` : ''
      return `${url}${sep}appsecret_proof=${appProof}${idp}`
    }
    const wabaId = credRow.waba_id
    const start = startParam ? new Date(startParam) : new Date(Date.now() - 6*24*60*60*1000)
    const end = endParam ? new Date(endParam) : new Date()
    const since = toISODateOnly(start)
    const until = toISODateOnly(end)
    const sinceTs = toEpoch(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), 0,0,0)))
    const untilTs = toEpoch(new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 23,59,59)))

    const errors = []
    const totals = { sent: 0, delivered: 0, received: 0 }
    // categorias pagas (para refletir o cartão "Mensagens pagas entregues")
    const categories = { marketing: 0, service: 0, authentication: 0, authentication_international: 0, utility: 0 }
    // contadores de conversas grátis (para refletir o cartão "Mensagens grátis entregues")
    const free = { support_free: 0, entry_point_free: 0 }
    // totais derivados de conversation_analytics
    let delivered_free = 0
    let delivered_paid = 0
    // custos aproximados quando a API retornar custo por categoria/entrada
    let approx_spend_total = 0
    const approx_spend_by_category = { marketing: 0, service: 0, authentication: 0, authentication_international: 0, utility: 0 }

    async function fetchForPhone(pn) {
      // Try phone-level insights first (messages metric)
      try {
        const url1 = withProof(`https://graph.facebook.com/v19.0/${encodeURIComponent(pn)}/insights?metric=messages&since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}&granularity=DAILY`)
        const r1 = await fetch(url1, { headers: { Authorization: `Bearer ${token}` } })
        const j1 = await r1.json().catch(()=>({}))
        if (r1.ok) {
          const parsed1 = parseMessagesAnalytics(j1, pn)
          if (parsed1) return parsed1
        } else {
          errors.push(j1?.error?.message || 'phone insights failed')
        }
      } catch (e) { errors.push(e.message) }

      // Fallback: WABA-level insights (messages metric) com dimensões por número
      try {
        const dims = encodeURIComponent('["PHONE_NUMBER"]')
        const url2 = withProof(`https://graph.facebook.com/v19.0/${encodeURIComponent(wabaId)}/insights?metric=messages&since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}&granularity=DAILY&dimensions=${dims}`)
        const r2 = await fetch(url2, { headers: { Authorization: `Bearer ${token}` } })
        const j2 = await r2.json().catch(()=>({}))
        if (r2.ok) {
          const parsed2 = parseMessagesAnalytics(j2, pn)
          if (parsed2) return parsed2
        } else {
          errors.push(j2?.error?.message || 'waba insights failed')
        }
      } catch (e) { errors.push(e.message) }
      // Fallback 2: epoch timestamps on phone insights
      try {
        const url3 = withProof(`https://graph.facebook.com/v19.0/${encodeURIComponent(pn)}/insights?metric=messages&granularity=DAILY&since=${sinceTs}&until=${untilTs}`)
        const r3 = await fetch(url3, { headers: { Authorization: `Bearer ${token}` } })
        const j3 = await r3.json().catch(()=>({}))
        if (r3.ok) {
          const parsed3 = parseMessagesAnalytics(j3, pn)
          if (parsed3) return parsed3
        } else {
          errors.push(j3?.error?.message || 'phone insights epoch failed')
        }
      } catch (e) { errors.push(e.message) }
      return { sent: 0, delivered: 0, received: 0 }
    }

    if (phone_number_id) {
      const one = await fetchForPhone(phone_number_id)
      totals.sent += one.sent
      totals.delivered += one.delivered
      totals.received += one.received
    } else {
      // Fetch all numbers under this WABA
      try {
        const urlNum = withProof(`https://graph.facebook.com/v19.0/${encodeURIComponent(wabaId)}/phone_numbers?fields=id,display_phone_number`)
        const rn = await fetch(urlNum, { headers: { Authorization: `Bearer ${token}` } })
        const jn = await rn.json().catch(()=>({}))
        if (rn.ok) {
          const items = Array.isArray(jn?.data) ? jn.data : []
          for (const n of items) {
            const one = await fetchForPhone(n.id)
            totals.sent += one.sent
            totals.delivered += one.delivered
            totals.received += one.received
          }
        } else {
          errors.push(jn?.error?.message || 'phone_numbers fetch failed')
        }
      } catch (e) { errors.push(e.message) }
    }

    try {
      const dims = encodeURIComponent('["CONVERSATION_CATEGORY","CONVERSATION_ENTRY_POINT"]')
      const urlConv = withProof(`https://graph.facebook.com/v19.0/${encodeURIComponent(wabaId)}/insights?metric=conversation_analytics&since=${encodeURIComponent(since)}&until=${encodeURIComponent(until)}&dimensions=${dims}&granularity=DAILY`)
      const rc = await fetch(urlConv, { headers: { Authorization: `Bearer ${token}` } })
      const jc = await rc.json().catch(()=>({}))
      if (rc.ok && Array.isArray(jc?.data)) {
        const item = jc.data.find(it => (it.name||it.metric) === 'conversation_analytics') || jc.data[0]
        const values = Array.isArray(item?.values) ? item.values : []
        for (const v of values) {
          const val = v?.value || {}
          const cat = (val?.conversation_category || val?.category || '').toString().toLowerCase()
          const count = Number(val?.count || val?.conversations || val?.total || 0) || 0
          const ep = (val?.conversation_entry_point || val?.entry_point || '').toString().toLowerCase()
          const isFree = ep.includes('free')
          if (isFree) {
            // grátis
            delivered_free += count
            if (ep.includes('support') || ep.includes('customer')) free.support_free += count
            else free.entry_point_free += count
          } else {
            // pago: acumula por categoria
            delivered_paid += count
            if (cat.includes('marketing')) categories.marketing += count
            else if (cat.includes('service')) categories.service += count
            else if (cat.includes('auth')) {
              if (cat.includes('international')) categories.authentication_international += count
              else categories.authentication += count
            } else if (cat.includes('utility')) categories.utility += count
          }

          // custos aproximados quando expostos pela API
          const cost = val?.cost || val?.spend || val?.total_spend || val?.price
          const numCost = (typeof cost === 'number') ? cost : Number(cost?.amount || 0)
          if (!isNaN(numCost) && numCost > 0) {
            approx_spend_total += numCost
            if (!isFree) {
              if (cat.includes('marketing')) approx_spend_by_category.marketing += numCost
              else if (cat.includes('service')) approx_spend_by_category.service += numCost
              else if (cat.includes('auth')) {
                if (cat.includes('international')) approx_spend_by_category.authentication_international += numCost
                else approx_spend_by_category.authentication += numCost
              } else if (cat.includes('utility')) approx_spend_by_category.utility += numCost
            }
          }
        }
      } else if (!rc.ok) {
        errors.push(jc?.error?.message || 'conversation analytics failed')
      }
    } catch (e) { errors.push(e.message) }

    // If insights not available, fallback to CRM counts
    try {
      const none = (!totals.sent && !totals.delivered && !totals.received)
      const hasEdgeErrors = (errors || []).some(e => String(e || '').toLowerCase().includes('nonexisting field') || String(e || '').toLowerCase().includes('invalid edge'))
      if (none || hasEdgeErrors) {
        const startISO = new Date(start).toISOString()
        const endISO = new Date(end).toISOString()
        const baseFilter = (q) => {
          q = q.eq('user_id', user.id)
          if (credential_id) q = q.eq('credential_id', credential_id)
          if (phone_number_id) q = q.eq('phone_number_id', phone_number_id)
          return q
        }
        const countFor = async (col) => {
          let q = supabaseAdmin.from('disparo_crm_api').select('id', { count: 'exact', head: true })
          q = baseFilter(q)
          q = q.not(col, 'is', null).gte(col, startISO).lte(col, endISO)
          const { count } = await q
          return count || 0
        }
        const sentC = await countFor('sent_at')
        const deliveredC = await countFor('delivered_at')
        const readC = await countFor('read_at')
        let receivedC = 0
        try {
          let qi = supabaseAdmin.from('whatsapp_inbound').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
          if (credential_id) qi = qi.eq('credential_id', credential_id)
          if (phone_number_id) qi = qi.eq('phone_number_id', phone_number_id)
          const { count: inb } = await qi.gte('received_at', startISO).lte('received_at', endISO)
          receivedC = inb || 0
        } catch {}
        // Also try status events table (captura disparos fora do CRM)
        const countStatus = async (st) => {
          try {
            let qs = supabaseAdmin.from('whatsapp_status_events').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', st)
            if (credential_id) qs = qs.eq('credential_id', credential_id)
            if (phone_number_id) qs = qs.eq('phone_number_id', phone_number_id)
            const { count } = await qs.gte('event_ts', startISO).lte('event_ts', endISO)
            return count || 0
          } catch { return 0 }
        }
        const sentEv = await countStatus('sent')
        const deliveredEv = await countStatus('delivered')
        const readEv = await countStatus('read')

        // Derivar pagas/grátis e categorias a partir de status_events (quando possível)
        try {
          let qe = supabaseAdmin
            .from('whatsapp_status_events')
            .select('pricing_billable, pricing_category', { head: false })
            .eq('user_id', user.id)
            .eq('status', 'delivered')
            .gte('event_ts', startISO)
            .lte('event_ts', endISO)
            .limit(200000)
          if (credential_id) qe = qe.eq('credential_id', credential_id)
          if (phone_number_id) qe = qe.eq('phone_number_id', phone_number_id)
          const { data: ev } = await qe
          for (const r of ev || []) {
            const bill = r?.pricing_billable
            const cat = (r?.pricing_category || '').toString().toLowerCase()
            if (bill === false) delivered_free += 1
            else delivered_paid += 1
            if (bill !== false) {
              if (cat.includes('marketing')) categories.marketing += 1
              else if (cat.includes('service')) categories.service += 1
              else if (cat.includes('auth')) categories.authentication += 1
              else if (cat.includes('utility')) categories.utility += 1
            }
          }
        } catch {}
        totals.sent = Math.max(sentC, sentEv)
        totals.delivered = Math.max(deliveredC, deliveredEv)
        totals.received = receivedC || Math.max(readC, readEv)
        errors.push('Using CRM fallback: insights not available for this WABA/phone.')
        return NextResponse.json({ totals, categories, free, delivered_paid, delivered_free, since, until, errors, source: 'crm_fallback' })
      }
    } catch (e) {
      errors.push('CRM fallback failed: ' + (e?.message || e))
    }

    // entregue total (quando possível, usar soma paid+free para ficar consistente com o Manager)
    const deliveredFromConv = delivered_paid + delivered_free
    if (deliveredFromConv > 0) totals.delivered = deliveredFromConv

    return NextResponse.json({
      totals,
      categories, // pagas por categoria
      free,
      delivered_paid,
      delivered_free,
      approx_spend_total,
      approx_spend_by_category,
      since,
      until,
      errors,
      source: 'meta_insights'
    })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno', details: e.message }, { status: 500 })
  }
}



