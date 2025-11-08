import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutos

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
    const accessKey = settings.shiftDataAccessKey
    const costPerQuery = parseFloat(settings.shiftDataCostPerQuery) || 0.10

    if (!accessKey) {
      return NextResponse.json({ 
        error: 'AccessKey do Shift Data não configurado. Configure em /configuracao' 
      }, { status: 400 })
    }

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
      
      console.log('✅ [Enrich Process] Login successful')
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

        const cpf = (record.cpf || '').replace(/\D/g, '') // Remover formatação

        if (!cpf || cpf.length !== 11) {
          throw new Error('CPF inválido')
        }

        // Consultar API Shift Data
        const enrichRes = await fetch('https://api.shiftdata.com.br/api/PessoaFisica', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({ cpf })
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

        console.log(`✅ [Enrich Process] Record ${record.id} success`)

      } catch (recordError) {
        console.error(`❌ [Enrich Process] Record ${record.id} error:`, recordError)
        
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
