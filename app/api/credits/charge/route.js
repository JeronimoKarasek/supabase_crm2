import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
const credits = require('@/lib/credits')

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
      
      // Validate balance before charging
      const result = await credits.chargeWithValidation(userId, valueCents)
      if (!result.success) {
        return NextResponse.json({ 
          error: result.error, 
          balanceCents: result.newBalance,
          balanceBRL: credits.formatBRL(result.newBalance)
        }, { status: 402 }) // 402 Payment Required
      }
      
      return NextResponse.json({ 
        ok: true, 
        userId, 
        balanceCents: result.newBalance, 
        balanceBRL: credits.formatBRL(result.newBalance) 
      })
    }

    const user = await getUserFromAuth(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!userId) userId = user.id
    if (userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const valueCents = typeof cents === 'number' ? Math.round(cents) : credits.toCents(amount)
    if (!Number.isFinite(valueCents) || valueCents <= 0) return NextResponse.json({ error: 'amount invalid' }, { status: 400 })

    // Validate balance before charging
    const result = await credits.chargeWithValidation(userId, valueCents)
    if (!result.success) {
      return NextResponse.json({ 
        error: result.error, 
        balanceCents: result.newBalance,
        balanceBRL: credits.formatBRL(result.newBalance)
      }, { status: 402 }) // 402 Payment Required
    }
    
    return NextResponse.json({ 
      ok: true, 
      userId, 
      balanceCents: result.newBalance, 
      balanceBRL: credits.formatBRL(result.newBalance) 
    })
  }catch(e){
    return NextResponse.json({ error: 'Failed to charge credits', details: e.message }, { status: 500 })
  }
}
