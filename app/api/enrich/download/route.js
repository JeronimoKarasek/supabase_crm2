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

    // Gerar CSV combinando dados originais + enriquecidos estruturados
    const headerArray = [
      'status_enriquecimento',
      'erro_enriquecimento',
      // Dados originais
      ...Object.keys(records[0]?.original_data || {}).map(k => `original_${k}`),
      // Dados principais enriquecidos
      'cpf', 'cnpj', 'nome', 'data_nascimento', 'idade', 'sexo', 'nome_mae', 'nome_pai',
      'renda', 'profissao_cbo', 'signo', 'estado_civil',
      // Telefones (até 5)
      'telefone_1', 'whatsapp_1', 'operadora_1',
      'telefone_2', 'whatsapp_2', 'operadora_2',
      'telefone_3', 'whatsapp_3', 'operadora_3',
      'telefone_4', 'whatsapp_4', 'operadora_4',
      'telefone_5', 'whatsapp_5', 'operadora_5',
      // Emails (até 3)
      'email_1', 'email_2', 'email_3',
      // Endereços (até 2)
      'endereco_1_completo', 'endereco_1_cep', 'endereco_1_cidade', 'endereco_1_uf',
      'endereco_2_completo', 'endereco_2_cep', 'endereco_2_cidade', 'endereco_2_uf'
    ]

    const csvLines = [headerArray.join(';')]

    // Adicionar linhas
    records.forEach(r => {
      const result = r.enriched_data?.result || r.enriched_data || {}
      const telefones = result.Telefones || []
      const emails = result.Emails || []
      const enderecos = result.Enderecos || []

      const row = [
        r.status || '',
        r.error_message || '',
        // Dados originais
        ...Object.values(r.original_data || {}).map(v => String(v || '')),
        // Dados principais
        result.CPF || r.cpf || '',
        result.CNPJ || r.cnpj || '',
        result.Nome || '',
        result.DataNascimento ? new Date(result.DataNascimento).toLocaleDateString('pt-BR') : '',
        result.Idade || '',
        result.Sexo || '',
        result.NomeMae || '',
        result.NomePai || '',
        result.Renda || '',
        result.DescricaoCbo || '',
        result.Signo || '',
        result.EstadoCivil || '',
        // Telefones (até 5)
        ...Array.from({length: 5}, (_, i) => {
          const tel = telefones[i]
          if (!tel) return ['', '', '']
          return [
            `(${tel.DDD}) ${tel.Telefone}`,
            tel.WhatsApp ? 'SIM' : 'NAO',
            tel.Operadora || ''
          ]
        }).flat(),
        // Emails (até 3)
        ...Array.from({length: 3}, (_, i) => emails[i]?.Email || ''),
        // Endereços (até 2)
        ...Array.from({length: 2}, (_, i) => {
          const end = enderecos[i]
          if (!end) return ['', '', '', '']
          return [
            end.EnderecoCompleto || `${end.Logradouro || ''}, ${end.Numero || ''} - ${end.Bairro || ''}`,
            end.CEP || '',
            end.Cidade || '',
            end.UF || ''
          ]
        }).flat()
      ]

      csvLines.push(row.map(v => String(v).replace(/;/g, ',')).join(';'))
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
