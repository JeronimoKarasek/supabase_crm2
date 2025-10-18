import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

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
    const { searchParams } = new URL(request.url)
    const batch_id = searchParams.get('batch_id') || null
    let query = supabaseAdmin.from('disparo_crm_api').select('phone,name,template_name,status,button_clicked,created_at').eq('user_id', user.id)
    if (batch_id) query = query.eq('batch_id', batch_id)
    const { data, error } = await query
    if (error) {
      if (error?.message?.toLowerCase()?.includes('does not exist') || error?.code === '42P01') {
        return NextResponse.json({ error: 'Tabela disparo_crm_api não encontrada.' }, { status: 400 })
      }
      return NextResponse.json({ error: 'Falha ao buscar dados', details: error.message }, { status: 400 })
    }
    const header = ['phone','name','template_name','status','button_clicked','created_at']
    const lines = [header.join(',')]
    for (const r of data || []) {
      const row = [r.phone, r.name || '', r.template_name || '', r.status || '', r.button_clicked || '', (r.created_at || '')]
      lines.push(row.map(v => String(v).replace(/\n|\r|"/g, ' ')).join(','))
    }
    const csv = lines.join('\n')
    return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="relatorio_disparo.csv"' } })
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno', details: e.message }, { status: 500 })
  }
}

