import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
// CommonJS export; use require for compatibility in Next.js edge/server
const credits = require('@/lib/credits')

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

    // Buscar registros para enviar
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
      if (error?.message?.toLowerCase()?.includes('does not exist') || error?.code === '42P01') {
        return NextResponse.json({ 
          error: 'Tabela sms_disparo não encontrada. Execute o SQL sugerido.', 
          missingTable: true 
        }, { status: 400 })
      }
      return NextResponse.json({ error: 'Falha ao consultar base', details: error.message }, { status: 400 })
    }

    if (!rows || !rows.length) {
      return NextResponse.json({ ok: true, sent: 0, failed: 0, valid: 0, invalid: 0, blacklist: 0, not_disturb: 0 })
    }

    // Ler credencial única dos global settings (despreza credential_id legado)
    const { data: settingsRow, error: settingsErr } = await supabaseAdmin
      .from('global_settings')
      .select('data')
      .eq('id', 'global')
      .single()
    if (settingsErr) {
      return NextResponse.json({ error: 'Falha ao ler configurações globais' }, { status: 500 })
    }
    const gs = settingsRow?.data || {}
    const apiToken = gs.smsApiToken
    const smsApiId = Number(gs.smsApiId || 0)
    const webhookUrl = gs.smsWebhookUrl || null
    if (!apiToken) {
      return NextResponse.json({ error: 'Token SMS não configurado' }, { status: 400 })
    }

    // Preparar payload para Kolmeya (máximo 1000 por vez)
    const messages = rows.map(r => ({
      phone: parseInt(r.phone, 10),
      message: r.message,
      reference: r.reference || r.id,
    }))

    const payload = {
      sms_api_id: smsApiId || 0,
      webhook_url: webhookUrl,
      tenant_segment_id: rows[0].tenant_segment_id || null,
      reference: batch_id,
      messages,
    }

    // Verificar créditos suficientes antes do envio (pre-autorização)
    const pricePerMsg = Number(gs.smsMessageValue || 0)
    const priceCents = credits.toCents(pricePerMsg)
    if (priceCents > 0) {
      const required = priceCents * rows.length
      // Buscar empresa do usuário
      const { data: link } = await supabaseAdmin.from('empresa_users').select('empresa_id').eq('user_id', user.id).single()
      const empresaId = link?.empresa_id || null
      const okBalance = await credits.hasSufficientBalance(user.id, required, empresaId)
      if (!okBalance) {
        const bal = await credits.getBalanceCents(user.id, empresaId)
        return NextResponse.json({ 
          error: 'Saldo insuficiente para enviar esta campanha', 
          balanceBRL: credits.formatBRL(bal)
        }, { status: 402 })
      }
    }

    // Enviar para Kolmeya
    try {
      const res = await fetch('https://weebserver6.farolchat.com/webhook/v1/sms/store', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

  const json = await res.json()

      if (!res.ok) {
        console.error('[DisparoSMS] Falha no envio', { batch_id, error: json })
        return NextResponse.json({ 
          error: 'Falha ao enviar SMS', 
          details: json?.message || 'erro',
          sent: 0,
          failed: rows.length,
        }, { status: res.status })
      }

  const requestId = json?.id || null
  const smsJob = json?.smsJob || json?.job || null
      const valids = json?.valids || []
      const invalids = json?.invalids || []
      const blacklist = json?.blacklist || []
      const not_disturb = json?.not_disturb || []

      // Atualizar status dos registros
      let sentCount = 0, failedCount = 0, blacklistCount = 0, notDisturbCount = 0

      // Válidos (enviados com sucesso)
      for (const v of valids) {
        const row = rows.find(r => (r.reference || r.id) === v.reference)
        if (row) {
          await supabaseAdmin
            .from('sms_disparo')
            .update({
              status: 'sent',
              request_id: requestId,
              sent_at: new Date().toISOString(),
              attempt_count: (row.attempt_count || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('id', row.id)
          sentCount++
        }
      }

      // Inválidos (falha)
      for (const inv of invalids) {
        const row = rows.find(r => r.phone === String(inv.phone))
        if (row) {
          await supabaseAdmin
            .from('sms_disparo')
            .update({
              status: 'failed',
              error_message: inv.error || 'inválido',
              attempt_count: (row.attempt_count || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('id', row.id)
          failedCount++
        }
      }

      // Blacklist
      if (Array.isArray(blacklist)) {
        for (const bl of blacklist) {
          const row = rows.find(r => r.phone === String(bl.phone))
          if (row) {
            await supabaseAdmin
              .from('sms_disparo')
              .update({
                status: 'blacklist',
                error_message: 'blacklist',
                attempt_count: (row.attempt_count || 0) + 1,
                updated_at: new Date().toISOString(),
              })
              .eq('id', row.id)
            blacklistCount++
          }
        }
      }

      // Não perturbe
      if (Array.isArray(not_disturb)) {
        for (const nd of not_disturb) {
          const row = rows.find(r => r.phone === String(nd.phone))
          if (row) {
            await supabaseAdmin
              .from('sms_disparo')
              .update({
                status: 'not_disturb',
                error_message: 'não perturbe',
                attempt_count: (row.attempt_count || 0) + 1,
                updated_at: new Date().toISOString(),
              })
              .eq('id', row.id)
            notDisturbCount++
          }
        }
      }

      // Cobrar apenas mensagens válidas - MÉTODO DIRETO (igual Higienizar Dados)
      let charged = false
      let chargeError = null
      let empresaId = null
      if (priceCents > 0 && valids.length > 0) {
        const totalCents = priceCents * valids.length
        const totalBRL = totalCents / 100.0
        
        const { data: link } = await supabaseAdmin.from('empresa_users').select('empresa_id').eq('user_id', user.id).single()
        empresaId = link?.empresa_id || null
        
        if (!empresaId) {
          chargeError = 'Usuário não vinculado a empresa'
        } else {
          console.log('💰 [SMS Send] Tentando cobrar:', {
            userId: user.id,
            empresaId,
            priceCents,
            validsCount: valids.length,
            totalCents,
            totalBRL
          })
          
          // Buscar saldo atual
          const { data: empresaData } = await supabaseAdmin
            .from('empresa')
            .select('credits')
            .eq('id', empresaId)
            .single()
          
          const currentCredits = parseFloat(empresaData?.credits) || 0
          
          if (currentCredits < totalBRL) {
            charged = false
            chargeError = `Saldo insuficiente. Necessário: R$ ${totalBRL.toFixed(2)} | Disponível: R$ ${currentCredits.toFixed(2)}`
          } else {
            // Descontar diretamente (igual Higienizar Dados)
            const newCredits = Math.max(0, currentCredits - totalBRL)
            
            const { error: updateError } = await supabaseAdmin
              .from('empresa')
              .update({ credits: newCredits })
              .eq('id', empresaId)
            
            if (updateError) {
              console.error('❌ [SMS Send] Erro ao descontar créditos:', updateError)
              charged = false
              chargeError = 'Erro ao atualizar créditos'
            } else {
              console.log('✅ [SMS Send] Créditos descontados!', {
                antes: currentCredits,
                depois: newCredits,
                diferenca: totalBRL
              })
              charged = true
              chargeError = null
            }
          }
        }
      }

      // 🔍 Log detalhado de créditos
      console.log('💰 [SMS Send] Débito de créditos:', {
        charged,
        chargeError,
        pricePerMsg,
        priceCents,
        totalUnits: valids.length,
        totalCostCents: priceCents * valids.length,
        totalCostBRL: pricePerMsg * valids.length,
        empresaId,
        userId: user.id
      })

      return NextResponse.json({ 
        ok: true, 
        sent: sentCount, 
        failed: failedCount,
        blacklist: blacklistCount,
        not_disturb: notDisturbCount,
        valid: valids.length,
        invalid: invalids.length,
        credits: { charged, unitBRL: pricePerMsg, totalUnits: valids.length, error: chargeError },
        requestId,
        smsJob
      })

    } catch (e) {
      console.error('[DisparoSMS] Erro ao enviar', { batch_id, error: e.message })
      return NextResponse.json({ 
        error: 'Erro ao comunicar com Kolmeya', 
        details: e.message 
      }, { status: 500 })
    }

  } catch (e) {
    return NextResponse.json({ error: 'Payload inválido', details: e.message }, { status: 400 })
  }
}
