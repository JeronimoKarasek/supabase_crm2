/**
 * Verifica se os pagamentos foram marcados como processados no Redis
 */

const fs = require('fs')
const path = require('path')

// Ler .env.local
const envPath = path.join(__dirname, '.env.local')
let redisUrl = process.env.UPSTASH_REDIS_REST_URL
let redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

if ((!redisUrl || !redisToken) && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  const urlMatch = envContent.match(/UPSTASH_REDIS_REST_URL=(.+)/)
  const tokenMatch = envContent.match(/UPSTASH_REDIS_REST_TOKEN=(.+)/)
  if (urlMatch) redisUrl = urlMatch[1].trim()
  if (tokenMatch) redisToken = tokenMatch[1].trim()
}

if (!redisUrl || !redisToken) {
  console.log('⚠️  Redis não configurado (modo memory - não é possível verificar)')
  process.exit(0)
}

const https = require('https')
const { URL } = require('url')

async function checkRedisKey(key) {
  const url = new URL(redisUrl)
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      path: `/get/${key}`,
      headers: {
        'Authorization': `Bearer ${redisToken}`
      }
    }
    
    https.get(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          resolve(json.result)
        } catch (e) {
          reject(e)
        }
      })
    }).on('error', reject)
  })
}

async function checkPayments() {
  const paymentIds = ['133207568958', '132604380283']
  
  console.log('🔍 Verificando processamento no Redis...\n')
  
  for (const id of paymentIds) {
    const key = `mp:credits_applied:${id}`
    try {
      const result = await checkRedisKey(key)
      if (result) {
        console.log(`✅ Payment ${id}: PROCESSADO`)
        console.log(`   Chave Redis: ${key}`)
        console.log(`   Valor: ${result}`)
      } else {
        console.log(`❌ Payment ${id}: NÃO PROCESSADO (chave não existe)`)
      }
    } catch (e) {
      console.log(`⚠️  Payment ${id}: Erro ao verificar - ${e.message}`)
    }
    console.log('')
  }
}

checkPayments()
