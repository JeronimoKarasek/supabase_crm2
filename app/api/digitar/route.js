import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase-admin.js'


export const dynamic = 'force-dynamic'
async function getUserFromRequest(request) {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return null
  const token = auth.split(' ')[1]
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error) return null
  return data?.user || null
}

async function readSettings() {
  const { data } = await supabaseAdmin.from('global_settings').select('data').eq('id', 'global').single()
  return data?.data || {}
}

export async function POST(request) {
  try {
    const user = await getUserFromRequest(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json()
    const { bankKey, cpf, payload, product } = body || {}
    if (!bankKey || !cpf) return NextResponse.json({ error: 'bankKey e cpf são obrigatórios' }, { status: 400 })

    const settings = await readSettings()
    const banks = Array.isArray(settings?.banks) ? settings.banks : []
    const bank = banks.find(b => b.key === bankKey)
    if (!bank) return NextResponse.json({ error: 'Banco não configurado' }, { status: 400 })

    let target = bank.webhookDigitar || null
    if (product && Array.isArray(bank.productConfigs)) {
      const pc = bank.productConfigs.find(p => p.product === product)
      if (pc && pc.webhookDigitar) target = pc.webhookDigitar
    }
    if (!target) return NextResponse.json({ error: 'Webhook digitar não configurado' }, { status: 400 })

    // Load user credentials for this bank
    const { data: credRow } = await supabaseAdmin
      .from('bank_credentials')
      .select('credentials')
      .eq('user_id', user.id)
      .eq('bank_key', bankKey)
      .single()
    const credentials = credRow?.credentials || {}

    // Chama webhook e AGUARDA resposta síncrona (igual simulador)
    const res = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cpf,
        email: user.email,
        credentials,
        data: payload || {},
        product,
        userId: user.id,
        userMetadata: user.user_metadata || {},
        timestamp: new Date().toISOString()
      }),
    })
    
    const ctype = (res.headers.get('content-type') || '').toLowerCase()
    let bodyVal = null
    if (ctype.includes('application/json')) {
      bodyVal = await res.json().catch(() => ({}))
    } else {
      const txt = await res.text().catch(() => '')
      try { 
        bodyVal = JSON.parse(txt) 
      } catch { 
        bodyVal = txt ? { mensagem: txt } : {} 
      }
    }
    
    if (!res.ok) {
      const errorMsg = (typeof bodyVal === 'object' && bodyVal) 
        ? (bodyVal.error || bodyVal.mensagem || bodyVal.message) 
        : String(bodyVal || '')
      return NextResponse.json({ 
        error: errorMsg || 'Falha no webhook' 
      }, { status: 400 })
    }
    
    // Normaliza resposta para encontrar link
    const src = (typeof bodyVal === 'object' && bodyVal) ? bodyVal : { mensagem: String(bodyVal || '') }
    const norm = (s) => { 
      try { 
        return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'') 
      } catch { 
        return String(s||'').toLowerCase() 
      } 
    }
    const getBySyn = (obj, syns) => { 
      const map = new Map(Object.keys(obj||{}).map(k=>[norm(k),k]))
      for (const s of syns) { 
        const key = map.get(norm(s))
        if (key && typeof obj[key] !== 'undefined' && obj[key] !== null) return obj[key] 
      }
      return undefined 
    }
    
    const normalized = {
      link: getBySyn(src, ['link', 'url', 'proposta_url', 'propostaUrl', 'proposta_link', 'propostaLink', 'formalizacao_url', 'formalizacaoUrl', 'contrato', 'pdf']),
      mensagem: getBySyn(src, ['mensagem', 'message', 'msg']),
      status: getBySyn(src, ['status', 'estado']),
      protocolo: getBySyn(src, ['protocolo', 'numero_protocolo', 'proposta_id', 'propostaId']),
      _raw: src
    }
    
    return NextResponse.json({ ok: true, response: normalized })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}

