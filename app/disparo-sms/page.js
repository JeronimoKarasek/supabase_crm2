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
import { supabase } from '@/lib/supabase'
import { Send, Upload } from 'lucide-react'

export default function DisparoSmsPage() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Configuração global SMS
  const [hasToken, setHasToken] = useState(false)

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
  const [scheduleAt, setScheduleAt] = useState('') // datetime-local
  const [chunkSize, setChunkSize] = useState('') // tamanho por lote (cliente)
  const [chunkIntervalSec, setChunkIntervalSec] = useState('') // minutos entre lotes (cliente)
  const [sendingScheduler, setSendingScheduler] = useState({ active: false, nextAt: null, intervalId: null })

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

  const enviar = async (idOptional, includeFailed = false) => {
    const bid = idOptional || batchId
    if (!bid) { setError('Nenhum batch selecionado ou importado.'); return }
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
        const msg = `Envio iniciado. Válidos: ${data.valid || 0}, Inválidos: ${data.invalid || 0}, Blacklist: ${data.blacklist || 0}, Não Perturbe: ${data.not_disturb || 0}`
        setMessage(msg)
        setCampaignsRefreshKey(k => k + 1)
        loadBalance()
      } else {
        setError(data?.error || 'Falha ao enviar')
      }
    } catch (e) {
      setError('Erro inesperado no envio')
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
        await enviar(batchId, false)
        // agendar execuções subsequentes
        const id = setInterval(async () => {
          await enviar(batchId, false)
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
    <div className="p-6">
      <Tabs defaultValue="nova" className="space-y-6">
        <TabsList className="grid grid-cols-3 md:max-w-lg">
          <TabsTrigger value="nova">Nova Campanha</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
          <TabsTrigger value="detalhados">Detalhados</TabsTrigger>
        </TabsList>
        <TabsContent value="nova" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Disparo SMS</h1>
              <p className="text-sm text-muted-foreground">Envie SMS em massa para sua base de contatos</p>
            </div>
          </div>

      {message && (
        <Alert className="bg-success/10 border-success">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert className="bg-destructive/10 border-destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
          <CardDescription>Importe sua base e configure a mensagem</CardDescription>
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
                  <div className="md:col-span-2 space-y-2">
                    <Label className="text-xs">Número para retorno (WhatsApp)</Label>
                    <Input placeholder="Ex: 5599999999999" value={returnNumber} onChange={(e)=> setReturnNumber(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => {
                      let num = returnNumber.trim()
                      if (!num) { alert('Informe o número para retorno'); return }
                      // Garantir DDI 55 se não houver
                      if (!num.startsWith('55') && num.length <= 11) num = '55' + num
                      // Gera link com a primeira linha como exemplo de variáveis ou padrão
                      let text = messageTemplate || ''
                      if (csvRows.length) {
                        const sample = csvRows[0]
                        Object.keys(sample).forEach(k => {
                          const regex = new RegExp(`\\{\\{${k}\\}\\}`, 'gi')
                          text = text.replace(regex, sample[k] ?? '')
                        })
                      }
                      const finalText = text.trim() || 'Saber mais'
                      const encoded = encodeURIComponent(finalText).replace(/%20/g, '%20')
                      const url = `https://wa.me/${num}?text=${encoded}`
                      // Insere no final da mensagem
                      setMessageTemplate(prev => (prev ? prev + "\n" + url : url))
                    }}>Inserir link WhatsApp</Button>
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
              <div className="flex items-center justify-between">
                <CardTitle>Campanhas Importadas</CardTitle>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div><strong>Legenda:</strong></div>
                  <div className="flex flex-wrap gap-3">
                    <span><strong>T</strong>: Total</span>
                    <span><strong>Q</strong>: Na fila</span>
                    <span><strong>S</strong>: Enviadas</span>
                    <span><strong>F</strong>: Falhas</span>
                    <span><strong>B</strong>: Blacklist</span>
                    <span><strong>N</strong>: Não perturbe</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CampaignsList
                refreshKey={campaignsRefreshKey}
                selectedBatchId={batchId}
                onSend={(id, includeFailed) => { setBatchId(id); enviar(id, includeFailed) }}
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
      const res = await fetch('/api/disparo-sms/batches', { 
        headers: token ? { Authorization: `Bearer ${token}` } : undefined 
      })
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
            <TableHead>Contagens</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(items || []).map((b) => (
            <TableRow key={b.batch_id} className={selectedBatchId === b.batch_id ? 'bg-muted/50' : ''}>
              <TableCell>{new Date(b.created_at).toLocaleString()}</TableCell>
              <TableCell className="font-mono text-xs">{b.batch_id.slice(0, 8)}</TableCell>
              <TableCell>
                <span className="text-xs">
                  Tot:{b.counts.total} Fila:{b.counts.queued} Env:{b.counts.sent} Fal:{b.counts.failed} Bl:{b.counts.blacklist} NP:{b.counts.not_disturb}
                </span>
              </TableCell>
              <TableCell>
                {(() => {
                  const hasQueued = (b.counts?.queued || 0) > 0
                  const hasFailed = (b.counts?.failed || 0) > 0
                  const label = hasQueued ? 'Enviar' : (hasFailed ? 'Reenviar falhas' : 'Enviar')
                  const disabled = !hasQueued && !hasFailed
                  const includeFailed = !hasQueued && hasFailed
                  return (
                    <Button size="sm" onClick={() => onSend(b.batch_id, includeFailed)} disabled={disabled}>
                      <Send className="h-3 w-3 mr-1" />{label}
                    </Button>
                  )
                })()}
              </TableCell>
            </TableRow>
          ))}
          {(!items || !items.length) && (
            <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">Nenhuma campanha importada ainda.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function RelatoriosCampanhas() {
  const [loading, setLoading] = useState(false)
  const [batches, setBatches] = useState([])
  const [error, setError] = useState('')
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
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Resumo Geral</CardTitle>
          <CardDescription>Indicadores agregados conforme sua hierarquia</CardDescription>
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
                {(batches || []).map(b => (
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
          </div>
        </CardContent>
      </Card>
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
      const res = await fetch('/api/disparo-sms/reports/detailed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ start_at: startDate, end_at: endDate })
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
                  {messages.map((m, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs">{m.telefone}</TableCell>
                      <TableCell>{m.nome}</TableCell>
                      <TableCell>
                        <Badge variant={m.status === 'enviado' ? 'default' : 'destructive'}>{m.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{m.enviada_em}</TableCell>
                      <TableCell>{m.lote}</TableCell>
                      <TableCell className="text-xs">{m.centro_custo}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
