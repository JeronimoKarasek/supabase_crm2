// Teste rápido para verificar dados na Carteira
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ihhqxwssvnyopjubemxc.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseKey) {
  console.error('❌ Nenhuma chave do Supabase encontrada!')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testCarteira() {
  console.log('🔍 Verificando tabela Carteira...\n')
  
  const { data, error, count } = await supabase
    .from('Carteira')
    .select('*', { count: 'exact', head: false })
    .limit(5)
  
  if (error) {
    console.error('❌ Erro ao buscar dados:', error.message)
    return
  }
  
  console.log('✅ Total de registros:', count)
  console.log('📊 Primeiros 5 registros:\n')
  
  if (data && data.length > 0) {
    data.forEach((item, idx) => {
      console.log(`\n--- Registro ${idx + 1} ---`)
      console.log('ID:', item.id)
      console.log('Criado em:', item.created_at)
      console.log('Atualizado em:', item.updated_at)
      console.log('Simulou:', item.simulou)
      console.log('Digitou:', item.digitou)
      console.log('Pago:', item.pago)
      console.log('Valor liberado:', item['Valor liberado'] || item.valorContrato)
      console.log('Vendedor:', item.vendedor)
      console.log('Produto:', item.produto)
    })
  } else {
    console.log('⚠️  Nenhum registro encontrado na tabela')
  }
}

testCarteira().catch(console.error)
