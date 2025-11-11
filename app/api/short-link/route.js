import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

function unauthorized(msg = 'Unauthorized') { 
  return NextResponse.json({ error: msg }, { status: 401 }) 
}

async function getUserFromRequest(request) {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return null
  const token = auth.split(' ')[1]
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error) return null
  return data?.user || null
}

// Gerar slug único de 8 caracteres
function generateSlug() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let slug = ''
  for (let i = 0; i < 8; i++) {
    slug += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return slug
}

export async function POST(request) {
  const user = await getUserFromRequest(request)
  if (!user) return unauthorized()

  try {
    const body = await request.json()
    const { realUrl, phone, message } = body

    if (!realUrl) {
      return NextResponse.json({ error: 'realUrl é obrigatório' }, { status: 400 })
    }

    // Gerar slug único (tentar até 5 vezes)
    let slug = null
    let attempts = 0
    while (!slug && attempts < 5) {
      const candidate = generateSlug()
      const { data: existing } = await supabaseAdmin
        .from('short_links')
        .select('id')
        .eq('slug', candidate)
        .single()
      
      if (!existing) {
        slug = candidate
      }
      attempts++
    }

    if (!slug) {
      return NextResponse.json({ error: 'Falha ao gerar slug único' }, { status: 500 })
    }

    // Criar link curto
    const { data, error } = await supabaseAdmin
      .from('short_links')
      .insert({
        slug,
        real_url: realUrl,
        phone,
        message,
        user_id: user.id
      })
      .select()
      .single()

    if (error) {
      console.error('[Short Link] Erro ao criar:', error)
      return NextResponse.json({ error: 'Falha ao criar link curto', details: error.message }, { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://crm.farolbase.com'
    const shortUrl = `${baseUrl}/l/${slug}`

    return NextResponse.json({ 
      ok: true,
      shortUrl,
      slug,
      realUrl: data.real_url
    })

  } catch (e) {
    console.error('[Short Link] Exception:', e)
    return NextResponse.json({ error: 'Payload inválido', details: e.message }, { status: 400 })
  }
}

// Buscar links do usuário
export async function GET(request) {
  const user = await getUserFromRequest(request)
  if (!user) return unauthorized()

  try {
    const { data, error } = await supabaseAdmin
      .from('short_links')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      return NextResponse.json({ error: 'Falha ao buscar links', details: error.message }, { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://crm.farolbase.com'
    const links = (data || []).map(item => ({
      ...item,
      shortUrl: `${baseUrl}/l/${item.slug}`
    }))

    return NextResponse.json({ ok: true, links })

  } catch (e) {
    return NextResponse.json({ error: 'Erro ao buscar links', details: e.message }, { status: 500 })
  }
}
