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
    const body = await request.json()
    const batch_id = body?.batch_id || ''
    const includeFailed = !!body?.include_failed
    const limit = Math.min(Math.max(parseInt(body?.limit || '1000', 10) || 1000, 1), 1000)

    if (!batch_id) {
      return NextResponse.json({ error: 'batch_id obrigatório' }, { status: 400 })
    }

    // Buscar registros que seriam enviados
    let query = supabaseAdmin
      .from('sms_disparo')
      .select('*')
      .eq('user_id', user.id)
      .eq('batch_id', batch_id)

    if (includeFailed) {
      query = query.in('status', ['queued', 'failed']).lt('attempt_count', 3)
    } else {
      query = query.eq('status', 'queued')
    }

    query = query.limit(limit)

    const { data: rows, error } = await query

    if (error) {
      return NextResponse.json({ error: 'Falha ao consultar base', details: error.message }, { status: 400 })
    }

    if (!rows || !rows.length) {
      return NextResponse.json({ 
        disponivel: 0,
        invalidos: 0,
        invalidosAnatel: 0,
        naoPerturbe: 0,
        duplicados: 0,
        historicoNegativo: 0,
        total: 0,
        percentDisponivel: 0,
        percentInvalidos: 0,
        percentInvalidosAnatel: 0,
        percentNaoPerturbe: 0,
        percentDuplicados: 0,
        percentHistoricoNegativo: 0
      })
    }

    // Detectar duplicados na própria lista
    const phoneSet = new Set()
    const duplicados = []
    rows.forEach(r => {
      if (phoneSet.has(r.phone)) {
        duplicados.push(r.phone)
      } else {
        phoneSet.add(r.phone)
      }
    })

    // Ler configurações
    const { data: settingsRow } = await supabaseAdmin
      .from('global_settings')
      .select('data')
      .eq('id', 'global')
      .single()
    
    const gs = settingsRow?.data || {}
    const apiToken = gs.smsApiToken
    const smsApiId = Number(gs.smsApiId || 0)
    const webhookUrl = gs.smsWebhookUrl || null

    if (!apiToken) {
      return NextResponse.json({ error: 'Token SMS não configurado' }, { status: 400 })
    }

    // Preparar payload para Kolmeya (simular envio)
    const messages = rows.map(r => ({
      phone: parseInt(r.phone, 10),
      message: r.message,
      reference: r.reference || r.id,
    }))

    const payload = {
      sms_api_id: smsApiId || 0,
      webhook_url: webhookUrl,
      tenant_segment_id: rows[0].tenant_segment_id || null,
      reference: `preview_${batch_id}`,
      messages,
    }

    // Chamar Kolmeya para validação (a API retorna valids/invalids/blacklist/not_disturb)
    try {
      const res = await fetch('https://weebserver6.farolchat.com/webhook/v1/sms/validate', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      // Se não existir endpoint /validate, usar /store mas com flag de dry_run (se suportado)
      // Caso a Kolmeya não tenha endpoint de validação, vamos fazer validação local básica
      if (!res.ok) {
        console.warn('[SMS Preview] Endpoint /validate não disponível, fazendo validação local')
        
        // Validação local básica
        const invalidos = []
        const validosLocal = []
        
        rows.forEach(r => {
          const phone = String(r.phone).replace(/\D/g, '')
          // Validação básica: telefone brasileiro com 10 ou 11 dígitos
          if (phone.length < 10 || phone.length > 11) {
            invalidos.push(r.phone)
          } else {
            validosLocal.push(r.phone)
          }
        })

        const total = rows.length
        const disponivel = validosLocal.length
        const invalidosCount = invalidos.length
        const duplicadosCount = duplicados.length
        
        return NextResponse.json({
          disponivel,
          invalidos: invalidosCount,
          invalidosAnatel: 0, // Não temos como validar localmente
          naoPerturbe: 0, // Não temos como validar localmente
          duplicados: duplicadosCount,
          historicoNegativo: 0, // Não temos como validar localmente
          total,
          percentDisponivel: total > 0 ? ((disponivel / total) * 100).toFixed(2) : 0,
          percentInvalidos: total > 0 ? ((invalidosCount / total) * 100).toFixed(2) : 0,
          percentInvalidosAnatel: '0.00',
          percentNaoPerturbe: '0.00',
          percentDuplicados: total > 0 ? ((duplicadosCount / total) * 100).toFixed(2) : 0,
          percentHistoricoNegativo: '0.00',
          warning: 'Validação local apenas (formato). Para validação completa, configure endpoint /validate na Kolmeya.'
        })
      }

      const json = await res.json()

      const valids = json?.valids || []
      const invalids = json?.invalids || []
      const blacklist = json?.blacklist || []
      const not_disturb = json?.not_disturb || []

      const total = rows.length
      const disponivel = valids.length
      const invalidosCount = invalids.length
      const naoPerturbeCount = Array.isArray(not_disturb) ? not_disturb.length : (not_disturb?.phone ? 1 : 0)
      const blacklistCount = Array.isArray(blacklist) ? blacklist.length : (blacklist?.phone ? 1 : 0)
      const duplicadosCount = duplicados.length

      // Histórico negativo = blacklist (números que já deram problema antes)
      const historicoNegativo = blacklistCount

      return NextResponse.json({
        disponivel,
        invalidos: invalidosCount,
        invalidosAnatel: 0, // Kolmeya não diferencia, mas podemos adicionar se houver campo específico
        naoPerturbe: naoPerturbeCount,
        duplicados: duplicadosCount,
        historicoNegativo,
        total,
        percentDisponivel: total > 0 ? ((disponivel / total) * 100).toFixed(2) : 0,
        percentInvalidos: total > 0 ? ((invalidosCount / total) * 100).toFixed(2) : 0,
        percentInvalidosAnatel: '0.00',
        percentNaoPerturbe: total > 0 ? ((naoPerturbeCount / total) * 100).toFixed(2) : 0,
        percentDuplicados: total > 0 ? ((duplicadosCount / total) * 100).toFixed(2) : 0,
        percentHistoricoNegativo: total > 0 ? ((historicoNegativo / total) * 100).toFixed(2) : 0,
        // Detalhes para debug
        details: {
          validsCount: valids.length,
          invalidsCount: invalids.length,
          blacklistCount,
          notDisturbCount: naoPerturbeCount
        }
      })

    } catch (e) {
      console.error('[SMS Preview] Erro ao validar:', e.message)
      return NextResponse.json({ 
        error: 'Erro ao validar números', 
        details: e.message 
      }, { status: 500 })
    }

  } catch (e) {
    return NextResponse.json({ error: 'Payload inválido', details: e.message }, { status: 400 })
  }
}
