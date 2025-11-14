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

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Substitui variáveis {{nome}}, {{cpf}}, {{valor}} etc na mensagem
function replaceVariables(template, row) {
  let result = template
  Object.keys(row).forEach((key) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'gi')
    result = result.replace(regex, String(row[key] || ''))
  })
  return result
}

export async function POST(request) {
  const user = await getUserFromRequest(request)
  if (!user) return unauthorized()
  try {
    const body = await request.json()
    const rows = Array.isArray(body?.rows) ? body.rows : []
    const message_template = body?.message_template || ''
    const tenant_segment_id = body?.tenant_segment_id || null
    const reference_prefix = body?.reference_prefix || ''
    if (!rows.length || !message_template) {
      return NextResponse.json({ error: 'Parâmetros insuficientes' }, { status: 400 })
    }

    // Garante existência de uma credencial placeholder por usuário, para satisfazer FK em sms_disparo
    let placeholderId = null
    try {
      const { data: existing } = await supabaseAdmin
        .from('kolmeya_credentials')
        .select('id')
        .eq('user_id', user.id)
        .eq('label', '__GLOBAL__')
        .limit(1)
        .maybeSingle()
      if (existing?.id) placeholderId = existing.id
      else {
        const { data: created, error: insertErr } = await supabaseAdmin
          .from('kolmeya_credentials')
          .insert({ user_id: user.id, label: '__GLOBAL__', api_token: 'placeholder', sms_api_id: 0, webhook_url: null })
          .select('id')
          .single()
        if (insertErr) throw insertErr
        placeholderId = created?.id
      }
    } catch (e) {
      return NextResponse.json({ error: 'Falha ao garantir credencial placeholder', details: e.message }, { status: 500 })
    }

    // Preparar todos os registros primeiro (filtrar inválidos)
    const allMapped = rows.map((r) => {
      const phone = String(r.phone || '').replace(/\D/g, '')
      const message = replaceVariables(message_template, r)
      const ref = reference_prefix ? `${reference_prefix}_${phone}` : null

      return {
        user_id: user.id,
        credential_id: placeholderId,
        phone,
        name: r.name || null,
        cpf: r.cpf || null,
        message,
        reference: ref,
        tenant_segment_id,
        status: 'queued',
        attempt_count: 0,
      }
    }).filter(r => r.phone.length >= 10) // Filtrar telefones inválidos

    if (!allMapped.length) {
      return NextResponse.json({ error: 'Nenhum telefone válido encontrado' }, { status: 400 })
    }

    console.log(`📨 [SMS Import] Total de ${allMapped.length} registros válidos`)

    // Dividir em lotes de no máximo 1000 linhas
    const BATCH_SIZE = 1000
    const batches = []
    for (let i = 0; i < allMapped.length; i += BATCH_SIZE) {
      batches.push(allMapped.slice(i, i + BATCH_SIZE))
    }

    console.log(`📨 [SMS Import] Dividindo em ${batches.length} campanha(s)`)

    const batchIds = []
    let totalInserted = 0

    // Criar uma campanha separada para cada lote
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batchChunk = batches[batchIndex]
      const batch_id = uuidv4()
      
      // Adicionar batch_id, created_at e updated_at em cada registro
      const recordsWithBatchId = batchChunk.map(r => ({
        ...r,
        batch_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))

      try {
        const { error } = await supabaseAdmin.from('sms_disparo').insert(recordsWithBatchId)
        if (error) {
          if (error?.message?.toLowerCase()?.includes('does not exist') || error?.code === '42P01') {
            return NextResponse.json({ 
              error: 'Tabela sms_disparo não encontrada. Execute o SQL sugerido.', 
              missingTable: true 
            }, { status: 400 })
          }
          console.error(`❌ [SMS Import] Erro ao inserir lote ${batchIndex + 1}:`, error)
          return NextResponse.json({ error: 'Falha ao inserir base', details: error.message }, { status: 400 })
        }
        batchIds.push(batch_id)
        totalInserted += recordsWithBatchId.length
        console.log(`✅ [SMS Import] Campanha ${batchIndex + 1}/${batches.length} criada: ${batch_id} (${recordsWithBatchId.length} registros)`)
      } catch (e) {
        console.error(`❌ [SMS Import] Exception ao inserir lote ${batchIndex + 1}:`, e)
        return NextResponse.json({ error: 'Falha ao inserir base', details: e.message }, { status: 400 })
      }
    }

    return NextResponse.json({ 
      ok: true, 
      batch_id: batchIds[0], // Retorna primeiro batch_id para compatibilidade
      batch_ids: batchIds, // Array com todos os batch_ids criados
      campaigns_created: batches.length,
      inserted: totalInserted 
    })
  } catch (e) {
    return NextResponse.json({ error: 'Payload inválido', details: e.message }, { status: 400 })
  }
}
