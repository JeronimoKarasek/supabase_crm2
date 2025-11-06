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

function uuidv4() {
  // RFC4122 v4 simplified
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export async function POST(request) {
  const user = await getUserFromRequest(request)
  if (!user) return unauthorized()
  try {
    const body = await request.json()
    const rows = Array.isArray(body?.rows) ? body.rows : []
    const credential_id = body?.credential_id || ''
    const phone_number_id = body?.phone_number_id || ''
    const template_name = body?.template_name || ''
    const template_language = body?.template_language || 'pt_BR'
    if (!rows.length || !phone_number_id || !template_name || !credential_id) {
      return NextResponse.json({ error: 'Parâmetros insuficientes' }, { status: 400 })
    }

    // validate credential ownership
    const { data: credRow, error: credErr } = await supabaseAdmin.from('whatsapp_credentials').select('id').eq('id', credential_id).eq('user_id', user.id).single()
    if (credErr) return NextResponse.json({ error: 'Credencial inválida', details: credErr.message }, { status: 400 })
    const batch_id = uuidv4()

    const mapped = rows.map((r) => {
      const components = []
      Object.keys(r).forEach((k) => {
        if (k.toLowerCase().startsWith('var') && String(r[k]).length) {
          components.push({ type: 'text', text: String(r[k]) })
        }
      })
      return {
        user_id: user.id,
        credential_id,
        batch_id,
        phone: String(r.phone || '').replace(/\D/g, ''),
        name: r.name || null,
        template_name,
        template_language,
        template_components: components,
        phone_number_id,
        status: 'queued',
        attempt_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    })

    try {
      const { error } = await supabaseAdmin.from('disparo_crm_api').insert(mapped)
      if (error) {
        if (error?.message?.toLowerCase()?.includes('does not exist') || error?.code === '42P01') {
          return NextResponse.json({ error: 'Tabela disparo_crm_api não encontrada. Execute o SQL sugerido.', missingTable: true }, { status: 400 })
        }
        return NextResponse.json({ error: 'Falha ao inserir base', details: error.message }, { status: 400 })
      }
    } catch (e) {
      return NextResponse.json({ error: 'Falha ao inserir base', details: e.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, batch_id, inserted: mapped.length })
  } catch (e) {
    return NextResponse.json({ error: 'Payload inválido', details: e.message }, { status: 400 })
  }
}
