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
 * GET /api/enrich/download?lote_id=xxx
 * 
 * Download resultados do enriquecimento em CSV
 */
export async function GET(request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return unauthorized()

    const { searchParams } = new URL(request.url)
    const lote_id = searchParams.get('lote_id')

    if (!lote_id) {
      return NextResponse.json({ error: 'lote_id não fornecido' }, { status: 400 })
    }

    // Verificar se o job pertence ao usuário
    const { data: job, error: jobError } = await supabaseAdmin
      .from('enrichment_jobs')
      .select('*')
      .eq('lote_id', lote_id)
      .eq('user_email', user.email)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job não encontrado' }, { status: 404 })
    }

    // Buscar todos os registros
    const { data: records, error: recordsError } = await supabaseAdmin
      .from('enrichment_records')
      .select('*')
      .eq('lote_id', lote_id)
      .order('id', { ascending: true })

    if (recordsError) {
      return NextResponse.json({ 
        error: 'Erro ao buscar registros', 
        details: recordsError.message 
      }, { status: 500 })
    }

    if (!records || records.length === 0) {
      return NextResponse.json({ error: 'Nenhum registro encontrado' }, { status: 404 })
    }

    // Gerar CSV combinando dados originais + enriquecidos
    const headers = new Set()
    
    // Adicionar headers dos dados originais
    records.forEach(r => {
      if (r.original_data) {
        Object.keys(r.original_data).forEach(k => headers.add(`original_${k}`))
      }
    })

    // Adicionar headers dos dados enriquecidos
    headers.add('status_enriquecimento')
    headers.add('erro_enriquecimento')
    records.forEach(r => {
      if (r.enriched_data) {
        Object.keys(r.enriched_data).forEach(k => headers.add(`enriquecido_${k}`))
      }
    })

    const headerArray = Array.from(headers)
    const csvLines = [headerArray.join(';')]

    // Adicionar linhas
    records.forEach(r => {
      const row = []
      headerArray.forEach(h => {
        if (h === 'status_enriquecimento') {
          row.push(r.status || '')
        } else if (h === 'erro_enriquecimento') {
          row.push(r.error_message || '')
        } else if (h.startsWith('original_')) {
          const key = h.replace('original_', '')
          row.push(r.original_data?.[key] || '')
        } else if (h.startsWith('enriquecido_')) {
          const key = h.replace('enriquecido_', '')
          const value = r.enriched_data?.[key]
          row.push(typeof value === 'object' ? JSON.stringify(value) : (value || ''))
        } else {
          row.push('')
        }
      })
      csvLines.push(row.join(';'))
    })

    const csv = csvLines.join('\n')

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="enriquecimento_${lote_id.slice(0, 12)}.csv"`
      }
    })

  } catch (error) {
    console.error('❌ [Enrich Download] Exception:', error)
    return NextResponse.json({ 
      error: 'Erro interno', 
      details: error.message 
    }, { status: 500 })
  }
}
