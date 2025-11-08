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

/**
 * POST /api/enrich/upload
 * 
 * Upload planilha para enriquecimento
 * Body: { csv: string, filename?: string }
 */
export async function POST(request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return unauthorized()

    const body = await request.json()
    const { csv, filename } = body

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

    // Verificar se tem CPF
    const hasCpf = headers.some(h => /cpf/.test(h))
    if (!hasCpf) {
      return NextResponse.json({ 
        error: 'CSV deve conter coluna CPF para enriquecimento' 
      }, { status: 400 })
    }

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

    // Inserir registros
    const records = rows.map(row => ({
      lote_id,
      cpf: row.cpf || row.documento || '',
      nome: row.nome || row.name || '',
      telefone: row.telefone || row.phone || row.celular || '',
      email: row.email || '',
      original_data: row,
      status: 'pending'
    }))

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

    console.log('✅ [Enrich Upload] Success! Lote:', lote_id, 'Records:', rows.length)

    return NextResponse.json({
      success: true,
      lote_id,
      total_rows: rows.length,
      message: 'Upload concluído. Aguardando processamento.'
    })

  } catch (error) {
    console.error('❌ [Enrich Upload] Exception:', error)
    return NextResponse.json({ 
      error: 'Erro interno', 
      details: error.message 
    }, { status: 500 })
  }
}
