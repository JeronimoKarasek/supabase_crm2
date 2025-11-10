/**
 * Verifica os dados completos da empresa Farol diretamente no Supabase
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

async function checkAllEmpresaFields() {
  console.log('🔍 Buscando TODOS os dados da empresa Farol...\n')
  
  // Buscar pelo ID específico
  const empresaId = '55fcda3b-9fea-4f51-8a64-b1086fb0f595'
  
  const { data, error } = await supabase
    .from('empresa')
    .select('*')
    .eq('id', empresaId)
    .single()
  
  if (error) {
    console.error('❌ Erro:', error)
    return
  }
  
  console.log('📊 TODOS OS CAMPOS DA EMPRESA:')
  console.log(JSON.stringify(data, null, 2))
  console.log('\n')
  
  // Mostrar créditos especificamente
  console.log('💰 CAMPOS DE CRÉDITOS:')
  if (data.credits !== undefined) {
    console.log(`  credits (float antigo): ${data.credits}`)
  }
  if (data.credits_balance_cents !== undefined) {
    console.log(`  credits_balance_cents: ${data.credits_balance_cents} centavos = R$ ${(data.credits_balance_cents / 100).toFixed(2)}`)
  }
  
  // Mostrar todos os outros campos
  console.log('\n📋 TODOS OS CAMPOS:')
  Object.keys(data).forEach(key => {
    console.log(`  ${key}: ${JSON.stringify(data[key])}`)
  })
}

checkAllEmpresaFields()
