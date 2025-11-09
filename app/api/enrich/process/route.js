import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutos
/**
 * Parse JSON com fallback seguro para texto
 */
async function parseJsonSafe(res) {
  try {
    const text = await res.text()
    try {
      return JSON.parse(text)
    } catch (_) {
      return text && text.length ? { raw: text } : {}
    }
  } catch (_) {
    return {}
  }
}

/**
 * Chama endpoint Shift Data com fallbacks:
 * 1) POST com payload minúsculo
 * 2) POST com payload MAIÚSCULO
 * 3) GET /endpoint/{valor}
 * 4) GET /endpoint?chave=valor
 */
async function callShiftDataWithFallbacks(endpoint, bearerToken, payload) {
  const key = Object.keys(payload || {})[0]
  const value = payload ? payload[key] : undefined
  const headersJson = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${bearerToken}`
  }
  const headersGet = {
    'Accept': 'application/json',
    'Authorization': `Bearer ${bearerToken}`
  }

  const attempts = [
    { method: 'POST', url: endpoint, headers: headersJson, body: JSON.stringify(payload) },
    key ? { method: 'POST', url: endpoint, headers: headersJson, body: JSON.stringify({ [key.toUpperCase()]: value }) } : null,
    (value !== undefined) ? { method: 'GET', url: `${endpoint}/${encodeURIComponent(value)}`, headers: headersGet } : null,
    (value !== undefined && key) ? { method: 'GET', url: `${endpoint}?${encodeURIComponent(key)}=${encodeURIComponent(value)}`, headers: headersGet } : null,
  ].filter(Boolean)

  let lastErr = 'Falha na consulta'
  for (const att of attempts) {
    try {
      const res = await fetch(att.url, { method: att.method, headers: att.headers, body: att.body })
      const data = await parseJsonSafe(res)
      if (res.ok) return { ok: true, data }
      lastErr = (typeof data === 'string' ? data : (data?.message || res.statusText || lastErr))
      // Se for 405 Method Not Allowed, tenta próximo fallback
    } catch (e) {
      lastErr = e.message || lastErr
    }
  }
  return { ok: false, error: lastErr }
}
/**
 * Obter endpoint e payload correto baseado no tipo de consulta
 */
function getApiConfig(queryType, value) {
  const cleanValue = (value || '').replace(/\D/g, '') // Remove formatação
  
  switch (queryType) {
    case 'cpf':
      if (!cleanValue || cleanValue.length !== 11) {
        throw new Error('CPF inválido (deve ter 11 dígitos)')
      }
      return {
        endpoint: 'https://api.shiftdata.com.br/api/PessoaFisica',
        payload: { cpf: cleanValue },
        label: 'CPF'
      }
    
    case 'cnpj':
      if (!cleanValue || cleanValue.length !== 14) {
        throw new Error('CNPJ inválido (deve ter 14 dígitos)')
      }
      return {
        endpoint: 'https://api.shiftdata.com.br/api/PessoaJuridica',
        payload: { cnpj: cleanValue },
        label: 'CNPJ'
      }
    
    case 'placa':
      const placa = (value || '').replace(/[^A-Z0-9]/gi, '').toUpperCase()
      if (!placa || placa.length !== 7) {
        throw new Error('Placa inválida (deve ter 7 caracteres)')
      }
      return {
        endpoint: 'https://api.shiftdata.com.br/api/Veiculos',
        payload: { placa },
        label: 'Placa'
      }
    
    case 'telefone':
      if (!cleanValue || cleanValue.length < 10) {
        throw new Error('Telefone inválido (mínimo 10 dígitos)')
      }
      return {
        endpoint: 'https://api.shiftdata.com.br/api/Telefone',
        payload: { telefone: cleanValue },
        label: 'Telefone'
      }
    
    default:
      throw new Error(`Tipo de consulta inválido: ${queryType}`)
  }
}


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

/**
 * POST /api/enrich/process
 * 
 * Processar lote de enriquecimento
 * Body: { lote_id: string }
 */
export async function POST(request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return unauthorized()

    const body = await request.json()
    const { lote_id } = body

    if (!lote_id) {
      return NextResponse.json({ error: 'lote_id não fornecido' }, { status: 400 })
    }

    console.log('🔄 [Enrich Process] Starting lote:', lote_id, 'User:', user.email)

    // Verificar se o job existe e pertence ao usuário
    const { data: job, error: jobError } = await supabaseAdmin
      .from('enrichment_jobs')
      .select('*')
      .eq('lote_id', lote_id)
      .eq('user_email', user.email)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job não encontrado' }, { status: 404 })
    }

    if (job.status === 'processando') {
      return NextResponse.json({ error: 'Job já está sendo processado' }, { status: 400 })
    }

    // Buscar configurações (accessKey e custo)
    const { data: settingsRow } = await supabaseAdmin
      .from('global_settings')
      .select('data')
      .eq('id', 'global')
      .single()

    const settings = settingsRow?.data || {}
    const webhookTokenUrl = settings.shiftDataWebhookToken || 'https://weebserver6.farolchat.com/webhook/gerarToken'
    const costPerQuery = parseFloat(settings.shiftDataCostPerQuery) || 0.07

    // Buscar registros pendentes ANTES de validar saldo
    const { data: records } = await supabaseAdmin
      .from('enrichment_records')
      .select('*')
      .eq('lote_id', lote_id)
      .eq('status', 'pending')
      .limit(1000) // Processar em lotes de até 1000

    if (!records || records.length === 0) {
      await supabaseAdmin
        .from('enrichment_jobs')
        .update({ status: 'concluido', completed_at: new Date().toISOString() })
        .eq('lote_id', lote_id)
      
      return NextResponse.json({ 
        success: true, 
        message: 'Nenhum registro pendente para processar' 
      })
    }

    // Buscar empresa do usuário
    const { data: empresaLink, error: linkError } = await supabaseAdmin
      .from('empresa_users')
      .select('empresa_id')
      .eq('user_id', user.id)
      .single()

    if (linkError || !empresaLink?.empresa_id) {
      return NextResponse.json({ 
        error: 'Usuário não está vinculado a nenhuma empresa' 
      }, { status: 404 })
    }

    // Verificar saldo da empresa antes de processar
    const { data: empresaData, error: empresaError } = await supabaseAdmin
      .from('empresa')
      .select('credits')
      .eq('id', empresaLink.empresa_id)
      .single()

    if (empresaError || !empresaData) {
      return NextResponse.json({ 
        error: 'Empresa não encontrada no sistema' 
      }, { status: 404 })
    }

    const currentCredits = parseFloat(empresaData.credits) || 0
    const requiredCredits = records.length * costPerQuery

    if (currentCredits < requiredCredits) {
      return NextResponse.json({ 
        error: `Saldo insuficiente para processar ${records.length} registros. Necessário: R$ ${requiredCredits.toFixed(2)} | Disponível: R$ ${currentCredits.toFixed(2)}`,
        requiredCredits: requiredCredits,
        availableCredits: currentCredits,
        recordCount: records.length,
        costPerRecord: costPerQuery
      }, { status: 402 })
    }

    // Atualizar status para processando
    await supabaseAdmin
      .from('enrichment_jobs')
      .update({ status: 'processando', updated_at: new Date().toISOString() })
      .eq('lote_id', lote_id)

    console.log('📋 [Enrich Process] Processing', records.length, 'records')

    // 1. Buscar token via webhook
    let authToken = null
    try {
      console.log('🔑 [Enrich Process] Buscando token via webhook:', webhookTokenUrl)
      const tokenRes = await fetch(webhookTokenUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      })
      const tokenData = await parseJsonSafe(tokenRes)
      
      if (!tokenRes.ok) {
        throw new Error(tokenData?.message || tokenData?.error || 'Falha ao obter token do webhook')
      }
      
      // Extrair token de múltiplas estruturas possíveis
      const candidates = [
        tokenData?.token,
        tokenData?.Token,
        tokenData?.access_token,
        tokenData?.accessToken,
        tokenData?.data?.token,
        tokenData?.data?.Token,
        typeof tokenData === 'string' ? tokenData : null
      ]
      authToken = candidates.find(Boolean)
      
      if (!authToken) {
        throw new Error('Token não encontrado na resposta do webhook')
      }
      
      console.log('✅ [Enrich Process] Token obtido com sucesso. Query type:', job.query_type)
    } catch (tokenError) {
      console.error('❌ [Enrich Process] Erro ao buscar token:', tokenError)
      await supabaseAdmin
        .from('enrichment_jobs')
        .update({ 
          status: 'erro', 
          updated_at: new Date().toISOString() 
        })
        .eq('lote_id', lote_id)
      
      return NextResponse.json({ 
        error: 'Erro ao obter token de autenticação', 
        details: tokenError.message 
      }, { status: 500 })
    }

    // 2. Processar cada registro
    let successCount = 0
    let failedCount = 0
    let creditsUsed = 0

    for (const record of records) {
      try {
        // Atualizar status para processing
        await supabaseAdmin
          .from('enrichment_records')
          .update({ status: 'processing' })
          .eq('id', record.id)

        // Obter configuração da API baseada no tipo
        const apiConfig = getApiConfig(record.query_type || job.query_type, record.query_value)
        
        console.log(`🔍 [Enrich] Record ${record.id}: ${apiConfig.label} = ${apiConfig.payload[Object.keys(apiConfig.payload)[0]]}`)
        
        // Consultar API Shift Data com endpoint correto
        const result = await callShiftDataWithFallbacks(apiConfig.endpoint, authToken, apiConfig.payload)
        if (!result.ok) {
          throw new Error(result.error || 'Erro na consulta')
        }

        // Salvar dados enriquecidos
        await supabaseAdmin
          .from('enrichment_records')
          .update({
            status: 'success',
            enriched_data: result.data,
            processed_at: new Date().toISOString(),
            error_message: null
          })
          .eq('id', record.id)

        successCount++
        creditsUsed += costPerQuery

  console.log(`✅ [Enrich] Record ${record.id} success (${apiConfig.label})`)

      } catch (recordError) {
  console.error(`❌ [Enrich] Record ${record.id} error:`, recordError.message)
        
        await supabaseAdmin
          .from('enrichment_records')
          .update({
            status: 'failed',
            error_message: recordError.message,
            processed_at: new Date().toISOString()
          })
          .eq('id', record.id)

        failedCount++
      }

      // Pequeno delay para não sobrecarregar a API
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Atualizar job com totais
    const { data: allRecords } = await supabaseAdmin
      .from('enrichment_records')
      .select('status')
      .eq('lote_id', lote_id)

    const totalProcessed = allRecords?.filter(r => r.status !== 'pending').length || 0
    const totalSuccess = allRecords?.filter(r => r.status === 'success').length || 0
    const totalFailed = allRecords?.filter(r => r.status === 'failed').length || 0
    const isComplete = totalProcessed === job.total_rows

    await supabaseAdmin
      .from('enrichment_jobs')
      .update({
        processed_rows: totalProcessed,
        success_rows: totalSuccess,
        failed_rows: totalFailed,
        credits_used: creditsUsed,
        status: isComplete ? 'concluido' : 'processando',
        completed_at: isComplete ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('lote_id', lote_id)

    // Descontar créditos da empresa
    if (creditsUsed > 0) {
      const newCredits = Math.max(0, currentCredits - creditsUsed)
      
      const { error: updateError } = await supabaseAdmin
        .from('empresa')
        .update({ credits: newCredits })
        .eq('id', empresaLink.empresa_id)

      if (updateError) {
        console.error('❌ [Enrich Process] Erro ao descontar créditos:', updateError)
      } else {
        console.log(`💰 [Enrich Process] Créditos descontados: Empresa ${empresaLink.empresa_id} | ${currentCredits.toFixed(2)} → ${newCredits.toFixed(2)} (${successCount} consultas × R$ ${costPerQuery.toFixed(2)} = R$ ${creditsUsed.toFixed(2)})`)
      }
    }

    console.log('✅ [Enrich Process] Complete! Success:', successCount, 'Failed:', failedCount)

    return NextResponse.json({
      success: true,
      processed: records.length,
      success_count: successCount,
      failed_count: failedCount,
      credits_used: creditsUsed,
      is_complete: isComplete,
      remaining_credits: Math.max(0, currentCredits - creditsUsed)
    })

  } catch (error) {
    console.error('❌ [Enrich Process] Exception:', error)
    return NextResponse.json({ 
      error: 'Erro interno', 
      details: error.message 
    }, { status: 500 })
  }
}
