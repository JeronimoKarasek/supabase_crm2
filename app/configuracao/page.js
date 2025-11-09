"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { Plus, Edit, Trash2 } from 'lucide-react'

export default function ConfiguracaoPage() {
  const [tables, setTables] = useState([])
  const [columns, setColumns] = useState([])
  const [table, setTable] = useState('')
  const [sumColumn, setSumColumn] = useState('')
  const [condColumn, setCondColumn] = useState('')
  const [condType, setCondType] = useState('contains')
  const [condValue, setCondValue] = useState('')
  const [list, setList] = useState([])

  const [siteName, setSiteName] = useState('')
  const [siteSubtitle, setSiteSubtitle] = useState('')
  const [logoUrl, setLogoUrl] = useState('')

  const [banks, setBanks] = useState([])
  const [products, setProducts] = useState([])

  const [payProvider, setPayProvider] = useState('picpay')
  const [picpayToken, setPicpayToken] = useState('')
  const [picpayClientId, setPicpayClientId] = useState('')
  const [picpayClientSecret, setPicpayClientSecret] = useState('')
  const [mercadopagoAccessToken, setMercadopagoAccessToken] = useState('')
  const [mercadopagoPublicKey, setMercadopagoPublicKey] = useState('')
  const [creditsWebhook, setCreditsWebhook] = useState('')
  const [addCreditsWebhook, setAddCreditsWebhook] = useState('')
  const [adminEmails, setAdminEmails] = useState('')

  // SMS única credencial
  const [smsApiToken, setSmsApiToken] = useState('')
  const [smsApiId, setSmsApiId] = useState('')
  const [smsWebhookUrl, setSmsWebhookUrl] = useState('')
  const [smsMessageValue, setSmsMessageValue] = useState('')

  // Shift Data API
  const [shiftDataAccessKey, setShiftDataAccessKey] = useState('')
  const [shiftDataCostPerQuery, setShiftDataCostPerQuery] = useState('')
  const [shiftDataWebhookToken, setShiftDataWebhookToken] = useState('')

  const [message, setMessage] = useState('')

  const getAuthHeaders = async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  useEffect(() => {
    ;(async () => {
      try {
        const h = await getAuthHeaders()
        const res = await fetch('/api/tables', { headers: h })
        const json = await res.json()
        if (res.ok) setTables(json.tables || [])
      } catch {}
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      if (!table) { setColumns([]); return }
      try {
        const h = await getAuthHeaders()
        const res = await fetch(`/api/table-columns?table=${encodeURIComponent(table)}`, { headers: h })
        const json = await res.json()
        if (res.ok) setColumns(json.columns || [])
      } catch {}
    })()
  }, [table])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/global-settings')
        const json = await res.json()
        if (res.ok) {
          const s = json.settings || {}
          if (Array.isArray(s.valorPagoList)) setList(s.valorPagoList)
          else if (s.valorPago) setList([s.valorPago])
          setSiteName(s.siteName || '')
          setSiteSubtitle(s.siteSubtitle || '')
          setLogoUrl(s.logoUrl || '')
          setBanks(Array.isArray(s.banks) ? s.banks : [])
          setProducts(Array.isArray(s.products) ? s.products : [])
          const p = s.payments || {}
          if (typeof p.provider === 'string') setPayProvider(p.provider)
          if (typeof p.picpaySellerToken === 'string') setPicpayToken(p.picpaySellerToken)
          if (typeof p.picpayClientId === 'string') setPicpayClientId(p.picpayClientId)
          if (typeof p.picpayClientSecret === 'string') setPicpayClientSecret(p.picpayClientSecret)
          if (typeof p.mercadopagoAccessToken === 'string') setMercadopagoAccessToken(p.mercadopagoAccessToken)
          if (typeof p.mercadopagoPublicKey === 'string') setMercadopagoPublicKey(p.mercadopagoPublicKey)
          if (typeof p.creditsWebhook === 'string') setCreditsWebhook(p.creditsWebhook)
          if (typeof p.addCreditsWebhook === 'string') setAddCreditsWebhook(p.addCreditsWebhook)
          // adminEmails: lista de emails separados por vírgula ou array
          if (Array.isArray(s.adminEmails)) setAdminEmails(s.adminEmails.join(', '))
          else if (typeof s.adminEmails === 'string') setAdminEmails(s.adminEmails)
        }
      } catch {}
    })()
    // Carregar credencial SMS e valor
    ;(async () => {
      try {
        const res = await fetch('/api/global-settings')
        const json = await res.json()
        if (res.ok) {
          const s = json.settings || {}
          setSmsApiToken(s.smsApiToken || '')
          setSmsApiId(s.smsApiId || '')
          setSmsWebhookUrl(s.smsWebhookUrl || '')
          setSmsMessageValue(s.smsMessageValue || '')
          // AccessKey fixa (fallback) apenas para exibição; não editável
          setShiftDataAccessKey(s.shiftDataAccessKey || '96FA65CEC7234FFDA72D2D97EA6A457B')
          setShiftDataCostPerQuery(s.shiftDataCostPerQuery || '0.07')
          setShiftDataWebhookToken(s.shiftDataWebhookToken || 'https://weebserver6.farolchat.com/webhook/gerarToken')
        }
      } catch {}
    })()
  }, [])

  const loadSmsCredentials = async () => {
    try {
      const h = await getAuthHeaders()
      const res = await fetch('/api/disparo-sms/credentials', { headers: h })
      const data = await res.json()
      if (res.ok) {
        setSmsCredentials(Array.isArray(data?.credentials) ? data.credentials : [])
      }
    } catch {}
  }

  const addSmsCredential = async () => {
    if (!newSmsCred.label || !newSmsCred.api_token) {
      setMessage('Label e Token são obrigatórios')
      return
    }
    try {
      const h = await getAuthHeaders()
      const res = await fetch('/api/disparo-sms/credentials', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', ...h }, 
        body: JSON.stringify(newSmsCred) 
      })
      if (res.ok) {
        setMessage('Credencial SMS adicionada.')
        setTimeout(() => setMessage(''), 2000)
        setNewSmsCred({ label: '', api_token: '', sms_api_id: '', webhook_url: '' })
        loadSmsCredentials()
      }
    } catch {}
  }

  const updateSmsCredential = async (cred) => {
    try {
      const h = await getAuthHeaders()
      await fetch('/api/disparo-sms/credentials', { 
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json', ...h }, 
        body: JSON.stringify(cred) 
      })
      setEditSmsCred(null)
      loadSmsCredentials()
    } catch {}
  }

  const removeSmsCredential = async (id) => {
    // removido
  }

  const saveBranding = async () => {
    try {
      const res = await fetch('/api/global-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteName, siteSubtitle, logoUrl }) })
      if (res.ok) { setMessage('Configuracoes salvas'); setTimeout(()=>setMessage(''), 2000) }
    } catch {}
  }

  const saveValorPagoList = async () => {
    try {
      const res = await fetch('/api/global-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ valorPagoList: list }) })
      if (res.ok) { setMessage('Configuracoes salvas'); setTimeout(()=>setMessage(''), 2000) }
    } catch {}
  }

  const saveBanks = async () => {
    try {
      const res = await fetch('/api/global-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ banks }) })
      if (res.ok) { setMessage('Configuracoes salvas'); setTimeout(()=>setMessage(''), 2000) }
    } catch {}
  }

  const saveProducts = async () => {
    try {
      const res = await fetch('/api/global-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ products }) })
      if (res.ok) { setMessage('Configuracoes salvas'); setTimeout(()=>setMessage(''), 2000) }
    } catch {}
  }

  const savePayments = async () => {
    try {
      const res = await fetch('/api/global-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payments: {
            provider: payProvider,
            picpaySellerToken: picpayToken,
            picpayClientId,
            picpayClientSecret,
            mercadopagoAccessToken,
            mercadopagoPublicKey,
            creditsWebhook,
            addCreditsWebhook
          }
        })
      })
      if (res.ok) { setMessage('Configuracoes salvas'); setTimeout(()=>setMessage(''), 2000) }
    } catch {}
  }

  const saveAdminEmails = async () => {
    try {
      // Converte string separada por vírgula em array
      const emailsArray = adminEmails.split(',').map(e => e.trim()).filter(Boolean)
      const res = await fetch('/api/global-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminEmails: emailsArray })
      })
      if (res.ok) { setMessage('Admins salvos com sucesso'); setTimeout(()=>setMessage(''), 2000) }
    } catch {}
  }

  const clearInputs = () => { setTable(''); setSumColumn(''); setCondColumn(''); setCondType('contains'); setCondValue('') }

  return (
    <div className="-m-4 min-h-[calc(100vh-56px)] bg-background">
      <div className="container mx-auto py-6 px-6">
        <Tabs defaultValue="geral" className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full md:max-w-4xl">
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="credenciais">Credenciais</TabsTrigger>
            <TabsTrigger value="higienizacao">Higienização</TabsTrigger>
            <TabsTrigger value="apis">APIs Externas</TabsTrigger>
            <TabsTrigger value="bancos">Bancos & Produtos</TabsTrigger>
          </TabsList>

          {/* Aba Geral */}
          <TabsContent value="geral" className="space-y-6">
            <Card className="bg-card">
              <CardHeader className="bg-muted/40 rounded-t-lg">
                <CardTitle className="text-foreground">Configuração</CardTitle>
                <CardDescription className="text-muted-foreground">Defina nome do site, subtítulo e logo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input placeholder="Nome do sistema" value={siteName} onChange={(e)=> setSiteName(e.target.value)} />
                  <Input placeholder="Subtitulo" value={siteSubtitle} onChange={(e)=> setSiteSubtitle(e.target.value)} />
                  <Input placeholder="URL do logo" value={logoUrl} onChange={(e)=> setLogoUrl(e.target.value)} />
                </div>
                <div className="flex justify-end">
                  <Button onClick={saveBranding}>Salvar</Button>
                </div>
                {message && <div className="text-emerald-600 text-sm">{message}</div>}
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardHeader>
                <CardTitle>Valor Pago</CardTitle>
                <CardDescription>Monte regras de soma por tabela</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Select value={table} onValueChange={(v)=> { setTable(v); setSumColumn(''); setCondColumn('') }}>
                    <SelectTrigger><SelectValue placeholder="Tabela" /></SelectTrigger>
                    <SelectContent>
                      {tables.map(t => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <Select value={sumColumn} onValueChange={setSumColumn} disabled={!table}>
                    <SelectTrigger><SelectValue placeholder="Coluna (somar)" /></SelectTrigger>
                    <SelectContent>
                      {columns.map(c => (<SelectItem key={c.column_name} value={c.column_name}>{c.column_name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <Select value={condColumn} onValueChange={setCondColumn} disabled={!table}>
                    <SelectTrigger><SelectValue placeholder="Coluna (condicao)" /></SelectTrigger>
                    <SelectContent>
                      {columns.map(c => (<SelectItem key={c.column_name} value={c.column_name}>{c.column_name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <Select value={condType} onValueChange={setCondType}>
                    <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contains">Contem</SelectItem>
                      <SelectItem value="equals">Igual</SelectItem>
                      <SelectItem value="greaterThan">Maior que</SelectItem>
                      <SelectItem value="lessThan">Menor que</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <Input placeholder="Valor da condicao" value={condValue} onChange={(e)=> setCondValue(e.target.value)} />
                  <div className="md:col-span-3 flex gap-2 justify-end">
                    <Button variant="outline" onClick={clearInputs}>Limpar</Button>
                    <Button variant="outline" onClick={() => { if (!table || !sumColumn) return; const item = { table, sumColumn, cond: { column: condColumn, type: condType, value: condValue } }; setList(prev => [...prev, item]) }}>Adicionar</Button>
                    <Button onClick={saveValorPagoList} disabled={list.length === 0}>Salvar lista</Button>
                  </div>
                </div>
                <div className="space-y-2">
                  {list.map((cfg, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 border rounded">
                      <div className="text-sm">
                        <div><span className="font-medium">Tabela:</span> {cfg.table}</div>
                        <div><span className="font-medium">Soma:</span> {cfg.sumColumn}</div>
                        {cfg.cond?.column ? (
                          <div><span className="font-medium">Condicao:</span> {cfg.cond.column} {cfg.cond.type} {String(cfg.cond.value)}</div>
                        ) : (
                          <div className="text-muted-foreground">Sem condicao</div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setTable(cfg.table || ''); setSumColumn(cfg.sumColumn || ''); setCondColumn(cfg.cond?.column || ''); setCondType(cfg.cond?.type || 'contains'); setCondValue(cfg.cond?.value || '') }}>Editar</Button>
                        <Button size="sm" variant="destructive" onClick={() => setList(prev => prev.filter((_,i)=> i!==idx))}>Excluir</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardHeader>
                <CardTitle>Administradores do Sistema</CardTitle>
                <CardDescription>Configure quais e-mails podem adicionar créditos manualmente para usuários</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm font-medium mb-2">E-mails dos Administradores</div>
                  <Input 
                    value={adminEmails} 
                    onChange={(e)=> setAdminEmails(e.target.value)} 
                    placeholder="admin@dominio.com, outro@dominio.com"
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    Separe múltiplos e-mails por vírgula. Usuários com estes e-mails poderão adicionar créditos na página de Usuários.
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={saveAdminEmails}>Salvar administradores</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Credenciais */}
          <TabsContent value="credenciais" className="space-y-6">
            <Card className="bg-card">
              <CardHeader>
                <CardTitle>Pagamentos</CardTitle>
                <CardDescription>Configurações de pagamento dos produtos e consulta de créditos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div>
                <div className="text-sm font-medium mb-1">Provedor de Pagamento</div>
                <Select value={payProvider} onValueChange={setPayProvider}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o provedor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="picpay">PicPay</SelectItem>
                    <SelectItem value="mercadopago">Mercado Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

        {/* Credenciais PicPay */}
            {payProvider === 'picpay' && (
              <div className="space-y-3 p-4 border rounded-lg bg-slate-50 dark:bg-slate-900">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">Credenciais PicPay</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-sm font-medium">PicPay Seller Token</div>
                    <Input value={picpayToken} onChange={(e)=> setPicpayToken(e.target.value)} placeholder="Token de vendedor" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">PicPay Client ID</div>
                    <Input value={picpayClientId} onChange={(e)=> setPicpayClientId(e.target.value)} placeholder="OAuth2 Client ID (opcional)" />
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium">PicPay Client Secret</div>
                  <Input type="password" value={picpayClientSecret} onChange={(e)=> setPicpayClientSecret(e.target.value)} placeholder="OAuth2 Client Secret (opcional)" />
                </div>
              </div>
            )}

        {/* Credenciais Mercado Pago */}
            {payProvider === 'mercadopago' && (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/40">
                <div className="text-sm font-semibold text-foreground">Credenciais Mercado Pago</div>
                <div>
                  <div className="text-sm font-medium">Access Token (Server-side)</div>
                  <Input 
                    type="password" 
                    value={mercadopagoAccessToken} 
                    onChange={(e)=> setMercadopagoAccessToken(e.target.value)} 
                    placeholder="APP_USR-XXXX-XXXX-XXXX" 
                  />
                  <div className="text-xs text-slate-500 mt-1">Token privado usado no backend para criar pagamentos</div>
                </div>
                <div>
                  <div className="text-sm font-medium">Public Key (opcional)</div>
                  <Input 
                    value={mercadopagoPublicKey} 
                    onChange={(e)=> setMercadopagoPublicKey(e.target.value)} 
                    placeholder="APP_USR-XXXX-XXXX-XXXX-pub" 
                  />
                  <div className="text-xs text-slate-500 mt-1">Chave pública para uso no frontend (se necessário)</div>
                </div>
              </div>
            )}

        {/* Webhooks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-sm font-medium">Webhook Consulta de Créditos</div>
                <Input value={creditsWebhook} onChange={(e)=> setCreditsWebhook(e.target.value)} placeholder="https://..." />
              </div>
              <div>
                <div className="text-sm font-medium">Webhook Adicionar Créditos</div>
                <Input value={addCreditsWebhook} onChange={(e)=> setAddCreditsWebhook(e.target.value)} placeholder="https://..." />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={savePayments}>Salvar pagamentos</Button>
            </div>
              </CardContent>
            </Card>
            {/* Card de Credencial SMS única + valor por mensagem */}
            <Card className="bg-card">
          <CardHeader>
            <CardTitle>Credencial SMS (Kolmeya)</CardTitle>
            <CardDescription>Configure o token único da Kolmeya e o valor cobrado por mensagem enviada.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sms_api_token">API Token *</Label>
                <Input 
                  id="sms_api_token"
                  type="password"
                  placeholder="Token da API Kolmeya" 
                  value={smsApiToken} 
                  onChange={(e) => setSmsApiToken(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sms_api_id">SMS API ID (opcional)</Label>
                <Input 
                  id="sms_api_id"
                  type="number" 
                  placeholder="0" 
                  value={smsApiId} 
                  onChange={(e) => setSmsApiId(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sms_webhook_url">Webhook URL (opcional)</Label>
                <Input 
                  id="sms_webhook_url"
                  placeholder="https://..." 
                  value={smsWebhookUrl} 
                  onChange={(e) => setSmsWebhookUrl(e.target.value)} 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sms_message_value">Valor por mensagem SMS (R$)</Label>
                <Input 
                  id="sms_message_value"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.10" 
                  value={smsMessageValue} 
                  onChange={(e) => setSmsMessageValue(e.target.value)} 
                />
              </div>
            </div>
            <Button onClick={async () => {
              const body = {
                smsApiToken,
                smsApiId,
                smsWebhookUrl,
                smsMessageValue
              }
              await fetch('/api/global-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
              })
              setMessage('Credencial SMS e valor salvos!')
              setTimeout(() => setMessage(''), 2000)
            }} disabled={!smsApiToken}>
              Salvar Credencial SMS
            </Button>
            {message && <div className="text-emerald-600 text-sm">{message}</div>}
          </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Higienização (Shift Data) */}
          <TabsContent value="higienizacao" className="space-y-6">
            <Card className="bg-card">
              <CardHeader>
                <CardTitle>Shift Data - Higienização de Dados</CardTitle>
                <CardDescription>Configuração do webhook que retorna o token de autenticação</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="shift_webhook_token">Webhook para Obter Token *</Label>
                    <Input 
                      id="shift_webhook_token"
                      type="url"
                      placeholder="https://seu-servidor.com/webhook/gerarToken" 
                      value={shiftDataWebhookToken} 
                      onChange={(e) => setShiftDataWebhookToken(e.target.value)} 
                    />
                    <p className="text-xs text-muted-foreground">URL do webhook que retorna o token (método GET). Exemplo: https://weebserver6.farolchat.com/webhook/gerarToken</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shift_cost_per_query">Custo por Consulta (R$) *</Label>
                    <Input 
                      id="shift_cost_per_query"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.10" 
                      value={shiftDataCostPerQuery} 
                      onChange={(e) => setShiftDataCostPerQuery(e.target.value)} 
                    />
                    <p className="text-xs text-muted-foreground">Valor cobrado por cada consulta realizada</p>
                  </div>
                </div>
                <div className="p-4 bg-muted/50 rounded-md border border-border/50">
                  <h4 className="font-medium text-sm mb-2">Como funciona</h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• O sistema faz um GET no webhook configurado acima</li>
                    <li>• O webhook deve retornar um JSON com o token válido</li>
                    <li>• Esse token é usado para autenticar nas APIs da Shift Data:</li>
                    <li className="ml-4">- <strong>CPF:</strong> https://api.shiftdata.com.br/api/PessoaFisica</li>
                    <li className="ml-4">- <strong>CNPJ:</strong> https://api.shiftdata.com.br/api/PessoaJuridica</li>
                    <li className="ml-4">- <strong>Placa:</strong> https://api.shiftdata.com.br/api/Veiculos</li>
                    <li className="ml-4">- <strong>Telefone:</strong> https://api.shiftdata.com.br/api/Telefone</li>
                  </ul>
                </div>
                <Button onClick={async () => {
                  const body = { 
                    shiftDataCostPerQuery,
                    shiftDataWebhookToken 
                  }
                  await fetch('/api/global-settings', {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
                  })
                  setMessage('Configurações salvas com sucesso!')
                  setTimeout(() => setMessage(''), 2000)
                }} disabled={!shiftDataCostPerQuery || !shiftDataWebhookToken}>
                  Salvar Configurações
                </Button>
                {message && <div className="text-emerald-600 text-sm">{message}</div>}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba Bancos & Produtos */}
          <TabsContent value="bancos" className="space-y-6">
            <Card className="bg-card">
              <CardHeader>
                <CardTitle>Configurar Bancos</CardTitle>
                <CardDescription>Defina campos de credenciais e webhooks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button variant="outline" onClick={() => setBanks(prev => [...prev, { key: `bank_${Date.now()}`, name: '', fields: [{ key: 'usuario', label: 'Usuario', required: false }, { key: 'senha', label: 'Senha', required: false }], digitarFields: [], webhookUrl: '', forBatch: true, forSimular: true, productConfigs: [] }])}>Adicionar banco</Button>
                <div className="space-y-4">
                  {banks.map((b, idx) => (
                    <div key={b.key || idx} className="p-3 border rounded space-y-2 bg-muted/50">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <Input placeholder="Nome do banco" value={b.name} onChange={(e)=> setBanks(prev => prev.map((x,i)=> i===idx ? { ...x, name: e.target.value } : x))} />
                        <Input placeholder="Webhook (consulta em lote)" value={b.webhookUrl || ''} onChange={(e)=> setBanks(prev => prev.map((x,i)=> i===idx ? { ...x, webhookUrl: e.target.value } : x))} />
                        <div className="flex items-center gap-4 text-sm">
                          <label className="flex items-center gap-2"><input type="checkbox" checked={!!b.forBatch} onChange={(e)=> setBanks(prev => prev.map((x,i)=> i===idx ? { ...x, forBatch: e.target.checked } : x))} /> Lote</label>
                          <label className="flex items-center gap-2"><input type="checkbox" checked={!!b.forSimular} onChange={(e)=> setBanks(prev => prev.map((x,i)=> i===idx ? { ...x, forSimular: e.target.checked } : x))} /> Simular/Digitar</label>
                        </div>
                      </div>
                      <div className="space-y-2 bg-card/70 p-3 rounded border border-border/50">
                        <div className="text-sm font-medium">Campos de credenciais</div>
                        {(b.fields || []).map((f, fi) => (
                          <div key={fi} className="space-y-1">
                            <div className="grid grid-cols-3 gap-2 items-center">
                              <Input placeholder="Label" value={f.label || ''} onChange={(e)=> setBanks(prev => prev.map((x,i)=> i===idx ? { ...x, fields: x.fields.map((ff,j)=> j===fi ? { ...ff, label: e.target.value } : ff) } : x))} />
                              <Input placeholder="Chave (ex.: client_id)" value={f.key || ''} onChange={(e)=> setBanks(prev => prev.map((x,i)=> i===idx ? { ...x, fields: x.fields.map((ff,j)=> j===fi ? { ...ff, key: e.target.value } : ff) } : x))} />
                              <div className="flex items-center gap-4">
                                <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={!!f.required} onChange={(e)=> setBanks(prev => prev.map((x,i)=> i===idx ? { ...x, fields: x.fields.map((ff,j)=> j===fi ? { ...ff, required: e.target.checked } : ff) } : x))} /> Obrigatorio</label>
                                <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={f.type === 'select'} onChange={(e)=> setBanks(prev => prev.map((x,i)=> i===idx ? { ...x, fields: x.fields.map((ff,j)=> j===fi ? { ...ff, type: e.target.checked ? 'select' : 'text' } : ff) } : x))} /> Lista</label>
                              </div>
                            </div>
                            {f.type === 'select' && (
                              <Input placeholder="Opcoes (separadas por virgula)" value={f._optionsText ?? (Array.isArray(f.options) ? f.options.join(', ') : '')} onChange={(e)=> setBanks(prev => prev.map((x,i)=> i===idx ? { ...x, fields: x.fields.map((ff,j)=> j===fi ? { ...ff, _optionsText: e.target.value } : ff) } : x))} onBlur={(e)=> setBanks(prev => prev.map((x,i)=> i===idx ? { ...x, fields: x.fields.map((ff,j)=> j===fi ? { ...ff, _optionsText: e.target.value, options: e.target.value.split(',').map(s=>s.trim()).filter(Boolean) } : ff) } : x))} />
                            )}
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={()=> setBanks(prev => prev.map((x,i)=> i===idx ? { ...x, fields: [...(x.fields || []), { key: '', label: '' }] } : x))}>Adicionar campo</Button>
                          <Button size="sm" variant="destructive" onClick={()=> setBanks(prev => prev.filter((_,i)=> i!==idx))}>Remover banco</Button>
                        </div>
                      </div>
                      <div className="space-y-2 bg-card/70 p-3 rounded border border-border/50">
                        <div className="text-sm font-medium">Campos para Digitar</div>
                        {(b.digitarFields || []).map((f, fi) => (
                          <div key={fi} className="space-y-1">
                            <div className="grid grid-cols-3 gap-2 items-center">
                              <Input placeholder="Label" value={f.label || ''} onChange={(e)=> setBanks(prev => prev.map((x,i)=> i===idx ? { ...x, digitarFields: x.digitarFields.map((ff,j)=> j===fi ? { ...ff, label: e.target.value } : ff) } : x))} />
                              <Input placeholder="Chave (ex.: conta, agencia)" value={f.key || ''} onChange={(e)=> setBanks(prev => prev.map((x,i)=> i===idx ? { ...x, digitarFields: x.digitarFields.map((ff,j)=> j===fi ? { ...ff, key: e.target.value } : ff) } : x))} />
                              <div className="flex items-center gap-4">
                                <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={!!f.required} onChange={(e)=> setBanks(prev => prev.map((x,i)=> i===idx ? { ...x, digitarFields: x.digitarFields.map((ff,j)=> j===fi ? { ...ff, required: e.target.checked } : ff) } : x))} /> Obrigatorio</label>
                                <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={f.type === 'select'} onChange={(e)=> setBanks(prev => prev.map((x,i)=> i===idx ? { ...x, digitarFields: x.digitarFields.map((ff,j)=> j===fi ? { ...ff, type: e.target.checked ? 'select' : 'text' } : ff) } : x))} /> Lista</label>
                              </div>
                            </div>
                            {f.type === 'select' && (
                              <Input placeholder="Opcoes (separadas por virgula)" value={f._optionsText ?? (Array.isArray(f.options) ? f.options.join(', ') : '')} onChange={(e)=> setBanks(prev => prev.map((x,i)=> i===idx ? { ...x, digitarFields: x.digitarFields.map((ff,j)=> j===fi ? { ...ff, _optionsText: e.target.value } : ff) } : x))} onBlur={(e)=> setBanks(prev => prev.map((x,i)=> i===idx ? { ...x, digitarFields: x.digitarFields.map((ff,j)=> j===fi ? { ...ff, _optionsText: e.target.value, options: e.target.value.split(',').map(s=>s.trim()).filter(Boolean) } : ff) } : x))} />
                            )}
                          </div>
                        ))}
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={()=> setBanks(prev => prev.map((x,i)=> i===idx ? { ...x, digitarFields: [ ...(x.digitarFields || []), { key: '', label: '' } ] } : x))}>Adicionar campo</Button>
                        </div>
                      </div>
                      <div className="space-y-2 bg-card/70 p-3 rounded border border-border/50">
                        <div className="text-sm font-medium">Produtos deste banco</div>
                        {(products || []).map((p, pi) => {
                          const name = typeof p === 'string' ? p : (p?.name || '')
                          const list = b.productConfigs || []
                          const cfg = list.find(pc => pc.product === name) || null
                          return (
                            <div key={pi} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
                              <label className="flex items-center gap-2 md:col-span-2">
                                <input type="checkbox" checked={!!cfg} onChange={(e)=> setBanks(prev => prev.map((x,i)=> { if (i!==idx) return x; const cur = Array.isArray(x.productConfigs) ? [...x.productConfigs] : []; const ix = cur.findIndex(pc => pc.product === name); if (e.target.checked) { if (ix === -1) cur.push({ product: name, webhookSimulador: '', webhookDigitar: '' }) } else { if (ix !== -1) cur.splice(ix,1) } return { ...x, productConfigs: cur } }))} />
                                <span className="text-sm">{name}</span>
                              </label>
                              <Input placeholder="Webhook simulador (produto)" value={cfg?.webhookSimulador || ''} onChange={(e)=> setBanks(prev => prev.map((x,i)=> { if (i!==idx) return x; const cur = Array.isArray(x.productConfigs) ? [...x.productConfigs] : []; const ix = cur.findIndex(pc => pc.product === name); if (ix === -1) cur.push({ product: name, webhookSimulador: e.target.value, webhookDigitar: '' }); else cur[ix] = { ...cur[ix], webhookSimulador: e.target.value }; return { ...x, productConfigs: cur } }))} />
                              <Input placeholder="Webhook digitar (produto)" value={cfg?.webhookDigitar || ''} onChange={(e)=> setBanks(prev => prev.map((x,i)=> { if (i!==idx) return x; const cur = Array.isArray(x.productConfigs) ? [...x.productConfigs] : []; const ix = cur.findIndex(pc => pc.product === name); if (ix === -1) cur.push({ product: name, webhookSimulador: '', webhookDigitar: e.target.value }); else cur[ix] = { ...cur[ix], webhookDigitar: e.target.value }; return { ...x, productConfigs: cur } }))} />
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button onClick={saveBanks}>Salvar configuracoes</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardHeader>
                <CardTitle>Configurar Produtos</CardTitle>
                <CardDescription>Defina produtos e sua utilização</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2 items-center">
                  <Input placeholder="Novo produto" id="newProduct" />
                  <Button variant="outline" onClick={() => { const inp = document.getElementById('newProduct'); const val = inp?.value?.trim(); if (!val) return; setProducts(prev => ([...prev, { name: val, forBatch: true, forSimular: true }])); inp.value = '' }}>Adicionar</Button>
                </div>
                <div className="space-y-2">
                  {(products || []).map((p, i) => { const name = typeof p === 'string' ? p : (p?.name || ''); const forBatch = typeof p === 'string' ? true : !!p.forBatch; const forSim = typeof p === 'string' ? true : !!p.forSimular; return (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                      <Input value={name} onChange={(e)=> setProducts(prev => prev.map((x,xi)=> xi===i ? (typeof x === 'string' ? { name: e.target.value, forBatch, forSimular: forSim } : { ...x, name: e.target.value }) : x))} />
                      <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={forBatch} onChange={(e)=> setProducts(prev => prev.map((x,xi)=> xi===i ? (typeof x === 'string' ? { name, forBatch: e.target.checked, forSimular: forSim } : { ...x, forBatch: e.target.checked }) : x))} /> Lote</label>
                      <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={forSim} onChange={(e)=> setProducts(prev => prev.map((x,xi)=> xi===i ? (typeof x === 'string' ? { name, forBatch, forSimular: e.target.checked } : { ...x, forSimular: e.target.checked }) : x))} /> Simular/Digitar</label>
                      <Button size="sm" variant="destructive" onClick={() => setProducts(prev => prev.filter((_,xi)=> xi!==i))}>Remover</Button>
                    </div>
                  )})}
                </div>
                <div className="flex justify-end">
                  <Button onClick={saveProducts}>Salvar produtos</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

