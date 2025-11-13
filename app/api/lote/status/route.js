import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { supabaseAdmin } from '../../../../lib/supabase-admin.js'

export const dynamic = 'force-dynamic'

const storePath = path.join(process.cwd(), '.emergent', 'lote.json')
function ensureDir() { const dir = path.dirname(storePath); if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }) }
function readStore() { try { ensureDir(); if (!fs.existsSync(storePath)) return { items: [] }; return JSON.parse(fs.readFileSync(storePath,'utf8')) } catch { return { items: [] } } }
function writeStore(obj) { ensureDir(); fs.writeFileSync(storePath, JSON.stringify(obj, null, 2), 'utf8') }

export async function POST(request) {
  try {
    const body = await request.json()
    const { itemId, status = 'concluido', message } = body || {}
    if (!itemId) return NextResponse.json({ error: 'Missing itemId' }, { status: 400 })

    // Update Supabase rows for this lote_id
    const { error } = await supabaseAdmin
      .from('lote_items')
      .update({ status })
      .eq('lote_id', itemId)
    if (error) return NextResponse.json({ error: 'Failed to update status', details: error.message }, { status: 500 })

    // Update local store (best-effort)
    const store = readStore()
    store.items = (store.items || []).map(i => i.id === itemId ? { ...i, status, message } : i)
    writeStore(store)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}

