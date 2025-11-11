// Teste direto de cobrança de créditos da empresa

import { supabaseAdmin } from './lib/supabase-admin.js'

async function testDirectCharge() {
  try {
    console.log('\n🔍 === TESTE DE COBRANÇA DIRETA ===\n')
    
    // 1. Listar empresas
    console.log('1️⃣ Buscando empresas...')
    const { data: empresas, error: listError } = await supabaseAdmin
      .from('empresa')
      .select('id, nome, credits')
      .limit(5)
    
    if (listError) {
      console.error('❌ Erro ao listar:', listError)
      return
    }
    
    if (!empresas || empresas.length === 0) {
      console.log('⚠️ Nenhuma empresa encontrada')
      return
    }
    
    console.log('✅ Empresas encontradas:')
    empresas.forEach(e => {
      console.log(`   - ${e.nome}: R$ ${e.credits} (ID: ${e.id.slice(0, 8)})`)
    })
    
    const empresa = empresas[0]
    console.log(`\n2️⃣ Testando com: ${empresa.nome}`)
    console.log(`   Saldo atual: R$ ${empresa.credits}`)
    
    // 2. Testar cobrança de R$ 0.50 (50 centavos)
    const centsToCharge = 50
    const reaisToCharge = centsToCharge / 100
    
    console.log(`\n3️⃣ Cobrando ${centsToCharge} centavos (R$ ${reaisToCharge})...`)
    
    // Método 1: Via RPC
    console.log('\n   Método 1: Via RPC empresa_charge_credits')
    const { data: rpcResult, error: rpcError } = await supabaseAdmin
      .rpc('empresa_charge_credits', {
        p_empresa: empresa.id,
        p_cents: centsToCharge
      })
    
    if (rpcError) {
      console.error('   ❌ RPC Error:', rpcError)
    } else {
      console.log('   ✅ RPC Resultado:', rpcResult)
    }
    
    // 3. Verificar novo saldo
    console.log('\n4️⃣ Verificando novo saldo...')
    const { data: updated, error: getError } = await supabaseAdmin
      .from('empresa')
      .select('credits')
      .eq('id', empresa.id)
      .single()
    
    if (getError) {
      console.error('❌ Erro ao buscar:', getError)
    } else {
      console.log(`   Saldo anterior: R$ ${empresa.credits}`)
      console.log(`   Saldo atual: R$ ${updated.credits}`)
      console.log(`   Diferença: R$ ${(empresa.credits - updated.credits).toFixed(2)}`)
      
      const expectedNew = empresa.credits - reaisToCharge
      if (Math.abs(updated.credits - expectedNew) < 0.01) {
        console.log('   ✅ COBRANÇA FUNCIONOU CORRETAMENTE!')
      } else {
        console.log(`   ❌ COBRANÇA NÃO FUNCIONOU! Esperado: R$ ${expectedNew.toFixed(2)}`)
      }
    }
    
    // 4. Restaurar saldo
    console.log('\n5️⃣ Restaurando saldo original...')
    const { error: restoreError } = await supabaseAdmin
      .from('empresa')
      .update({ credits: empresa.credits })
      .eq('id', empresa.id)
    
    if (restoreError) {
      console.error('❌ Erro ao restaurar:', restoreError)
    } else {
      console.log('✅ Saldo restaurado')
    }
    
    console.log('\n🏁 === FIM DO TESTE ===\n')
    
  } catch (e) {
    console.error('\n❌ ERRO INESPERADO:', e)
  }
}

testDirectCharge()
