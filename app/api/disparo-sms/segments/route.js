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
  if (!user) return unauthorized()
  try {
    // Ler credencial única dos global settings
    const { data: settingsRow, error: settingsErr } = await supabaseAdmin
      .from('global_settings')
      .select('data')
      .eq('id', 'global')
      .single()
    if (settingsErr) {
      return NextResponse.json({ error: 'Falha ao ler configurações globais' }, { status: 500 })
    }
    const s = settingsRow?.data || {}
    const apiToken = s.smsApiToken
    if (!apiToken) {
      return NextResponse.json({ error: 'Token SMS não configurado' }, { status: 400 })
    }

    // Chamar API Kolmeya para listar centros de custo
    const res = await fetch('https://kolmeya.com.br/api/v1/sms/segments', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    })

    const json = await res.json()

    if (!res.ok) {
      return NextResponse.json({ 
        error: 'Falha ao buscar centros de custo', 
        details: json?.message || 'erro' 
      }, { status: res.status })
    }

    return NextResponse.json({ segments: json?.segments || [] })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno', details: e.message }, { status: 500 })
  }
}
