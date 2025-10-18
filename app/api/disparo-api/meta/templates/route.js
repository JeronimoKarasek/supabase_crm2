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
    const { searchParams } = new URL(request.url)
    const credential_id = searchParams.get('credential_id')
    if (!credential_id) return NextResponse.json({ error: 'credential_id é obrigatório' }, { status: 400 })
    const { data: credRow, error: credErr } = await supabaseAdmin.from('whatsapp_credentials').select('*').eq('id', credential_id).eq('user_id', user.id).single()
    if (credErr) return NextResponse.json({ error: 'Credencial não encontrada', details: credErr.message }, { status: 404 })

    const waba = credRow.waba_id
    const token = credRow.access_token
    const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(waba)}/message_templates?limit=200`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    const json = await res.json()
    if (!res.ok) return NextResponse.json({ error: 'Falha ao buscar templates', details: json?.error?.message || 'erro' }, { status: res.status })
    const list = (json?.data || []).map(t => ({ name: t.name, language: t.language, status: t.status, category: t.category }))
    return NextResponse.json({ templates: list })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno', details: e.message }, { status: 500 })
  }
}

