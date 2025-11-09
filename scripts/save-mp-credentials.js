/**
 * Script para salvar credenciais do Mercado Pago direto no banco
 * Uso: node scripts/save-mp-credentials.js
 */

const { createClient } = require('@supabase/supabase-js')

// Lê do .env ou usa hardcoded se necessário
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gpakoffbuypbmfiwewka.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// Credenciais do Mercado Pago (CORRETAS)
const MP_CREDENTIALS = {
  provider: 'mercadopago',
  mercadopagoAccessToken: 'APP_USR-6832397982878428-110522-8212ccd1ba3e1dc85d31fe48a1cdb1ae-834403024',
  mercadopagoPublicKey: 'APP_USR-60cda7b7-9cb9-4c89-985f-f13741831fc7',
  picpaySellerToken: '',
  picpayClientId: '',
  picpayClientSecret: '',
  creditsWebhook: '',
  addCreditsWebhook: ''
}

async function saveCredentials() {
  try {
    console.log('🔧 Conectando ao Supabase...')
    console.log('URL:', SUPABASE_URL.substring(0, 30) + '...')
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    // 1. Buscar configurações atuais
    console.log('📥 Buscando configurações atuais...')
    const { data: current, error: fetchError } = await supabase
      .from('global_settings')
      .select('data')
      .eq('id', 'global')
      .single()
    
    if (fetchError && fetchError.code !== 'PGRST116') {
      throw new Error('Erro ao buscar: ' + fetchError.message)
    }
    
    // 2. Mesclar com novas credenciais
    const currentData = current?.data || {}
    const updated = {
      ...currentData,
      payments: {
        ...(currentData.payments || {}),
        ...MP_CREDENTIALS
      }
    }
    
    console.log('💾 Salvando credenciais do Mercado Pago...')
    
    // 3. Salvar
    const { error: saveError } = await supabase
      .from('global_settings')
      .upsert({
        id: 'global',
        data: updated
      }, {
        onConflict: 'id'
      })
    
    if (saveError) {
      throw new Error('Erro ao salvar: ' + saveError.message)
    }
    
    console.log('\n✅ Credenciais salvas com sucesso!')
    console.log('\n📋 Configurações aplicadas:')
    console.log('   Provider: Mercado Pago')
    console.log('   Access Token:', MP_CREDENTIALS.mercadopagoAccessToken.substring(0, 20) + '...')
    console.log('   Public Key:', MP_CREDENTIALS.mercadopagoPublicKey.substring(0, 20) + '...')
    console.log('\n🎉 Pronto! Reinicie o servidor (npm run dev) e teste.')
    
  } catch (error) {
    console.error('\n❌ Erro:', error.message)
    console.log('\n💡 Verifique se as variáveis estão configuradas:')
    console.log('   NEXT_PUBLIC_SUPABASE_URL')
    console.log('   SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
}

saveCredentials()
