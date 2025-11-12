"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { Send, Upload, MessageSquare, AlertCircle, RefreshCw, X, Link as LinkIcon } from 'lucide-react'

export default function DisparoSmsPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Configuração global SMS
  const [hasToken, setHasToken] = useState(false)
  const [smsMessageValue, setSmsMessageValue] = useState('')

  // Disparo
  const [segments, setSegments] = useState([])
  const [selectedSegmentId, setSelectedSegmentId] = useState('default')
  const [balance, setBalance] = useState('') // saldo agora exibido fora (navbar) apenas para admin
  const [messageTemplate, setMessageTemplate] = useState('')
  const [referencePrefix, setReferencePrefix] = useState('')
  const [csvText, setCsvText] = useState('')
  const [csvRows, setCsvRows] = useState([])
  const [batchId, setBatchId] = useState('')
  const [campaignsRefreshKey, setCampaignsRefreshKey] = useState(0)
  // Retorno WhatsApp e agendamento
  const [returnNumber, setReturnNumber] = useState('')
  const [whatsappMessage, setWhatsappMessage] = useState('') // Nova mensagem personalizada do WhatsApp
  const [scheduleAt, setScheduleAt] = useState('') // datetime-local
  const [chunkSize, setChunkSize] = useState('') // tamanho por lote (cliente)
  const [chunkIntervalSec, setChunkIntervalSec] = useState('') // minutos entre lotes (cliente)
  const [sendingScheduler, setSendingScheduler] = useState({ active: false, nextAt: null, intervalId: null })
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [confirmData, setConfirmData] = useState(null)
  // Jobs (após envio) e métricas locais por sessão
  const [jobStates, setJobStates] = useState({}) // { batchId: { smsJob, status: 'running'|'paused', metrics: {...} } }
  const [showDetails, setShowDetails] = useState(false)
  const [detailsData, setDetailsData] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState('')

  // Parse CSV
  const parseCsv = (text) => {
    if (!text) return []
    text = text.replace(/^\uFEFF/, '')
    const rawLines = text.split(/\r?\n/)
    const lines = rawLines.filter(l => l.trim().length > 0)
    if (!lines.length) return []

    const candidates = [';', ',', '\t', '|']
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

    const normalize = (s) => String(s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

    const rawHeader = splitLine(lines[0])
    const headerMap = {}
    rawHeader.forEach((h, idx) => {
      const n = normalize(h)
      if (['phone', 'telefone', 'celular', 'whatsapp', 'numero', 'fone'].includes(n)) {
        headerMap[idx] = 'phone'
      } else if (['name', 'nome', 'contato'].includes(n)) {
        headerMap[idx] = 'name'
      } else if (['cpf', 'documento'].includes(n)) {
        headerMap[idx] = 'cpf'
      } else if (['valor', 'value', 'amount'].includes(n)) {
        headerMap[idx] = 'valor'
      } else {
        headerMap[idx] = String(h).trim()
      }
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

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/global-settings')
      const js = await res.json()
      const s = js?.settings || {}
      setHasToken(!!s.smsApiToken)
      setSmsMessageValue(s.smsMessageValue || '')
    } catch {}
  }

  const loadSegments = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      console.log('📋 [SMS Segments] Buscando centros de custo...', { hasToken: !!token })
      const res = await fetch(`/api/disparo-sms/segments`, { 
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined 
      })
      const data = await res.json()
      console.log('📋 [SMS Segments] Resposta:', { ok: res.ok, status: res.status, data })
      if (res.ok) setSegments(data?.segments || [])
      else console.error('❌ [SMS Segments] Erro:', data)
    } catch (e) {
      console.error('❌ [SMS Segments] Exception:', e)
    }
  }

  const loadBalance = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      console.log('📊 [SMS Balance] Buscando saldo...', { hasToken: !!token })
      const res = await fetch(`/api/disparo-sms/balance`, { 
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined 
      })
      const data = await res.json()
      console.log('📊 [SMS Balance] Resposta:', { ok: res.ok, status: res.status, data })
      if (res.ok) setBalance(data?.balance || '0')
      else console.error('❌ [SMS Balance] Erro:', data)
    } catch (e) {
      console.error('❌ [SMS Balance] Exception:', e)
    }
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setCsvText(text)
    setCsvRows(parseCsv(text))
  }

  const importRows = async () => {
    if (!messageTemplate || !csvRows.length) {
      setError('Defina a mensagem e carregue o CSV.')
      return
    }
    try {
      setLoading(true)
      setError('')
      setMessage('')
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const segmentId = selectedSegmentId && selectedSegmentId !== 'default' ? parseInt(selectedSegmentId, 10) : null
      const payload = { 
        message_template: messageTemplate,
        tenant_segment_id: segmentId,
        reference_prefix: referencePrefix || null,
        rows: csvRows 
      }
      const res = await fetch('/api/disparo-sms/import', { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          ...(token ? { Authorization: `Bearer ${token}` } : {}) 
        }, 
        body: JSON.stringify(payload) 
      })
      let data = {}
      try {
        data = await res.json()
      } catch (parseErr) {
        console.error('Falha ao parsear resposta JSON da importação:', parseErr)
        setError('Resposta inválida do servidor ao importar')
        setLoading(false)
        return
      }
      if (res.ok) {
        setMessage(`Importação concluída. ${data.inserted || 0} registros. Batch: ${data.batch_id}`)
        setBatchId(data.batch_id)
        setCampaignsRefreshKey(k => k + 1)
      } else {
        setError(data?.error || 'Falha ao importar')
      }
    } catch (e) {
      console.error('Erro inesperado ao importar:', e)
      setError('Erro inesperado ao importar: ' + (e.message || ''))
    } finally {
      setLoading(false)
    }
  }

  const prepareEnviar = async (idOptional, includeFailed = false) => {
    const bid = idOptional || batchId
    if (!bid) { setError('Nenhum batch selecionado ou importado.'); return }
    
    // Buscar quantos números válidos serão enviados
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      
      // Consultar quantos registros válidos existem no batch
      const statusFilter = includeFailed ? 'failed' : 'queued'
      
      const { count, error: countError } = await supabase
        .from('sms_disparo')
        .select('*', { count: 'exact', head: true })
        .eq('batch_id', bid)
        .eq('status', statusFilter)
      
      if (countError) {
        console.error('[SMS] Erro ao contar:', countError)
        setError('Erro ao calcular quantidade de SMS')
        return
      }
      
      const validCount = count || 0
      const costPerSms = Number(smsMessageValue) || 0
      const totalCost = validCount * costPerSms
      
      setConfirmData({
        bid,
        includeFailed,
        validCount,
        costPerSms,
        totalCost
      })
      setShowConfirmDialog(true)
    } catch (e) {
      console.error('[SMS] Exception ao preparar envio:', e)
      setError('Erro ao calcular custos: ' + e.message)
    }
  }

  const confirmarEnvio = async () => {
    if (!confirmData) return
    setShowConfirmDialog(false)
    
    const { bid, includeFailed } = confirmData
    try {
      setLoading(true)
      setError('')
      setMessage('')
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/disparo-sms/send', { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          ...(token ? { Authorization: `Bearer ${token}` } : {}) 
        }, 
        body: JSON.stringify({ batch_id: bid, include_failed: includeFailed }) 
      })
      const data = await res.json()
      if (res.ok) {
        const msg = `✅ Envio concluído! Válidos: ${data.valid || 0}, Inválidos: ${data.invalid || 0}, Blacklist: ${data.blacklist || 0}, Não Perturbe: ${data.not_disturb || 0}. Créditos debitados: R$ ${(data.credits?.totalUnits * data.credits?.unitBRL || 0).toFixed(2)}`
        setMessage(msg)
        setCampaignsRefreshKey(k => k + 1)
        loadBalance()
        // Registrar job se retornado
        if (data.smsJob) {
          setJobStates(prev => ({
            ...prev,
            [confirmData.bid]: {
              smsJob: data.smsJob,
              status: 'running',
              metrics: {
                sent: data.sent || 0,
                delivered: data.sent || 0, // aproximação inicial
                failed: data.failed || 0,
                replies: 0,
                total: (data.sent || 0) + (data.failed || 0)
              }
            }
          }))
        }
      } else {
        setError(data?.error || 'Falha ao enviar')
      }
    } catch (e) {
      setError('Erro inesperado no envio')
    } finally {
      setLoading(false)
      setConfirmData(null)
      // Limpar estado de envio após completar
      window.clearSendingBatch?.()
    }
  }

  // Função auxiliar para envio direto (sem confirmação)
  const enviarDireto = async (bid, includeFailed = false) => {
    try {
      setLoading(true)
      setError('')
      setMessage('')
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/disparo-sms/send', { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          ...(token ? { Authorization: `Bearer ${token}` } : {}) 
        }, 
        body: JSON.stringify({ batch_id: bid, include_failed: includeFailed, limit: parseInt(chunkSize || '1000', 10) }) 
      })
      const data = await res.json()
      if (res.ok) {
        const msg = `✅ Lote enviado! Válidos: ${data.valid || 0}, Inválidos: ${data.invalid || 0}`
        setMessage(msg)
        setCampaignsRefreshKey(k => k + 1)
        loadBalance()
      } else {
        setError(data?.error || 'Falha ao enviar lote')
      }
    } catch (e) {
      setError('Erro inesperado no envio do lote')
    } finally {
      setLoading(false)
    }
  }

  // Envio agendado em lotes (frontend). Requer manter a aba aberta.
  const enviarAgendado = async () => {
    if (!batchId) { setError('Nenhum batch selecionado ou importado.'); return }
    const size = Math.max(1, Math.min(parseInt(chunkSize || '0', 10) || 0, 1000))
    const gapMinutes = Math.max(1, parseInt(chunkIntervalSec || '0', 10) || 0)
    if (!size || !gapMinutes) { setError('Defina tamanho do lote e intervalo (min).'); return }
    const gapMs = gapMinutes * 60 * 1000
    try {
      // espera até scheduleAt, se definido e futuro
      let delayMs = 0
      if (scheduleAt) {
        const ts = new Date(scheduleAt).getTime()
        const now = Date.now()
        delayMs = Math.max(0, ts - now)
      }
      setMessage('Agendamento iniciado. Mantenha esta aba aberta até finalizar.')
      // primeira execução após delay
      setTimeout(async () => {
        // dispara imediatamente um primeiro lote
        await enviarDireto(batchId, false)
        // agendar execuções subsequentes
        const id = setInterval(async () => {
          await enviarDireto(batchId, false)
        }, gapMs)
        setSendingScheduler({ active: true, nextAt: new Date(Date.now() + gapMs).toISOString(), intervalId: id })
      }, delayMs)
    } catch (e) {
      setError('Falha ao iniciar agendamento')
    }
  }

  const cancelarAgendamento = () => {
    if (sendingScheduler?.intervalId) clearInterval(sendingScheduler.intervalId)
    setSendingScheduler({ active: false, nextAt: null, intervalId: null })
    setMessage('Agendamento cancelado')
  }

  useEffect(() => {
    loadSettings()
    loadSegments()
    loadBalance()
  }, [])

  const fetchDetailsReport = async (period = 168) => {
    try {
      setDetailsLoading(true); setDetailsError(''); setDetailsData(null)
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/disparo-sms/reports/quantity-jobs', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) },
        body: JSON.stringify({ period })
      })
      const js = await res.json()
      if(!res.ok){
        setDetailsError(js?.error || 'Falha ao carregar detalhes')
        return
      }
      setDetailsData(js.report || js)
    } catch(e){
      setDetailsError('Erro inesperado')
    } finally { setDetailsLoading(false) }
  }

  // Carregar dados do localStorage se vindo de clientes
  useEffect(() => {
    try {
      const storedCsv = localStorage.getItem('sms_csv_data')
      const storedSource = localStorage.getItem('sms_csv_source')
      console.log('📱 [SMS Page] Checking localStorage:', { hasCsv: !!storedCsv, source: storedSource })
      if (storedCsv && storedSource === 'base_csv') {
        console.log('📱 [SMS Page] Loading CSV from localStorage...')
        setCsvText(storedCsv)
        const rows = parseCsv(storedCsv)
        console.log('📱 [SMS Page] Parsed rows:', rows.length)
        setCsvRows(rows)
        // Limpar localStorage após carregar
        localStorage.removeItem('sms_csv_data')
        localStorage.removeItem('sms_csv_source')
        console.log('✅ [SMS Page] CSV loaded successfully')
        // A aba "Nova Campanha" já é a padrão, mas podemos garantir
        setTimeout(() => {
          const hash = window.location.hash
          if (hash === '#nova-campanha') {
            const element = document.getElementById('nova-campanha')
            if (element) element.scrollIntoView({ behavior: 'smooth' })
          }
        }, 100)
      }
    } catch (e) {
      console.error('❌ [SMS Page] Error loading SMS data from localStorage:', e)
    }
  }, [])

  const availableVars = (() => {
    if (!csvRows.length) return []
    const sample = csvRows[0]
    return Object.keys(sample).filter(k => k !== 'phone')
  })()

  return (
    <div className="p-6 space-y-6">
      {/* Header com gradiente */}
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 shadow-lg">
          <MessageSquare className="h-8 w-8 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
            Disparo SMS
          </h1>
          <p className="text-muted-foreground mt-1">Envie SMS em massa para sua base de contatos</p>
          {smsMessageValue && (
            <p className="text-xs text-muted-foreground mt-1">Cada SMS consome R$ {Number(smsMessageValue).toFixed(2)} em créditos.</p>
          )}
        </div>
      </div>

      {message && (
        <Alert className="border-l-4 border-l-green-500 bg-green-50 dark:bg-green-950/20">
          <AlertCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">{message}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert className="border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800 dark:text-red-200">{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="nova" className="space-y-6">
        <TabsList className="grid grid-cols-3 md:max-w-lg bg-gradient-to-r from-teal-500/10 to-cyan-500/10">
          <TabsTrigger value="nova" className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-teal-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white">
            Nova Campanha
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-teal-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white">
            Relatórios
          </TabsTrigger>
          <TabsTrigger value="detalhados" className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-teal-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white">
            Detalhados
          </TabsTrigger>
        </TabsList>
        <TabsContent value="nova" className="space-y-6">

      {!hasToken && (
        <Alert>
          <AlertDescription>
            Token de API SMS não configurado. Acesse <strong>Configuração → Credenciais (SMS)</strong> para adicionar seu token.
          </AlertDescription>
        </Alert>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle>Nova Campanha SMS</CardTitle>
          <CardDescription>Importe sua base, personalize variáveis e acompanhe o envio. O custo por mensagem segue o valor configurado.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Centro de Custo (opcional)</Label>
                  <Select value={selectedSegmentId} onValueChange={setSelectedSegmentId}>
                    <SelectTrigger><SelectValue placeholder="Padrão: Corporativo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Padrão (Corporativo)</SelectItem>
                      {segments.map(s => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Saldo SMS movido para cabeçalho (app-chrome) quando admin */}

              <div className="space-y-2">
                <Label>Mensagem SMS</Label>
                <div className="grid grid-cols-1 gap-3">
                  {/* Campos para criar link curto personalizado */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Número WhatsApp (retorno)</Label>
                      <Input placeholder="Ex: 11999887766" value={returnNumber} onChange={(e)=> setReturnNumber(e.target.value)} />
                      <p className="text-xs text-muted-foreground">DDI 55 será adicionado automaticamente</p>
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <Label className="text-xs">Mensagem do link WhatsApp</Label>
                      <Input placeholder="Ex: Quero saber mais sobre essa oferta" value={whatsappMessage} onChange={(e)=> setWhatsappMessage(e.target.value)} />
                      <p className="text-xs text-muted-foreground">Texto que será pré-preenchido no WhatsApp</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={async () => {
                      let num = returnNumber.trim()
                      if (!num) { alert('Informe o número para retorno'); return }
                      // Garantir DDI 55 se não houver
                      if (!num.startsWith('55')) {
                        // Remove caracteres não numéricos
                        num = num.replace(/\D/g, '')
                        if (num.length <= 11) num = '55' + num
                      }
                      
                      const message = whatsappMessage.trim() || 'Saber mais'
                      const encoded = encodeURIComponent(message)
                      const realUrl = `https://wa.me/${num}?text=${encoded}`
                      
                      // Criar link curto personalizado via API
                      try {
                        const { data: sessionData } = await supabase.auth.getSession()
                        const token = sessionData?.session?.access_token
                        const res = await fetch('/api/short-link', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            ...(token ? { Authorization: `Bearer ${token}` } : {})
                          },
                          body: JSON.stringify({ 
                            realUrl,
                            phone: num,
                            message
                          })
                        })
                        const data = await res.json()
                        if (res.ok && data.shortUrl) {
                          // Insere link curto personalizado no final da mensagem
                          setMessageTemplate(prev => (prev ? prev + "\n" + data.shortUrl : data.shortUrl))
                          setMessage(`✅ Link criado: ${data.shortUrl}`)
                          setTimeout(() => setMessage(''), 3000)
                        } else {
                          // Fallback: usa link direto do WhatsApp
                          setMessageTemplate(prev => (prev ? prev + "\n" + realUrl : realUrl))
                          setError('Não foi possível criar link curto, usando link direto')
                          setTimeout(() => setError(''), 3000)
                        }
                      } catch (e) {
                        // Fallback: insere link direto
                        setMessageTemplate(prev => (prev ? prev + "\n" + realUrl : realUrl))
                      }
                    }}>
                      <LinkIcon className="h-4 w-4 mr-2" />
                      Inserir link WhatsApp
                    </Button>
                  </div>
                </div>
                <Textarea 
                  placeholder="Digite sua mensagem aqui. Use {{nome}}, {{cpf}}, {{valor}} etc. para variáveis." 
                  value={messageTemplate} 
                  onChange={(e) => setMessageTemplate(e.target.value)}
                  rows={6}
                />
                <div className="text-xs text-muted-foreground">
                  Variáveis disponíveis no CSV: {availableVars.length > 0 ? availableVars.map(v => `{{${v}}}`).join(', ') : 'Carregue um CSV para ver'}
                </div>
                <div className="text-xs text-muted-foreground">
                  Limite: 160 caracteres por mensagem. Tamanho atual: {messageTemplate.length}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Prefixo de Referência (opcional)</Label>
                <Input placeholder="Ex: campanha_natal" value={referencePrefix} onChange={(e) => setReferencePrefix(e.target.value)} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Agendar envio (data e hora)</Label>
                  <Input type="datetime-local" value={scheduleAt} onChange={(e)=> setScheduleAt(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Tamanho do lote</Label>
                  <Input type="number" min="1" max="1000" placeholder="Ex: 200" value={chunkSize} onChange={(e)=> setChunkSize(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Intervalo entre lotes (minutos)</Label>
                  <Input type="number" min="1" placeholder="Ex: 5" value={chunkIntervalSec} onChange={(e)=> setChunkIntervalSec(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Base CSV</Label>
                <div className="flex gap-2">
                  <Input type="file" accept=".csv" onChange={onFile} />
                </div>
                <div className="text-xs text-muted-foreground">
                  Colunas obrigatórias: phone (ou telefone). Opcionais: nome, cpf, valor, etc.
                </div>
              </div>

              {csvRows.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Prévia: {csvRows.length} linhas</div>
                  <div className="max-h-64 overflow-auto border rounded">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>phone</TableHead>
                          <TableHead>name</TableHead>
                          <TableHead>cpf</TableHead>
                          <TableHead>valor</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {csvRows.slice(0, 5).map((r, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{r.phone}</TableCell>
                            <TableCell>{r.name}</TableCell>
                            <TableCell>{r.cpf}</TableCell>
                            <TableCell>{r.valor}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {messageTemplate && (
                    <div className="p-3 bg-muted rounded">
                      <div className="text-sm font-medium mb-2">Preview da mensagem (primeira linha):</div>
                      <div className="text-sm whitespace-pre-wrap">
                        {(() => {
                          let preview = messageTemplate
                          const sample = csvRows[0]
                          Object.keys(sample).forEach(k => {
                            const regex = new RegExp(`\\{\\{${k}\\}\\}`, 'gi')
                            preview = preview.replace(regex, sample[k])
                          })
                          return preview
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button 
                  onClick={importRows} 
                  disabled={loading || !csvRows.length || !messageTemplate || !hasToken}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {!hasToken ? 'Configure o token SMS' : !messageTemplate ? 'Escreva a mensagem' : !csvRows.length ? 'Carregue o CSV' : 'Importar Campanha'}
                </Button>
                <Button type="button" variant="outline" onClick={enviarAgendado} disabled={!batchId || !chunkSize || !chunkIntervalSec}>
                  Agendar envio em lotes (cliente)
                </Button>
                {sendingScheduler.active && (
                  <Button type="button" variant="destructive" onClick={cancelarAgendamento}>Cancelar agendamento</Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Campanhas Importadas</CardTitle>
              <CardDescription>Métricas e progresso de cada campanha</CardDescription>
            </CardHeader>
            <CardContent>
              <CampaignsList
                refreshKey={campaignsRefreshKey}
                selectedBatchId={batchId}
                onSend={(id, includeFailed) => { setBatchId(id); prepareEnviar(id, includeFailed) }}
                jobStates={jobStates}
                setJobStates={setJobStates}
                openDetails={(bid) => { setShowDetails(true); fetchDetailsReport(); }}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="relatorios" className="space-y-6">
          <RelatoriosCampanhas />
        </TabsContent>

        <TabsContent value="detalhados" className="space-y-6">
          <RelatoriosDetalhados />
        </TabsContent>
      </Tabs>

      {/* Dialog de Confirmação de Envio */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Envio de SMS</DialogTitle>
            <DialogDescription>
              Revise os detalhes antes de confirmar o envio da campanha
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Números válidos:</span>
                <span className="text-lg font-bold text-green-600">{confirmData?.validCount || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Custo por SMS:</span>
                <span className="text-sm">R$ {(confirmData?.costPerSms || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm font-bold">Total a ser debitado:</span>
                <span className="text-xl font-bold text-red-600">R$ {(confirmData?.totalCost || 0).toFixed(2)}</span>
              </div>
            </div>
            <Alert className="border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                <strong>Atenção:</strong> Os créditos serão debitados automaticamente. Esta ação não pode ser desfeita.
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowConfirmDialog(false); setConfirmData(null) }}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={confirmarEnvio} className="bg-green-600 hover:bg-green-700">
              <Send className="h-4 w-4 mr-2" />
              Confirmar e Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Detalhes de Jobs */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Detalhes de Jobs (até 168h)</DialogTitle>
            <DialogDescription>Relatório de respostas e mensagens processadas</DialogDescription>
          </DialogHeader>
          <div className="min-h-[200px] space-y-4">
            {detailsLoading && <div className="text-sm text-muted-foreground">Carregando...</div>}
            {detailsError && <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>{detailsError}</AlertDescription></Alert>}
            {!detailsLoading && !detailsError && detailsData && (
              <div className="overflow-auto max-h-[60vh] border rounded p-2 text-xs font-mono bg-muted/30">
                {Array.isArray(detailsData?.data) && detailsData.data.length ? (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-muted">
                        <th className="p-1 border">Job</th>
                        <th className="p-1 border">Telefone</th>
                        <th className="p-1 border">Enviado em</th>
                        <th className="p-1 border">Resposta</th>
                        <th className="p-1 border">Recebido em</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailsData.data.map((r,i)=>(
                        <tr key={i} className="hover:bg-accent/40">
                          <td className="p-1 border">{r.job}</td>
                          <td className="p-1 border">{r.phone}</td>
                          <td className="p-1 border">{r.send_at}</td>
                          <td className="p-1 border max-w-[240px] truncate" title={r.reply}>{r.reply || '-'}</td>
                          <td className="p-1 border">{r.received_at}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-sm text-muted-foreground">Sem dados no período.</div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>fetchDetailsReport(24)}>24h</Button>
            <Button variant="outline" onClick={()=>fetchDetailsReport(72)}>72h</Button>
            <Button variant="outline" onClick={()=>fetchDetailsReport(168)}>168h</Button>
            <Button onClick={()=>setShowDetails(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
  )
}

function CampaignsList({ selectedBatchId, onSend, refreshKey, jobStates, setJobStates, openDetails }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [sendingBatch, setSendingBatch] = useState(null)
  const [cancelMessage, setCancelMessage] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 6 // menos itens para caber cards

  useEffect(() => {
    window.clearSendingBatch = () => setSendingBatch(null)
    return () => { window.clearSendingBatch = null }
  }, [])

  const load = async () => {
    try {
      setLoading(true)
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/disparo-sms/batches', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      const data = await res.json()
      if (res.ok) setItems(data?.batches || [])
    } catch (e) {}
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [refreshKey])

  const totalPages = Math.ceil((items || []).length / itemsPerPage)
  const startIdx = (currentPage - 1) * itemsPerPage
  const endIdx = startIdx + itemsPerPage
  const paginatedItems = (items || []).slice(startIdx, endIdx)

  const pct = (v, total) => {
    if (!total) return '0.00%'
    return ((v / total) * 100).toFixed(2) + '%'
  }

  return (
    <div className="space-y-4">
      {cancelMessage && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{cancelMessage}</AlertDescription>
        </Alert>
      )}
      {loading && <div className="text-xs text-muted-foreground">Carregando campanhas...</div>}
      {!loading && !items.length && (
        <div className="text-sm text-muted-foreground border rounded p-4 text-center">Nenhuma campanha importada ainda.</div>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {paginatedItems.map(b => {
          const counts = b.counts || {}
          const total = counts.total || 0
          const sent = counts.sent || 0
          const failed = counts.failed || 0
          // Tentativa de delivered (se houver campo entregue futuramente). Por enquanto aproximamos usando sent - failed.
          const delivered = Math.max(0, sent - failed)
          const replies = (jobStates[b.batch_id]?.metrics?.replies || 0)
          const queued = counts.queued || 0
          const finished = queued === 0 && sent > 0
          const progressPerc = total ? Math.min(100, ((sent + failed) / total) * 100) : 0
          const js = jobStates[b.batch_id]
          const isRunning = js && js.status === 'running'
          const isPaused = js && js.status === 'paused'
          const hasQueued = queued > 0
          const hasFailed = failed > 0
          const disabled = !hasQueued && !hasFailed
          const includeFailed = !hasQueued && hasFailed
          const label = hasQueued ? 'Enviar' : (hasFailed ? 'Reenviar falhas' : 'Enviar')
          const isSending = sendingBatch === b.batch_id
          return (
            <div key={b.batch_id} className={`rounded-xl border shadow-sm bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm p-4 relative ${selectedBatchId === b.batch_id ? 'ring-2 ring-teal-500' : ''}`}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-xs text-muted-foreground">Criada em</div>
                  <div className="text-sm font-medium">{new Date(b.created_at).toLocaleString()}</div>
                </div>
                <Badge variant={finished ? 'default' : 'secondary'}>{finished ? 'FINALIZADO' : isPaused ? 'PAUSADO' : isRunning ? 'EM ANDAMENTO' : 'AGUARDANDO'}</Badge>
              </div>
              <div className="font-mono text-[10px] mb-2 opacity-70">Batch {b.batch_id.slice(0,8)}</div>
              <div className="grid grid-cols-5 gap-2 text-center mb-3">
                <div className="space-y-1">
                  <div className="text-[10px] font-medium">ENVIADOS</div>
                  <div className="text-sm font-bold">{sent}</div>
                  <div className="text-[10px] text-muted-foreground">{pct(sent,total)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-medium">ENTREGUES</div>
                  <div className="text-sm font-bold text-green-600 dark:text-green-400">{delivered}</div>
                  <div className="text-[10px] text-muted-foreground">{pct(delivered,total)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-medium">FALHAS</div>
                  <div className="text-sm font-bold text-red-600 dark:text-red-400">{failed}</div>
                  <div className="text-[10px] text-muted-foreground">{pct(failed,total)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-medium">RESPOSTAS</div>
                  <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{replies}</div>
                  <div className="text-[10px] text-muted-foreground">{pct(replies,total)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-medium">TOTAL</div>
                  <div className="text-sm font-bold">{total}</div>
                  <div className="text-[10px] text-muted-foreground">100%</div>
                </div>
              </div>
              <div className="h-2 w-full rounded bg-muted overflow-hidden mb-3">
                <div className={`h-full transition-all ${finished ? 'bg-green-500' : 'bg-teal-500'} `} style={{ width: progressPerc + '%' }} />
              </div>
              {finished && <div className="text-center text-[11px] font-medium text-green-700 dark:text-green-300 mb-3">ENVIO FINALIZADO</div>}
              <div className="flex flex-wrap gap-2">
                {js ? (
                  <>
                    {isRunning && (
                      <Button size="sm" variant="secondary" onClick={async () => {
                        try {
                          const { data: sessionData } = await supabase.auth.getSession()
                          const token = sessionData?.session?.access_token
                          const r = await fetch('/api/disparo-sms/jobs/pause', { method: 'POST', headers: { 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) }, body: JSON.stringify({ smsJob: js.smsJob }) })
                          if (r.ok) setJobStates(p => ({ ...p, [b.batch_id]: { ...p[b.batch_id], status: 'paused' } }))
                        } catch {}
                      }}>Pausar</Button>
                    )}
                    {isPaused && (
                      <Button size="sm" variant="secondary" onClick={async () => {
                        try {
                          const { data: sessionData } = await supabase.auth.getSession()
                          const token = sessionData?.session?.access_token
                          const r = await fetch('/api/disparo-sms/jobs/play', { method: 'POST', headers: { 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) }, body: JSON.stringify({ smsJob: js.smsJob }) })
                          if (r.ok) setJobStates(p => ({ ...p, [b.batch_id]: { ...p[b.batch_id], status: 'running' } }))
                        } catch {}
                      }}>Play</Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => openDetails(b.batch_id)}>Detalhes</Button>
                  </>
                ) : isSending ? (
                  <Button size="sm" disabled className="opacity-50"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Enviando...</Button>
                ) : (
                  <>
                    <Button size="sm" onClick={() => { setSendingBatch(b.batch_id); setCancelMessage(''); onSend(b.batch_id, includeFailed) }} disabled={disabled}><Send className="h-3 w-3 mr-1" />{label}</Button>
                    <Button size="sm" variant="outline" disabled={disabled} onClick={async () => {
                      if (!confirm(`Deseja realmente cancelar/excluir a campanha ${b.batch_id.slice(0,8)}?`)) return
                      try {
                        const { error } = await supabase.from('sms_disparo').delete().eq('batch_id', b.batch_id)
                        if (error) { setCancelMessage('❌ Erro ao cancelar campanha') } else { setCancelMessage('✅ Campanha cancelada'); setTimeout(()=>{ load(); setCancelMessage('') },1500) }
                      } catch { setCancelMessage('❌ Erro inesperado ao cancelar') }
                    }}><X className="h-3 w-3 mr-1" />Cancelar</Button>
                  </>
                )}
              </div>
            </div>
          )})}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">Página {currentPage} de {totalPages} ({items.length} campanhas)</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Anterior</Button>
            <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
  )
}

function RelatoriosCampanhas({ jobStates, setShowDetails, setDetailsData }) {
  const [loading, setLoading] = useState(false)
  const [batches, setBatches] = useState([])
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  // Modal respostas (quantity-jobs)
  const [showReplies, setShowReplies] = useState(false)
  const [repliesData, setRepliesData] = useState(null)
  const [repliesLoading, setRepliesLoading] = useState(false)
  const [repliesError, setRepliesError] = useState('')
  const [period, setPeriod] = useState(168)
  
  const load = async () => {
    try {
      setLoading(true); setError('')
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/disparo-sms/batches', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      const js = await res.json()
      if (!res.ok) {
        setError(js?.error || 'Falha ao carregar relatórios')
        setBatches([])
        return
      }
      setBatches(js.batches || [])
    } catch (e) {
      setError('Erro inesperado')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])
  const totalMsgs = batches.reduce((acc, b) => acc + (b.counts?.total || 0), 0)
  const totalEnviadas = batches.reduce((acc, b) => acc + (b.counts?.sent || 0), 0)
  const totalFalhas = batches.reduce((acc, b) => acc + (b.counts?.failed || 0), 0)
  
  const totalPages = Math.ceil(batches.length / itemsPerPage)
  const startIdx = (currentPage - 1) * itemsPerPage
  const endIdx = startIdx + itemsPerPage
  const paginatedBatches = batches.slice(startIdx, endIdx)
  
  const loadReplies = async (hours = period) => {
    try {
      setRepliesLoading(true); setRepliesError(''); setRepliesData(null); setPeriod(hours)
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/disparo-sms/reports/quantity-jobs', { method: 'POST', headers: { 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) }, body: JSON.stringify({ period: hours }) })
      const js = await res.json()
      if(!res.ok){ setRepliesError(js?.error || 'Falha ao carregar respostas'); return }
      setRepliesData(js.report || js)
    } catch(e){ setRepliesError('Erro inesperado') }
    finally { setRepliesLoading(false) }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Resumo Geral</CardTitle>
          <CardDescription>Indicadores agregados conforme sua hierarquia</CardDescription>
          <div className="mt-2">
            <Button size="sm" variant="outline" onClick={() => { setShowReplies(true); loadReplies(168) }}>Detalhes (Respostas)</Button>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 rounded border bg-muted/50">
            <div className="text-xs text-muted-foreground">Total Mensagens</div>
            <div className="text-lg font-semibold">{totalMsgs}</div>
          </div>
          <div className="p-3 rounded border bg-muted/50">
            <div className="text-xs text-muted-foreground">Enviadas</div>
            <div className="text-lg font-semibold text-green-600 dark:text-green-400">{totalEnviadas}</div>
          </div>
          <div className="p-3 rounded border bg-muted/50">
            <div className="text-xs text-muted-foreground">Falhas</div>
            <div className="text-lg font-semibold text-red-600 dark:text-red-400">{totalFalhas}</div>
          </div>
          <div className="p-3 rounded border bg-muted/50">
            <div className="text-xs text-muted-foreground">Campanhas</div>
            <div className="text-lg font-semibold">{batches.length}</div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Campanhas</CardTitle>
          <CardDescription>Detalhes de cada batch</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <div className="text-sm text-red-600 dark:text-red-400 mb-2">{error}</div>}
          <div className="border rounded overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Tot</TableHead>
                  <TableHead>Env</TableHead>
                  <TableHead>Fal</TableHead>
                  <TableHead>Bl</TableHead>
                  <TableHead>NP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedBatches.map(b => (
                  <TableRow key={b.batch_id}>
                    <TableCell>{new Date(b.created_at).toLocaleString()}</TableCell>
                    <TableCell className="font-mono text-xs">{b.batch_id.slice(0,8)}</TableCell>
                    <TableCell>{b.counts?.total || 0}</TableCell>
                    <TableCell>{b.counts?.sent || 0}</TableCell>
                    <TableCell>{b.counts?.failed || 0}</TableCell>
                    <TableCell>{b.counts?.blacklist || 0}</TableCell>
                    <TableCell>{b.counts?.not_disturb || 0}</TableCell>
                  </TableRow>
                ))}
                {(!batches || !batches.length) && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">Nenhuma campanha encontrada.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-3 border-t">
                <div className="text-xs text-muted-foreground">Página {currentPage} de {totalPages} ({batches.length} itens)</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Anterior</Button>
                  <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Próxima</Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      {/* Modal respostas */}
      <Dialog open={showReplies} onOpenChange={setShowReplies}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Respostas de SMS (últimas {period}h)</DialogTitle>
            <DialogDescription>Mensagens recebidas de jobs via Web</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 min-h-[200px]">
            <div className="flex gap-2">
              <Button size="sm" variant={period===24?'default':'outline'} onClick={()=>loadReplies(24)}>24h</Button>
              <Button size="sm" variant={period===72?'default':'outline'} onClick={()=>loadReplies(72)}>72h</Button>
              <Button size="sm" variant={period===168?'default':'outline'} onClick={()=>loadReplies(168)}>168h</Button>
            </div>
            {repliesLoading && <div className="text-sm text-muted-foreground">Carregando...</div>}
            {repliesError && <Alert><AlertCircle className="h-4 w-4" /><AlertDescription>{repliesError}</AlertDescription></Alert>}
            {!repliesLoading && !repliesError && repliesData && Array.isArray(repliesData.data) && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded border bg-muted/50">
                    <div className="text-[11px] text-muted-foreground">Total Registros</div>
                    <div className="text-lg font-semibold">{repliesData.total || repliesData.data.length}</div>
                  </div>
                  <div className="p-3 rounded border bg-muted/50">
                    <div className="text-[11px] text-muted-foreground">Com Resposta</div>
                    <div className="text-lg font-semibold text-indigo-600">{repliesData.data.filter(d=>d.reply).length}</div>
                  </div>
                  <div className="p-3 rounded border bg-muted/50">
                    <div className="text-[11px] text-muted-foreground">Sem Resposta</div>
                    <div className="text-lg font-semibold text-orange-600">{repliesData.data.filter(d=>!d.reply).length}</div>
                  </div>
                  <div className="p-3 rounded border bg-muted/50">
                    <div className="text-[11px] text-muted-foreground">Jobs Únicos</div>
                    <div className="text-lg font-semibold">{new Set(repliesData.data.map(d=>d.job)).size}</div>
                  </div>
                </div>
                <div className="border rounded overflow-auto max-h-[55vh] text-xs">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-muted">
                        <th className="p-2 border">Job</th>
                        <th className="p-2 border">Telefone</th>
                        <th className="p-2 border">Mensagem Enviada</th>
                        <th className="p-2 border">Resposta</th>
                        <th className="p-2 border">Recebido em</th>
                      </tr>
                    </thead>
                    <tbody>
                      {repliesData.data.map((r,i)=>(
                        <tr key={i} className="hover:bg-accent/40">
                          <td className="p-2 border font-mono text-[10px]">{r.job}</td>
                          <td className="p-2 border">{r.phone}</td>
                          <td className="p-2 border max-w-[240px] truncate" title={r.message}>{r.message}</td>
                          <td className="p-2 border max-w-[240px] truncate" title={r.reply}>{r.reply || '-'}</td>
                          <td className="p-2 border">{r.received_at || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {!repliesLoading && !repliesError && repliesData && (!Array.isArray(repliesData.data) || !repliesData.data.length) && (
              <div className="text-sm text-muted-foreground">Sem respostas no período.</div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={()=>setShowReplies(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RelatoriosDetalhados() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState([])
  const [error, setError] = useState('')
  const [stats, setStats] = useState({})
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Inicializar: data inicial 3 horas atrás, data final 2 horas antes da hora atual
  useEffect(() => {
    const now = new Date()
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000)
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000)
    const formatDateTime = (d) => {
      const pad = (n) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
    }
    setStartDate(formatDateTime(threeHoursAgo))
    setEndDate(formatDateTime(twoHoursAgo))
  }, [])

  const loadDetailed = async () => {
    if (!startDate || !endDate) {
      setError('Informe data inicial e final')
      return
    }
    try {
      setLoading(true)
      setError('')
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      
      // Converter formato datetime-local (2025-11-11T21:21) para Y-m-d H:i (2025-11-11 21:21)
      const formatToApi = (dt) => dt ? dt.replace('T', ' ') : ''
      
      const res = await fetch('/api/disparo-sms/reports/detailed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ 
          start_at: formatToApi(startDate), 
          end_at: formatToApi(endDate) 
        })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || 'Falha ao carregar relatórios')
        return
      }
      const msgs = data.messages || []
      setMessages(msgs)
      // Calcular stats
      const st = {}
      msgs.forEach(m => {
        st[m.status] = (st[m.status] || 0) + 1
      })
      setStats(st)
    } catch (e) {
      setError('Erro inesperado: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(messages.length / itemsPerPage)
  const startIdx = (currentPage - 1) * itemsPerPage
  const endIdx = startIdx + itemsPerPage
  const paginatedMessages = messages.slice(startIdx, endIdx)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Relatórios Detalhados</CardTitle>
          <CardDescription>Consulte mensagens enviadas por período (máx. 7 dias)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Input 
                type="datetime-local" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <Label>Data Final</Label>
              <Input 
                type="datetime-local" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
              />
            </div>
            <div className="flex items-end">
              <Button onClick={loadDetailed} disabled={loading || !startDate || !endDate}>
                {loading ? 'Carregando...' : 'Consultar'}
              </Button>
            </div>
          </div>
          {error && <Alert className="bg-destructive/10 border-destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          {Object.keys(stats).length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(stats).map(([status, count]) => (
                <div key={status} className="p-3 rounded border bg-muted/50">
                  <div className="text-xs text-muted-foreground capitalize">{status}</div>
                  <div className="text-lg font-semibold">{count}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {messages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Mensagens ({messages.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded overflow-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Enviada em</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Centro Custo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedMessages.map((m, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs">{m.telefone}</TableCell>
                      <TableCell>{m.nome}</TableCell>
                      <TableCell>
                        {(() => {
                          // Normaliza o status para facilitar comparação
                          const status = String(m.status || '').toLowerCase()
                          let variant = 'secondary'
                          let customClass = ''
                          if (["entregue", "delivered", "success"].includes(status)) {
                            variant = 'default'; customClass = 'bg-green-600 text-white border-green-700'
                          } else if (["enviado", "sent", "enviada"].includes(status)) {
                            variant = 'outline'; customClass = 'bg-blue-500 text-white border-blue-600'
                          } else if (["pendente", "pending", "aguardando"].includes(status)) {
                            variant = 'outline'; customClass = 'bg-yellow-400 text-black border-yellow-500'
                          } else if (["falha", "erro", "failed", "error"].includes(status)) {
                            variant = 'destructive'; customClass = 'bg-red-600 text-white border-red-700'
                          } else if (["blacklist", "not_disturb", "nao perturbe"].includes(status)) {
                            variant = 'secondary'; customClass = 'bg-gray-500 text-white border-gray-600'
                          }
                          return <Badge variant={variant} className={customClass}>{m.status}</Badge>
                        })()}
                      </TableCell>
                      <TableCell className="text-xs">{m.enviada_em}</TableCell>
                      <TableCell>{m.lote}</TableCell>
                      <TableCell className="text-xs">{m.centro_custo}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-3 border-t">
                  <div className="text-xs text-muted-foreground">Página {currentPage} de {totalPages} ({messages.length} mensagens)</div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Anterior</Button>
                    <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Próxima</Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
