import * as XLSX from 'xlsx'

/**
 * Exporta dados para CSV - FORMATO CONFIÁVEL
 * Excel tem problemas com arquivos .xlsx gerados via JS
 * CSV funciona perfeitamente e abre em Excel, Google Sheets, etc.
 */
export function exportToExcel(rows, filename = 'export') {
  // Redireciona para CSV que é mais confiável
  exportToCsv(rows, `${filename}.csv`)
}

/**
 * DESABILITADO - Mantido para referência futura
 * Excel .xlsx gerado via XLSX.js apresenta erros de formato
 */
function exportToExcelXLSX(rows, filename = 'export') {
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
  
  // Gerar arquivo Excel usando método compatível com navegadores
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Exporta dados para CSV - Formato universal compatível com Excel
 * Usa ponto-e-vírgula (;) como separador (padrão brasileiro)
 * Adiciona BOM UTF-8 para acentuação correta no Excel
 */
export function exportToCsv(rows, filename = 'export.csv') {
  if (!Array.isArray(rows) || rows.length === 0) {
    console.warn('Nenhum dado para exportar')
    return
  }

  // Coletar todos os headers (colunas) de todas as linhas
  let headers = []
  if (rows.length > 0) {
    const first = Object.keys(rows[0])
    const set = new Set(first)
    headers = [...first]
    for (let i = 1; i < rows.length; i++) {
      const ks = Object.keys(rows[i] || {})
      for (const k of ks) { 
        if (!set.has(k)) { 
          set.add(k)
          headers.push(k) 
        } 
      }
    }
  }

  // Função para escapar valores (aspas duplas, quebras de linha, ponto-e-vírgula)
  const esc = (val) => {
    if (val === null || typeof val === 'undefined') return ''
    const s = String(val)
    // Se contém ponto-e-vírgula, aspas ou quebra de linha, envolve em aspas
    if (/[;"|\n\r]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"'
    }
    return s
  }

  // Montar linhas do CSV
  const lines = []
  
  // Linha de cabeçalho
  if (headers.length) {
    lines.push(headers.map(esc).join(';'))
  }
  
  // Linhas de dados
  for (const row of rows) {
    const line = headers.map((h) => esc(row[h]))
    lines.push(line.join(';'))
  }

  // Juntar tudo com quebra de linha
  const csvCore = lines.join('\r\n')
  
  // BOM UTF-8 para Excel reconhecer acentuação corretamente
  const BOM = '\uFEFF'
  // Dica para Excel usar ';' como separador
  const SEP = 'sep=;\r\n'
  const blob = new Blob([BOM + SEP + csvCore], { type: 'text/csv;charset=utf-8;' })
  
  // Download
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
