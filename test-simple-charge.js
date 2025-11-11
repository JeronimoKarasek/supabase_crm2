// Teste simples - verificar se RPC existe
const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

// Carregar .env.local manualmente
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
} catch (e) {
  console.log('⚠️ .env.local não encontrado, usando variáveis do sistema')
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não configuradas!')
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'OK' : 'FALTANDO')
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'OK' : 'FALTANDO')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  try {
    console.log('\n🔍 === TESTE SIMPLES ===\n')
    
    // 1. Verificar empresas
    console.log('1️⃣ Buscando empresas...')
    const { data: empresas, error: e1 } = await supabase
      .from('empresa')
      .select('id, nome, credits')
      .limit(3)
    
    if (e1) {
      console.error('❌ Erro:', e1.message)
      return
    }
    
    console.log(`✅ ${empresas.length} empresas encontradas:`)
    empresas.forEach(emp => {
      console.log(`   ${emp.nome}: R$ ${emp.credits} (${emp.id.slice(0, 8)})`)
    })
    
    if (empresas.length === 0) {
      console.log('\n⚠️ Nenhuma empresa. Crie uma primeiro.')
      return
    }
    
    // Pegar empresa com saldo > 0
    const emp = empresas.find(e => e.credits > 0) || empresas[0]
    console.log(`\n2️⃣ Testando com: ${emp.nome}`)
    console.log(`   Saldo antes: R$ ${emp.credits}`)
    
    // 2. Cobrar 50 centavos via RPC
    console.log('\n3️⃣ Cobrando 50 centavos via RPC...')
    const { data: result, error: e2 } = await supabase
      .rpc('empresa_charge_credits', {
        p_empresa: emp.id,
        p_cents: 50
      })
    
    if (e2) {
      console.error('❌ RPC Error:', e2.message)
      console.error('   Code:', e2.code)
      console.error('   Details:', e2.details)
      console.error('   Hint:', e2.hint)
      return
    }
    
    console.log('✅ RPC executou!')
    console.log('   Resultado:', result)
    
    // 3. Verificar novo saldo
    console.log('\n4️⃣ Verificando saldo após cobrança...')
    const { data: emp2, error: e3 } = await supabase
      .from('empresa')
      .select('credits')
      .eq('id', emp.id)
      .single()
    
    if (e3) {
      console.error('❌ Erro:', e3.message)
      return
    }
    
    console.log(`   Saldo depois: R$ ${emp2.credits}`)
    console.log(`   Diferença: R$ ${(emp.credits - emp2.credits).toFixed(2)}`)
    
    if (emp2.credits < emp.credits) {
      console.log('\n✅ ✅ ✅ FUNCIONOU! Crédito foi descontado! ✅ ✅ ✅')
    } else {
      console.log('\n❌ ❌ ❌ NÃO FUNCIONOU! Saldo não mudou! ❌ ❌ ❌')
    }
    
    // 4. Restaurar
    console.log('\n5️⃣ Restaurando saldo...')
    await supabase
      .from('empresa')
      .update({ credits: emp.credits })
      .eq('id', emp.id)
    console.log('✅ Restaurado')
    
  } catch (err) {
    console.error('\n❌ ERRO:', err.message)
  }
}

test()
