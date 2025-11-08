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

async function getCreds(userId) {
  try {
    const { data, error } = await supabaseAdmin.from('whatsapp_credentials').select('*').eq('user_id', userId).limit(1)
    if (!error && data && data[0]) return data[0]
  } catch {}
  const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId)
  return (u?.user?.user_metadata?.whatsapp) || null
}

export async function GET(request) {
  const user = await getUserFromRequest(request)
  if (!user) return unauthorized()
  try {
    const { searchParams } = new URL(request.url)
    const batch_id = searchParams.get('batch_id') || null
    const credential_id = searchParams.get('credential_id') || null
    const phone_number_id = searchParams.get('phone_number_id') || null

    let counts = {}
    try {
      let query = supabaseAdmin.from('disparo_crm_api').select('status', { count: 'exact', head: false }).eq('user_id', user.id)
      if (batch_id) query = query.eq('batch_id', batch_id)
      const { data, error } = await query
      if (!error && Array.isArray(data)) {
        // data returns rows; compute counts
        counts = data.reduce((acc, r) => { acc[r.status || 'unknown'] = (acc[r.status || 'unknown'] || 0) + 1; return acc }, {})
      }
    } catch {}

    let phoneInfo = {}
    // If batch provided, derive credential and phone_number_id from it
    let credRow = null
    let pn = phone_number_id
    if (batch_id && !pn) {
      const { data: one, error: oneErr } = await supabaseAdmin.from('disparo_crm_api').select('credential_id, phone_number_id').eq('user_id', user.id).eq('batch_id', batch_id).limit(1)
      if (!oneErr && one && one[0]) {
        pn = one[0].phone_number_id
        const { data, error } = await supabaseAdmin.from('whatsapp_credentials').select('*').eq('id', one[0].credential_id).eq('user_id', user.id).single()
        if (!error) credRow = data
      }
    }
    if (!credRow && credential_id) {
      const { data, error } = await supabaseAdmin.from('whatsapp_credentials').select('*').eq('id', credential_id).eq('user_id', user.id).single()
      if (!error) credRow = data
    }
    if (credRow?.access_token && pn) {
      try {
        const endpoint = `https://graph.facebook.com/v19.0/${encodeURIComponent(pn)}`
        const fields = 'quality_rating,display_phone_number,name_status'
        const token = credRow.access_token
        const appId = credRow.app_id || null
        const appSecret = credRow.app_secret || null
        let appProof = null
        try { if (appSecret && token) { const { createHmac } = await import('crypto'); appProof = createHmac('sha256', appSecret).update(token).digest('hex') } } catch {}
        const withProof = (url) => { if (!appProof) return url; const sep = url.includes('?') ? '&' : '?'; const idp = appId ? `&app_id=${encodeURIComponent(appId)}` : ''; return `${url}${sep}appsecret_proof=${appProof}${idp}` }
        const res = await fetch(withProof(`${endpoint}?fields=${encodeURIComponent(fields)}`), { headers: { Authorization: `Bearer ${token}` } })
        const json = await res.json()
        if (res.ok) phoneInfo = json
      } catch {}
    }

    return NextResponse.json({
      quality_rating: phoneInfo.quality_rating || '',
      name_status: phoneInfo.name_status || '',
      display_phone_number: phoneInfo.display_phone_number || '',
      counts,
    })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno', details: e.message }, { status: 500 })
  }
}
