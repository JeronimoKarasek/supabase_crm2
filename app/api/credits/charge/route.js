import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
const credits = require('@/lib/credits')

export const dynamic = 'force-dynamic'

function getApiKey(request){
  return request.headers.get('x-api-key') || request.headers.get('X-Api-Key') || ''
}

async function getUserFromAuth(request){
  const auth = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return null
  const token = auth.split(' ')[1]
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error) return null
  return data?.user || null
}

export async function POST(request){
  try{
    const body = await request.json().catch(()=> ({}))
    let { userId, amount, cents } = body

    const apiKey = getApiKey(request)
    // S2S path using x-api-key
    if (apiKey) {
      if (!process.env.INTERNAL_API_KEY) {
        return NextResponse.json({ error: 'Unauthorized (server missing INTERNAL_API_KEY)' }, { status: 401 })
      }
      if (apiKey !== process.env.INTERNAL_API_KEY) {
        return NextResponse.json({ error: 'Unauthorized (invalid x-api-key)' }, { status: 401 })
      }
      if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
  const valueCents = typeof cents === 'number' ? Math.round(cents) : credits.toCents(amount)
      if (!Number.isFinite(valueCents) || valueCents <= 0) return NextResponse.json({ error: 'amount invalid' }, { status: 400 })
  // Buscar empresa do usuário alvo
  const { data: link } = await supabaseAdmin.from('empresa_users').select('empresa_id').eq('user_id', userId).single()
  const empresaId = link?.empresa_id || null
  
  if (!empresaId) {
    return NextResponse.json({ error: 'Usuário não vinculado a empresa' }, { status: 404 })
  }
  
  // MÉTODO DIRETO: Buscar saldo e cobrar (igual Higienizar Dados)
  const valueBRL = valueCents / 100.0
  const { data: empresaData } = await supabaseAdmin.from('empresa').select('credits').eq('id', empresaId).single()
  const currentCredits = parseFloat(empresaData?.credits) || 0
  
  if (currentCredits < valueBRL) {
    return NextResponse.json({ 
      error: 'Saldo insuficiente', 
      balanceCents: Math.round(currentCredits * 100),
      balanceBRL: credits.formatBRL(Math.round(currentCredits * 100))
    }, { status: 402 })
  }
  
  const newCredits = Math.max(0, currentCredits - valueBRL)
  const { error: updateError } = await supabaseAdmin.from('empresa').update({ credits: newCredits }).eq('id', empresaId)
  
  if (updateError) {
    return NextResponse.json({ error: 'Erro ao atualizar créditos' }, { status: 500 })
  }
  
  return NextResponse.json({ 
    ok: true, 
    userId, 
    balanceCents: Math.round(newCredits * 100), 
    balanceBRL: credits.formatBRL(Math.round(newCredits * 100))
  })
    }

    const user = await getUserFromAuth(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!userId) userId = user.id
    if (userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const valueCents = typeof cents === 'number' ? Math.round(cents) : credits.toCents(amount)
    if (!Number.isFinite(valueCents) || valueCents <= 0) return NextResponse.json({ error: 'amount invalid' }, { status: 400 })

  // Buscar empresa do usuário autenticado
  const { data: link } = await supabaseAdmin.from('empresa_users').select('empresa_id').eq('user_id', userId).single()
  const empresaId = link?.empresa_id || null

  if (!empresaId) {
    return NextResponse.json({ error: 'Usuário não vinculado a empresa' }, { status: 404 })
  }

  // MÉTODO DIRETO: Buscar saldo e cobrar (igual Higienizar Dados)
  const valueBRL = valueCents / 100.0
  const { data: empresaData } = await supabaseAdmin.from('empresa').select('credits').eq('id', empresaId).single()
  const currentCredits = parseFloat(empresaData?.credits) || 0
  
  if (currentCredits < valueBRL) {
    return NextResponse.json({ 
      error: 'Saldo insuficiente', 
      balanceCents: Math.round(currentCredits * 100),
      balanceBRL: credits.formatBRL(Math.round(currentCredits * 100))
    }, { status: 402 })
  }
  
  const newCredits = Math.max(0, currentCredits - valueBRL)
  const { error: updateError } = await supabaseAdmin.from('empresa').update({ credits: newCredits }).eq('id', empresaId)
  
  if (updateError) {
    return NextResponse.json({ error: 'Erro ao atualizar créditos' }, { status: 500 })
  }
  
  return NextResponse.json({ 
    ok: true, 
    userId, 
    balanceCents: Math.round(newCredits * 100), 
    balanceBRL: credits.formatBRL(Math.round(newCredits * 100))
  })
  }catch(e){
    return NextResponse.json({ error: 'Failed to charge credits', details: e.message }, { status: 500 })
  }
}
