import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

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
    const { data, error } = await supabaseAdmin.from('whatsapp_credentials').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
    if (error) {
      if (error?.message?.toLowerCase()?.includes('does not exist') || error?.code === '42P01') {
        return NextResponse.json({ credentials: [] , missingTable: true })
      }
      return NextResponse.json({ error: 'Falha ao listar credenciais', details: error.message }, { status: 400 })
    }
    return NextResponse.json({ credentials: data || [] })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno', details: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  const user = await getUserFromRequest(request)
  if (!user) return unauthorized()
  try {
    const body = await request.json()
    const { waba_id, access_token, label, webhook_verify_token } = body || {}
    if (!waba_id || !access_token) return NextResponse.json({ error: 'waba_id e access_token são obrigatórios' }, { status: 400 })
    const row = {
      user_id: user.id,
      waba_id: String(waba_id),
      access_token: String(access_token),
      label: label ? String(label) : null,
      webhook_verify_token: webhook_verify_token ? String(webhook_verify_token) : 'verificadorcrm',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await supabaseAdmin.from('whatsapp_credentials').insert(row).select('*').single()
    if (error) return NextResponse.json({ error: 'Falha ao criar credencial', details: error.message }, { status: 400 })
    return NextResponse.json({ credential: data })
  } catch (e) {
    return NextResponse.json({ error: 'Payload inválido', details: e.message }, { status: 400 })
  }
}

export async function PUT(request) {
  const user = await getUserFromRequest(request)
  if (!user) return unauthorized()
  try {
    const body = await request.json()
    const { id, waba_id, access_token, label, webhook_verify_token } = body || {}
    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })
    const patch = { updated_at: new Date().toISOString() }
    if (typeof waba_id === 'string' && waba_id) patch.waba_id = waba_id
    if (typeof access_token === 'string' && access_token) patch.access_token = access_token
    if (typeof label !== 'undefined') patch.label = label
    if (typeof webhook_verify_token === 'string' && webhook_verify_token) patch.webhook_verify_token = webhook_verify_token
    const { data, error } = await supabaseAdmin.from('whatsapp_credentials').update(patch).eq('id', id).eq('user_id', user.id).select('*').single()
    if (error) return NextResponse.json({ error: 'Falha ao atualizar credencial', details: error.message }, { status: 400 })
    return NextResponse.json({ credential: data })
  } catch (e) {
    return NextResponse.json({ error: 'Payload inválido', details: e.message }, { status: 400 })
  }
}

export async function DELETE(request) {
  const user = await getUserFromRequest(request)
  if (!user) return unauthorized()
  try {
    const body = await request.json()
    const { id } = body || {}
    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })
    const { error } = await supabaseAdmin.from('whatsapp_credentials').delete().eq('id', id).eq('user_id', user.id)
    if (error) return NextResponse.json({ error: 'Falha ao remover credencial', details: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Payload inválido', details: e.message }, { status: 400 })
  }
}

