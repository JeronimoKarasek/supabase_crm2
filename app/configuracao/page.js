"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

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
        }
      } catch {}
    })()
  }, [])

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

  const clearInputs = () => { setTable(''); setSumColumn(''); setCondColumn(''); setCondType('contains'); setCondValue('') }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto py-8 px-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Configuracao</CardTitle>
            <CardDescription>Defina nome do site, subtitulo e logo</CardDescription>
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

        <Card>
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

        <Card>
          <CardHeader>
            <CardTitle>Configurar Bancos</CardTitle>
            <CardDescription>Defina campos de credenciais e webhooks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" onClick={() => setBanks(prev => [...prev, { key: `bank_${Date.now()}`, name: '', fields: [{ key: 'usuario', label: 'Usuario', required: false }, { key: 'senha', label: 'Senha', required: false }], digitarFields: [], webhookUrl: '', forBatch: true, forSimular: true, productConfigs: [] }])}>Adicionar banco</Button>
            <div className="space-y-4">
              {banks.map((b, idx) => (
                <div key={b.key || idx} className="p-3 border rounded space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <Input placeholder="Nome do banco" value={b.name} onChange={(e)=> setBanks(prev => prev.map((x,i)=> i===idx ? { ...x, name: e.target.value } : x))} />
                    <Input placeholder="Webhook (consulta em lote)" value={b.webhookUrl || ''} onChange={(e)=> setBanks(prev => prev.map((x,i)=> i===idx ? { ...x, webhookUrl: e.target.value } : x))} />
                    <div className="flex items-center gap-4 text-sm">
                      <label className="flex items-center gap-2"><input type="checkbox" checked={!!b.forBatch} onChange={(e)=> setBanks(prev => prev.map((x,i)=> i===idx ? { ...x, forBatch: e.target.checked } : x))} /> Lote</label>
                      <label className="flex items-center gap-2"><input type="checkbox" checked={!!b.forSimular} onChange={(e)=> setBanks(prev => prev.map((x,i)=> i===idx ? { ...x, forSimular: e.target.checked } : x))} /> Simular/Digitar</label>
                    </div>
                  </div>
                  <div className="space-y-2">
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
                  <div className="space-y-2">
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
                  <div className="space-y-2">
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

        <Card>
          <CardHeader>
            <CardTitle>Configurar Produtos</CardTitle>
            <CardDescription>Defina produtos e sua utilizacao</CardDescription>
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

        <Card>
          <CardHeader>
            <CardTitle>Pagamentos</CardTitle>
            <CardDescription>Configuracoes de pagamento dos produtos e consulta de creditos</CardDescription>
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
              <div className="space-y-3 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950">
                <div className="text-sm font-semibold text-blue-700 dark:text-blue-300">Credenciais Mercado Pago</div>
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
      </div>
    </div>
  )
}

