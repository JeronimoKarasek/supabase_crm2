const fs = require('fs')
const path = require('path')

// Lê .env.local
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const MP_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN

async function reprocessPayment(paymentId) {
  console.log(`\n🔄 Reprocessando pagamento ${paymentId}...\n`)
  
  // 1. Busca detalhes do pagamento no MP
  console.log('1️⃣ Consultando Mercado Pago...')
  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${MP_TOKEN}` }
  })
  
  if (!mpRes.ok) {
    console.error('❌ Pagamento não encontrado no Mercado Pago')
    return
  }
  
  const payment = await mpRes.json()
  console.log('   Status:', payment.status)
  console.log('   Valor: R$', payment.transaction_amount)
  console.log('   Reference:', payment.external_reference)
  
  if (payment.status !== 'approved') {
    console.error('❌ Pagamento não está aprovado')
    return
  }
  
  if (!payment.external_reference?.startsWith('credits_')) {
    console.error('❌ Não é um pagamento de créditos')
    return
  }
  
  // 2. Extrai userId
  const parts = payment.external_reference.split('_')
  const userId = parts.slice(1, -1).join('_')
  console.log('\n2️⃣ User ID:', userId)
  
  // 3. Busca empresa
  const empresaRes = await fetch(`${SUPABASE_URL}/rest/v1/empresa_users?user_id=eq.${userId}&select=empresa_id`, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`
    }
  })
  const empresaData = await empresaRes.json()
  
  if (!empresaData[0]?.empresa_id) {
    console.error('❌ Usuário sem empresa vinculada')
    return
  }
  
  const empresaId = empresaData[0].empresa_id
  console.log('   Empresa ID:', empresaId)
  
  // 4. Adiciona créditos
  const cents = Math.round(payment.transaction_amount * 100)
  console.log('\n3️⃣ Adicionando', cents, 'cents à empresa...')
  
  const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/empresa_add_credits`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      p_empresa: empresaId,
      p_cents: cents
    })
  })
  
  if (!rpcRes.ok) {
    console.error('❌ Erro ao adicionar créditos:', await rpcRes.text())
    return
  }
  
  const newBalance = await rpcRes.json()
  console.log('   ✅ Novo saldo:', newBalance, 'cents (R$', (newBalance/100).toFixed(2), ')')
  
  console.log('\n✅ Pagamento reprocessado com sucesso!')
}

const paymentId = process.argv[2] || '133189349850'
reprocessPayment(paymentId)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err.message)
    process.exit(1)
  })
