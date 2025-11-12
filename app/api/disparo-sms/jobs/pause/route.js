import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

async function getUser(request){
  const auth = request.headers.get('authorization') || request.headers.get('Authorization')
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
    const body = await request.json()
    const { smsJob } = body || {}
    if(!smsJob) return NextResponse.json({ error: 'smsJob obrigatório' }, { status: 400 })

    const { data: gs } = await supabaseAdmin.from('global_settings').select('data').eq('id','global').single()
    const apiToken = gs?.data?.smsApiToken
    if(!apiToken) return NextResponse.json({ error: 'Token SMS não configurado' }, { status: 400 })

    const res = await fetch('https://weebserver6.farolchat.com/webhook/v1/sms/jobs/pause', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify({ smsJob })
    })
    const json = await res.json().catch(()=> ({}))
    if(!res.ok){
      return NextResponse.json({ error: 'Falha ao pausar job', details: json }, { status: res.status })
    }
    return NextResponse.json({ ok: true, data: json })
  } catch(e){
    return NextResponse.json({ error: 'Erro interno', details: e.message }, { status: 500 })
  }
}
