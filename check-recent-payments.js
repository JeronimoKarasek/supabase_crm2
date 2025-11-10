/**
 * Busca pagamentos recentes do Mercado Pago
 * Usage: node check-recent-payments.js
 */

const https = require('https')
const fs = require('fs')
const path = require('path')

// Ler .env.local manualmente
const envPath = path.join(__dirname, '.env.local')
let token = process.env.MERCADOPAGO_ACCESS_TOKEN

if (!token && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  const match = envContent.match(/MERCADOPAGO_ACCESS_TOKEN=(.+)/)
  if (match) {
    token = match[1].trim()
  }
}

if (!token) {
  console.error('❌ MERCADOPAGO_ACCESS_TOKEN não encontrado')
  process.exit(1)
}

console.log('🔍 Buscando pagamentos da última hora...\n')

const options = {
  hostname: 'api.mercadopago.com',
  path: '/v1/payments/search?sort=date_created&criteria=desc&range=date_created&begin_date=NOW-1HOURS&end_date=NOW',
  headers: {
    'Authorization': `Bearer ${token}`
  }
}

https.get(options, (res) => {
  let data = ''
  
  res.on('data', (chunk) => {
    data += chunk
  })
  
  res.on('end', () => {
    try {
      const json = JSON.parse(data)
      
      if (json.error) {
        console.error('❌ Erro da API:', json.error, json.message)
        process.exit(1)
      }
      
      if (!json.results || json.results.length === 0) {
        console.log('ℹ️  Nenhum pagamento encontrado na última hora')
        return
      }
      
      console.log(`✅ Encontrados ${json.results.length} pagamentos:\n`)
      
      json.results.slice(0, 10).forEach((payment, i) => {
        console.log(`${i + 1}. Payment ID: ${payment.id}`)
        console.log(`   Status: ${payment.status}`)
        console.log(`   Valor: R$ ${payment.transaction_amount.toFixed(2)}`)
        console.log(`   Data: ${payment.date_created}`)
        console.log(`   External Ref: ${payment.external_reference || '(sem referência)'}`)
        console.log(`   Descrição: ${payment.description || '(sem descrição)'}`)
        console.log(`   Tipo: ${payment.payment_type_id}`)
        console.log('')
      })
      
    } catch (e) {
      console.error('❌ Erro ao parsear resposta:', e.message)
      console.log('Resposta:', data)
      process.exit(1)
    }
  })
}).on('error', (e) => {
  console.error('❌ Erro na requisição:', e.message)
  process.exit(1)
})
