import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { supabaseAdmin } from '../../../../lib/supabase-admin.js'

const filePath = path.join(process.cwd(), '.emergent', 'credentials.json')

function ensureDir() {
  try { const dir = path.dirname(filePath); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }) } catch {}
}
function readStore() { try { ensureDir(); if (!fs.existsSync(filePath)) return {}; return JSON.parse(fs.readFileSync(filePath,'utf8')) } catch { return {} } }
function writeStore(obj) { ensureDir(); fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf8') }

async function getUserFromRequest(request) {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return null
  const token = auth.split(' ')[1]
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error) return null
  return data?.user || null
}

export async function GET(request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const store = readStore()
  const creds = store[user.id] || {}
  return NextResponse.json({ credentials: creds })
}

export async function PUT(request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const body = await request.json()
    const store = readStore()
    store[user.id] = body?.credentials || {}
    writeStore(store)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}

