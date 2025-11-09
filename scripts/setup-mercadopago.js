/**
 * Script para configurar credenciais do Mercado Pago via linha de comando
 * 
 * Uso: node scripts/setup-mercadopago.js
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://gpakoffbuypbmfiwewka.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY não configurada')
  console.log('Configure a variável de ambiente primeiro:')
  console.log('export SUPABASE_SERVICE_ROLE_KEY=your_service_role_key')
  process.exit(1)
}

// Credenciais do Mercado Pago (CORRETAS - fornecidas pelo usuário)
const MERCADOPAGO_CONFIG = {
  provider: 'mercadopago',
  mercadopagoAccessToken: 'APP_USR-6832397982878428-110522-8212ccd1ba3e1dc85d31fe48a1cdb1ae-834403024',
  mercadopagoPublicKey: 'APP_USR-60cda7b7-9cb9-4c89-985f-f13741831fc7',
  picpaySellerToken: '',
  picpayClientId: '',
  picpayClientSecret: '',
  creditsWebhook: '',
  addCreditsWebhook: ''
}

async function setupMercadoPago() {
  try {
    console.log('🚀 Configurando Mercado Pago...\n')

    // 1. Buscar configurações atuais
    console.log('📥 Buscando configurações atuais...')
    const getRes = await fetch(`${SUPABASE_URL}/rest/v1/global_settings?id=eq.global`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      }
    })

    if (!getRes.ok) {
      throw new Error(`Erro ao buscar configurações: ${getRes.status}`)
    }

    const currentSettings = await getRes.json()
    const current = currentSettings[0]?.data || {}

    // 2. Mesclar com novas configurações
    const updated = {
      ...current,
      payments: {
        ...(current.payments || {}),
        ...MERCADOPAGO_CONFIG
      }
    }

    // 3. Atualizar no banco
    console.log('💾 Salvando configurações...')
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/global_settings?id=eq.global`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ data: updated })
    })

    if (!updateRes.ok) {
      const error = await updateRes.text()
      throw new Error(`Erro ao atualizar: ${updateRes.status} - ${error}`)
    }

    console.log('✅ Configurações salvas com sucesso!\n')
    console.log('📋 Configurações aplicadas:')
    console.log('   Provedor: Mercado Pago')
    console.log('   Access Token: APP_USR-...****')
    console.log('   Public Key: PP_USR-...****')
    console.log('\n🎉 Pronto! Acesse /configuracao para verificar')

  } catch (error) {
    console.error('❌ Erro:', error.message)
    process.exit(1)
  }
}

setupMercadoPago()
