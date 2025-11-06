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
  // fallback: metadata
  const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId)
  return (u?.user?.user_metadata?.whatsapp) || null
}

async function sendTemplateMessage({ access_token, phone_number_id, to, template_name, template_language, components }) {
  const endpoint = `https://graph.facebook.com/v19.0/${encodeURIComponent(phone_number_id)}/messages`
  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: template_name,
      language: { code: template_language || 'pt_BR' },
      ...(Array.isArray(components) && components.length ? { components: [{ type: 'body', parameters: components }] } : {}),
    },
  }
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(json?.error?.message || 'Falha no envio')
    err.details = json
    throw err
  }
  return json
}

export async function POST(request) {
  const user = await getUserFromRequest(request)
  if (!user) return unauthorized()
  try {
    const body = await request.json()
    const batch_id = body?.batch_id || ''
    if (!batch_id) return NextResponse.json({ error: 'batch_id obrigatório' }, { status: 400 })

    // load queued rows for this batch (they share the same credential_id)
    const { data: rows, error } = await supabaseAdmin
      .from('disparo_crm_api')
      .select('*')
      .eq('user_id', user.id)
      .eq('batch_id', batch_id)
      .eq('status', 'queued')
      .limit(500)

    if (error) {
      if (error?.message?.toLowerCase()?.includes('does not exist') || error?.code === '42P01') {
        return NextResponse.json({ error: 'Tabela disparo_crm_api não encontrada. Execute o SQL sugerido.', missingTable: true }, { status: 400 })
      }
      return NextResponse.json({ error: 'Falha ao consultar base', details: error.message }, { status: 400 })
    }

    if (!rows || !rows.length) return NextResponse.json({ ok: true, sent: 0, failed: 0 })

    // load credential
    const credId = rows[0].credential_id
    const { data: credRow, error: credErr } = await supabaseAdmin.from('whatsapp_credentials').select('*').eq('id', credId).eq('user_id', user.id).single()
    if (credErr || !credRow?.access_token) return NextResponse.json({ error: 'Credenciais ausentes' }, { status: 400 })

    let sent = 0, failed = 0
    for (const r of rows || []) {
      try {
        const json = await sendTemplateMessage({
          access_token: credRow.access_token,
          phone_number_id: r.phone_number_id,
          to: r.phone,
          template_name: r.template_name,
          template_language: r.template_language,
          components: Array.isArray(r.template_components) ? r.template_components : [],
        })
        const msgId = json?.messages?.[0]?.id || null
        await supabaseAdmin.from('disparo_crm_api').update({ status: 'sent', message_id: msgId, sent_at: new Date().toISOString(), attempt_count: (r.attempt_count || 0) + 1, updated_at: new Date().toISOString() }).eq('id', r.id)
        sent++
      } catch (e) {
        await supabaseAdmin.from('disparo_crm_api').update({ status: 'failed', error_message: e.message || 'erro', attempt_count: (r.attempt_count || 0) + 1, updated_at: new Date().toISOString() }).eq('id', r.id)
        failed++
      }
    }

    return NextResponse.json({ ok: true, sent, failed })
  } catch (e) {
    return NextResponse.json({ error: 'Payload inválido', details: e.message }, { status: 400 })
  }
}
