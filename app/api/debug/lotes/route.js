import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase-admin.js'

export const dynamic = 'force-dynamic'

async function getUserFromRequest(request) {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return null
  const token = auth.split(' ')[1]
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error) return null
  return data?.user || null
}

export async function GET(request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const result = {
      userEmail: user.email,
      totalRegistros: 0,
      comLoteId: 0,
      semLoteId: 0,
      lotesUnicos: [],
      registrosSemLote: []
    }

    // Total de registros deste usuário
    const { count: total } = await supabaseAdmin
      .from('importar')
      .select('*', { count: 'exact', head: true })
      .eq('cliente', user.email)
    result.totalRegistros = total || 0

    // Com lote_id
    const { count: comLote } = await supabaseAdmin
      .from('importar')
      .select('*', { count: 'exact', head: true })
      .eq('cliente', user.email)
      .not('lote_id', 'is', null)
    result.comLoteId = comLote || 0

    // Sem lote_id
    const { count: semLote } = await supabaseAdmin
      .from('importar')
      .select('*', { count: 'exact', head: true })
      .eq('cliente', user.email)
      .is('lote_id', null)
    result.semLoteId = semLote || 0

    // Listar todos os registros (incluindo lote_id)
    const { data: todos } = await supabaseAdmin
      .from('importar')
      .select('id, lote_id, produto, banco_simulado, status, created_at')
      .eq('cliente', user.email)
      .order('created_at', { ascending: false })
      .limit(50)

    // Agrupar por lote_id
    const lotesMap = new Map()
    todos?.forEach(r => {
      if (r.lote_id) {
        if (!lotesMap.has(r.lote_id)) {
          lotesMap.set(r.lote_id, {
            loteId: r.lote_id,
            produto: r.produto,
            banco: r.banco_simulado,
            status: r.status,
            primeiroRegistro: r.created_at,
            totalRegistros: 0
          })
        }
        lotesMap.get(r.lote_id).totalRegistros++
      } else {
        result.registrosSemLote.push({
          id: r.id,
          produto: r.produto,
          banco: r.banco_simulado,
          created: r.created_at
        })
      }
    })

    result.lotesUnicos = Array.from(lotesMap.values())

    return NextResponse.json(result, { status: 200 })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
