import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'


export const dynamic = 'force-dynamic'
export async function GET(request){
  try{
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    // Evitar depender de coluna específica (active/is_active) para compatibilidade
  let query = supabaseAdmin.from('products').select('id,key,name,description,learn_more_url,pricing,sectors,product_type,payment_method,billing_mode')
    if (key) query = query.eq('key', key)
    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    if (key) {
      const p = data?.[0]
      return NextResponse.json({ product: p ? { ...p, productType: p.product_type, paymentMethod: p.payment_method, billingMode: p.billing_mode } : null })
    }
    // Caso exista coluna de status no futuro, podemos filtrar aqui no app
    const products = (Array.isArray(data) ? data : []).map(p => ({ ...p, productType: p.product_type, paymentMethod: p.payment_method, billingMode: p.billing_mode }))
    return NextResponse.json({ products })
  }catch(e){
    return NextResponse.json({ error: 'Invalid request', details: e.message }, { status: 400 })
  }
}

