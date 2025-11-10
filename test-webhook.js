// Testa o webhook do Mercado Pago localmente
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

async function testWebhook() {
  console.log('\n🧪 Testando webhook do Mercado Pago...\n')
  
  // Simula notificação do MP
  const webhookPayload = {
    type: 'payment',
    data: {
      id: '133189349850' // ID do pagamento aprovado
    }
  }
  
  console.log('📤 Enviando notificação para webhook local...')
  console.log('Payload:', JSON.stringify(webhookPayload, null, 2))
  
  try {
    // Chama o webhook (precisa estar rodando em localhost:3000)
    const response = await fetch('http://localhost:3000/api/mercadopago/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(webhookPayload)
    })
    
    console.log('\n📥 Resposta do webhook:')
    console.log('Status:', response.status)
    
    const data = await response.json()
    console.log('Body:', JSON.stringify(data, null, 2))
    
    if (response.ok) {
      console.log('\n✅ Webhook processou com sucesso!')
      console.log('\n💡 Verifique se os créditos foram adicionados:')
      console.log('   - Acesse o sistema e confira o saldo')
      console.log('   - O webhook deve ter adicionado R$ 0,50')
    } else {
      console.log('\n❌ Webhook retornou erro')
    }
  } catch (error) {
    console.error('\n❌ Erro ao chamar webhook:', error.message)
    console.log('\n💡 Certifique-se de que o servidor está rodando:')
    console.log('   npm run dev')
  }
}

testWebhook()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Erro:', err)
    process.exit(1)
  })
