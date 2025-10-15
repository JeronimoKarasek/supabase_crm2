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
  const [message, setMessage] = useState('')
  const [list, setList] = useState([])
  const [siteName, setSiteName] = useState('')
  const [siteSubtitle, setSiteSubtitle] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [banks, setBanks] = useState([]) // [{key,name,fields:[{key,label}], webhookUrl, returnWebhookUrl}]
  const [products, setProducts] = useState([]) // [string]

  useEffect(() => {
    ;(async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/tables', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      const json = await res.json()
      if (res.ok) setTables(json.tables || [])
    })()
  }, [])

  useEffect(() => {
    ;(async () => {
      if (!table) { setColumns([]); return }
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch(`/api/table-columns?table=${encodeURIComponent(table)}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      const json = await res.json()
      if (res.ok) setColumns(json.columns || [])
    })()
  }, [table])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/global-settings')
        const json = await res.json()
        if (res.ok) {
          if (Array.isArray(json.settings?.valorPagoList)) setList(json.settings.valorPagoList)
          else if (json.settings?.valorPago) setList([json.settings.valorPago])
          setSiteName(json.settings?.siteName || '')
          setSiteSubtitle(json.settings?.siteSubtitle || '')
          setLogoUrl(json.settings?.logoUrl || '')
          setBanks(Array.isArray(json.settings?.banks) ? json.settings.banks : [])
          setProducts(Array.isArray(json.settings?.products) ? json.settings.products : [])
        }
      } catch {}
    })()
  }, [])

  const saveValorPagoList = async () => {
    try {
      const res = await fetch('/api/global-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ valorPagoList: list }) })
      if (res.ok) {
        setMessage('Configurações salvas')
        setTimeout(() => setMessage(''), 2000)
      }
    } catch {}
  }

  const saveBanks = async () => {
    try {
      const res = await fetch('/api/global-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ banks }) })
      if (res.ok) { setMessage('Configurações salvas'); setTimeout(()=>setMessage(''),2000) }
    } catch {}
  }

  const saveProducts = async () => {
    try {
      const res = await fetch('/api/global-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ products }) })
      if (res.ok) { setMessage('Configurações salvas'); setTimeout(()=>setMessage(''),2000) }
    } catch {}
  }

  const clear = async () => {
    setTable(''); setSumColumn(''); setCondColumn(''); setCondType('contains'); setCondValue('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto py-8 px-4">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Configuração</CardTitle>
            <CardDescription>Defina como calcular o "Valor Pago" por tabela</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Branding */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input placeholder="Nome do sistema" value={siteName} onChange={(e) => setSiteName(e.target.value)} />
              <Input placeholder="Subtítulo" value={siteSubtitle} onChange={(e) => setSiteSubtitle(e.target.value)} />
              <Input placeholder="URL do logo" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button onClick={async () => {
                try {
                  const res = await fetch('/api/global-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ siteName, siteSubtitle, logoUrl }) })
                  if (res.ok) { setMessage('Configurações salvas'); setTimeout(()=>setMessage(''),2000) }
                } catch {}
              }}>Salvar</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Select value={table} onValueChange={(v) => { setTable(v); setSumColumn(''); setCondColumn('') }}>
                <SelectTrigger>
                  <SelectValue placeholder="Tabela" />
                </SelectTrigger>
                <SelectContent>
                  {tables.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={sumColumn} onValueChange={setSumColumn} disabled={!table}>
                <SelectTrigger>
                  <SelectValue placeholder="Coluna (somar)" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map(c => (
                    <SelectItem key={c.column_name} value={c.column_name}>{c.column_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={condColumn} onValueChange={setCondColumn} disabled={!table}>
                <SelectTrigger>
                  <SelectValue placeholder="Coluna (condição)" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map(c => (
                    <SelectItem key={c.column_name} value={c.column_name}>{c.column_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={condType} onValueChange={setCondType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">Contém</SelectItem>
                  <SelectItem value="equals">Igual</SelectItem>
                  <SelectItem value="greaterThan">Maior que</SelectItem>
                  <SelectItem value="lessThan">Menor que</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input placeholder="Valor da condição (ex.: paid)" value={condValue} onChange={(e) => setCondValue(e.target.value)} />
              <div className="md:col-span-3 flex gap-2 justify-end">
                <Button variant="outline" onClick={clear}>Limpar</Button>
                <Button variant="outline" onClick={() => {
                  if (!table || !sumColumn) return
                  const item = { table, sumColumn, cond: { column: condColumn, type: condType, value: condValue } }
                  setList((prev) => [...prev, item])
                }}>Adicionar à lista</Button>
                <Button onClick={saveValorPagoList} disabled={list.length === 0}>Salvar lista</Button>
              </div>
            </div>
            {message && <div className="text-emerald-600 text-sm">{message}</div>}
          </CardContent>
        </Card>

        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurações salvas</CardTitle>
              <CardDescription>Essas regras serão somadas no Dashboard, respeitando as permissões por tabela</CardDescription>
            </CardHeader>
            <CardContent>
              {list.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhuma configuração adicionada.</div>
              ) : (
                <div className="space-y-2">
                  {list.map((cfg, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 border rounded">
                      <div className="text-sm">
                        <div><span className="font-medium">Tabela:</span> {cfg.table}</div>
                        <div><span className="font-medium">Soma:</span> {cfg.sumColumn}</div>
                        {cfg.cond?.column ? (
                          <div><span className="font-medium">Condição:</span> {cfg.cond.column} {cfg.cond.type} {String(cfg.cond.value)}</div>
                        ) : (
                          <div className="text-muted-foreground">Sem condição</div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => {
                          setTable(cfg.table || '')
                          setSumColumn(cfg.sumColumn || '')
                          setCondColumn(cfg.cond?.column || '')
                          setCondType(cfg.cond?.type || 'contains')
                          setCondValue(cfg.cond?.value || '')
                        }}>Editar</Button>
                        <Button size="sm" variant="destructive" onClick={() => {
                          setList((prev) => prev.filter((_, i) => i !== idx))
                        }}>Excluir</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Banks config */}
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurar Bancos</CardTitle>
              <CardDescription>Defina campos de credenciais e webhooks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" onClick={() => setBanks(prev => [...prev, { key: `bank_${Date.now()}`, name: '', fields: [{ key: 'usuario', label: 'Usuário' }, { key: 'senha', label: 'Senha' }], webhookUrl: '', returnWebhookUrl: '' }])}>Adicionar banco</Button>
              <div className="space-y-4">
                {banks.map((b, idx) => (
                  <div key={b.key} className="p-3 border rounded space-y-2">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <Input placeholder="Nome do banco (ex.: BANCO V8)" value={b.name} onChange={(e) => {
                        const val = e.target.value
                        setBanks(prev => prev.map((x,i) => i===idx ? { ...x, name: val } : x))
                      }} />
                      <Input placeholder="Webhook (consulta)" value={b.webhookUrl} onChange={(e) => setBanks(prev => prev.map((x,i)=> i===idx ? { ...x, webhookUrl: e.target.value } : x))} />
                      <Input placeholder="Webhook de retorno" value={b.returnWebhookUrl} onChange={(e) => setBanks(prev => prev.map((x,i)=> i===idx ? { ...x, returnWebhookUrl: e.target.value } : x))} />
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Campos de credenciais</div>
                      {b.fields.map((f, fi) => (
                        <div key={fi} className="grid grid-cols-2 gap-2">
                          <Input placeholder="Label" value={f.label} onChange={(e) => setBanks(prev => prev.map((x,i) => i===idx ? { ...x, fields: x.fields.map((ff,j)=> j===fi ? { ...ff, label: e.target.value } : ff) } : x))} />
                          <Input placeholder="Chave (ex.: id_client)" value={f.key} onChange={(e) => setBanks(prev => prev.map((x,i) => i===idx ? { ...x, fields: x.fields.map((ff,j)=> j===fi ? { ...ff, key: e.target.value } : ff) } : x))} />
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setBanks(prev => prev.map((x,i)=> i===idx ? { ...x, fields: [...x.fields, { key: '', label: '' }] } : x))}>Adicionar campo</Button>
                        <Button size="sm" variant="destructive" onClick={() => setBanks(prev => prev.filter((_,i)=> i!==idx))}>Remover banco</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <Button onClick={saveBanks}>Salvar configurações</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Products config */}
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Configurar Produtos</CardTitle>
              <CardDescription>Adicione produtos para uso em Consulta em lote</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 items-center">
                <Input placeholder="Novo produto" id="newProduct" />
                <Button variant="outline" onClick={() => {
                  const inp = document.getElementById('newProduct')
                  const val = inp?.value?.trim()
                  if (!val) return
                  setProducts(prev => Array.from(new Set([...prev, val])))
                  inp.value=''
                }}>Adicionar</Button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {products.map((p, i) => (
                  <div key={i} className="px-2 py-1 rounded border bg-muted/30 flex items-center gap-2">
                    <span className="text-sm">{p}</span>
                    <Button size="sm" variant="ghost" onClick={() => setProducts(prev => prev.filter((x)=> x!==p))}>Remover</Button>
                  </div>
                ))}
              </div>
              <div className="flex justify-end">
                <Button onClick={saveProducts}>Salvar produtos</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
