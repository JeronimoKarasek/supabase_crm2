"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  const [chunkIntervalSec, setChunkIntervalSec] = useState('') // segundos entre lotes (cliente)
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
      const res = await fetch(`/api/disparo-sms/segments`, { 
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined 
      })
      const data = await res.json()
      if (res.ok) setSegments(data?.segments || [])
    } catch {}
  }

  const loadBalance = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch(`/api/disparo-sms/balance`, { 
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined 
      })
      const data = await res.json()
      if (res.ok) setBalance(data?.balance || '0')
    } catch {}
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
    const gap = Math.max(1, parseInt(chunkIntervalSec || '0', 10) || 0)
    if (!size || !gap) { setError('Defina tamanho do lote e intervalo (s).'); return }
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
        }, gap * 1000)
        setSendingScheduler({ active: true, nextAt: new Date(Date.now() + gap * 1000).toISOString(), intervalId: id })
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

  const availableVars = (() => {
    if (!csvRows.length) return []
    const sample = csvRows[0]
    return Object.keys(sample).filter(k => k !== 'phone')
  })()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Disparo SMS</h1>
          <p className="text-sm text-muted-foreground">Envie SMS em massa via Kolmeya API</p>
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
            Token da Kolmeya não configurado. Acesse <strong>Configuração → Credenciais (SMS)</strong> para adicionar seu token.
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
                      if (!returnNumber) { alert('Informe o número para retorno'); return }
                      // Gera link com a primeira linha como exemplo de variáveis
                      let text = messageTemplate || ''
                      if (csvRows.length) {
                        const sample = csvRows[0]
                        Object.keys(sample).forEach(k => {
                          const regex = new RegExp(`\\{\\{${k}\\}\\}`, 'gi')
                          text = text.replace(regex, sample[k] ?? '')
                        })
                      }
                      const encoded = encodeURIComponent(text)
                      const url = `https://wa.me/${returnNumber}?text=${encoded}`
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
                  <Label>Intervalo entre lotes (segundos)</Label>
                  <Input type="number" min="1" placeholder="Ex: 60" value={chunkIntervalSec} onChange={(e)=> setChunkIntervalSec(e.target.value)} />
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
