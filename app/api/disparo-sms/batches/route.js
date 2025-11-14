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

export async function GET(request) {
  const user = await getUserFromRequest(request)
  if (!user) return unauthorized()
  try {
    // Determinar hierarquia
    const role = user.user_metadata?.role || 'user'
    let userIdsFilter = null // null => sem filtro (admin)
    if (role === 'gestor') {
      // obter empresa do gestor
      const { data: link } = await supabaseAdmin.from('empresa_users').select('empresa_id').eq('user_id', user.id).single()
      const empresaId = link?.empresa_id
      if (empresaId) {
        const { data: rels } = await supabaseAdmin.from('empresa_users').select('user_id').eq('empresa_id', empresaId)
        userIdsFilter = (rels || []).map(r => r.user_id)
      } else {
        userIdsFilter = [user.id]
      }
    } else if (role !== 'admin') {
      userIdsFilter = [user.id]
    }

    // Buscar TODOS os batch_ids únicos usando paginação (evita limite de 1000 registros)
    console.log('📊 [SMS Batches] Iniciando busca paginada de batch_ids...')
    let allBatchIds = new Set()
    let page = 0
    const pageSize = 1000
    let hasMore = true
    
    while (hasMore) {
      let pageQuery = supabaseAdmin
        .from('sms_disparo')
        .select('batch_id')
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1)
      
      if (Array.isArray(userIdsFilter)) {
        pageQuery = pageQuery.in('user_id', userIdsFilter)
      }
      
      const { data: pageRecords, error: pageError } = await pageQuery
      
      if (pageError) {
        if (pageError?.message?.toLowerCase()?.includes('does not exist') || pageError?.code === '42P01') {
          return NextResponse.json({ batches: [], missingTable: true })
        }
        console.error(`❌ [SMS Batches] Erro na página ${page}:`, pageError)
        return NextResponse.json({ error: 'Falha ao listar batches', details: pageError.message }, { status: 400 })
      }
      
      if (!pageRecords || pageRecords.length === 0) {
        hasMore = false
      } else {
        pageRecords.forEach(r => allBatchIds.add(r.batch_id))
        console.log(`📊 [SMS Batches] Página ${page + 1}: ${pageRecords.length} registros, ${allBatchIds.size} batch_ids únicos acumulados`)
        
        if (pageRecords.length < pageSize) {
          hasMore = false
        }
        page++
      }
    }

    // Extrair batch_ids únicos
    const uniqueBatchIds = Array.from(allBatchIds)
    console.log(`📊 [SMS Batches] Total de campanhas únicas encontradas: ${uniqueBatchIds.length}`)

    if (!uniqueBatchIds.length) {
      return NextResponse.json({ batches: [] })
    }

    // Agora buscar detalhes de cada batch (com limite razoável)
    const batches = []
    
    for (const batchId of uniqueBatchIds) {
      let batchQuery = supabaseAdmin
        .from('sms_disparo')
        .select('batch_id, credential_id, status, reference, tenant_segment_id, created_at, user_id')
        .eq('batch_id', batchId)
      
      if (Array.isArray(userIdsFilter)) {
        batchQuery = batchQuery.in('user_id', userIdsFilter)
      }
      
      const { data: batchRecords } = await batchQuery
      
      if (!batchRecords || !batchRecords.length) continue
      
      // Agregar contadores
      const counts = { total: 0, queued: 0, sent: 0, delivered: 0, failed: 0, blacklist: 0, not_disturb: 0 }
      let oldestCreatedAt = batchRecords[0].created_at
      
      for (const r of batchRecords) {
        counts.total++
        const s = (r.status || 'queued').toLowerCase()
        if (s in counts) counts[s]++
        else counts[s] = 1
        if (new Date(r.created_at) < new Date(oldestCreatedAt)) {
          oldestCreatedAt = r.created_at
        }
      }
      
      batches.push({
        batch_id: batchId,
        credential_id: batchRecords[0].credential_id,
        tenant_segment_id: batchRecords[0].tenant_segment_id,
        reference: batchRecords[0].reference,
        created_at: oldestCreatedAt,
        counts
      })
    }

    // Ordenar por data de criação (mais recentes primeiro)
    batches.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    
    console.log(`📊 [SMS Batches] Retornando ${batches.length} campanhas`)
    return NextResponse.json({ batches })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno', details: e.message }, { status: 500 })
  }
}
