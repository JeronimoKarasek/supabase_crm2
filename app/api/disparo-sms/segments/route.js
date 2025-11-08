import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

function unauthorized(msg = 'Unauthorized') { return NextResponse.json({ error: msg }, { status: 401 }) }

async function getUserFromRequest(request) {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return null
  const token = auth.split(' ')[1]
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error) return null
  return data?.user || null
}

export async function POST(request) {
  const user = await getUserFromRequest(request)
  console.log('📋 [Segments API] User:', user?.email || 'not authenticated')
  if (!user) return unauthorized()
  try {
    // Ler credencial única dos global settings
    const { data: settingsRow, error: settingsErr } = await supabaseAdmin
      .from('global_settings')
      .select('data')
      .eq('id', 'global')
      .single()
    if (settingsErr) {
      console.error('❌ [Segments API] Settings error:', settingsErr)
      return NextResponse.json({ error: 'Falha ao ler configurações globais' }, { status: 500 })
    }
    const s = settingsRow?.data || {}
    const apiToken = s.smsApiToken
    console.log('📋 [Segments API] Has token:', !!apiToken)
    if (!apiToken) {
      return NextResponse.json({ error: 'Token SMS não configurado' }, { status: 400 })
    }

    // Chamar API Kolmeya para listar centros de custo
    console.log('📋 [Segments API] Calling Kolmeya API...')
    const res = await fetch('https://kolmeya.com.br/api/v1/sms/segments', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    })

    const json = await res.json()
    console.log('📋 [Segments API] Kolmeya response:', { ok: res.ok, status: res.status, segments: json?.segments?.length || 0, data: json })

    if (!res.ok) {
      console.error('❌ [Segments API] Kolmeya error:', json)
      let errorMsg = 'Falha ao buscar centros de custo'
      if (res.status === 403) {
        errorMsg = 'Token SMS inválido ou sem permissão. Verifique o token em Configurações.'
      } else if (res.status === 401) {
        errorMsg = 'Token SMS não autorizado. Verifique o token em Configurações.'
      }
      return NextResponse.json({ 
        error: errorMsg, 
        details: json?.message || json?.error || 'Erro desconhecido',
        status: res.status
      }, { status: res.status })
    }

    return NextResponse.json({ segments: json?.segments || [] })
  } catch (e) {
    console.error('❌ [Segments API] Exception:', e)
    return NextResponse.json({ error: 'Erro interno', details: e.message }, { status: 500 })
  }
}
