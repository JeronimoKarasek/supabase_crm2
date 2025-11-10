// Script para testar criação de preapproval no Mercado Pago
// node scripts/test-mp-preapproval.js

const fetch = require('node-fetch')

async function testPreapproval() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  
  if (!accessToken) {
    console.error('❌ MERCADOPAGO_ACCESS_TOKEN não configurado')
    process.exit(1)
  }

  console.log('✓ Access token encontrado:', accessToken.slice(0, 10) + '...')

  // Payload mínimo para preapproval
  const preapproval = {
    reason: 'Teste Assinatura',
    external_reference: `test_${Date.now()}`,
    payer_email: 'test@example.com',
    auto_recurring: {
      frequency: 1,
      frequency_type: 'months',
      transaction_amount: 10.00,
      currency_id: 'BRL'
    },
    back_url: 'https://seu-site.com/success',
    status: 'pending'
  }

  console.log('\n📤 Enviando payload:')
  console.log(JSON.stringify(preapproval, null, 2))

  try {
    const response = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(preapproval)
    })

    const text = await response.text()
    console.log('\n📥 Response status:', response.status)
    console.log('📥 Response headers:', JSON.stringify([...response.headers.entries()], null, 2))
    console.log('📥 Response body (raw):', text)

    if (response.ok) {
      try {
        const json = JSON.parse(text)
        console.log('\n✅ Preapproval criado com sucesso!')
        console.log('ID:', json.id)
        console.log('Status:', json.status)
        console.log('Init Point:', json.init_point || json.sandbox_init_point)
      } catch (e) {
        console.log('\n⚠️ Response OK mas não é JSON válido')
      }
    } else {
      console.log('\n❌ Erro na API do Mercado Pago')
      try {
        const json = JSON.parse(text)
        console.log('Error:', json.message || json.error)
        console.log('Cause:', JSON.stringify(json.cause, null, 2))
        console.log('Details:', JSON.stringify(json, null, 2))
      } catch (e) {
        console.log('Não foi possível parsear erro como JSON')
      }
    }
  } catch (error) {
    console.error('\n❌ Erro ao fazer requisição:', error.message)
    console.error(error)
  }
}

testPreapproval()
