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
  console.log('\n🔄 Adicionando créditos À EMPRESA...\n')
  
  // 1. Busca empresa do usuário
  console.log('1️⃣ Buscando empresa do usuário...')
  const empresaRes = await fetch(`${SUPABASE_URL}/rest/v1/empresa_users?user_id=eq.${userId}&select=empresa_id`, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`
    }
  })
  const empresaData = await empresaRes.json()
  
  if (!empresaData || empresaData.length === 0 || !empresaData[0]?.empresa_id) {
    console.error('❌ Usuário não vinculado a nenhuma empresa!')
    console.log('   Execute o SQL de empresa.sql no Supabase antes de usar este script.')
    return
  }
  
  const empresaId = empresaData[0].empresa_id
  console.log('   ✅ Empresa encontrada:', empresaId)
  
  // 2. Busca saldo atual da empresa
  console.log('\n2️⃣ Verificando saldo atual da empresa...')
  const empresaInfoRes = await fetch(`${SUPABASE_URL}/rest/v1/empresa?id=eq.${empresaId}&select=credits_balance_cents,nome`, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`
    }
  })
  const empresaInfo = await empresaInfoRes.json()
  const currentBalance = empresaInfo[0]?.credits_balance_cents || 0
  const empresaNome = empresaInfo[0]?.nome || 'N/A'
  console.log('   Empresa:', empresaNome)
  console.log('   Saldo atual:', currentBalance, 'cents (R$', (currentBalance/100).toFixed(2), ')')
  
  // 3. Adiciona créditos usando RPC
  console.log('\n3️⃣ Adicionando', amountToAdd, 'cents via empresa_add_credits...')
  const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/empresa_add_credits`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      p_empresa: empresaId,
      p_cents: amountToAdd
    })
  })
  
  if (!rpcRes.ok) {
    console.error('❌ Erro ao adicionar créditos:', await rpcRes.text())
    return
  }
  
  const newBalance = await rpcRes.json()
  console.log('   ✅ Novo saldo:', newBalance, 'cents (R$', (newBalance/100).toFixed(2), ')')
  
  // 4. Busca dados do usuário
  console.log('\n4️⃣ Dados do usuário:')
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`
    }
  })
  const userData = await userRes.json()
  console.log('   Email:', userData.email)
  console.log('   Nome:', userData.user_metadata?.name || 'N/A')
  
  console.log('\n✅ Créditos adicionados à EMPRESA com sucesso!')
  console.log('   Todos os usuários da empresa', empresaNome, 'agora têm acesso a estes créditos.')
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
