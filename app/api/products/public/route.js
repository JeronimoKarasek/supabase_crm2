import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'


export const dynamic = 'force-dynamic'
export async function GET(request){
  try{
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    // Evitar depender de coluna específica (active/is_active) para compatibilidade
    let query = supabaseAdmin.from('products').select('id,key,name,description,learn_more_url,pricing,sectors')
    if (key) query = query.eq('key', key)
    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    if (key) return NextResponse.json({ product: data?.[0] || null })
    // Caso exista coluna de status no futuro, podemos filtrar aqui no app
    return NextResponse.json({ products: Array.isArray(data) ? data : [] })
  }catch(e){
    return NextResponse.json({ error: 'Invalid request', details: e.message }, { status: 400 })
  }
}

