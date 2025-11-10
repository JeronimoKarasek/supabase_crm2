// Script direto para adicionar créditos via API
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
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

const userId = '63e09cd6-5870-42c5-90ad-5130be525c33'
const amountToAdd = 50 // 50 cents = R$ 0,50

async function addCredits() {
  console.log('\n🔄 Adicionando créditos...\n')
  
  // 1. Verifica saldo atual no Redis
  console.log('1️⃣ Verificando saldo atual no Redis...')
  const key = `cr:bal:u:${userId}`
  
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    console.log('   ⚠️ Redis não configurado - usando Supabase')
    
    // Busca no Supabase
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/user_credits?user_id=eq.${userId}&select=balance_cents`, {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`
      }
    })
    const credits = await checkRes.json()
    const currentBalance = credits[0]?.balance_cents || 0
    console.log('   Saldo atual:', currentBalance, 'cents (R$', (currentBalance/100).toFixed(2), ')')
    
    // Adiciona créditos
    console.log('\n2️⃣ Adicionando', amountToAdd, 'cents...')
    const newBalance = currentBalance + amountToAdd
    
    const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/user_credits`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        user_id: userId,
        balance_cents: newBalance,
        updated_at: new Date().toISOString()
      })
    })
    
    if (!upsertRes.ok) {
      console.error('❌ Erro ao atualizar saldo:', await upsertRes.text())
      return
    }
    
    console.log('   ✅ Novo saldo:', newBalance, 'cents (R$', (newBalance/100).toFixed(2), ')')
    
  } else {
    console.log('   ✅ Redis configurado')
    
    // GET atual
    const getRes = await fetch(`${UPSTASH_URL}/get/${key}`, {
      headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}` }
    })
    const getData = await getRes.json()
    const currentBalance = parseInt(getData.result || '0')
    console.log('   Saldo atual:', currentBalance, 'cents (R$', (currentBalance/100).toFixed(2), ')')
    
    // INCRBY
    console.log('\n2️⃣ Adicionando', amountToAdd, 'cents...')
    const incrRes = await fetch(`${UPSTASH_URL}/incrby/${key}/${amountToAdd}`, {
      headers: { 'Authorization': `Bearer ${UPSTASH_TOKEN}` }
    })
    const incrData = await incrRes.json()
    const newBalance = incrData.result
    console.log('   ✅ Novo saldo:', newBalance, 'cents (R$', (newBalance/100).toFixed(2), ')')
  }
  
  // 3. Busca dados do usuário
  console.log('\n3️⃣ Dados do usuário:')
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`
    }
  })
  const userData = await userRes.json()
  console.log('   Email:', userData.email)
  console.log('   Nome:', userData.user_metadata?.name || 'N/A')
  
  console.log('\n✅ Créditos adicionados com sucesso!')
}

addCredits()
  .then(() => {
    console.log('\n💡 Agora verifique o saldo no sistema')
    process.exit(0)
  })
  .catch(err => {
    console.error('\n❌ Erro:', err.message)
    process.exit(1)
  })
