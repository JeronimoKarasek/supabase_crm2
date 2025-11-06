"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { supabase } from '@/lib/supabase'
import { sectors as allSectors } from '@/lib/sectors'

export default function CriacaoProdutosPage(){
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const empty = { key:'', name:'', description:'', learn_more_url:'', webhook_url:'', sectors:[], pricing:{ basePrice: 0, userPrice: 0, connectionPrice: 0 }, active:true }
  const [form, setForm] = useState(empty)
  const [editingId, setEditingId] = useState('')

  const toast = (m) => { setMessage(m); setTimeout(()=>setMessage(''), 2500) }

  const headersAuth = async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
  }

  const load = async () => {
    try {
      const h = await headersAuth()
      const res = await fetch('/api/products', { headers: h })
      const json = await res.json()
      if (res.ok) setItems(json.products || [])
      else toast(json?.error || 'Falha ao listar')
    } catch { toast('Erro ao listar') }
  }
  useEffect(()=>{ load() }, [])

  const save = async () => {
    setLoading(true)
    try {
      const h = await headersAuth()
      const body = { ...form, pricing: { ...form.pricing, basePrice: Number(form.pricing.basePrice||0), userPrice: Number(form.pricing.userPrice||0), connectionPrice: Number(form.pricing.connectionPrice||0) } }
      const res = await fetch('/api/products', { method: editingId ? 'PUT' : 'POST', headers: h, body: JSON.stringify(editingId ? { id: editingId, ...body } : body) })
      const json = await res.json()
      if (res.ok) { toast('Salvo com sucesso'); setForm(empty); setEditingId(''); load() }
      else toast(json?.error || 'Falha ao salvar')
    } catch { toast('Erro ao salvar') }
    finally { setLoading(false) }
  }

  const edit = (it) => {
    setEditingId(it.id)
  setForm({ key: it.key, name: it.name, description: it.description||'', learn_more_url: it.learn_more_url||'', webhook_url: it.webhook_url||'', sectors: it.sectors || [], pricing: { basePrice: it.pricing?.basePrice || 0, userPrice: it.pricing?.userPrice || 0, connectionPrice: it.pricing?.connectionPrice || 0 }, active: !!it.active })
  }

  const remove = async (id) => {
    if (!confirm('Remover este produto?')) return
    try { const h = await headersAuth(); const res = await fetch('/api/products', { method: 'DELETE', headers: h, body: JSON.stringify({ id }) }); const json = await res.json(); if (res.ok) { toast('Removido'); load() } else toast(json?.error || 'Falha ao remover') } catch { toast('Erro ao remover') }
  }

  const toggleSector = (s) => setForm(prev => ({ ...prev, sectors: prev.sectors.includes(s) ? prev.sectors.filter(x=>x!==s) : [...prev.sectors, s] }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Criação de produtos</h1>
          <p className="text-sm text-muted-foreground">Cadastre e gerencie produtos; ao comprar, o usuário recebe acesso às seções selecionadas e disparamos o webhook.</p>
        </div>
      </div>
      {message && <div className="text-sm text-amber-600">{message}</div>}

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? 'Editar produto' : 'Criar novo produto'}</CardTitle>
          <CardDescription>Defina nome, preços e seções liberadas após compra.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Chave (slug)</Label>
              <Input value={form.key} onChange={(e)=> setForm(prev => ({...prev, key: e.target.value}))} placeholder="ex: farolchat" disabled={!!editingId} />
            </div>
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e)=> setForm(prev => ({...prev, name: e.target.value}))} placeholder="Nome do produto" />
            </div>
            <div className="md:col-span-2">
              <Label>Descrição</Label>
              <Input value={form.description} onChange={(e)=> setForm(prev => ({...prev, description: e.target.value}))} placeholder="Descrição curta" />
            </div>
            <div>
              <Label>Saiba mais (URL)</Label>
              <Input value={form.learn_more_url} onChange={(e)=> setForm(prev => ({...prev, learn_more_url: e.target.value}))} placeholder="https://... (PDF)" />
            </div>
            <div>
              <Label>Webhook de compra (URL)</Label>
              <Input value={form.webhook_url} onChange={(e)=> setForm(prev => ({...prev, webhook_url: e.target.value}))} placeholder="https://..." />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Preço base (R$)</Label>
              <Input type="number" step="0.01" value={form.pricing.basePrice} onChange={(e)=> setForm(prev => ({...prev, pricing:{...prev.pricing, basePrice: e.target.value}}))} />
            </div>
            <div>
              <Label>User price (R$)</Label>
              <Input type="number" step="0.01" value={form.pricing.userPrice} onChange={(e)=> setForm(prev => ({...prev, pricing:{...prev.pricing, userPrice: e.target.value}}))} />
            </div>
            <div>
              <Label>Connection price (R$)</Label>
              <Input type="number" step="0.01" value={form.pricing.connectionPrice} onChange={(e)=> setForm(prev => ({...prev, pricing:{...prev.pricing, connectionPrice: e.target.value}}))} />
            </div>
          </div>
          <div>
            <Label>Seções liberadas após compra</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
              {allSectors.map(s => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.sectors.includes(s)} onCheckedChange={()=> toggleSector(s)} />
                  {s}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={loading || !form.key || !form.name}>{editingId ? 'Salvar' : 'Criar produto'}</Button>
            {editingId ? <Button variant="secondary" onClick={()=>{ setEditingId(''); setForm(empty) }}>Cancelar</Button> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Produtos</CardTitle>
          <CardDescription>Lista de produtos cadastrados</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map(it => (
            <div key={it.id} className="border rounded p-3 flex items-center justify-between">
              <div>
                <div className="font-medium">{it.name} <span className="text-xs text-muted-foreground">({it.key})</span></div>
                <div className="text-xs text-muted-foreground">Seções: {(it.sectors||[]).join(', ') || '-'}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={()=> edit(it)}>Editar</Button>
                <Button variant="destructive" onClick={()=> remove(it.id)}>Remover</Button>
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="text-sm text-muted-foreground">Nenhum produto cadastrado.</div>}
        </CardContent>
      </Card>
    </div>
  )
}

