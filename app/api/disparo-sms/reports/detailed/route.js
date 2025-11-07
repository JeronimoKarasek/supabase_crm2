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

export async function POST(request) {
  const user = await getUserFromRequest(request)
  if (!user) return unauthorized()

  try {
    const body = await request.json()
    const { start_at, end_at } = body || {}

    if (!start_at || !end_at) {
      return NextResponse.json({ error: 'start_at e end_at são obrigatórios (formato: YYYY-MM-DD HH:mm)' }, { status: 400 })
    }

    // Buscar token da API SMS (global_settings)
    const { data: gsData } = await supabaseAdmin
      .from('global_settings')
      .select('data')
      .eq('id', 'global')
      .single()

    const apiToken = gsData?.data?.smsApiToken
    if (!apiToken) {
      return NextResponse.json({ error: 'Token SMS não configurado' }, { status: 400 })
    }

    // Chamar API Kolmeya
    console.log('[Detailed Reports] Chamando API Kolmeya:', {
      url: 'https://kolmeya.com.br/api/v1/sms/reports/statuses',
      start_at,
      end_at,
      limit: 30000,
      hasToken: !!apiToken
    })

    const kolmeyaRes = await fetch('https://kolmeya.com.br/api/v1/sms/reports/statuses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify({
        start_at,
        end_at,
        limit: 30000
      })
    })

    const kolmeyaData = await kolmeyaRes.json()

    console.log('[Detailed Reports] Resposta Kolmeya:', {
      status: kolmeyaRes.status,
      ok: kolmeyaRes.ok,
      data: kolmeyaData
    })

    if (!kolmeyaRes.ok) {
      console.error('[Detailed Reports] Erro Kolmeya:', kolmeyaData)
      return NextResponse.json({ 
        error: 'Falha ao consultar API SMS', 
        details: kolmeyaData?.message || kolmeyaData?.error || JSON.stringify(kolmeyaData) || 'Erro desconhecido',
        status: kolmeyaRes.status
      }, { status: kolmeyaRes.status })
    }

    return NextResponse.json({ 
      messages: kolmeyaData.messages || [],
      total: (kolmeyaData.messages || []).length
    })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno', details: e.message }, { status: 500 })
  }
}
