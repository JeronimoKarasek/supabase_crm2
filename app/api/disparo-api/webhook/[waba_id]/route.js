import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

async function getVerifyTokenForWaba(waba) {
  try {
    const { data, error } = await supabaseAdmin.from('whatsapp_credentials').select('webhook_verify_token').eq('waba_id', waba).limit(1)
    if (!error && data && data[0]) return data[0].webhook_verify_token
  } catch {}
  return process.env.META_WEBHOOK_VERIFY_TOKEN || 'verificadorcrm'
}

export async function GET(request, { params }) {
  const { waba_id } = params || {}
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')
  const expected = await getVerifyTokenForWaba(waba_id)
  if (mode === 'subscribe' && token && challenge && token === expected) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

export async function POST(request, { params }) {
  try {
    const body = await request.json()
    const entries = body?.entry || []
    for (const entry of entries) {
      const changes = entry?.changes || []
      for (const change of changes) {
        const value = change?.value || {}
        if (Array.isArray(value.statuses)) {
          for (const s of value.statuses) {
            const msgId = s.id
            const status = s.status
            const button = s?.button?.text || null
            const updates = { status, updated_at: new Date().toISOString() }
            if (status === 'delivered') updates.delivered_at = new Date().toISOString()
            if (status === 'read') updates.read_at = new Date().toISOString()
            if (button) { updates.button_clicked = button; updates.interacted_at = new Date().toISOString() }
            if (msgId) await supabaseAdmin.from('disparo_crm_api').update(updates).eq('message_id', msgId)
          }
        }
        if (Array.isArray(value.messages)) {
          for (const m of value.messages) {
            const inter = m?.interactive
            if (inter?.type === 'button_reply') {
              const btn = inter?.button_reply?.title || inter?.button_reply?.id || null
              const from = value?.contacts?.[0]?.wa_id || null
              if (from && btn) {
                await supabaseAdmin.from('disparo_crm_api').update({ button_clicked: btn, interacted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('phone', from)
              }
            }
          }
        }
      }
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}

