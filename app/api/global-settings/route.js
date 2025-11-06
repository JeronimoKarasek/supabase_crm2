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

async function readSettingsFromDb() {
  const { data, error } = await supabaseAdmin
    .from('global_settings')
    .select('data')
    .eq('id', 'global')
    .single()
  if (error) return {}
  return data?.data || {}
}

async function writeSettingsToDb(obj) {
  const { error } = await supabaseAdmin
    .from('global_settings')
    .upsert({ id: 'global', data: obj }, { onConflict: 'id' })
  if (error) throw error
}

export async function GET() {
  // Always return full site-wide settings so Configuração works on Vercel
  const settings = await readSettingsFromDb()
  return NextResponse.json({ settings })
}

export async function PUT(request) {
  // Optionally require auth here. For Vercel persistence, we allow unauthenticated PUT but sanitize fields.
  try {
    const body = await request.json()
    const current = await readSettingsFromDb()
    // Only allow safe fields to be updated
    const next = { ...current }
    if (typeof body.siteName === 'string') next.siteName = body.siteName
    if (typeof body.siteSubtitle === 'string') next.siteSubtitle = body.siteSubtitle
    if (typeof body.logoUrl === 'string') next.logoUrl = body.logoUrl
    if (Array.isArray(body.valorPagoList)) next.valorPagoList = body.valorPagoList
    if (Array.isArray(body.adminEmails)) {
      next.adminEmails = body.adminEmails.filter(e => typeof e === 'string' && e.length > 0)
    }
    if (Array.isArray(body.products)) {
      next.products = body.products.map(p => (typeof p === 'string' ? { name: p, forBatch: true, forSimular: true } : { name: p.name, forBatch: !!p.forBatch, forSimular: !!p.forSimular }))
    }
    if (Array.isArray(body.banks)) {
      // Sanitize banks and support new fields (compatibility kept)
      next.banks = body.banks.map(b => ({
        key: b.key,
        name: b.name,
        fields: Array.isArray(b.fields) ? b.fields.map(f => ({ key: f.key, label: f.label, required: !!f.required, type: f.type === 'select' ? 'select' : 'text', options: Array.isArray(f.options) ? f.options.filter(Boolean) : [] })) : [],
        digitarFields: Array.isArray(b.digitarFields) ? b.digitarFields.map(f => ({ key: f.key, label: f.label, required: !!f.required, type: f.type === 'select' ? 'select' : 'text', options: Array.isArray(f.options) ? f.options.filter(Boolean) : [] })) : [],
        webhookUrl: b.webhookUrl || '', // consulta em lote
        returnWebhookUrl: b.returnWebhookUrl || '', // callback/status (lote)
        webhookSimulador: b.webhookSimulador || '',
        webhookDigitar: b.webhookDigitar || '',
        webhookProposta: b.webhookProposta || '',
        forBatch: !!b.forBatch,
        forSimular: !!b.forSimular,
        productConfigs: Array.isArray(b.productConfigs) ? b.productConfigs.map(pc => ({ product: (typeof pc.product === "string" ? pc.product : (pc.name || "")), webhookSimulador: pc.webhookSimulador || "", webhookDigitar: pc.webhookDigitar || "" })) : [],
      }))
    }
    if (typeof body.farolChat === 'object' && body.farolChat !== null) {
      const fc = body.farolChat
      const toNumber = (v) => {
        const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v)
        return isNaN(n) ? 0 : Math.max(0, n)
      }
      next.farolChat = {
        userPrice: toNumber(fc.userPrice),
        connectionPrice: toNumber(fc.connectionPrice),
      }
    }
    if (typeof body.payments === 'object' && body.payments !== null) {
      const pay = body.payments
      next.payments = {
        provider: typeof pay.provider === 'string' ? pay.provider : (next.payments?.provider || 'picpay'),
        picpaySellerToken: typeof pay.picpaySellerToken === 'string' ? pay.picpaySellerToken : (next.payments?.picpaySellerToken || ''),
        picpayClientId: typeof pay.picpayClientId === 'string' ? pay.picpayClientId : (next.payments?.picpayClientId || ''),
        picpayClientSecret: typeof pay.picpayClientSecret === 'string' ? pay.picpayClientSecret : (next.payments?.picpayClientSecret || ''),
        mercadopagoAccessToken: typeof pay.mercadopagoAccessToken === 'string' ? pay.mercadopagoAccessToken : (next.payments?.mercadopagoAccessToken || ''),
        mercadopagoPublicKey: typeof pay.mercadopagoPublicKey === 'string' ? pay.mercadopagoPublicKey : (next.payments?.mercadopagoPublicKey || ''),
        creditsWebhook: typeof pay.creditsWebhook === 'string' ? pay.creditsWebhook : (next.payments?.creditsWebhook || ''),
        addCreditsWebhook: typeof pay.addCreditsWebhook === 'string' ? pay.addCreditsWebhook : (next.payments?.addCreditsWebhook || ''),
      }
    }
    await writeSettingsToDb(next)
    const sanitized = { ...next, banks: (next.banks || []).map(b => ({ key: b.key, name: b.name, fields: b.fields })) }
    return NextResponse.json({ settings: sanitized })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}

