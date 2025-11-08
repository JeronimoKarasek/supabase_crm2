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
    let cred = null
    try {
      const { data } = await supabaseAdmin.from('whatsapp_credentials').select('*').eq('waba_id', params?.waba_id).limit(1)
      if (Array.isArray(data) && data[0]) cred = data[0]
    } catch {}
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
            // also store status event for accounts que dispararam fora do CRM
            try {
              const pn = value?.metadata?.phone_number_id || null
              const ts = s?.timestamp ? new Date(parseInt(s.timestamp,10)*1000).toISOString() : new Date().toISOString()
              // detalhes de pricing/conversation
              const pricing = s?.pricing || {}
              const billable = (typeof pricing?.billable === 'boolean') ? pricing.billable : null
              const pcat = pricing?.category || null
              const conv = s?.conversation || {}
              const convId = conv?.id || null
              const convCat = conv?.category || null
              const convOrigin = (conv?.origin && (conv.origin.type || conv.origin)) || null
              if (cred?.user_id && pn && msgId && status) {
                await supabaseAdmin.from('whatsapp_status_events').upsert({
                  user_id: cred.user_id,
                  credential_id: cred.id,
                  phone_number_id: pn,
                  message_id: msgId,
                  status,
                  pricing_category: pcat,
                  pricing_billable: billable,
                  conversation_id: convId,
                  conversation_category: convCat,
                  conversation_origin: convOrigin,
                  event_ts: ts,
                }, { onConflict: 'message_id,status' })
              }
            } catch {}
          }
        }
        if (Array.isArray(value.messages)) {
          for (const m of value.messages) {
            const inter = m?.interactive
            if (inter?.type === 'button_reply') {
              const btnTitle = inter?.button_reply?.title || null
              const btnId = inter?.button_reply?.id || null
              const from = value?.contacts?.[0]?.wa_id || null
              if (from && (btnTitle || btnId)) {
                await supabaseAdmin.from('disparo_crm_api').update({ button_clicked: btnTitle || btnId, interacted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('phone', from)
                try {
                  const phone_number_id = value?.metadata?.phone_number_id || null
                  if (cred?.user_id && phone_number_id) {
                    await supabaseAdmin.from('whatsapp_click_events').insert({
                      user_id: cred.user_id,
                      credential_id: cred.id,
                      phone_number_id,
                      from_wa_id: from,
                      message_id: m?.id || null,
                      button_id: btnId,
                      button_title: btnTitle,
                      clicked_at: new Date().toISOString(),
                    })
                  }
                } catch {}
              }
            }
            try {
              const phone_number_id = value?.metadata?.phone_number_id || null
              const from_wa_id = (value?.contacts?.[0]?.wa_id) || m?.from || null
              if (phone_number_id && from_wa_id && cred?.user_id) {
                await supabaseAdmin.from('whatsapp_inbound').insert({
                  user_id: cred.user_id,
                  credential_id: cred.id,
                  phone_number_id,
                  from_wa_id,
                  type: m?.type || null,
                  payload: m,
                  received_at: new Date().toISOString(),
                })
                // increment received via status events table too
                await supabaseAdmin.from('whatsapp_status_events').insert({
                  user_id: cred.user_id,
                  credential_id: cred.id,
                  phone_number_id,
                  message_id: m?.id || null,
                  status: 'received',
                  event_ts: new Date().toISOString(),
                })
              }
            } catch (e) {}
          }
        }
      }
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}

