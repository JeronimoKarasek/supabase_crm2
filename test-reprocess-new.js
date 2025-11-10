/**
 * Testa o reprocessamento com o novo código (campo credits)
 */

const https = require('https')
const fs = require('fs')
const path = require('path')

// Ler .env.local
const envPath = path.join(__dirname, '.env.local')
let apiKey = process.env.INTERNAL_API_KEY

if (!apiKey && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  const match = envContent.match(/INTERNAL_API_KEY=(.+)/)
  if (match) apiKey = match[1].trim()
}

// Payment ID do último PIX (R$ 0,02)
const paymentId = '132606991119'

console.log('🧪 Testando reprocessamento do pagamento:', paymentId)
console.log('⚠️  AVISO: Só funciona se o Redis não tiver bloqueado (ou se não usar Redis)')
console.log('')

const postData = JSON.stringify({ paymentId })

const options = {
  hostname: 'crm.farolbase.com',
  path: '/api/mercadopago/reprocess',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': postData.length,
    ...(apiKey ? { 'X-Api-Key': apiKey } : {})
  }
}

const req = https.request(options, (res) => {
  let data = ''
  
  res.on('data', (chunk) => {
    data += chunk
  })
  
  res.on('end', () => {
    console.log(`📥 Response Status: ${res.statusCode}`)
    console.log('📦 Response Body:')
    try {
      const json = JSON.parse(data)
      console.log(JSON.stringify(json, null, 2))
      
      if (res.statusCode === 200 && json.ok) {
        console.log('')
        console.log('✅ SUCESSO!')
        console.log(`💰 Créditos adicionados: R$ ${json.addedBRL}`)
        console.log(`📊 Saldo anterior: R$ ${json.previousBalance?.toFixed(2) || 'N/A'}`)
        console.log(`📊 Saldo novo: R$ ${json.newBalance?.toFixed(2) || 'N/A'}`)
      } else if (res.statusCode === 409) {
        console.log('')
        console.log('⚠️  Pagamento já foi processado (deduplicação)')
      }
    } catch (e) {
      console.log(data)
    }
  })
})

req.on('error', (e) => {
  console.error('❌ Erro na requisição:', e.message)
})

req.write(postData)
req.end()
