import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase-admin.js'

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
    if (Array.isArray(body.products)) next.products = body.products
    if (Array.isArray(body.banks)) {
      // Sanitize banks: keep only name/key/fields/webhooks
      next.banks = body.banks.map(b => ({
        key: b.key,
        name: b.name,
        fields: Array.isArray(b.fields) ? b.fields.map(f => ({ key: f.key, label: f.label })) : [],
        webhookUrl: b.webhookUrl || '',
        returnWebhookUrl: b.returnWebhookUrl || '',
      }))
    }
    await writeSettingsToDb(next)
    const sanitized = { ...next, banks: (next.banks || []).map(b => ({ key: b.key, name: b.name, fields: b.fields })) }
    return NextResponse.json({ settings: sanitized })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}
