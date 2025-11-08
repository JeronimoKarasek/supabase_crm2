import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutos
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
    // AccessKey fixa como fallback para o login na Shift Data
    const accessKey = (settings.shiftDataAccessKey || '96FA65CEC7234FFDA72D2D97EA6A457B')
    const costPerQuery = parseFloat(settings.shiftDataCostPerQuery) || 0.10
    // Nunca bloqueia por falta de accessKey, sempre usa fallback

    // Atualizar status para processando
    await supabaseAdmin
      .from('enrichment_jobs')
      .update({ status: 'processando', updated_at: new Date().toISOString() })
      .eq('lote_id', lote_id)

    // Buscar registros pendentes
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

    console.log('📋 [Enrich Process] Processing', records.length, 'records')

    // 1. Fazer login na API Shift Data
    let authToken = null
    try {
      const loginRes = await fetch('https://api.shiftdata.com.br/api/Login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessKey })
      })
      const loginData = await loginRes.json()
      
      if (!loginRes.ok) {
        throw new Error(loginData?.message || 'Falha no login Shift Data')
      }
      
      authToken = loginData?.token || loginData?.data?.token
      if (!authToken) {
        throw new Error('Token não retornado pela API')
      }
      
  console.log('✅ [Enrich Process] Login successful. Query type:', job.query_type)
    } catch (loginError) {
      console.error('❌ [Enrich Process] Login error:', loginError)
      await supabaseAdmin
        .from('enrichment_jobs')
        .update({ 
          status: 'erro', 
          updated_at: new Date().toISOString() 
        })
        .eq('lote_id', lote_id)
      
      return NextResponse.json({ 
        error: 'Erro ao fazer login na API Shift Data', 
        details: loginError.message 
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
        const enrichRes = await fetch(apiConfig.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(apiConfig.payload)
        })

        const enrichData = await enrichRes.json()

        if (!enrichRes.ok) {
          throw new Error(enrichData?.message || 'Erro na consulta')
        }

        // Salvar dados enriquecidos
        await supabaseAdmin
          .from('enrichment_records')
          .update({
            status: 'success',
            enriched_data: enrichData,
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

    console.log('✅ [Enrich Process] Complete! Success:', successCount, 'Failed:', failedCount)

    return NextResponse.json({
      success: true,
      processed: records.length,
      success_count: successCount,
      failed_count: failedCount,
      credits_used: creditsUsed,
      is_complete: isComplete
    })

  } catch (error) {
    console.error('❌ [Enrich Process] Exception:', error)
    return NextResponse.json({ 
      error: 'Erro interno', 
      details: error.message 
    }, { status: 500 })
  }
}
