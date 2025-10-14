import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

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
  return NextResponse.json({ settings })
}

export async function PUT(request) {
  try {
    const body = await request.json()
    const current = readSettings()
    const merged = { ...current, ...body }
    writeSettings(merged)
    return NextResponse.json({ settings: merged })
  } catch (e) {
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}

