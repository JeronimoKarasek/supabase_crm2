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

export default function DisparoApiPage() {
  const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || 'https://crm.farolbase.com')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Credentials
  const [credentials, setCredentials] = useState([]) // lista
  const [newCred, setNewCred] = useState({ label: '', waba_id: '', access_token: '', webhook_verify_token: 'verificadorcrm' })

  // Disparo/import
  const [csvText, setCsvText] = useState('')
  const [csvRows, setCsvRows] = useState([])
  const [selectedCredentialId, setSelectedCredentialId] = useState('')
  const [phoneNumbers, setPhoneNumbers] = useState([])
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState('')
  const [templates, setTemplates] = useState([])
  const [templateName, setTemplateName] = useState('')
  const [templateLanguage, setTemplateLanguage] = useState('pt_BR')
  const [batchId, setBatchId] = useState('')

  // Reports
  const [report, setReport] = useState({
    quality_rating: '',
    name_status: '',
    display_phone_number: '',
    counts: {},
  })

  const parseCsv = (text) => {
    const lines = text.split(/\r?\n/).filter(Boolean)
    if (!lines.length) return []
    const header = lines[0].split(',').map(h => h.trim())
    const out = []
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',')
      const row = {}
      header.forEach((h, idx) => {
        row[h] = (cols[idx] || '').trim()
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
        setNewCred({ label: '', waba_id: '', access_token: '', webhook_verify_token: 'verificadorcrm' })
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
      const payload = { credential_id: selectedCredentialId, phone_number_id: selectedPhoneNumberId, template_name: templateName, template_language: templateLanguage, rows: csvRows }
      const res = await fetch('/api/disparo-api/import', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (res.ok) {
        setMessage(`Importação concluída. ${data.inserted || 0} registros. Batch: ${data.batch_id}`)
        setBatchId(data.batch_id)
      } else {
        setError(data?.error || 'Falha ao importar')
      }
    } catch (e) {
      setError('Erro inesperado ao importar')
    } finally {
      setLoading(false)
    }
  }

  const enviar = async () => {
    if (!batchId) { setError('Nenhum batch importado.'); return }
    try {
      setLoading(true)
      setError('')
      setMessage('')
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/disparo-api/send', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ batch_id: batchId }) })
      const data = await res.json()
      if (res.ok) {
        setMessage(`Envio iniciado. Sucessos: ${data.sent || 0}, Falhas: ${data.failed || 0}`)
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Disparo API</h1>
          <p className="text-sm text-muted-foreground">Envie mensagens via WhatsApp Cloud API (Meta)</p>
        </div>
      </div>
      {message ? <div className="text-green-600 text-sm">{message}</div> : null}
      {error ? <div className="text-red-600 text-sm">{error}</div> : null}

      <Tabs defaultValue="credenciais">
        <TabsList>
          <TabsTrigger value="credenciais">Credenciais</TabsTrigger>
          <TabsTrigger value="disparo">Disparo</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="credenciais">
          <Card>
            <CardHeader>
              <CardTitle>Credenciais WhatsApp (Meta)</CardTitle>
              <CardDescription>Use WABA ID e Token permanente. Você pode adicionar múltiplas credenciais.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
          <Card>
            <CardHeader>
              <CardTitle>Base de disparo</CardTitle>
              <CardDescription>Baixe o modelo, importe sua base e selecione o template e número.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={downloadModel} variant="outline">Baixar modelo CSV</Button>
                <Input type="file" accept=".csv" onChange={onFile} />
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
                  <Label>Número (Phone Number ID)</Label>
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
                        <SelectItem key={`${t.name}:${t.language}`} value={t.name}>{t.name} ({t.language})</SelectItem>
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
              </div>
              <div className="flex gap-2">
                <Button onClick={importRows} disabled={loading || !csvRows.length}>Importar</Button>
                <Button onClick={enviar} variant="secondary" disabled={!batchId || loading}>Enviar</Button>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Prévia: {csvRows.length} linhas</div>
                <div className="max-h-64 overflow-auto border rounded">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>phone</TableHead>
                        <TableHead>name</TableHead>
                        <TableHead>var1</TableHead>
                        <TableHead>var2</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvRows.slice(0,10).map((r, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{r.phone}</TableCell>
                          <TableCell>{r.name}</TableCell>
                          <TableCell>{r.var1}</TableCell>
                          <TableCell>{r.var2}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="relatorios">
          <Card>
            <CardHeader>
              <CardTitle>Relatórios</CardTitle>
              <CardDescription>Qualidade do número e estatísticas dos envios.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={loadReport} variant="outline">Atualizar</Button>
                <Button onClick={async () => {
                  const { data: sessionData } = await supabase.auth.getSession()
                  const token = sessionData?.session?.access_token
                  const res = await fetch(`/api/disparo-api/reports/download${batchId ? `?batch_id=${encodeURIComponent(batchId)}` : ''}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 border rounded">
                  <div className="text-xs text-muted-foreground">Qualidade</div>
                  <div className="text-lg font-semibold">{report.quality_rating || '-'}</div>
                </div>
                <div className="p-3 border rounded">
                  <div className="text-xs text-muted-foreground">Status do nome</div>
                  <div className="text-lg font-semibold">{report.name_status || '-'}</div>
                </div>
                <div className="p-3 border rounded">
                  <div className="text-xs text-muted-foreground">Número</div>
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
      </Tabs>
    </div>
  )
}
