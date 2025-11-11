// Test script para verificar se empresa_charge_credits está funcionando

import { supabaseAdmin } from './lib/supabase-admin.js'

async function testCharge() {
  try {
    console.log('🔍 1. Listando empresas...')
    const { data: empresas, error: listError } = await supabaseAdmin
      .from('empresa')
      .select('id, nome, credits')
      .limit(5)
    
    if (listError) {
      console.error('❌ Erro ao listar empresas:', listError)
      return
    }
    
    console.log('📋 Empresas encontradas:', empresas)
    
    if (!empresas || empresas.length === 0) {
      console.log('⚠️ Nenhuma empresa encontrada. Crie uma primeiro.')
      return
    }
    
    const empresa = empresas[0]
    console.log(`\n🏢 Testando empresa: ${empresa.nome} (${empresa.id})`)
    console.log(`💰 Saldo atual: R$ ${empresa.credits}`)
    
    // Testar cobrança de 100 centavos (R$ 1,00)
    const centsToCharge = 100
    console.log(`\n💳 Cobrando ${centsToCharge} centavos (R$ ${centsToCharge/100})...`)
    
    const { data: chargeResult, error: chargeError } = await supabaseAdmin
      .rpc('empresa_charge_credits', {
        p_empresa: empresa.id,
        p_cents: centsToCharge
      })
    
    if (chargeError) {
      console.error('❌ Erro ao cobrar:', chargeError)
      return
    }
    
    console.log('✅ Resultado da cobrança:', chargeResult)
    
    // Verificar novo saldo
    const { data: updatedEmpresa, error: getError } = await supabaseAdmin
      .from('empresa')
      .select('credits')
      .eq('id', empresa.id)
      .single()
    
    if (getError) {
      console.error('❌ Erro ao buscar novo saldo:', getError)
      return
    }
    
    console.log(`\n💰 Novo saldo: R$ ${updatedEmpresa.credits}`)
    console.log(`📊 Diferença: R$ ${(empresa.credits - updatedEmpresa.credits).toFixed(2)}`)
    
  } catch (e) {
    console.error('❌ Erro inesperado:', e)
  }
}

testCharge()
