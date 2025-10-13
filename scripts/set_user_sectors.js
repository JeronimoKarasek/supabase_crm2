// Usage: node scripts/set_user_sectors.js <email> [sectorsCommaSeparated]
// Default sectors: Clientes,Usuários

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

function loadEnv() {
  const env = { ...process.env }
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    const envPath = path.resolve(process.cwd(), '.env')
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/) || []
      for (const line of lines) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
        if (m) {
          const key = m[1]
          // strip optional quotes
          const val = m[2].replace(/^"|"$/g, '')
          if (!env[key]) env[key] = val
        }
      }
    }
  }
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment/.env')
  }
  return env
}

async function main() {
  const email = process.argv[2]
  const sectorsArg = process.argv[3]
  const sectors = (sectorsArg ? sectorsArg.split(',') : ['Clientes', 'Usuários']).map(s => s.trim()).filter(Boolean)
  if (!email) {
    console.error('Usage: node scripts/set_user_sectors.js <email> [sectorsCommaSeparated]')
    process.exit(1)
  }
  const env = loadEnv()
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  const admin = createClient(supabaseUrl, serviceKey)

  console.log(`Setting sectors for ${email} -> ${sectors.join(', ')}`)

  // Find user by email via pagination
  let page = 1
  const perPage = 100
  let found = null
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const users = data?.users || []
    if (!users.length) break
    found = users.find(u => (u.email || '').toLowerCase() === email.toLowerCase())
    if (found) break
    page += 1
  }

  if (!found) {
    console.error(`User not found: ${email}`)
    process.exit(2)
  }

  const currentMeta = found.user_metadata || {}
  const newMeta = { ...currentMeta, sectors }

  const { data: upd, error: updErr } = await admin.auth.admin.updateUserById(found.id, {
    user_metadata: newMeta,
  })
  if (updErr) {
    console.error('Failed to update user:', updErr)
    process.exit(3)
  }

  console.log('Updated user:', { id: upd?.user?.id, email: upd?.user?.email, sectors: upd?.user?.user_metadata?.sectors })
}

main().catch((e) => {
  console.error(e)
  process.exit(10)
})

