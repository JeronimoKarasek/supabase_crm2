/**
 * Migra o valor do campo 'credits' (float) para 'credits_balance_cents' (integer)
 * Converte R$ 20,29 → 2029 centavos
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

async function migrateCredits() {
  const empresaId = '55fcda3b-9fea-4f51-8a64-b1086fb0f595'
  
  console.log('🔄 Migrando créditos de "credits" para "credits_balance_cents"...\n')
  
  // Buscar empresa
  const { data: empresa, error: getError } = await supabase
    .from('empresa')
    .select('*')
    .eq('id', empresaId)
    .single()
  
  if (getError) {
    console.error('❌ Erro ao buscar empresa:', getError)
    return
  }
  
  console.log('📊 Estado ANTES da migração:')
  console.log(`  credits (float): R$ ${empresa.credits}`)
  console.log(`  credits_balance_cents: ${empresa.credits_balance_cents} centavos = R$ ${(empresa.credits_balance_cents / 100).toFixed(2)}`)
  console.log('')
  
  // Calcular novo valor em centavos
  const creditsFloat = parseFloat(empresa.credits) || 0
  const newCents = Math.round(creditsFloat * 100)
  
  console.log(`💰 Valor a migrar: R$ ${creditsFloat.toFixed(2)} = ${newCents} centavos`)
  console.log('')
  
  // Atualizar
  const { data: updated, error: updateError } = await supabase
    .from('empresa')
    .update({ credits_balance_cents: newCents })
    .eq('id', empresaId)
    .select('*')
    .single()
  
  if (updateError) {
    console.error('❌ Erro ao atualizar:', updateError)
    return
  }
  
  console.log('✅ Migração concluída!')
  console.log('\n📊 Estado DEPOIS da migração:')
  console.log(`  credits (float): R$ ${updated.credits} (mantido para histórico)`)
  console.log(`  credits_balance_cents: ${updated.credits_balance_cents} centavos = R$ ${(updated.credits_balance_cents / 100).toFixed(2)}`)
  console.log('')
  console.log('🎉 Agora todos os pagamentos serão adicionados corretamente!')
}

migrateCredits()
