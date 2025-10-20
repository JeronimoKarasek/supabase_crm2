import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

function unauthorized(msg='Unauthorized'){ return NextResponse.json({ error: msg }, { status: 401 }) }
function forbidden(msg='Forbidden'){ return NextResponse.json({ error: msg }, { status: 403 }) }

async function getUser(request){
  const auth = request.headers.get('authorization') || request.headers.get('Authorization')
  if(!auth || !auth.toLowerCase().startsWith('bearer ')) return null
  const token = auth.split(' ')[1]
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if(error) return null
  return data?.user || null
}

function isAdminOrBuilder(user){
  const role = user?.user_metadata?.role || 'viewer'
  const sectors = Array.isArray(user?.user_metadata?.sectors) ? user.user_metadata.sectors : []
  return role === 'admin' || sectors.includes('Criação de produtos')
}

export async function GET(request){
  const user = await getUser(request)
  if(!user) return unauthorized()
  if(!isAdminOrBuilder(user)) return forbidden()
  const { data, error } = await supabaseAdmin.from('products').select('*').order('created_at', { ascending: false })
  if(error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ products: data || [] })
}

export async function POST(request){
  const user = await getUser(request)
  if(!user) return unauthorized()
  if(!isAdminOrBuilder(user)) return forbidden()
  try{
    const body = await request.json()
    const row = {
      key: body.key,
      name: body.name,
      description: body.description || null,
      learn_more_url: body.learn_more_url || null,
      webhook_url: body.webhook_url || null,
      sectors: Array.isArray(body.sectors) ? body.sectors : [],
      pricing: body.pricing || null,
      active: body.active !== false,
    }
    if(!row.key || !row.name) return NextResponse.json({ error: 'key e name são obrigatórios' }, { status: 400 })
    const { data, error } = await supabaseAdmin.from('products').insert(row).select('*').single()
    if(error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ product: data })
  }catch(e){
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}

export async function PUT(request){
  const user = await getUser(request)
  if(!user) return unauthorized()
  if(!isAdminOrBuilder(user)) return forbidden()
  try{
    const body = await request.json()
    const id = body.id
    if(!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })
    const patch = {}
    ;['key','name','description','learn_more_url','webhook_url','pricing','active'].forEach(f=>{ if(typeof body[f] !== 'undefined') patch[f]=body[f] })
    if(Array.isArray(body.sectors)) patch.sectors = body.sectors
    const { data, error } = await supabaseAdmin.from('products').update(patch).eq('id', id).select('*').single()
    if(error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ product: data })
  }catch(e){
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}

export async function DELETE(request){
  const user = await getUser(request)
  if(!user) return unauthorized()
  if(!isAdminOrBuilder(user)) return forbidden()
  try{
    const body = await request.json()
    const id = body.id
    if(!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })
    const { error } = await supabaseAdmin.from('products').delete().eq('id', id)
    if(error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }catch(e){
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}

