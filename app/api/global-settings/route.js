import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { supabaseAdmin } from '../../../lib/supabase-admin.js'

const filePath = path.join(process.cwd(), '.emergent', 'global_settings.json')

function ensureDir() {
  try {
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  } catch {}
}

function readSettings() {
  try {
    ensureDir()
    if (!fs.existsSync(filePath)) return {}
    const raw = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function writeSettings(obj) {
  ensureDir()
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf8')
}

export async function GET() {
  const settings = readSettings()
  // Public subset for unauthenticated requests (branding only)
  const publicSubset = {
    siteName: settings.siteName || 'CRM',
    siteSubtitle: settings.siteSubtitle || 'Supabase Viewer',
    logoUrl: settings.logoUrl || '',
  }
  return NextResponse.json({ settings: publicSubset })
}

async function getUserFromRequest(request) {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return null
  const token = auth.split(' ')[1]
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error) return null
  return data?.user || null
}

export async function PUT(request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json()
    const current = readSettings()
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
    writeSettings(next)
    const sanitized = { ...next, banks: (next.banks || []).map(b => ({ key: b.key, name: b.name, fields: b.fields })) }
    return NextResponse.json({ settings: sanitized })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}
