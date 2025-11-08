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
  console.log('📊 [Balance API] User:', user?.email || 'not authenticated')
  if (!user) return unauthorized()
  try {
    // Ler credencial única dos global settings
    const { data: settingsRow, error: settingsErr } = await supabaseAdmin
      .from('global_settings')
      .select('data')
      .eq('id', 'global')
      .single()
    if (settingsErr) {
      console.error('❌ [Balance API] Settings error:', settingsErr)
      return NextResponse.json({ error: 'Falha ao ler configurações globais' }, { status: 500 })
    }
    const s = settingsRow?.data || {}
    const apiToken = s.smsApiToken
    console.log('📊 [Balance API] Has token:', !!apiToken)
    if (!apiToken) {
      return NextResponse.json({ error: 'Token SMS não configurado' }, { status: 400 })
    }

    console.log('📊 [Balance API] Calling Kolmeya API...')
    const res = await fetch('https://kolmeya.com.br/api/v1/sms/balance', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    })
    const json = await res.json()
    console.log('📊 [Balance API] Kolmeya response:', { ok: res.ok, status: res.status, balance: json?.balance, data: json })
    if (!res.ok) {
      console.error('❌ [Balance API] Kolmeya error:', json)
      let errorMsg = 'Falha ao consultar saldo'
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
    return NextResponse.json({ balance: json?.balance || '0' })
  } catch (e) {
    console.error('❌ [Balance API] Exception:', e)
    return NextResponse.json({ error: 'Erro interno', details: e.message }, { status: 500 })
  }
}
