// Script para processar pagamento manualmente e adicionar créditos
const fs = require('fs')
const path = require('path')

// Lê .env.local manualmente
const envPath = path.join(__dirname, '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=:#]+)=(.*)$/)
  if (match) {
    const key = match[1].trim()
    const value = match[2].trim()
    process.env[key] = value
  }
})

const { createClient } = require('@supabase/supabase-js')
const { addCents, getBalanceCents, formatBRL } = require('./lib/credits')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não configuradas!')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

async function processPayment() {
  console.log('\n🔄 Processando pagamento manualmente...\n')
  
  // Dados do pagamento aprovado
  const paymentId = '133189349850'
  const userId = '63e09cd6-5870-42c5-90ad-5130be525c33'
  const amount = 0.50 // R$ 0,50
  const externalReference = 'credits_63e09cd6-5870-42c5-90ad-5130be525c33_1762732252647'
  
  console.log('📋 Dados do pagamento:')
  console.log('   Payment ID:', paymentId)
  console.log('   User ID:', userId)
  console.log('   Valor: R$', amount)
  console.log('   Reference:', externalReference)
  
  // 1. Verifica saldo atual
  console.log('\n1️⃣ Verificando saldo atual...')
  const currentBalance = await getBalanceCents(userId)
  console.log('   Saldo atual:', formatBRL(currentBalance))
  
  // 2. Adiciona créditos
  console.log('\n2️⃣ Adicionando créditos...')
  const cents = Math.round(amount * 100) // R$ 0,50 = 50 cents
  await addCents(userId, cents)
  console.log('   Adicionados:', formatBRL(cents))
  
  // 3. Verifica novo saldo
  console.log('\n3️⃣ Verificando novo saldo...')
  const newBalance = await getBalanceCents(userId)
  console.log('   Novo saldo:', formatBRL(newBalance))
  
  // 4. Busca dados do usuário
  console.log('\n4️⃣ Dados do usuário:')
  const { data: userData, error } = await supabase.auth.admin.getUserById(userId)
  if (error) {
    console.error('   ❌ Erro ao buscar usuário:', error)
  } else {
    console.log('   Email:', userData.user.email)
    console.log('   Nome:', userData.user.user_metadata?.name || 'N/A')
  }
  
  console.log('\n✅ Processamento concluído!')
  console.log('\n💡 Dica: Para evitar isso no futuro, verifique se:')
  console.log('   1. O webhook está configurado no Mercado Pago')
  console.log('   2. A URL do webhook está acessível publicamente')
  console.log('   3. O servidor está recebendo as notificações')
}

processPayment()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ Erro:', err)
    process.exit(1)
  })
