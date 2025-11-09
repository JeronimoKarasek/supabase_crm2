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

export async function GET(request){
  try{
    const { searchParams } = new URL(request.url)
    const queryUserId = searchParams.get('userId')

    // Allow S2S with INTERNAL_API_KEY to query any user
    const apiKey = getApiKey(request)
    if (apiKey) {
      if (!process.env.INTERNAL_API_KEY) {
        return NextResponse.json({ error: 'Unauthorized (server missing INTERNAL_API_KEY)' }, { status: 401 })
      }
      if (apiKey !== process.env.INTERNAL_API_KEY) {
        return NextResponse.json({ error: 'Unauthorized (invalid x-api-key)' }, { status: 401 })
      }
      if (!queryUserId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
      
      // Buscar empresa do usuário
      const { data: empresaLink } = await supabaseAdmin
        .from('empresa_users')
        .select('empresa_id')
        .eq('user_id', queryUserId)
        .single()
      
      if (!empresaLink?.empresa_id) {
        return NextResponse.json({ 
          userId: queryUserId, 
          balanceCents: 0, 
          balanceBRL: 'R$ 0,00',
          warning: 'Usuário não vinculado a empresa' 
        })
      }
      
      // Buscar créditos da empresa
      const { data: empresa } = await supabaseAdmin
        .from('empresa')
        .select('credits')
        .eq('id', empresaLink.empresa_id)
        .single()
      
      const creditsInReais = parseFloat(empresa?.credits) || 0
      const cents = Math.round(creditsInReais * 100)
      
      return NextResponse.json({ 
        userId: queryUserId, 
        empresaId: empresaLink.empresa_id,
        balanceCents: cents, 
        balanceBRL: credits.formatBRL(cents) 
      })
    }

    // Otherwise, read from authenticated user
    const user = await getUserFromAuth(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const targetUserId = queryUserId && queryUserId !== user.id ? null : user.id
    if (!targetUserId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    
    // Buscar empresa do usuário autenticado
    const { data: empresaLink } = await supabaseAdmin
      .from('empresa_users')
      .select('empresa_id')
      .eq('user_id', targetUserId)
      .single()
    
    if (!empresaLink?.empresa_id) {
      return NextResponse.json({ 
        userId: targetUserId, 
        balanceCents: 0, 
        balanceBRL: 'R$ 0,00',
        warning: 'Usuário não vinculado a empresa' 
      })
    }
    
    // Buscar créditos da empresa
    const { data: empresa } = await supabaseAdmin
      .from('empresa')
      .select('credits')
      .eq('id', empresaLink.empresa_id)
      .single()
    
    const creditsInReais = parseFloat(empresa?.credits) || 0
    const cents = Math.round(creditsInReais * 100)
    
    return NextResponse.json({ 
      userId: targetUserId, 
      empresaId: empresaLink.empresa_id,
      balanceCents: cents, 
      balanceBRL: credits.formatBRL(cents) 
    })
  }catch(e){
    return NextResponse.json({ error: 'Failed to get credits', details: e.message }, { status: 500 })
  }
}
