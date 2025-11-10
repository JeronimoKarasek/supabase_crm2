/**
 * Verifica saldo da empresa
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Ler .env.local
const envPath = path.join(__dirname, '.env.local')
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if ((!supabaseUrl || !supabaseKey) && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)
  const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)
  if (urlMatch) supabaseUrl = urlMatch[1].trim()
  if (keyMatch) supabaseKey = keyMatch[1].trim()
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkBalance() {
  console.log('🔍 Verificando saldo da empresa Farol...\n')
  
  const { data, error } = await supabase
    .from('empresa')
    .select('nome, credits_balance_cents, updated_at')
    .eq('nome', 'Farol')
    .single()
  
  if (error) {
    console.error('❌ Erro:', error)
    return
  }
  
  const reais = (data.credits_balance_cents / 100).toFixed(2)
  console.log(`Empresa: ${data.nome}`)
  console.log(`Saldo: R$ ${reais} (${data.credits_balance_cents} centavos)`)
  console.log(`Última atualização: ${data.updated_at}`)
}

checkBalance()
