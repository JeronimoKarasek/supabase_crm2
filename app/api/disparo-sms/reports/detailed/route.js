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

// Formata data recebida (aceita "2025-11-11T21:21" ou "2025-11-11 21:21") para "YYYY-MM-DD HH:mm"
function normalizeDateString(str) {
  if (!str) return ''
  // Remover segundos se existirem e trocar 'T' por espaço
  let s = String(str).trim().replace('T', ' ')
  // Caso venha completo com segundos, corta
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) s = s.slice(0, 16)
  // Validar formato final
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s)) return ''
  return s
}

export async function POST(request) {
  const user = await getUserFromRequest(request)
  if (!user) return unauthorized()

  try {
    const body = await request.json()
    let { start_at, end_at } = body || {}

    start_at = normalizeDateString(start_at)
    end_at = normalizeDateString(end_at)

    if (!start_at || !end_at) {
      return NextResponse.json({ error: 'start_at e end_at são obrigatórios (formato: YYYY-MM-DD HH:mm)' }, { status: 400 })
    }

    const { data: gsData } = await supabaseAdmin
      .from('global_settings')
      .select('data')
      .eq('id', 'global')
      .single()

    const apiToken = gsData?.data?.smsApiToken
    if (!apiToken) return NextResponse.json({ error: 'Token SMS não configurado' }, { status: 400 })

    console.log('[Detailed Reports] Chamando API SMS (statuses):', {
      url: 'https://weebserver6.farolchat.com/webhook/v1/sms/reports/statuses',
      start_at,
      end_at,
      limit: 30000
    })

    const remoteRes = await fetch('https://weebserver6.farolchat.com/webhook/v1/sms/reports/statuses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify({ start_at, end_at, limit: 30000 })
    })

    const remoteJson = await remoteRes.json()
    console.log('[Detailed Reports] Resposta:', { status: remoteRes.status, ok: remoteRes.ok })

    if (!remoteRes.ok) {
      return NextResponse.json({
        error: 'Falha ao consultar API SMS',
        details: remoteJson?.message || remoteJson?.error || remoteJson,
        status: remoteRes.status
      }, { status: remoteRes.status })
    }

    return NextResponse.json({
      messages: remoteJson.messages || [],
      total: (remoteJson.messages || []).length,
      range: { start_at, end_at }
    })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno', details: e.message }, { status: 500 })
  }
}
