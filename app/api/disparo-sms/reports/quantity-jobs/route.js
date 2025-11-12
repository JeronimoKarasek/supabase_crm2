import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

async function getUser(req){
  const auth = req.headers.get('authorization') || req.headers.get('Authorization')
  if(!auth || !auth.toLowerCase().startsWith('bearer ')) return null
  const token = auth.split(' ')[1]
  if(!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if(error) return null
  return data?.user || null
}

export async function POST(request){
  const user = await getUser(request)
  if(!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json().catch(()=> ({}))
    let { period } = body
    period = parseInt(period,10)
    if(!Number.isFinite(period) || period <=0) period = 24
    if(period > 168) period = 168

    const { data: gs } = await supabaseAdmin.from('global_settings').select('data').eq('id','global').single()
    const apiToken = gs?.data?.smsApiToken
    if(!apiToken) return NextResponse.json({ error: 'Token SMS não configurado' }, { status: 400 })

    const res = await fetch('https://weebserver6.farolchat.com/webhook/v1/sms/reports/quantity-jobs', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify({ period: String(period) })
    })
    const json = await res.json().catch(()=> ({}))
    if(!res.ok){
      return NextResponse.json({ error: 'Falha ao consultar quantity-jobs', details: json }, { status: res.status })
    }
    return NextResponse.json({ ok: true, period, report: json })
  } catch(e){
    return NextResponse.json({ error: 'Erro interno', details: e.message }, { status: 500 })
  }
}
