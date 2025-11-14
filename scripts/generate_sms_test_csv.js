const fs = require('fs')
const path = require('path')

function generateCsv(total = 4000) {
  const lines = []
  lines.push('phone,name')
  for (let i = 1; i <= total; i++) {
    const phoneNumber = '119' + String(10000000 + i).slice(1) // garante 11 dígitos
    const name = `Teste ${i}`
    lines.push(`${phoneNumber},${name}`)
  }
  return lines.join('\n')
}

function main() {
  const total = 4000
  const csv = generateCsv(total)
  const outPath = path.join(__dirname, 'sms_test_4000.csv')
  fs.writeFileSync(outPath, csv, 'utf8')
  console.log(`CSV de teste gerado em: ${outPath}`)
}

if (require.main === module) {
  main()
}
