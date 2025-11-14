/**
 * Script para limpar TODAS as campanhas SMS da tabela sms_disparo
 * Use com cuidado - esta operação não pode ser desfeita!
 * 
 * Como usar:
 * 1. Abra o arquivo .env.local
 * 2. Copie os valores de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
 * 3. Execute: node scripts/clear_sms_campaigns.js
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Ler .env.local
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
let supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  try {
    const envPath = path.join(__dirname, '..', '.env.local')
    const envContent = fs.readFileSync(envPath, 'utf8')
    const lines = envContent.split('\n')
    
    for (const line of lines) {
      if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
        supabaseUrl = line.split('=')[1].trim()
      } else if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
        supabaseServiceKey = line.split('=')[1].trim()
      }
    }
  } catch (e) {
    console.error('❌ Erro ao ler .env.local:', e.message)
  }
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente não configuradas!')
  console.error('Certifique-se de que NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão em .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function clearAllCampaigns() {
  try {
    console.log('🗑️  Iniciando limpeza de campanhas SMS...')
    
    // Primeiro, contar quantos registros existem
    const { count: totalCount, error: countError } = await supabase
      .from('sms_disparo')
      .select('*', { count: 'exact', head: true })
    
    if (countError) {
      console.error('❌ Erro ao contar registros:', countError.message)
      return
    }
    
    console.log(`📊 Total de registros encontrados: ${totalCount}`)
    
    if (totalCount === 0) {
      console.log('✅ Tabela já está vazia!')
      return
    }
    
    // Perguntar confirmação (apenas visual, já que é script)
    console.log(`\n⚠️  ATENÇÃO: Esta operação vai DELETAR ${totalCount} registros!`)
    console.log('⚠️  Pressione Ctrl+C nos próximos 3 segundos para cancelar...\n')
    
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // Deletar TUDO
    console.log('🗑️  Deletando todos os registros...')
    const { error: deleteError } = await supabase
      .from('sms_disparo')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Condição que sempre é true para deletar tudo
    
    if (deleteError) {
      console.error('❌ Erro ao deletar:', deleteError.message)
      return
    }
    
    // Verificar se realmente deletou
    const { count: remainingCount } = await supabase
      .from('sms_disparo')
      .select('*', { count: 'exact', head: true })
    
    console.log(`\n✅ Limpeza concluída!`)
    console.log(`📊 Registros deletados: ${totalCount}`)
    console.log(`📊 Registros restantes: ${remainingCount || 0}`)
    
    if (remainingCount === 0) {
      console.log('✨ Tabela sms_disparo está completamente vazia agora!')
    }
    
  } catch (e) {
    console.error('❌ Erro inesperado:', e.message)
  }
}

clearAllCampaigns()
