import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function cleanBankErrorMessage(raw) {
  if (!raw) return ''
  let s = typeof raw === 'string' ? raw : (raw.message || JSON.stringify(raw))
  s = s.replace(/\r|\n/g, ' ').trim()
  s = s.replace(/^mensagem\s*:/i, '').replace(/^Mensagem\s*:/i, '').trim()
  const jsonStart = s.indexOf('{')
  const jsonEnd = s.lastIndexOf('}')
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    const jsonStr = s.slice(jsonStart, jsonEnd + 1)
    try {
      const obj = JSON.parse(jsonStr)
      const preferred = obj.detail || obj.title || obj.mensagem || obj.message || obj.error
      if (preferred) return String(preferred).trim()
    } catch {}
  }
  // Quebra por vírgula para tentar extrair partes
  const parts = s.split(/[,|;]/).map(p => p.trim()).filter(p => p)
  // Heurísticas para escolher melhor frase em PT-BR
  const isBad = (p) => {
    if (!p) return true
    if (p.startsWith('/') || p.startsWith('http')) return true
    if (/^[a-z0-9_\-]+$/i.test(p) && !/[áéíóúàãõç]/i.test(p)) return true // parece código
    if (/type|error|instance|status|consult_not|nitlgth|nighttime/i.test(p)) return true
    return false
  }
  const candidates = parts.filter(p => !isBad(p))
  // Preferir frase com 'não' ou 'nao' ou 'Criação'
  const preferred = candidates.find(p => /criaç|criac|não|nao/i.test(p)) || candidates.find(p => /consulta/i.test(p)) || candidates[0]
  if (preferred) return preferred.replace(/["{}\\]/g, '').replace(/\s+/g, ' ').trim()
  // Fallback: remove chaves e códigos
  s = s.replace(/HTTP\s+\d{3}/i, '')
  s = s.replace(/403\s*-?/g, '')
  s = s.replace(/"type".*?"detail"/i, '')
  s = s.replace(/"[^"]*"\s*:\s*/g, '')
  s = s.replace(/["{}\\]/g, ' ').replace(/\s+/g, ' ').trim()
  return s
}
