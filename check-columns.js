const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

try {
  const envContent = fs.readFileSync('.env.local', 'utf8')
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim().replace(/^["']|["']$/g, '')
      process.env[key] = value
    }
  })
} catch (e) {}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function check() {
  const { data, error } = await supabase
    .from('empresa')
    .select('id, nome, credits, credits_balance_cents')
    .limit(3)
  
  if (error) {
    console.log('Error:', error.message)
    return
  }
  
  console.log('\n=== COLUNAS DA TABELA EMPRESA ===\n')
  data.forEach(e => {
    console.log(`${e.nome}:`)
    console.log(`  credits: R$ ${e.credits}`)
    console.log(`  credits_balance_cents: ${e.credits_balance_cents || 'NULL'}`)
    console.log()
  })
}

check()
