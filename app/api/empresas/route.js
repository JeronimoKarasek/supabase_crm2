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
      
      // Garantir que credits sempre mostre o valor correto (campo credits float)
      const empresasWithCredits = (data || []).map(e => ({
        ...e,
        credits: parseFloat(e.credits) || 0
      }))
      
      return NextResponse.json({ empresas: empresasWithCredits })
    }
    // não admin: retorna apenas empresa vinculada ao usuário
    const { data: link, error: linkErr } = await supabaseAdmin.from('empresa_users').select('empresa_id').eq('user_id', caller.id).single()
    if (linkErr) return NextResponse.json({ empresas: [] })
    if (!link?.empresa_id) return NextResponse.json({ empresas: [] })
    const { data: empresa, error } = await supabaseAdmin.from('empresa').select('*').eq('id', link.empresa_id).single()
    if (error) return NextResponse.json({ empresas: [] })
    
    // Garantir que credits sempre mostre o valor correto (campo credits float)
    const empresaWithCredits = {
      ...empresa,
      credits: parseFloat(empresa.credits) || 0
    }
    
    return NextResponse.json({ empresas: [empresaWithCredits] })
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
    const { nome, cnpj, responsavel, telefone, user_limit } = body || {}
    
    console.log('[POST /api/empresas] Payload recebido:', { nome, cnpj, responsavel, telefone, user_limit })
    
    if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    
    const lim = Number.isFinite(Number(user_limit)) && Number(user_limit) >= 1 ? Number(user_limit) : 1
    
    // Preparar dados para inserção - incluir apenas campos que existem
    const insertData = {
      nome,
      cnpj: cnpj || null,
      responsavel: responsavel || null,
      telefone: telefone || null
    }
    
    // Adicionar user_limit e credits (começa com 0)
    insertData.user_limit = lim
    insertData.credits = 0
    
    console.log('[POST /api/empresas] Dados a inserir:', insertData)
    
    const { data, error } = await supabaseAdmin
      .from('empresa')
      .insert(insertData)
      .select('*')
      .single()
    
    if (error) {
      console.error('[POST /api/empresas] Erro Supabase:', error)
      return NextResponse.json({ 
        error: 'Falha ao criar empresa', 
        details: error.message,
        code: error.code,
        hint: error.hint || 'Verifique se as colunas user_limit e credits existem na tabela empresa'
      }, { status: 400 })
    }
    
    // Garantir que credits sempre mostre o valor correto
    const empresaWithCredits = {
      ...data,
      credits: parseFloat(data.credits) || 0
    }
    
    console.log('[POST /api/empresas] Sucesso:', empresaWithCredits)
    return NextResponse.json({ empresa: empresaWithCredits })
  } catch (e) {
    console.error('[POST /api/empresas] Exception:', e)
    return NextResponse.json({ error: 'Erro interno', details: e.message, stack: e.stack }, { status: 500 })
  }
}

export async function PUT(request) {
  const caller = await getUserFromRequest(request)
  if (!caller) return unauthorized()
  try {
    const role = caller.user_metadata?.role || 'user'
    if (role !== 'admin') return forbidden('Apenas admin pode editar empresas')
    const body = await request.json()
    const { id, nome, cnpj, responsavel, telefone, user_limit, credits } = body || {}
    
    console.log('[PUT /api/empresas] Payload recebido:', { id, nome, cnpj, responsavel, telefone, user_limit, credits })
    
    if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    
    const lim = Number.isFinite(Number(user_limit)) && Number(user_limit) >= 1 ? Number(user_limit) : 1
    
    const updateData = { 
      nome, 
      cnpj: cnpj || null, 
      responsavel: responsavel || null, 
      telefone: telefone || null, 
      user_limit: lim 
    }
    
    // Se credits foi fornecido, atualiza campo credits (float)
    if (credits !== undefined) {
      const creditsFloat = parseFloat(credits) || 0
      updateData.credits = creditsFloat
    }
    
    console.log('[PUT /api/empresas] Valores processados:', updateData)
    
    const { data, error } = await supabaseAdmin
      .from('empresa')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()
    
    if (error) {
      console.error('[PUT /api/empresas] Erro Supabase:', error)
      return NextResponse.json({ 
        error: 'Falha ao atualizar empresa', 
        details: error.message,
        code: error.code,
        hint: error.hint
      }, { status: 400 })
    }
    
    // Garantir que credits sempre mostre o valor correto
    const empresaWithCredits = {
      ...data,
      credits: parseFloat(data.credits) || 0
    }
    
    console.log('[PUT /api/empresas] Sucesso:', empresaWithCredits)
    return NextResponse.json({ empresa: empresaWithCredits })
  } catch (e) {
    console.error('[PUT /api/empresas] Exception:', e)
    return NextResponse.json({ error: 'Erro interno', details: e.message, stack: e.stack }, { status: 500 })
  }
}

export async function DELETE(request) {
  const caller = await getUserFromRequest(request)
  if (!caller) return unauthorized()
  try {
    const role = caller.user_metadata?.role || 'user'
    if (role !== 'admin') return forbidden('Apenas admin pode excluir empresas')
    const body = await request.json()
    const { id } = body || {}
    
    if (!id) return NextResponse.json({ error: 'ID é obrigatório' }, { status: 400 })
    
    // Verificar se há usuários vinculados
    const { count: userCount } = await supabaseAdmin
      .from('empresa_users')
      .select('*', { count: 'exact', head: true })
      .eq('empresa_id', id)
    
    if (userCount > 0) {
      return NextResponse.json({ 
        error: `Não é possível excluir empresa com ${userCount} usuário(s) vinculado(s)` 
      }, { status: 400 })
    }
    
    const { error } = await supabaseAdmin
      .from('empresa')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('[DELETE /api/empresas] Erro:', error)
      return NextResponse.json({ 
        error: 'Falha ao excluir empresa', 
        details: error.message 
      }, { status: 400 })
    }
    
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[DELETE /api/empresas] Exception:', e)
    return NextResponse.json({ error: 'Erro interno', details: e.message }, { status: 500 })
  }
}
