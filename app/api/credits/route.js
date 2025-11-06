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

export async function GET(request){
  try{
    const { searchParams } = new URL(request.url)
    const queryUserId = searchParams.get('userId')

    // Allow S2S with INTERNAL_API_KEY to query any user
    const apiKey = getApiKey(request)
    if (apiKey && process.env.INTERNAL_API_KEY && apiKey === process.env.INTERNAL_API_KEY) {
      if (!queryUserId) return NextResponse.json({ error: 'userId required' }, { status: 400 })
      const cents = await credits.getBalanceCents(queryUserId)
      return NextResponse.json({ userId: queryUserId, balanceCents: cents, balanceBRL: credits.formatBRL(cents) })
    }

    // Otherwise, read from authenticated user or explicit same user
    const user = await getUserFromAuth(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const targetUserId = queryUserId && queryUserId !== user.id ? null : user.id
    if (!targetUserId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const cents = await credits.getBalanceCents(targetUserId)
    return NextResponse.json({ userId: targetUserId, balanceCents: cents, balanceBRL: credits.formatBRL(cents) })
  }catch(e){
    return NextResponse.json({ error: 'Failed to get credits', details: e.message }, { status: 500 })
  }
}
