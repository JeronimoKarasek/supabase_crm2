// Script simples para testar conectividade com Supabase
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

console.log('🔍 Testando configuração do Supabase...\n')
console.log('✅ NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓ Configurada' : '✗ Faltando')
console.log('✅ NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✓ Configurada' : '✗ Faltando')
console.log('✅ SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓ Configurada' : '✗ Faltando')
console.log()

async function testConnection() {
  try {
    console.log('🔌 Testando conexão com Supabase...')
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    
    // Teste simples: verificar se conseguimos fazer uma query
    const { data, error } = await supabase.from('users').select('count').limit(1)
    
    if (error && error.code !== 'PGRST200') {
      console.log('⚠️  Erro ao consultar (pode ser normal se tabela não existe):', error.message)
    } else {
      console.log('✅ Conexão estabelecida com sucesso!')
    }
  } catch (err) {
    console.error('❌ Erro ao conectar:', err.message)
  }
}

testConnection()
