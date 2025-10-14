export function exportToCsv(rows, filename = 'export.csv') {
  if (!Array.isArray(rows)) rows = []
  let headers = []
  if (rows.length > 0) headers = Object.keys(rows[0])
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

