import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'


export const dynamic = 'force-dynamic'
async function getUser(request) {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return null
  const token = auth.split(' ')[1]
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error) return null
  return data?.user || null
}

export async function GET(request) {
  try {
    const user = await getUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // buscar settings
    const { data } = await supabaseAdmin.from('global_settings').select('data').eq('id','global').single()
    const webhook = data?.data?.payments?.creditsWebhook || ''
    if (!webhook) return NextResponse.json({ error: 'Credits webhook not configured' }, { status: 400 })

    // repassar chamada ao webhook do servidor para evitar CORS
    // Inclui informações completas do usuário conforme solicitado
    const payload = {
      event: 'credits_query',
      userId: user.id,
      email: user.email,
      userMetadata: user.user_metadata || {},
      timestamp: new Date().toISOString()
    }
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const ctype = (res.headers.get('content-type') || '').toLowerCase()
    let bodyVal = null
    if (ctype.includes('application/json')) bodyVal = await res.json().catch(() => ({}))
    else { const txt = await res.text().catch(() => ''); try { bodyVal = JSON.parse(txt) } catch { bodyVal = txt || null } }

    if (!res.ok) {
      const msg = (typeof bodyVal === 'object' && bodyVal) ? (bodyVal.error || bodyVal.message) : String(bodyVal || '')
      return NextResponse.json({ error: msg || `HTTP ${res.status}` }, { status: 502 })
    }

    return NextResponse.json({ ok: true, data: bodyVal })
  } catch (e) {
    return NextResponse.json({ error: 'Failed to query credits', details: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  // Espelhar GET
  return GET(request)
}
