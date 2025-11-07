import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

function unauthorized(msg = 'Unauthorized') { return NextResponse.json({ error: msg }, { status: 401 }) }
function forbidden(msg = 'Forbidden') { return NextResponse.json({ error: msg }, { status: 403 }) }

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
  const caller = await getUserFromRequest(request)
  if (!caller) return unauthorized()
  try {
    const role = caller.user_metadata?.role || 'user'
    if (role === 'admin') {
      const { data, error } = await supabaseAdmin.from('empresa').select('*').order('created_at', { ascending: false })
      if (error) return NextResponse.json({ error: 'Falha ao listar empresas', details: error.message }, { status: 400 })
      return NextResponse.json({ empresas: data || [] })
    }
    // não admin: retorna apenas empresa vinculada ao usuário
    const { data: link, error: linkErr } = await supabaseAdmin.from('empresa_users').select('empresa_id').eq('user_id', caller.id).single()
    if (linkErr) return NextResponse.json({ empresas: [] })
    if (!link?.empresa_id) return NextResponse.json({ empresas: [] })
    const { data: empresa, error } = await supabaseAdmin.from('empresa').select('*').eq('id', link.empresa_id).single()
    if (error) return NextResponse.json({ empresas: [] })
    return NextResponse.json({ empresas: [empresa] })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno', details: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  const caller = await getUserFromRequest(request)
  if (!caller) return unauthorized()
  try {
    const role = caller.user_metadata?.role || 'user'
    if (role !== 'admin') return forbidden('Apenas admin pode criar empresas')
    const body = await request.json()
    const { nome, cnpj, responsavel, telefone } = body || {}
    if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    const { data, error } = await supabaseAdmin.from('empresa').insert({ nome, cnpj, responsavel, telefone }).select('*').single()
    if (error) return NextResponse.json({ error: 'Falha ao criar empresa', details: error.message }, { status: 400 })
    return NextResponse.json({ empresa: data })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno', details: e.message }, { status: 500 })
  }
}
