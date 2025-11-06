import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
const credits = require('@/lib/credits')

async function getUserFromAuth(request){
  const auth = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return null
  const token = auth.split(' ')[1]
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error) return null
  return data?.user || null
}

async function resolveUserId(target){
  if (!target) return null
  if (target.includes('-')) return target // assume UUID userId
  // try by email
  try{
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const found = (list?.users || []).find(u => (u.email || '').toLowerCase() === target.toLowerCase())
    return found?.id || null
  }catch{
    return null
  }
}

export async function POST(request){
  try{
    const user = await getUserFromAuth(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check if requester is admin by settings.adminEmails
    const { data: settings } = await supabaseAdmin.from('global_settings').select('data').eq('id','global').single()
    const admins = settings?.data?.adminEmails || []
    const isAdmin = Array.isArray(admins) && admins.map(e => (e||'').toLowerCase()).includes((user.email||'').toLowerCase())
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden: configure adminEmails in global settings' }, { status: 403 })

    const body = await request.json().catch(()=> ({}))
    const { userId: inputUserId, email, amount, cents } = body
    const targetId = inputUserId || await resolveUserId(email)
    if (!targetId) return NextResponse.json({ error: 'userId or email required' }, { status: 400 })

    const valueCents = typeof cents === 'number' ? Math.round(cents) : credits.toCents(amount)
    if (!Number.isFinite(valueCents) || valueCents <= 0) return NextResponse.json({ error: 'amount invalid' }, { status: 400 })

    const newVal = await credits.addCents(targetId, valueCents)
    return NextResponse.json({ ok: true, userId: targetId, balanceCents: newVal, balanceBRL: credits.formatBRL(newVal) })
  }catch(e){
    return NextResponse.json({ error: 'Failed to admin add credits', details: e.message }, { status: 500 })
  }
}
