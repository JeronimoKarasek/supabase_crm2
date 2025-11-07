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

// GET - Listar credenciais
export async function GET(request) {
  const user = await getUserFromRequest(request)
  if (!user) return unauthorized()
  try {
    const { data, error } = await supabaseAdmin
      .from('kolmeya_credentials')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      if (error?.message?.toLowerCase()?.includes('does not exist') || error?.code === '42P01') {
        return NextResponse.json({ credentials: [], missingTable: true })
      }
      return NextResponse.json({ error: 'Falha ao listar credenciais', details: error.message }, { status: 400 })
    }

    return NextResponse.json({ credentials: data || [] })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno', details: e.message }, { status: 500 })
  }
}

// POST - Adicionar credencial
export async function POST(request) {
  const user = await getUserFromRequest(request)
  if (!user) return unauthorized()
  try {
    const body = await request.json()
    const { label, api_token, sms_api_id, webhook_url } = body

    if (!label || !api_token) {
      return NextResponse.json({ error: 'label e api_token são obrigatórios' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('kolmeya_credentials')
      .insert({
        user_id: user.id,
        label,
        api_token,
        sms_api_id: sms_api_id || null,
        webhook_url: webhook_url || null,
      })
      .select()
      .single()

    if (error) {
      if (error?.message?.toLowerCase()?.includes('does not exist') || error?.code === '42P01') {
        return NextResponse.json({ error: 'Tabela kolmeya_credentials não encontrada. Execute o SQL sugerido.', missingTable: true }, { status: 400 })
      }
      return NextResponse.json({ error: 'Falha ao adicionar credencial', details: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, credential: data })
  } catch (e) {
    return NextResponse.json({ error: 'Payload inválido', details: e.message }, { status: 400 })
  }
}

// PUT - Atualizar credencial
export async function PUT(request) {
  const user = await getUserFromRequest(request)
  if (!user) return unauthorized()
  try {
    const body = await request.json()
    const { id, label, api_token, sms_api_id, webhook_url } = body

    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('kolmeya_credentials')
      .update({
        label,
        api_token,
        sms_api_id: sms_api_id || null,
        webhook_url: webhook_url || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: 'Falha ao atualizar', details: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Payload inválido', details: e.message }, { status: 400 })
  }
}

// DELETE - Remover credencial
export async function DELETE(request) {
  const user = await getUserFromRequest(request)
  if (!user) return unauthorized()
  try {
    const body = await request.json()
    const { id } = body

    if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('kolmeya_credentials')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: 'Falha ao remover', details: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Payload inválido', details: e.message }, { status: 400 })
  }
}
