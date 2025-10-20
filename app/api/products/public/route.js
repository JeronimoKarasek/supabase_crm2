import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request){
  try{
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    let query = supabaseAdmin.from('products').select('id,key,name,description,learn_more_url,pricing,sectors,active').eq('active', true)
    if(key) query = query.eq('key', key)
    const { data, error } = await query
    if(error) return NextResponse.json({ error: error.message }, { status: 400 })
    if(key) return NextResponse.json({ product: data?.[0] || null })
    return NextResponse.json({ products: data || [] })
  }catch(e){
    return NextResponse.json({ error: 'Invalid request', details: e.message }, { status: 400 })
  }
}

