import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

function unauthorized(msg = 'Unauthorized') {
  return NextResponse.json({ error: msg }, { status: 401 })
}

/**
 * Normaliza CPF: remove pontuação e adiciona zeros à esquerda até 11 dígitos
 */
function normalizeCPF(cpf) {
  if (!cpf) return ''
  // Remove tudo que não é número
  const onlyNumbers = String(cpf).replace(/\D/g, '')
  // Adiciona zeros à esquerda até completar 11 dígitos
  return onlyNumbers.padStart(11, '0')
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
 * POST /api/enrich/upload
 * 
 * Upload planilha para enriquecimento
 * Body: { csv: string, filename?: string, type?: 'cpf'|'cnpj'|'placa'|'telefone' }
 */
export async function POST(request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return unauthorized()

  const body = await request.json()
  const { csv, filename, type: overrideTypeRaw } = body

    if (!csv) {
      return NextResponse.json({ error: 'CSV não fornecido' }, { status: 400 })
    }

    console.log('📤 [Enrich Upload] User:', user.email, 'Filename:', filename)

    // Parse CSV
    const lines = csv.trim().split('\n').filter(l => l.trim())
    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV vazio ou inválido' }, { status: 400 })
    }

    const headers = lines[0].split(/[;,\t]/).map(h => h.trim().toLowerCase())
    const rows = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(/[;,\t]/)
      const row = {}
      headers.forEach((h, idx) => {
        row[h] = values[idx]?.trim() || ''
      })
      rows.push(row)
    }

  // Detectar tipo de consulta baseado nas colunas (ou sobrescrever se vier no body)
  let queryType = null
    let queryColumn = null
    
    // Prioridade: CPF > CNPJ > Placa > Telefone
    const overrideType = typeof overrideTypeRaw === 'string' ? overrideTypeRaw.toLowerCase() : null
    const validTypes = ['cpf','cnpj','placa','telefone']

    if (overrideType && validTypes.includes(overrideType)) {
      queryType = overrideType
    }

    if (!queryType && headers.some(h => /^cpf$/i.test(h))) {
      queryType = 'cpf'
      queryColumn = headers.find(h => /^cpf$/i.test(h))
    } else if (!queryType && headers.some(h => /^cnpj$/i.test(h))) {
      queryType = 'cnpj'
      queryColumn = headers.find(h => /^cnpj$/i.test(h))
    } else if (!queryType && headers.some(h => /^placa$/i.test(h))) {
      queryType = 'placa'
      queryColumn = headers.find(h => /^placa$/i.test(h))
    } else if (!queryType && headers.some(h => /^telefone$|^phone$|^celular$/i.test(h))) {
      queryType = 'telefone'
      queryColumn = headers.find(h => /^telefone$|^phone$|^celular$/i.test(h))
    }
    
    if (!queryType) {
      return NextResponse.json({ 
        error: 'CSV deve conter coluna CPF, CNPJ, Placa ou Telefone para enriquecimento' 
      }, { status: 400 })
    }

    // Validar que a coluna correspondente existe quando o tipo é sobrescrito
    if (!queryColumn) {
      if (queryType === 'cpf') queryColumn = headers.find(h => /^cpf$/i.test(h))
      if (queryType === 'cnpj') queryColumn = headers.find(h => /^cnpj$/i.test(h))
      if (queryType === 'placa') queryColumn = headers.find(h => /^placa$/i.test(h))
      if (queryType === 'telefone') queryColumn = headers.find(h => /^telefone$|^phone$|^celular$/i.test(h))
    }
    if (!queryColumn) {
      return NextResponse.json({ error: `Para tipo '${queryType}', inclua uma coluna correspondente no CSV (ex.: ${queryType})` }, { status: 400 })
    }
    
    console.log('🔍 [Enrich Upload] Query type detected:', queryType, 'Column:', queryColumn)

    // Gerar lote_id único
    const lote_id = `enrich_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Criar job
    const { data: jobData, error: jobError } = await supabaseAdmin
      .from('enrichment_jobs')
      .insert({
        lote_id,
        user_email: user.email,
        user_id: user.id,
        filename: filename || 'upload.csv',
  query_type: queryType,
        status: 'pendente',
        total_rows: rows.length,
        processed_rows: 0
      })
      .select()
      .single()

    if (jobError) {
      console.error('❌ [Enrich Upload] Error creating job:', jobError)
      return NextResponse.json({ 
        error: 'Erro ao criar job', 
        details: jobError.message 
      }, { status: 500 })
    }

    // Inserir registros (normalizando CPF quando necessário)
    const records = rows.map(row => {
      const rawValue = row[queryColumn] || ''
      const normalizedValue = queryType === 'cpf' ? normalizeCPF(rawValue) : rawValue
      
      return {
        lote_id,
        query_type: queryType,
        query_value: normalizedValue,
        cpf: queryType === 'cpf' ? normalizedValue : '',
        cnpj: queryType === 'cnpj' ? rawValue : '',
        placa: queryType === 'placa' ? rawValue : '',
        telefone: queryType === 'telefone' ? rawValue : (row.telefone || row.phone || row.celular || ''),
        nome: row.nome || row.name || '',
        email: row.email || '',
        original_data: row,
        status: 'pending'
      }
    })

    const { error: recordsError } = await supabaseAdmin
      .from('enrichment_records')
      .insert(records)

    if (recordsError) {
      console.error('❌ [Enrich Upload] Error inserting records:', recordsError)
      // Rollback: deletar job
      await supabaseAdmin.from('enrichment_jobs').delete().eq('lote_id', lote_id)
      return NextResponse.json({ 
        error: 'Erro ao inserir registros', 
        details: recordsError.message 
      }, { status: 500 })
    }

  console.log('✅ [Enrich Upload] Success! Lote:', lote_id, 'Type:', queryType, 'Records:', rows.length)

    return NextResponse.json({
      success: true,
  query_type: queryType,
      lote_id,
      total_rows: rows.length,
  message: `Upload concluído (${queryType.toUpperCase()}). Aguardando processamento.`
    })

  } catch (error) {
    console.error('❌ [Enrich Upload] Exception:', error)
    return NextResponse.json({ 
      error: 'Erro interno', 
      details: error.message 
    }, { status: 500 })
  }
}
