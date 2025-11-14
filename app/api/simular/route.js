import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin.js'


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
    const cpf = (body?.cpf || '').toString().trim()
    const onlyBank = body?.bankKey || null
    const onlyProduct = body?.product || null
    if (!cpf) return NextResponse.json({ error: 'CPF é obrigatório' }, { status: 400 })

    const settings = await readSettings()
    const banks = Array.isArray(settings?.banks) ? settings.banks : []
    const products = Array.isArray(settings?.products) ? settings.products : []
    const productAllowed = (name) => {
      if (!name) return false
      const it = products.find(p => (typeof p === 'string' ? p === name : p?.name === name))
      if (!it) return true
      return typeof it === 'string' ? true : !!it.forSimular
    }
    const targetBanks = banks.filter(b => (b.forSimular || false) && (!onlyBank || b.key === onlyBank))

    // Load credentials for user (busca credencial padrão is_default=true)
    const { data: credsRows } = await supabaseAdmin
      .from('bank_user_credentials')
      .select('bank_key, credentials, is_default')
      .eq('user_id', user.id)

    const credsMap = new Map()
    for (const r of (credsRows || [])) {
      // Prioriza credencial padrão (is_default=true), senão usa a primeira
      if (!credsMap.has(r.bank_key) || r.is_default) {
        credsMap.set(r.bank_key, r.credentials || {})
      }
    }

    const out = []
    for (const b of targetBanks) {
      const credentials = credsMap.get(b.key) || {}
      const bankRes = { bankKey: b.key, bankName: b.name || b.key, products: [] }
      try {
        const cfgList = Array.isArray(b.productConfigs) ? b.productConfigs : []
        if (cfgList.length > 0) {
          for (const pc of cfgList) {
            const prodName = pc.product
            if (!prodName) continue
            if (!productAllowed(prodName)) continue
            if (onlyProduct && onlyProduct !== prodName) continue
            if (!pc.webhookSimulador) { bankRes.products.push({ product: prodName, error: 'Webhook simulador não configurado' }); continue }
            const payload = {
              cpf,
              email: user.email,
              credentials,
              product: prodName,
              userId: user.id,
              userMetadata: user.user_metadata || {},
              timestamp: new Date().toISOString()
            }
            const res = await fetch(pc.webhookSimulador, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            const ctype = (res.headers.get('content-type') || '').toLowerCase()
            let bodyVal = null
            if (ctype.includes('application/json')) bodyVal = await res.json().catch(() => ({}))
            else { const txt = await res.text().catch(() => ''); try { bodyVal = JSON.parse(txt) } catch { bodyVal = txt ? { mensagem: txt } : {} } }
            if (!res.ok) {
              const msg = (typeof bodyVal === 'object' && bodyVal) ? (bodyVal.error || bodyVal.mensagem || bodyVal.message) : String(bodyVal || '')
              bankRes.products.push({ product: prodName, error: msg || `HTTP ${res.status}` })
            } else {
              const src = (typeof bodyVal === 'object' && bodyVal) ? bodyVal : { mensagem: String(bodyVal || '') }
              const norm = (s) => { try { return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'') } catch { return String(s||'').toLowerCase() } }
              const getBySyn = (obj, syns) => { const map = new Map(Object.keys(obj||{}).map(k=>[norm(k),k])); for (const s of syns) { const key = map.get(norm(s)); if (key && typeof obj[key] !== 'undefined' && obj[key] !== null) return obj[key] } return undefined }
              const normalized = { mensagem: getBySyn(src,['mensagem','message','msg']), valor_cliente: getBySyn(src,['valor_cliente','valor cliente','valorCliente','valor','valor recomendado','valor_cliente_recomendado']), valor_liberado: getBySyn(src,['valor_liberado','valor liberado','valorLiberado','liberado']), taxa: getBySyn(src,['taxa','taxa efetiva','taxa_efetiva']), tabela: getBySyn(src,['tabela','modalidade']), prazo: getBySyn(src,['prazo','parcelas','periodo']), valor_bloqueado: getBySyn(src,['valor_bloqueado','valor bloqueado','valorBloqueado','bloqueado']) }
              normalized._raw = src
              // Se não retornou nenhum dado útil, marca como serviço indisponível
              const hasData = normalized.valor_liberado || normalized.valor_cliente || normalized.taxa || normalized.prazo || normalized.mensagem
              if (!hasData) {
                bankRes.products.push({ product: prodName, error: 'Serviço indisponível no momento' })
              } else {
                bankRes.products.push({ product: prodName, data: normalized })
              }
            }
          }
        } else if (b.webhookSimulador) {
          const payload = {
            cpf,
            email: user.email,
            credentials,
            userId: user.id,
            userMetadata: user.user_metadata || {},
            timestamp: new Date().toISOString()
          }
          const res = await fetch(b.webhookSimulador, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          const ctype = (res.headers.get('content-type') || '').toLowerCase()
          let bodyVal = null
          if (ctype.includes('application/json')) bodyVal = await res.json().catch(() => ({}))
          else { const txt = await res.text().catch(() => ''); try { bodyVal = JSON.parse(txt) } catch { bodyVal = txt ? { mensagem: txt } : {} } }
          if (!res.ok) {
            const msg = (typeof bodyVal === 'object' && bodyVal) ? (bodyVal.error || bodyVal.mensagem || bodyVal.message) : String(bodyVal || '')
            bankRes.products.push({ product: 'default', error: msg || `HTTP ${res.status}` })
          } else {
            const src = (typeof bodyVal === 'object' && bodyVal) ? bodyVal : { mensagem: String(bodyVal || '') }
            const norm = (s) => { try { return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'') } catch { return String(s||'').toLowerCase() } }
            const getBySyn = (obj, syns) => { const map = new Map(Object.keys(obj||{}).map(k=>[norm(k),k])); for (const s of syns) { const key = map.get(norm(s)); if (key && typeof obj[key] !== 'undefined' && obj[key] !== null) return obj[key] } return undefined }
            const normalized = { mensagem: getBySyn(src,['mensagem','message','msg']), valor_cliente: getBySyn(src,['valor_cliente','valor cliente','valorCliente','valor','valor recomendado','valor_cliente_recomendado']), valor_liberado: getBySyn(src,['valor_liberado','valor liberado','valorLiberado','liberado']), taxa: getBySyn(src,['taxa','taxa efetiva','taxa_efetiva']), tabela: getBySyn(src,['tabela','modalidade']), prazo: getBySyn(src,['prazo','parcelas','periodo']), valor_bloqueado: getBySyn(src,['valor_bloqueado','valor bloqueado','valorBloqueado','bloqueado']) }
            normalized._raw = src
            // Se não retornou nenhum dado útil, marca como serviço indisponível
            const hasData = normalized.valor_liberado || normalized.valor_cliente || normalized.taxa || normalized.prazo || normalized.mensagem
            if (!hasData) {
              bankRes.products.push({ product: 'default', error: 'Serviço indisponível no momento' })
            } else {
              bankRes.products.push({ product: 'default', data: normalized })
            }
          }
        }
      } catch (e) {
        // Erro de rede ou timeout = serviço indisponível
        const errorMsg = e.message?.includes('fetch') || e.message?.includes('timeout') || e.message?.includes('network') 
          ? 'Serviço indisponível no momento' 
          : e.message
        bankRes.error = errorMsg
      }
      out.push(bankRes)
    }
    return NextResponse.json({ results: out })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}

