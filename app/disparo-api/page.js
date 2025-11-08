"use client"

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { supabase } from '@/lib/supabase'
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import ChartBuilder from '@/components/chart-builder'

function Help({ title, children }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Passo a passo</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {children}
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}

function buildCsvTemplate() {
  const header = ['phone', 'name', 'var1', 'var2']
  const sample = ['+5511999999999', 'Fulano da Silva', 'Valor 1', 'Valor 2']
  return [header.join(','), sample.join(',')].join('\n')
}

function qualityLabelPt(val) {
  const v = String(val || '').toUpperCase()
  if (v === 'GREEN' || v === 'HIGH') return 'Alta'
  if (v === 'YELLOW' || v === 'MEDIUM') return 'Media'
  if (v === 'RED' || v === 'LOW') return 'Baixa'
  return 'Desconhecida'
}

function nameStatusPt(val) {
  const v = String(val || '').toUpperCase()
  if (v === 'APPROVED' || v === 'VERIFIED') return 'Aprovado'
  if (v === 'PENDING' || v === 'SUBMITTED') return 'Pendente'
  if (v === 'REJECTED' || v === 'DISABLED') return 'Rejeitado'
  if (v === 'UNVERIFIED') return 'Não verificado'
  return 'Desconhecido'
}

export default function DisparoApiPage() {
  const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || 'https://crm.farolbase.com')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Credentials
  const [credentials, setCredentials] = useState([]) // lista
  const [newCred, setNewCred] = useState({ label: '', waba_id: '', access_token: '', app_id: '', app_secret: '', webhook_verify_token: 'verificadorcrm' })

  // Disparo/import
  const [csvText, setCsvText] = useState('')
  const [csvRows, setCsvRows] = useState([])
  const [countryCode, setCountryCode] = useState('55')
  const [selectedCredentialId, setSelectedCredentialId] = useState('')
  const [phoneNumbers, setPhoneNumbers] = useState([])
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState('')
  const [templates, setTemplates] = useState([])
  const [templateName, setTemplateName] = useState('')
  const [templateLanguage, setTemplateLanguage] = useState('pt_BR')
  const [headerImageUrl, setHeaderImageUrl] = useState('')
  const [batchId, setBatchId] = useState('')
  const [campaignsRefreshKey, setCampaignsRefreshKey] = useState(0)

  // Reports
  const [report, setReport] = useState({
    quality_rating: '',
    name_status: '',
    display_phone_number: '',
    counts: {},
  })
  const [sentTodayCounts, setSentTodayCounts] = useState({})
  const [batches, setBatches] = useState([])
  const [allPhones, setAllPhones] = useState([])
  const [periodType, setPeriodType] = useState('today')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [seriesData, setSeriesData] = useState([])
  const [periodTotal, setPeriodTotal] = useState(0)
  // Relatórios (Meta insights)
  const [relPeriodType, setRelPeriodType] = useState('today')
  const [relCustomStart, setRelCustomStart] = useState('')
  const [relCustomEnd, setRelCustomEnd] = useState('')
  const [metaStats, setMetaStats] = useState({ totals: { sent: 0, delivered: 0, received: 0 }, categories: {}, free: {}, since: '', until: '', errors: [] })
  const [metaErrorsOpen, setMetaErrorsOpen] = useState(false)

  const parseCsv = (text) => {
    if (!text) return []
    // remove BOM if present
    text = text.replace(/^\uFEFF/, '')

    const rawLines = text.split(/\r?\n/)
    const lines = rawLines.filter(l => l.trim().length > 0)
    if (!lines.length) return []

    // autodetect delimiter among ; , \t |
    const candidates = [';', ',', '\t', '|'].map(s => s === '\\t' ? '\t' : s)
    const scoreDelim = (d) => {
      const sample = lines.slice(0, Math.min(lines.length, 3))
      return sample.reduce((acc, l) => acc + (l.split(d).length - 1), 0)
    }
    let delim = ','
    let best = -1
    for (const c of candidates) {
      const val = scoreDelim(c)
      if (val > best) { best = val; delim = c }
    }

    const splitLine = (line) => {
      const DELIM = delim
      const out = []
      let cur = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') {
          if (inQuotes && i + 1 < line.length && line[i + 1] === '"') { cur += '"'; i++ } else { inQuotes = !inQuotes }
        } else if (ch === DELIM && !inQuotes) {
          out.push(cur)
          cur = ''
        } else {
          cur += ch
        }
      }
      out.push(cur)
      return out
    }

    // normalização de cabeçalhos: aceita "telefone", "celular", "whatsapp", "número" etc. e mapeia para phone
    const normalize = (s) => String(s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove acentos
      .replace(/\s+/g, '')

    const rawHeader = splitLine(lines[0])
    const headerMap = {}
    rawHeader.forEach((h, idx) => {
      const n = normalize(h)
      // phone synonyms
      if (['phone', 'telefone', 'celular', 'whatsapp', 'numero', 'numero*', 'número', 'num'].includes(n)) {
        headerMap[idx] = 'phone'
        return
      }
      // name synonyms
      if (['name', 'nome', 'contato', 'responsavel', 'responsável'].includes(n)) {
        headerMap[idx] = 'name'
        return
      }
      // varK synonyms: var1, var 1, variavel1, variavel 1, variavel_1, valor1, campo1 etc
      const vk = n.match(/^(?:var|variavel|variavel|valor|campo)[_\s\-]*([0-9]+)$/)
      if (vk) {
        headerMap[idx] = `var${vk[1]}`
        return
      }
      // fallback: mantém o cabeçalho original
      headerMap[idx] = String(h).trim()
    })

    const out = []
    for (let i = 1; i < lines.length; i++) {
      const cols = splitLine(lines[i])
      const row = {}
      rawHeader.forEach((h, idx) => {
        const key = headerMap[idx]
        row[key] = (cols[idx] ?? '').toString().trim()
      })
      if (row.phone) out.push(row)
    }
    return out
  }

  const loadCreds = async () => {
    try {
      setError('')
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/disparo-api/credentials', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      const data = await res.json()
      if (res.ok) {
        setCredentials(Array.isArray(data?.credentials) ? data.credentials : [])
      } else if (data?.missingTable) {
        setError('Tabela whatsapp_credentials não encontrada. Execute o SQL sugerido abaixo em seu Supabase.')
      }
    } catch (e) {
      setError('Falha ao buscar credenciais')
    }
  }

  const addCredential = async () => {
    try {
      setLoading(true)
      setError('')
      setMessage('')
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/disparo-api/credentials', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(newCred) })
      const data = await res.json()
      if (res.ok) {
        setMessage('Credencial adicionada.')
        setNewCred({ label: '', waba_id: '', access_token: '', app_id: '', app_secret: '', webhook_verify_token: 'verificadorcrm' })
        loadCreds()
      } else {
        setError(data?.error || 'Falha ao adicionar credencial')
      }
    } catch (e) {
      setError('Erro inesperado ao adicionar')
    } finally {
      setLoading(false)
    }
  }

  const updateCredential = async (cred) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      await fetch('/api/disparo-api/credentials', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(cred) })
      loadCreds()
    } catch {}
  }

  const removeCredential = async (id) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      await fetch('/api/disparo-api/credentials', { method: 'DELETE', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ id }) })
      if (selectedCredentialId === id) {
        setSelectedCredentialId('')
        setPhoneNumbers([])
        setTemplates([])
      }
      loadCreds()
    } catch {}
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setCsvText(text)
    setCsvRows(parseCsv(text))
  }

  const downloadModel = () => {
    const csv = buildCsvTemplate()
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'modelo_disparo.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const importRows = async () => {
    if (!selectedCredentialId || !selectedPhoneNumberId || !templateName || !csvRows.length) {
      setError('Selecione credencial, número, template e carregue o CSV.')
      return
    }
    try {
      setLoading(true)
      setError('')
      setMessage('')
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      // normaliza phones (remove não-dígitos e prefixa código do país se necessário)
      const sciToIntString = (val) => {
        const s = String(val || '').trim()
        const m = s.match(/^([0-9]+(?:\.[0-9]+)?)e([+-]?[0-9]+)$/i)
        if (!m) return null
        let mant = m[1]
        const exp = parseInt(m[2], 10)
        if (isNaN(exp)) return null
        // remove dot and track decimals
        const parts = mant.split('.')
        let int = parts[0]
        let frac = parts[1] || ''
        if (exp >= 0) {
          // shift decimal to right
          if (exp >= frac.length) {
            int = int + frac + '0'.repeat(exp - frac.length)
            frac = ''
          } else {
            int = int + frac.slice(0, exp)
            frac = frac.slice(exp)
          }
          return int + (frac ? frac : '')
        } else {
          // negative exponent: shift left (produce leading zeros)
          const k = Math.abs(exp)
          const all = int + frac
          if (k >= all.length) return '0' // too small
          const pos = all.length - k
          const left = all.slice(0, pos)
          // drop fractional part
          return left
        }
      }

      const normalized = csvRows.map(r => {
        let raw = String(r.phone ?? '').trim()
        // try convert scientific notation like 1.997e+10
        const sci = sciToIntString(raw)
        if (sci) raw = sci
        let digits = raw.replace(/\D/g, '')
        const cc = String(countryCode || '').replace(/\D/g, '')
        if (cc && digits && !digits.startsWith(cc)) digits = cc + digits
        return { ...r, phone: digits }
      })
      // busca o param_count do template selecionado
      const selectedTemplate = templates.find(t => t.name === templateName && t.language === templateLanguage)
      const templateParamCount = selectedTemplate?.param_count || 0
      const hasImageHeader = selectedTemplate?.header?.type === 'IMAGE'
      
      // Validar se header de imagem está preenchido
      if (hasImageHeader && !headerImageUrl) {
        setError('Este template requer uma imagem no cabeçalho. Preencha a URL da imagem.')
        setLoading(false)
        return
      }
      
      const payload = { 
        credential_id: selectedCredentialId, 
        phone_number_id: selectedPhoneNumberId, 
        template_name: templateName, 
        template_language: templateLanguage, 
        template_param_count: templateParamCount,
        header_image_url: hasImageHeader ? headerImageUrl : null,
        rows: normalized 
      }
      const res = await fetch('/api/disparo-api/import', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (res.ok) {
        setMessage(`Importação concluída. ${data.inserted || 0} registros. Batch: ${data.batch_id}`)
        setBatchId(data.batch_id)
        setCampaignsRefreshKey(k => k + 1)
      } else {
        setError(data?.error || 'Falha ao importar')
      }
    } catch (e) {
      setError('Erro inesperado ao importar')
    } finally {
      setLoading(false)
    }
  }

  const enviar = async (idOptional, includeFailed = false) => {
    const bid = idOptional || batchId
    if (!bid) { setError('Nenhum batch selecionado ou importado.'); return }
    try {
      setLoading(true)
      setError('')
      setMessage('')
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/disparo-api/send', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ batch_id: bid, include_failed: includeFailed }) })
      const data = await res.json()
      if (res.ok) {
        const msg = `Envio iniciado. Sucessos: ${data.sent || 0}, Falhas: ${data.failed || 0}`
        setMessage(msg)
        if ((data.sent || 0) === 0 && (data.failed || 0) > 0 && Array.isArray(data.sample_errors) && data.sample_errors.length) {
          setError(`Falha ao enviar: ${data.sample_errors[0].message} (ex.: ${data.sample_errors[0].count} ocorrências)`)          
        }
        setCampaignsRefreshKey(k => k + 1)
      } else {
        setError(data?.error || 'Falha ao enviar')
      }
    } catch (e) {
      setError('Erro inesperado no envio')
    } finally {
      setLoading(false)
    }
  }

  const loadReport = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const qp = []
      if (batchId) qp.push(`batch_id=${encodeURIComponent(batchId)}`)
      if (!batchId && selectedCredentialId && selectedPhoneNumberId) {
        qp.push(`credential_id=${encodeURIComponent(selectedCredentialId)}`)
        qp.push(`phone_number_id=${encodeURIComponent(selectedPhoneNumberId)}`)
      }
      const res = await fetch(`/api/disparo-api/reports${qp.length ? `?${qp.join('&')}` : ''}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      const data = await res.json()
      if (res.ok) setReport(data)
    } catch {}
  }
  const loadSentToday = async (start, end) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const qp = []
      if (start) qp.push(`start=${encodeURIComponent(start)}`)
      if (end) qp.push(`end=${encodeURIComponent(end)}`)
      const res = await fetch(`/api/disparo-api/sent-today${qp.length ? `?${qp.join('&')}` : ''}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      const data = await res.json()
      if (res.ok) setSentTodayCounts(data?.counts || {})
    } catch {}
  }
  const loadBatches = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/disparo-api/batches', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      const data = await res.json()
      if (res.ok) setBatches(Array.isArray(data?.batches) ? data.batches : [])
    } catch {}
  }
  const loadAllPhones = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const all = []
      for (const c of credentials || []) {
        const res = await fetch(`/api/disparo-api/meta/phone-numbers?credential_id=${encodeURIComponent(c.id)}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const json = await res.json()
        if (res.ok) {
          for (const n of (json?.numbers || [])) {
            all.push({ credential_label: c.label || c.waba_id, ...n })
          }
        }
      }
      setAllPhones(all)
    } catch {}
  }
  const loadSeries = async (start, end) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const qp = []
      if (start) qp.push(`start=${encodeURIComponent(start)}`)
      if (end) qp.push(`end=${encodeURIComponent(end)}`)
      qp.push('metric=sent')
      const res = await fetch(`/api/disparo-api/series?${qp.join('&')}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      const json = await res.json()
      if (res.ok) {
        setSeriesData(Array.isArray(json?.series) ? json.series : [])
        setPeriodTotal(json?.total || 0)
      }
    } catch {}
  }

  const computeRelRange = () => {
    const now = new Date()
    if (relPeriodType === 'today') {
      const s = new Date(); s.setUTCHours(0,0,0,0)
      return { start: s.toISOString(), end: now.toISOString() }
    }
    if (relPeriodType === '7d') {
      const s = new Date(Date.now() - 6*24*60*60*1000); s.setUTCHours(0,0,0,0)
      return { start: s.toISOString(), end: now.toISOString() }
    }
    if (relPeriodType === '30d') {
      const s = new Date(Date.now() - 29*24*60*60*1000); s.setUTCHours(0,0,0,0)
      return { start: s.toISOString(), end: now.toISOString() }
    }
    const s = relCustomStart ? new Date(`${relCustomStart}T00:00:00.000Z`) : new Date()
    const e = relCustomEnd ? new Date(`${relCustomEnd}T23:59:59.999Z`) : new Date()
    return { start: s.toISOString(), end: e.toISOString() }
  }

  const loadMetaStats = async () => {
    if (!selectedCredentialId) return
    try {
      const { start, end } = computeRelRange()
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const qp = [
        `credential_id=${encodeURIComponent(selectedCredentialId)}`,
        ...(selectedPhoneNumberId ? [`phone_number_id=${encodeURIComponent(selectedPhoneNumberId)}`] : []),
        `start=${encodeURIComponent(start)}`,
        `end=${encodeURIComponent(end)}`,
      ]
      const res = await fetch(`/api/disparo-api/meta/insights?${qp.join('&')}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      const json = await res.json()
      if (res.ok) setMetaStats(json)
    } catch {}
  }
  useEffect(() => {
    if ((credentials || []).length) {
      loadAllPhones()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(credentials)])
  const updateCharts = async () => {
    let start, end
    const now = new Date()
    if (periodType === 'today') {
      const s = new Date()
      s.setUTCHours(0,0,0,0)
      start = s.toISOString()
      end = now.toISOString()
    } else if (periodType === '7d') {
      const s = new Date(Date.now() - 6*24*60*60*1000)
      s.setUTCHours(0,0,0,0)
      start = s.toISOString()
      end = now.toISOString()
    } else if (periodType === '30d') {
      const s = new Date(Date.now() - 29*24*60*60*1000)
      s.setUTCHours(0,0,0,0)
      start = s.toISOString()
      end = now.toISOString()
    } else {
      const s = customStart ? new Date(`${customStart}T00:00:00.000Z`) : new Date()
      const e = customEnd ? new Date(`${customEnd}T23:59:59.999Z`) : new Date()
      start = s.toISOString()
      end = e.toISOString()
    }
    await Promise.all([loadReport(), loadSentToday(start, end), loadBatches(), loadSeries(start, end)])
  }

  useEffect(() => { loadCreds() }, [])

  // quando selecionar credencial, buscar números e templates
  useEffect(() => {
    ;(async () => {
      if (!selectedCredentialId) { setPhoneNumbers([]); setTemplates([]); setSelectedPhoneNumberId(''); setTemplateName(''); return }
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        const [nRes, tRes] = await Promise.all([
          fetch(`/api/disparo-api/meta/phone-numbers?credential_id=${encodeURIComponent(selectedCredentialId)}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined }),
          fetch(`/api/disparo-api/meta/templates?credential_id=${encodeURIComponent(selectedCredentialId)}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined }),
        ])
        const nJson = await nRes.json()
        const tJson = await tRes.json()
        if (nRes.ok) setPhoneNumbers(nJson?.numbers || [])
        if (tRes.ok) setTemplates(tJson?.templates || [])
      } catch {}
    })()
  }, [selectedCredentialId])

  return (
    <div className="-m-4 min-h-[calc(100vh-56px)] bg-background">
      <div className="py-6 px-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Disparo API</h1>
          <p className="text-sm text-muted-foreground">Envie mensagens via WhatsApp Cloud API (Meta)</p>
        </div>
      </div>
      {message ? <div className="text-green-600 text-sm">{message}</div> : null}
      {error ? <div className="text-red-600 text-sm">{error}</div> : null}

  <Tabs defaultValue="credenciais">
        <TabsList>
          <TabsTrigger value="credenciais">Credenciais</TabsTrigger>
          <TabsTrigger value="disparo">Disparo</TabsTrigger>
          <TabsTrigger value="Relatórios">Relatórios</TabsTrigger>
          <TabsTrigger value="qualidade">Qualidade do número</TabsTrigger>
          <TabsTrigger value="grafico">Gráfico</TabsTrigger>
        </TabsList>

        <TabsContent value="credenciais">
          <Card className="bg-muted/30">
            <CardHeader className="bg-muted/50 rounded-t-xl">
              <CardTitle>Credenciais WhatsApp (Meta)</CardTitle>
              <CardDescription>Use WABA ID e Token permanente. Você pode adicionar múltiplas credenciais.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 bg-muted/20 rounded-b-xl">
              <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <div className="space-y-1">
                  <Label>Label</Label>
                  <Input value={newCred.label} onChange={e => setNewCred(v => ({ ...v, label: e.target.value }))} placeholder="Ex: Conta Principal" />
                </div>
                <div className="space-y-1">
                  <Label>WABA ID</Label>
                  <Input value={newCred.waba_id} onChange={e => setNewCred(v => ({ ...v, waba_id: e.target.value }))} placeholder="Ex: 123456789012345" />
                </div>
                <div className="space-y-1">
                  <Label>Access Token (permanente)</Label>
                  <Input value={newCred.access_token} onChange={e => setNewCred(v => ({ ...v, access_token: e.target.value }))} placeholder="EAAG..." />
                </div>
                <div className="space-y-1">
                  <Label>Verify Token do Webhook</Label>
                  <Input value={newCred.webhook_verify_token} onChange={e => setNewCred(v => ({ ...v, webhook_verify_token: e.target.value }))} placeholder="verificadorcrm" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <div className="space-y-1">
                  <Label>App ID (opcional)</Label>
                  <Input value={newCred.app_id} onChange={e => setNewCred(v => ({ ...v, app_id: e.target.value }))} placeholder="1234567890" />
                </div>
                <div className="space-y-1">
                  <Label>App Secret (opcional)</Label>
                  <Input value={newCred.app_secret} onChange={e => setNewCred(v => ({ ...v, app_secret: e.target.value }))} placeholder="xxxxxxxxxxxxxxxx" />
                </div>
              </div>
                <div className="flex gap-2">
                  <Button onClick={addCredential} disabled={loading}>Adicionar credencial</Button>
                  <Button variant="secondary" onClick={loadCreds}>Recarregar</Button>
                </div>
                <Separator />
                <div className="space-y-2">
                  {credentials.map((c) => (
                    <div key={c.id} className="border rounded p-3 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                        <div className="space-y-1"><Label>Label</Label><Input value={c.label || ''} onChange={e => setCredentials(prev => prev.map(x => x.id===c.id? { ...x, label: e.target.value }: x))} /></div>
                        <div className="space-y-1"><Label>WABA ID</Label><Input value={c.waba_id || ''} onChange={e => setCredentials(prev => prev.map(x => x.id===c.id? { ...x, waba_id: e.target.value }: x))} /></div>
                      <div className="space-y-1"><Label>Access Token</Label><Input value={c.access_token || ''} onChange={e => setCredentials(prev => prev.map(x => x.id===c.id? { ...x, access_token: e.target.value }: x))} /></div>
                      <div className="space-y-1"><Label>Verify Token</Label><Input value={c.webhook_verify_token || ''} onChange={e => setCredentials(prev => prev.map(x => x.id===c.id? { ...x, webhook_verify_token: e.target.value }: x))} /></div>
                      <div className="space-y-1"><Label>App ID (opcional)</Label><Input value={c.app_id || ''} onChange={e => setCredentials(prev => prev.map(x => x.id===c.id? { ...x, app_id: e.target.value }: x))} /></div>
                      <div className="space-y-1"><Label>App Secret (opcional)</Label><Input value={c.app_secret || ''} onChange={e => setCredentials(prev => prev.map(x => x.id===c.id? { ...x, app_secret: e.target.value }: x))} /></div>
                      </div>
                      <div className="text-xs text-muted-foreground">Webhook URL: {`${BASE_URL}/api/disparo-api/webhook/${c.waba_id}`}</div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => updateCredential(c)}>Salvar alterações</Button>
                        <Button size="sm" variant="destructive" onClick={() => removeCredential(c.id)}>Remover</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Se as tabelas não existirem, rode o SQL em scripts/sql/disparo_api.sql no Supabase.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disparo">
          <Card className="bg-muted/30">
            <CardHeader className="bg-muted/50 rounded-t-xl">
              <CardTitle>Base de disparo</CardTitle>
              <CardDescription>Baixe o modelo, importe sua base e selecione o template e número.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 bg-muted/20 rounded-b-xl">
              <div className="flex gap-2 items-center">
                <Input type="file" accept=".csv" onChange={onFile} className="flex-1" />
                <Button onClick={downloadModel} variant="outline" className="whitespace-nowrap">Baixar modelo CSV</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Credencial</Label>
                  <Select value={selectedCredentialId} onValueChange={v => setSelectedCredentialId(v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione a credencial" /></SelectTrigger>
                    <SelectContent>
                      {credentials.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.label || c.waba_id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>número (Phone Number ID)</Label>
                  <Select value={selectedPhoneNumberId} onValueChange={setSelectedPhoneNumberId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o número" /></SelectTrigger>
                    <SelectContent>
                      {phoneNumbers.map(n => (
                        <SelectItem key={n.id} value={n.id}>{n.display_phone_number} ({n.id.slice(-6)})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Template</Label>
                  <Select value={templateName} onValueChange={setTemplateName}>
                    <SelectTrigger><SelectValue placeholder="Selecione o template" /></SelectTrigger>
                    <SelectContent>
                      {templates.map(t => (
                        <SelectItem key={`${t.name}:${t.language}`} value={t.name}>
                          {t.name} ({t.language}) {t.param_count > 0 ? `[${t.param_count} var${t.param_count > 1 ? 's' : ''}]` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Idioma</Label>
                  <Select value={templateLanguage} onValueChange={setTemplateLanguage}>
                    <SelectTrigger><SelectValue placeholder="Selecione o idioma" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt_BR">pt_BR</SelectItem>
                      <SelectItem value="pt_PT">pt_PT</SelectItem>
                      <SelectItem value="en_US">en_US</SelectItem>
                      <SelectItem value="es_ES">es_ES</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-4">
                  <Label>Código do país para normalização (opcional)</Label>
                  <div className="flex items-center gap-2">
                    <Input className="w-32" value={countryCode} onChange={e => setCountryCode(e.target.value)} placeholder="55" />
                    <div className="text-xs text-muted-foreground">Se um telefone não iniciar com este código, ele será prefixado ao importar.</div>
                  </div>
                </div>
              </div>

              {/* Preview do Template Selecionado */}
              {templateName && (() => {
                const selectedTemplate = templates.find(t => t.name === templateName && t.language === templateLanguage)
                if (!selectedTemplate) return null
                
                const hasImageHeader = selectedTemplate.header?.type === 'IMAGE'
                
                return (
                  <div className="space-y-4 p-4 border rounded-lg bg-card">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">Preview do Template: {selectedTemplate.name}</div>
                      <div className="text-xs px-2 py-1 rounded bg-muted">
                        {selectedTemplate.category} • {selectedTemplate.language}
                      </div>
                    </div>
                    
                    <div className="max-w-md mx-auto space-y-2 p-4 rounded-lg border bg-background shadow-sm">
                      {/* Header */}
                      {selectedTemplate.header?.type && (
                        <div className="space-y-2">
                          {hasImageHeader && (
                            <>
                              <div className="text-xs font-medium text-muted-foreground">Cabeçalho (Imagem)</div>
                              <div className="space-y-2">
                                <Input 
                                  placeholder="URL da imagem (ex: https://exemplo.com/imagem.jpg)"
                                  value={headerImageUrl}
                                  onChange={(e) => setHeaderImageUrl(e.target.value)}
                                  className="text-sm"
                                />
                                {headerImageUrl && (
                                  <div className="relative w-full aspect-video bg-muted rounded overflow-hidden">
                                    <img 
                                      src={headerImageUrl} 
                                      alt="Preview" 
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        e.target.style.display = 'none'
                                        e.target.parentElement.innerHTML = '<div class="flex items-center justify-center h-full text-xs text-muted-foreground">Erro ao carregar imagem</div>'
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                          {selectedTemplate.header?.type === 'TEXT' && selectedTemplate.header?.text && (
                            <div className="font-bold text-sm">{selectedTemplate.header.text}</div>
                          )}
                        </div>
                      )}
                      
                      {/* Body */}
                      {selectedTemplate.body && (
                        <div className="text-sm whitespace-pre-wrap">
                          {selectedTemplate.body}
                        </div>
                      )}
                      
                      {/* Footer */}
                      {selectedTemplate.footer && (
                        <div className="text-xs text-muted-foreground pt-2 border-t">
                          {selectedTemplate.footer}
                        </div>
                      )}
                      
                      {/* Buttons */}
                      {selectedTemplate.buttons && selectedTemplate.buttons.length > 0 && (
                        <div className="space-y-1 pt-2">
                          {selectedTemplate.buttons.map((btn, idx) => (
                            <div key={idx} className="text-xs text-center py-2 px-3 rounded bg-primary/10 text-primary font-medium">
                              {btn.text || btn.type}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {selectedTemplate.param_count > 0 && (
                      <div className="text-xs text-muted-foreground text-center">
                        💡 Este template usa {selectedTemplate.param_count} variável{selectedTemplate.param_count > 1 ? 'is' : ''}: {Array.from({length: selectedTemplate.param_count}, (_, i) => `{{${i+1}}}`).join(', ')}
                      </div>
                    )}
                  </div>
                )
              })()}

              <div className="flex gap-2">
                <Button onClick={importRows} disabled={loading || !csvRows.length || !selectedCredentialId || !selectedPhoneNumberId || !templateName}>Importar</Button>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Prévia: {csvRows.length} linhas</div>
              {csvRows.length > 0 && (
                <div className="max-h-64 overflow-auto border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>phone</TableHead>
                        <TableHead>name</TableHead>
                        <TableHead>var1</TableHead>
                        <TableHead>var2</TableHead>
                        <TableHead>var3</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvRows.slice(0,10).map((r, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{r.phone}</TableCell>
                          <TableCell>{r.name}</TableCell>
                          <TableCell>{r.var1}</TableCell>
                          <TableCell>{r.var2}</TableCell>
                          <TableCell>{r.var3}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {csvRows.length > 0 && templateName && (() => {
                const selectedTemplate = templates.find(t => t.name === templateName && t.language === templateLanguage)
                const paramCount = selectedTemplate?.param_count || 0
                if (paramCount > 0) {
                  const sampleRow = csvRows[0] || {}
                  const missingVars = []
                  for (let i = 1; i <= paramCount; i++) {
                    if (!sampleRow[`var${i}`]) missingVars.push(`var${i}`)
                  }
                  if (missingVars.length > 0) {
                    return (
                      <div className="p-3 bg-warning/10 border border-warning rounded text-sm">
                        ⚠️ Template <strong>{templateName}</strong> requer {paramCount} variável{paramCount > 1 ? 'is' : ''} ({Array.from({length: paramCount}, (_, i) => `var${i+1}`).join(', ')}). 
                        {missingVars.length > 0 && ` Faltando no CSV: ${missingVars.join(', ')}`}
                      </div>
                    )
                  }
                }
                return null
              })()}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium mt-4">Campanhas importadas</div>
                <CampaignsList
                  refreshKey={campaignsRefreshKey}
                  selectedBatchId={batchId}
                  onSend={(id, includeFailed) => { setBatchId(id); enviar(id, includeFailed) }}
                />
              </div>

              <Separator />
              <div className="mt-4">
                <ChartBuilder />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="Relatórios">
          <Card className="bg-muted/30">
            <CardHeader className="bg-muted/50 rounded-t-xl">
              <CardTitle>Relatórios</CardTitle>
              <CardDescription>Qualidade do número e estatísticas dos envios.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 bg-muted/20 rounded-b-xl">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Credencial</Label>
                  <Select value={selectedCredentialId} onValueChange={v => setSelectedCredentialId(v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione a credencial" /></SelectTrigger>
                    <SelectContent>
                      {credentials.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.label || c.waba_id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>número (Phone Number ID)</Label>
                  <Select value={selectedPhoneNumberId} onValueChange={setSelectedPhoneNumberId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o número" /></SelectTrigger>
                    <SelectContent>
                      {phoneNumbers.map(n => (
                        <SelectItem key={n.id} value={n.id}>{n.display_phone_number} ({n.id.slice(-6)})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={loadReport} variant="outline">Atualizar</Button>
                <Button onClick={async () => {
                  const { data: sessionData } = await supabase.auth.getSession()
                  const token = sessionData?.session?.access_token
                  const qp = []
                  if (batchId) qp.push(`batch_id=${encodeURIComponent(batchId)}`)
                  if (!batchId && selectedCredentialId && selectedPhoneNumberId) {
                    qp.push(`credential_id=${encodeURIComponent(selectedCredentialId)}`)
                    qp.push(`phone_number_id=${encodeURIComponent(selectedPhoneNumberId)}`)
                  }
                  const res = await fetch(`/api/disparo-api/reports/download${qp.length ? `?${qp.join('&')}` : ''}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
                  if (res.ok) {
                    const blob = await res.blob()
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'relatorio_disparo.csv'
                    document.body.appendChild(a)
                    a.click()
                    document.body.removeChild(a)
                    URL.revokeObjectURL(url)
                  }
                }}>Baixar relatório</Button>
              </div>
              {/* estatísticas (Meta) */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Período</Label>
                  <Select value={relPeriodType} onValueChange={setRelPeriodType}>
                    <SelectTrigger><SelectValue placeholder="Selecione o período" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Hoje</SelectItem>
                      <SelectItem value="7d">Últimos 7 dias</SelectItem>
                      <SelectItem value="30d">Últimos 30 dias</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {relPeriodType === 'custom' && (
                  <>
                    <div className="space-y-2">
                      <Label>Início</Label>
                      <Input type="date" value={relCustomStart} onChange={e=>setRelCustomStart(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Fim</Label>
                      <Input type="date" value={relCustomEnd} onChange={e=>setRelCustomEnd(e.target.value)} />
                    </div>
                  </>
                )}
                <div className="flex items-end">
                  <Button onClick={loadMetaStats} variant="outline" className="w-full">Atualizar estatísticas (Meta)</Button>
                </div>
              </div>
              {/* blocos extras para espelhar o Manager: pagas/grátis e cobranças */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 border rounded">
                  <div className="text-xs text-muted-foreground">Mensagens pagas entregues</div>
                  <div className="text-lg font-semibold">{metaStats?.delivered_paid || 0}</div>
                </div>
                <div className="p-3 border rounded">
                  <div className="text-xs text-muted-foreground">Mensagens gr�tis entregues</div>
                  <div className="text-lg font-semibold">{(metaStats?.delivered_free != null ? metaStats.delivered_free : ((metaStats?.free?.support_free || 0) + (metaStats?.free?.entry_point_free || 0)))}</div>
                </div>
                <div className="p-3 border rounded">
                  <div className="text-xs text-muted-foreground">Total de cobran�as aproximado</div>
                  <div className="text-lg font-semibold">
                    {(() => {
                      const v = Number(metaStats?.approx_spend_total || 0)
                      if (!v) return 'N/D'
                      try { return v.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) } catch { return `$${v.toFixed(2)}` }
                    })()}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-3 border rounded"><div className="text-xs text-muted-foreground">Marketing</div><div className="text-lg font-semibold">{metaStats?.categories?.marketing || 0}</div></div>
                <div className="p-3 border rounded"><div className="text-xs text-muted-foreground">Servi�os</div><div className="text-lg font-semibold">{metaStats?.categories?.service || 0}</div></div>
                <div className="p-3 border rounded"><div className="text-xs text-muted-foreground">Autentica��o</div><div className="text-lg font-semibold">{metaStats?.categories?.authentication || 0}</div></div>
                <div className="p-3 border rounded"><div className="text-xs text-muted-foreground">Autentica��o - internacional</div><div className="text-lg font-semibold">{metaStats?.categories?.authentication_international || 0}</div></div>
              </div>
              {(() => {
                const sp = metaStats?.approx_spend_by_category || {}
                const total = Number(metaStats?.approx_spend_total || 0)
                if (!total) return null
                const fmt = (n) => { try { return Number(n||0).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) } catch { const x=Number(n||0); return `$${x.toFixed(2)}` } }
                return (
                  <div className="p-3 border rounded">
                    <div className="text-sm font-medium mb-1">Cobran�as por categoria (aprox.)</div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                      <div>Marketing: <strong>{fmt(sp.marketing)}</strong></div>
                      <div>Servi�os: <strong>{fmt(sp.service)}</strong></div>
                      <div>Autentica��o: <strong>{fmt(sp.authentication)}</strong></div>
                      <div>Autentica��o - intern.: <strong>{fmt(sp.authentication_international)}</strong></div>
                      <div>Utility: <strong>{fmt(sp.utility)}</strong></div>
                    </div>
                  </div>
                )
              })()}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 border rounded"><div className="text-xs text-muted-foreground">Mensagens enviadas ({metaStats?.source === 'crm_fallback' ? 'CRM' : 'Meta'})</div><div className="text-lg font-semibold">{metaStats?.totals?.sent || 0}</div></div>
                <div className="p-3 border rounded"><div className="text-xs text-muted-foreground">Mensagens entregues ({metaStats?.source === 'crm_fallback' ? 'CRM' : 'Meta'})</div><div className="text-lg font-semibold">{metaStats?.totals?.delivered || 0}</div></div>
                <div className="p-3 border rounded"><div className="text-xs text-muted-foreground">Mensagens recebidas ({metaStats?.source === 'crm_fallback' ? 'CRM (aprox. por leituras)' : 'Meta'})</div><div className="text-lg font-semibold">{metaStats?.totals?.received || 0}</div></div>
              </div>
              {Array.isArray(metaStats?.errors) && metaStats.errors.length > 0 && (
                <div className="p-3 border rounded bg-yellow-50 text-yellow-900 text-sm">
                  <div className="flex items-center justify-between">
                    <div>Ocorreram {metaStats.errors.length} avisos da API Meta neste período.</div>
                    <Button size="sm" variant="outline" onClick={() => setMetaErrorsOpen(v=>!v)}>
                      {metaErrorsOpen ? 'Ocultar detalhes' : 'Ver detalhes'}
                    </Button>
                  </div>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    {(metaErrorsOpen ? metaStats.errors : metaStats.errors.slice(0,3)).map((e, i) => (
                      <li key={i} className="break-all">{String(e)}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 border rounded"><div className="text-xs text-muted-foreground">Mensagens grátis entregues</div><div className="text-lg font-semibold">{(metaStats?.free?.support_free || 0) + (metaStats?.free?.entry_point_free || 0)}</div></div>
                <div className="p-3 border rounded"><div className="text-xs text-muted-foreground">Serviço</div><div className="text-lg font-semibold">{metaStats?.categories?.service || 0}</div></div>
                <div className="p-3 border rounded"><div className="text-xs text-muted-foreground">Autenticação</div><div className="text-lg font-semibold">{(metaStats?.categories?.authentication || 0) + (metaStats?.categories?.authentication_international || 0)}</div></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 border rounded">
                  <div className="text-xs text-muted-foreground">Qualidade</div>
                  <div className="text-lg font-semibold">{qualityLabelPt(report.quality_rating) || '-'}</div>
                </div>
                <div className="p-3 border rounded">
                  <div className="text-xs text-muted-foreground">Status do nome</div>
                  <div className="text-lg font-semibold">{nameStatusPt(report.name_status) || '-'}</div>
                </div>
                <div className="p-3 border rounded">
                  <div className="text-xs text-muted-foreground">número</div>
                  <div className="text-lg font-semibold">{report.display_phone_number || '-'}</div>
                </div>
              </div>
              <Separator />
              <div>
                <h3 className="text-sm font-medium mb-2">Status dos envios</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Quantidade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(report.counts || {}).map(([k,v]) => (
                      <TableRow key={k}>
                        <TableCell>{k}</TableCell>
                        <TableCell>{v}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="qualidade">
          <Card className="bg-muted/30">
            <CardHeader className="bg-muted/50 rounded-t-xl">
              <CardTitle>Qualidade do número</CardTitle>
              <CardDescription>Todos os números de todas as credenciais, com qualidade e envios de hoje.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 bg-muted/20 rounded-b-xl">
              <QualityAcrossCredentials credentials={credentials} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="grafico">
          <Card className="bg-muted/30">
            <CardHeader className="bg-muted/50 rounded-t-xl">
              <CardTitle>Gráficos</CardTitle>
              <CardDescription>Visualizações dos envios e números do WhatsApp API</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 bg-muted/20 rounded-b-xl">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Credencial</Label>
                  <Select value={selectedCredentialId} onValueChange={v => setSelectedCredentialId(v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione a credencial" /></SelectTrigger>
                    <SelectContent>
                      {credentials.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.label || c.waba_id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>número (Phone Number ID)</Label>
                  <Select value={selectedPhoneNumberId} onValueChange={setSelectedPhoneNumberId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o número" /></SelectTrigger>
                    <SelectContent>
                      {phoneNumbers.map(n => (
                        <SelectItem key={n.id} value={n.id}>{n.display_phone_number} ({n.id.slice(-6)})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Período</Label>
                  <Select value={periodType} onValueChange={setPeriodType}>
                    <SelectTrigger><SelectValue placeholder="Selecione o Período" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Hoje</SelectItem>
                      <SelectItem value="7d">Últimos 7 dias</SelectItem>
                      <SelectItem value="30d">Últimos 30 dias</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {periodType === 'custom' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Inicio</Label>
                    <Input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Fim</Label>
                    <Input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} />
                  </div>
                  <div className="flex items-end">
                  <Button onClick={updateCharts} variant="outline" className="w-full">Atualizar Gráficos</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-end">
                  <Button onClick={updateCharts} variant="outline">Atualizar Gráficos</Button>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Envios agregados por dia (todas as credenciais)</div>
                <div className="p-3 border rounded text-right">
                  <div className="text-xs text-muted-foreground">Total no Período</div>
                  <div className="text-xl font-semibold">{periodTotal.toLocaleString()}</div>
                </div>
              </div>

              <div className="p-3 border rounded">
                <div className="text-sm font-medium mb-2">Envios por dia</div>
                {Array.isArray(seriesData) && seriesData.length ? (
                  <ChartContainer config={{ sent: { label: 'Enviadas', color: 'hsl(210 90% 60%)' } }} className="h-64">
                    <LineChart data={seriesData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent hideIndicator />} />
                      <Line type="monotone" dataKey="value" stroke={`var(--color-sent)`} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ChartContainer>
                ) : (
                  <div className="text-sm text-muted-foreground">Sem dados no Período selecionado.</div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-3 border rounded">
                <div className="text-sm font-medium mb-2">Distribuição de Status</div>
                  {(() => {
                    const order = ['queued','sent','delivered','read','failed']
                    const labels = { queued: 'Na fila', sent: 'Enviadas', delivered: 'Entregues', read: 'Lidas', failed: 'Falhas' }
                    const data = order.map(k => ({ key: k, status: labels[k] || k, value: report?.counts?.[k] || 0 }))
                    const chartConfig = {
                      queued: { label: 'Na fila', color: 'hsl(215 20% 65%)' },
                      sent: { label: 'Enviadas', color: 'hsl(210 90% 60%)' },
                      delivered: { label: 'Entregues', color: 'hsl(140 65% 45%)' },
                      read: { label: 'Lidas', color: 'hsl(260 65% 55%)' },
                      failed: { label: 'Falhas', color: 'hsl(0 70% 55%)' },
                    }
                    const total = data.reduce((a,b)=>a+(b.value||0),0)
                    return total > 0 ? (
                      <ChartContainer config={chartConfig} className="h-64">
                        <PieChart>
                          <Pie data={data} dataKey="value" nameKey="status" innerRadius={50} outerRadius={80} paddingAngle={2}>
                            {data.map((d) => (
                              <Cell key={d.key} fill={`var(--color-${d.key})`} />
                            ))}
                          </Pie>
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <ChartLegend content={<ChartLegendContent />} />
                        </PieChart>
                      </ChartContainer>
                    ) : (
                      <div className="text-sm text-muted-foreground">Sem dados. Clique em Atualizar Gráficos.</div>
                    )
                  })()}
                </div>
                <div className="p-3 border rounded">
                  <div className="text-sm font-medium mb-2">Status (Barras)</div>
                  {(() => {
                    const order = ['queued','sent','delivered','read','failed']
                    const labels = { queued: 'Na fila', sent: 'Enviadas', delivered: 'Entregues', read: 'Lidas', failed: 'Falhas' }
                    const data = order.map(k => ({ key: k, status: labels[k] || k, value: report?.counts?.[k] || 0 }))
                    const total = data.reduce((a,b)=>a+(b.value||0),0)
                    return total > 0 ? (
                      <ChartContainer config={{}} className="h-64">
                        <BarChart data={data}>
                          <CartesianGrid vertical={false} strokeDasharray="3 3" />
                          <XAxis dataKey="status" tickLine={false} axisLine={false} />
                          <YAxis allowDecimals={false} />
                          <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                          <Bar dataKey="value">
                            {data.map((d) => (
                              <Cell key={d.key} fill={`var(--color-${d.key})`} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ChartContainer>
                    ) : (
                      <div className="text-sm text-muted-foreground">Sem dados. Clique em Atualizar Gráficos.</div>
                    )
                  })()}
                </div>
              </div>

              <div className="p-3 border rounded">
                <div className="text-sm font-medium mb-2">Envios por número no período (Top 10)</div>
                {(() => {
                  const map = new Map(allPhones.map(p => [p.id, p.display_phone_number]))
                  const rows = Object.entries(sentTodayCounts || {})
                    .map(([id, v]) => ({ id, label: map.get(id) || id, value: v }))
                    .sort((a,b)=> b.value - a.value)
                    .slice(0,10)
                  const total = rows.reduce((a,b)=>a+(b.value||0),0)
                  return total > 0 ? (
                    <ChartContainer config={{ sent: { label: 'Enviadas', color: 'hsl(210 90% 60%)' } }} className="h-64">
                      <BarChart data={rows}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} angle={-25} textAnchor="end" height={60} />
                        <YAxis allowDecimals={false} />
                        <ChartTooltip content={<ChartTooltipContent hideIndicator />} />
                        <Bar dataKey="value" fill={`var(--color-sent)`} />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <div className="text-sm text-muted-foreground">Sem envios no Período.</div>
                  )
                })()}
              </div>

              <div className="p-3 border rounded">
                <div className="text-sm font-medium mb-2">Qualidade dos números</div>
                {(() => {
                  const agg = {}
                  for (const n of allPhones || []) {
                    const k = (n.quality_rating || 'UNKNOWN')
                    agg[k] = (agg[k] || 0) + 1
                  }
                  const rows = Object.entries(agg).map(([k,v]) => ({ label: qualityLabelPt(k), value: v }))
                  const total = rows.reduce((a,b)=>a+(b.value||0),0)
                  return total > 0 ? (
                    <ChartContainer config={{ qual: { label: 'Quantidade', color: 'hsl(140 65% 45%)' } }} className="h-64">
                      <BarChart data={rows}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} />
                        <YAxis allowDecimals={false} />
                        <ChartTooltip content={<ChartTooltipContent hideIndicator />} />
                        <Bar dataKey="value" fill={`var(--color-qual)`} />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <div className="text-sm text-muted-foreground">Nenhum número encontrado.</div>
                  )
                })()}
              </div>

              <div className="p-3 border rounded">
                <div className="text-sm font-medium mb-2">Top templates por volume</div>
                {(() => {
                  const filtered = (batches || []).filter(b => {
                    if (selectedCredentialId && b.credential_id !== selectedCredentialId) return false
                    if (selectedPhoneNumberId && b.phone_number_id !== selectedPhoneNumberId) return false
                    return true
                  })
                  const m = new Map()
                  for (const b of filtered) {
                    const k = b.template_name || 'desconhecido'
                    const cur = m.get(k) || { template: k, total: 0 }
                    cur.total += (b.counts?.total || 0)
                    m.set(k, cur)
                  }
                  const rows = Array.from(m.values()).sort((a,b)=>b.total-a.total).slice(0,10)
                  const total = rows.reduce((a,b)=>a+(b.total||0),0)
                  return total > 0 ? (
                    <ChartContainer config={{ total: { label: 'Total', color: 'hsl(260 65% 55%)' } }} className="h-64">
                      <BarChart data={rows}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="template" tickLine={false} axisLine={false} interval={0} angle={-25} textAnchor="end" height={60} />
                        <YAxis allowDecimals={false} />
                        <ChartTooltip content={<ChartTooltipContent hideIndicator />} />
                        <Bar dataKey="total" fill={`var(--color-total)`} />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <div className="text-sm text-muted-foreground">Sem dados de templates.</div>
                  )
                })()}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  )
}

function CampaignsList({ selectedBatchId, onSend, refreshKey }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/disparo-api/batches', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      const data = await res.json()
      if (res.ok) setItems(data?.batches || [])
    } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [refreshKey])

  return (
    <div className="border rounded">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Batch</TableHead>
            <TableHead>Número</TableHead>
            <TableHead>Template</TableHead>
            <TableHead>Contagens</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(items || []).map((b) => (
            <TableRow key={b.batch_id} className={selectedBatchId===b.batch_id? 'bg-muted/50' : ''}>
              <TableCell>{new Date(b.created_at).toLocaleString()}</TableCell>
              <TableCell>{b.batch_id.slice(0,8)}</TableCell>
              <TableCell>{b.phone_number_id}</TableCell>
              <TableCell>{b.template_name} ({b.template_language})</TableCell>
              <TableCell>
                <span className="text-xs">T:{b.counts.total} Q:{b.counts.queued} S:{b.counts.sent} D:{b.counts.delivered} R:{b.counts.read} F:{b.counts.failed}</span>
              </TableCell>
              <TableCell>
                {(() => {
                  const hasQueued = (b.counts?.queued || 0) > 0
                  const hasFailed = (b.counts?.failed || 0) > 0
                  const label = hasQueued ? 'Enviar' : (hasFailed ? 'Reenviar falhas' : 'Enviar')
                  const disabled = !hasQueued && !hasFailed
                  const includeFailed = !hasQueued && hasFailed
                  return (
                    <Button size="sm" onClick={() => onSend(b.batch_id, includeFailed)} disabled={disabled}>{label}</Button>
                  )
                })()}
              </TableCell>
            </TableRow>
          ))}
          {(!items || !items.length) && (
            <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Nenhuma campanha importada ainda.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function QualityAcrossCredentials({ credentials }) {
  const [rows, setRows] = useState([])
  const [qPeriodType, setQPeriodType] = useState('today')
  const [qCustomStart, setQCustomStart] = useState('')
  const [qCustomEnd, setQCustomEnd] = useState('')
  const [qTotal, setQTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  function computeRange() {
    const now = new Date()
    if (qPeriodType === 'today') {
      const s = new Date()
      s.setUTCHours(0,0,0,0)
      return { start: s.toISOString(), end: now.toISOString() }
    }
    if (qPeriodType === '7d') {
      const s = new Date(Date.now() - 6*24*60*60*1000)
      s.setUTCHours(0,0,0,0)
      return { start: s.toISOString(), end: now.toISOString() }
    }
    if (qPeriodType === '30d') {
      const s = new Date(Date.now() - 29*24*60*60*1000)
      s.setUTCHours(0,0,0,0)
      return { start: s.toISOString(), end: now.toISOString() }
    }
    const s = qCustomStart ? new Date(`${qCustomStart}T00:00:00.000Z`) : new Date()
    const e = qCustomEnd ? new Date(`${qCustomEnd}T23:59:59.999Z`) : new Date()
    return { start: s.toISOString(), end: e.toISOString() }
  }

  const refresh = async () => {
    try {
      setLoading(true)
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const { start, end } = computeRange()
      const all = []
      for (const c of credentials || []) {
        const res = await fetch(`/api/disparo-api/meta/phone-numbers?credential_id=${encodeURIComponent(c.id)}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const data = await res.json()
        if (res.ok) {
          for (const n of (data?.numbers || [])) {
            all.push({ credential_id: c.id, credential_label: c.label || c.waba_id, ...n })
          }
        }
      }
      let total = 0
      const out = []
      for (const n of all) {
        try {
          const url = `/api/disparo-api/meta/insights?credential_id=${encodeURIComponent(n.credential_id)}&phone_number_id=${encodeURIComponent(n.id)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
          const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
          const j = await r.json()
          const sent = j?.totals?.sent || 0
          total += sent
          out.push({ ...n, sent_period: sent })
        } catch {
          out.push({ ...n, sent_period: 0 })
        }
      }
      setRows(out)
      setQTotal(total)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [JSON.stringify(credentials), qPeriodType, qCustomStart, qCustomEnd])

  const { start, end } = computeRange()
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="space-y-2">
          <Label>Período</Label>
          <Select value={qPeriodType} onValueChange={setQPeriodType}>
            <SelectTrigger><SelectValue placeholder="Selecione o Período" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {qPeriodType === 'custom' && (
          <>
            <div className="space-y-2">
              <Label>Inicio</Label>
              <Input type="date" value={qCustomStart} onChange={e=>setQCustomStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fim</Label>
              <Input type="date" value={qCustomEnd} onChange={e=>setQCustomEnd(e.target.value)} />
            </div>
          </>
        )}
        <div className="flex items-end">
          <Button onClick={refresh} variant="outline" className="w-full" disabled={loading}>Atualizar</Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">Período: {new Date(start).toLocaleDateString()} - {new Date(end).toLocaleDateString()}</div>
        <div className="p-3 border rounded text-right">
          <div className="text-xs text-muted-foreground">Total no Período (Meta)</div>
          <div className="text-xl font-semibold">{qTotal.toLocaleString()}</div>
        </div>
      </div>

      <div className="border rounded max-h-[480px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Credencial</TableHead>
              <TableHead>número</TableHead>
              <TableHead>Phone Number ID</TableHead>
              <TableHead>Qualidade</TableHead>
              <TableHead>Status nome</TableHead>
              <TableHead>Enviadas no Período</TableHead>
              <TableHead>Limite diário</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, idx) => (
              <TableRow key={`${r.id}-${idx}`}>
                <TableCell>{r.credential_label}</TableCell>
                <TableCell>{r.display_phone_number}</TableCell>
                <TableCell>{r.id}</TableCell>
                <TableCell>{qualityLabelPt(r.quality_rating) || '-'}</TableCell>
              <TableCell>{nameStatusPt(r.name_status) || '-'}</TableCell>
                <TableCell>{r.sent_period}</TableCell>
                <TableCell>N/A</TableCell>
              </TableRow>
            ))}
            {(!rows || !rows.length) && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground">Nenhum número encontrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