export async function POST(request) {
  // Mirror PUT: accept settings in body and persist sanitized fields
  try {
    const body = await request.json()
    const current = await readSettingsFromDb()
    const next = { ...current }
    if (typeof body.siteName === 'string') next.siteName = body.siteName
    if (typeof body.siteSubtitle === 'string') next.siteSubtitle = body.siteSubtitle
    if (typeof body.logoUrl === 'string') next.logoUrl = body.logoUrl
    if (Array.isArray(body.valorPagoList)) next.valorPagoList = body.valorPagoList
    if (Array.isArray(body.adminEmails)) {
      next.adminEmails = body.adminEmails.filter(e => typeof e === 'string' && e.length > 0)
    }
    if (Array.isArray(body.products)) { next.products = body.products.map(p => (typeof p === "string" ? { name: p, forBatch: true, forSimular: true } : { name: p.name, forBatch: !!p.forBatch, forSimular: !!p.forSimular })) }
    if (Array.isArray(body.banks)) {
      next.banks = body.banks.map(b => ({
        key: b.key,
        name: b.name,
        fields: Array.isArray(b.fields) ? b.fields.map(f => ({ key: f.key, label: f.label, required: !!f.required, type: f.type === 'select' ? 'select' : 'text', options: Array.isArray(f.options) ? f.options.filter(Boolean) : [] })) : [],
        digitarFields: Array.isArray(b.digitarFields) ? b.digitarFields.map(f => ({ key: f.key, label: f.label, required: !!f.required, type: f.type === 'select' ? 'select' : 'text', options: Array.isArray(f.options) ? f.options.filter(Boolean) : [] })) : [],
        webhookUrl: b.webhookUrl || '',
        returnWebhookUrl: b.returnWebhookUrl || '',
        webhookSimulador: b.webhookSimulador || '',
        webhookDigitar: b.webhookDigitar || '',
        webhookProposta: b.webhookProposta || '',
        forBatch: !!b.forBatch,
        forSimular: !!b.forSimular,
        productConfigs: Array.isArray(b.productConfigs) ? b.productConfigs.map(pc => ({ product: (typeof pc.product === "string" ? pc.product : (pc.name || "")), webhookSimulador: pc.webhookSimulador || "", webhookDigitar: pc.webhookDigitar || "" })) : [],
      }))
    }
    if (typeof body.farolChat === 'object' && body.farolChat !== null) {
      const fc = body.farolChat
      const toNumber = (v) => {
        const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v)
        return isNaN(n) ? 0 : Math.max(0, n)
      }
      next.farolChat = {
        userPrice: toNumber(fc.userPrice),
        connectionPrice: toNumber(fc.connectionPrice),
      }
    }
    if (typeof body.payments === 'object' && body.payments !== null) {
      const pay = body.payments
      next.payments = {
        provider: typeof pay.provider === 'string' ? pay.provider : (next.payments?.provider || 'picpay'),
        picpaySellerToken: typeof pay.picpaySellerToken === 'string' ? pay.picpaySellerToken : (next.payments?.picpaySellerToken || ''),
        picpayClientId: typeof pay.picpayClientId === 'string' ? pay.picpayClientId : (next.payments?.picpayClientId || ''),
        picpayClientSecret: typeof pay.picpayClientSecret === 'string' ? pay.picpayClientSecret : (next.payments?.picpayClientSecret || ''),
        mercadopagoAccessToken: typeof pay.mercadopagoAccessToken === 'string' ? pay.mercadopagoAccessToken : (next.payments?.mercadopagoAccessToken || ''),
        mercadopagoPublicKey: typeof pay.mercadopagoPublicKey === 'string' ? pay.mercadopagoPublicKey : (next.payments?.mercadopagoPublicKey || ''),
        creditsWebhook: typeof pay.creditsWebhook === 'string' ? pay.creditsWebhook : (next.payments?.creditsWebhook || ''),
        addCreditsWebhook: typeof pay.addCreditsWebhook === 'string' ? pay.addCreditsWebhook : (next.payments?.addCreditsWebhook || ''),
      }
    }
    await writeSettingsToDb(next)
    const sanitized = { ...next, banks: (next.banks || []).map(b => ({ key: b.key, name: b.name, fields: b.fields })) }
    return NextResponse.json({ settings: sanitized })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}








