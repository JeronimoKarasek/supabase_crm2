import * as XLSX from 'xlsx'

/**
 * Exporta dados para Excel (.xlsx) - FORMATO PREFERENCIAL
 */
export function exportToExcel(rows, filename = 'export') {
  if (!Array.isArray(rows) || rows.length === 0) {
    console.warn('Nenhum dado para exportar')
    return
  }

  // Criar worksheet a partir dos dados
  const worksheet = XLSX.utils.json_to_sheet(rows)
  
  // Ajustar largura das colunas automaticamente
  const cols = Object.keys(rows[0]).map(key => ({
    wch: Math.max(
      key.length,
      ...rows.map(row => String(row[key] || '').length)
    )
  }))
  worksheet['!cols'] = cols
  
  // Criar workbook
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados')
  
  // Gerar arquivo Excel
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}

/**
 * Exporta dados para CSV (manter por compatibilidade)
 */
export function exportToCsv(rows, filename = 'export.csv') {
  if (!Array.isArray(rows)) rows = []
  let headers = []
  if (rows.length > 0) {
    // Start with first row keys, then add any missing keys from remaining rows to include all columns
    const first = Object.keys(rows[0])
    const set = new Set(first)
    headers = [...first]
    for (let i = 1; i < rows.length; i++) {
      const ks = Object.keys(rows[i] || {})
      for (const k of ks) { if (!set.has(k)) { set.add(k); headers.push(k) } }
    }
  }
  const esc = (val) => {
    if (val === null || typeof val === 'undefined') return ''
    const s = String(val)
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
    return s
  }
  const lines = []
  if (headers.length) lines.push(headers.map(esc).join(','))
  for (const row of rows) {
    const line = headers.map((h) => esc(row[h]))
    lines.push(line.join(','))
  }
  const csv = lines.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
