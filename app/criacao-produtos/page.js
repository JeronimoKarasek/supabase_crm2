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

  const empty = { key:'', name:'', description:'', learn_more_url:'', webhook_url:'', sectors:[], pricing:{ basePrice: 0, userPrice: 0, connectionPrice: 0 }, active:true, useCredits: false, creditPrice: 0, productType: 'setor', paymentMethod: 'pix', billingMode: 'one_time' }
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
      const body = { 
        ...form, 
        pricing: { 
          ...form.pricing, 
          basePrice: Number(form.pricing.basePrice||0), 
          userPrice: Number(form.pricing.userPrice||0), 
          connectionPrice: Number(form.pricing.connectionPrice||0) 
        },
  productType: form.productType || 'setor',
  paymentMethod: form.paymentMethod || 'pix',
  billingMode: form.billingMode || 'one_time'
      }
      const res = await fetch('/api/products', { method: editingId ? 'PUT' : 'POST', headers: h, body: JSON.stringify(editingId ? { id: editingId, ...body } : body) })
      const json = await res.json()
      if (res.ok) { toast('Salvo com sucesso'); setForm(empty); setEditingId(''); load() }
      else toast(json?.error || 'Falha ao salvar')
    } catch { toast('Erro ao salvar') }
    finally { setLoading(false) }
  }

  const edit = (it) => {
    setEditingId(it.id)
    setForm({ 
      key: it.key, 
      name: it.name, 
      description: it.description||'', 
      learn_more_url: it.learn_more_url||'', 
      webhook_url: it.webhook_url||'', 
      sectors: it.sectors || [], 
      pricing: { 
        basePrice: it.pricing?.basePrice || 0, 
        userPrice: it.pricing?.userPrice || 0, 
        connectionPrice: it.pricing?.connectionPrice || 0 
      }, 
      active: !!it.active,
      useCredits: !!it.useCredits,
      creditPrice: it.creditPrice || 0,
      productType: it.productType || 'setor',
  paymentMethod: it.paymentMethod || 'pix',
  billingMode: it.billingMode || it.billing_mode || 'one_time'
    })
  }

  const remove = async (id) => {
    if (!confirm('Remover este produto?')) return
    try { const h = await headersAuth(); const res = await fetch('/api/products', { method: 'DELETE', headers: h, body: JSON.stringify({ id }) }); const json = await res.json(); if (res.ok) { toast('Removido'); load() } else toast(json?.error || 'Falha ao remover') } catch { toast('Erro ao remover') }
  }

  const toggleSector = (s) => setForm(prev => ({ ...prev, sectors: prev.sectors.includes(s) ? prev.sectors.filter(x=>x!==s) : [...prev.sectors, s] }))

  return (
    <div className="-m-4 min-h-[calc(100vh-56px)] bg-background">
      <div className="space-y-4 py-6 px-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-2xl font-semibold text-foreground">Criação de produtos</h1>
            <p className="text-sm text-muted-foreground">Cadastre e gerencie produtos; ao comprar, o usuário recebe acesso às seções selecionadas e disparamos o webhook.</p>
        </div>
      </div>
      {message && <div className="text-sm text-amber-600">{message}</div>}

  <Card className="bg-muted/30">
        <CardHeader className="bg-muted/50 rounded-t-xl">
          <CardTitle>{editingId ? 'Editar produto' : 'Criar novo produto'}</CardTitle>
          <CardDescription>Defina nome, preços e seções liberadas após compra.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 bg-muted/20 rounded-b-xl">
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
          
          {/* Tipo de Produto */}
          <div className="border-t pt-4 mt-4">
            <Label className="text-base font-semibold">Tipo de Produto</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              <label className="flex items-center gap-2 p-3 border rounded cursor-pointer hover:bg-muted/40">
                <input 
                  type="radio" 
                  name="productType" 
                  checked={form.productType === 'setor'} 
                  onChange={() => setForm(prev => ({...prev, productType: 'setor'}))} 
                />
                <div>
                  <div className="font-medium text-sm">Liberar Setor</div>
                  <div className="text-xs text-muted-foreground">Compra libera setores selecionados abaixo</div>
                </div>
              </label>
              <label className="flex items-center gap-2 p-3 border rounded cursor-pointer hover:bg-muted/40">
                <input 
                  type="radio" 
                  name="productType" 
                  checked={form.productType === 'usuario'} 
                  onChange={() => setForm(prev => ({...prev, productType: 'usuario'}))} 
                />
                <div>
                  <div className="font-medium text-sm">Comprar Usuário</div>
                  <div className="text-xs text-muted-foreground">Adiciona quantidade de usuários ao limite da empresa</div>
                </div>
              </label>
            </div>
          </div>

          {/* Método de Pagamento */}
          <div className="border-t pt-4 mt-4">
            <Label className="text-base font-semibold">Método de Pagamento</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              <label className="flex items-center gap-2 p-3 border rounded cursor-pointer hover:bg-muted/40">
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  checked={form.paymentMethod === 'pix'} 
                  onChange={() => setForm(prev => ({...prev, paymentMethod: 'pix', useCredits: false}))} 
                />
                <div>
                  <div className="font-medium text-sm">PIX</div>
                  <div className="text-xs text-muted-foreground">Pagamento via PIX Mercado Pago</div>
                </div>
              </label>
              <label className="flex items-center gap-2 p-3 border rounded cursor-pointer hover:bg-muted/40">
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  checked={form.paymentMethod === 'creditos'} 
                  onChange={() => setForm(prev => ({...prev, paymentMethod: 'creditos', useCredits: true}))} 
                />
                <div>
                  <div className="font-medium text-sm">Sistema de Créditos</div>
                  <div className="text-xs text-muted-foreground">Usa saldo de créditos da empresa</div>
                </div>
              </label>
              <label className="flex items-center gap-2 p-3 border rounded cursor-pointer hover:bg-muted/40">
                <input 
                  type="radio" 
                  name="paymentMethod" 
                  checked={form.paymentMethod === 'card'} 
                  onChange={() => setForm(prev => ({...prev, paymentMethod: 'card', useCredits: false}))} 
                />
                <div>
                  <div className="font-medium text-sm">Cartão (Mercado Pago)</div>
                  <div className="text-xs text-muted-foreground">Usado para assinatura mensal (preapproval)</div>
                </div>
              </label>
            </div>
          </div>

          {/* Modo de Cobrança */}
          <div className="border-t pt-4 mt-4">
            <Label className="text-base font-semibold">Modo de Cobrança</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
              <label className="flex items-center gap-2 p-3 border rounded cursor-pointer hover:bg-muted/40">
                <input 
                  type="radio" 
                  name="billingMode" 
                  checked={form.billingMode === 'one_time'} 
                  onChange={() => setForm(prev => ({...prev, billingMode: 'one_time'}))} 
                />
                <div>
                  <div className="font-medium text-sm">Pagamento Único</div>
                  <div className="text-xs text-muted-foreground">Cobra apenas uma vez</div>
                </div>
              </label>
              <label className="flex items-center gap-2 p-3 border rounded cursor-pointer hover:bg-muted/40">
                <input 
                  type="radio" 
                  name="billingMode" 
                  checked={form.billingMode === 'subscription'} 
                  onChange={() => setForm(prev => ({...prev, billingMode: 'subscription'}))} 
                />
                <div>
                  <div className="font-medium text-sm">Assinatura Mensal</div>
                  <div className="text-xs text-muted-foreground">Cobrança recorrente mensal. Use método de pagamento Cartão.</div>
                </div>
              </label>
            </div>
            {form.billingMode === 'subscription' && form.paymentMethod !== 'card' && (
              <div className="text-xs text-amber-600 mt-2">⚠️ Para assinaturas mensais selecione método de pagamento "Cartão".</div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label>Preço base (R$) {form.paymentMethod === 'creditos' && <span className="text-xs text-muted-foreground">- Valor em créditos</span>}</Label>
              <Input type="number" step="0.01" value={form.pricing.basePrice} onChange={(e)=> setForm(prev => ({...prev, pricing:{...prev.pricing, basePrice: e.target.value}}))} />
            </div>
            <div>
              <Label>User price (R$) {form.productType === 'usuario' && <span className="text-xs text-amber-600">- Qtd de usuários</span>}</Label>
              <Input type="number" step="0.01" value={form.pricing.userPrice} onChange={(e)=> setForm(prev => ({...prev, pricing:{...prev.pricing, userPrice: e.target.value}}))} />
              {form.productType === 'usuario' && <div className="text-xs text-muted-foreground mt-1">Este valor será adicionado ao user_limit da empresa</div>}
            </div>
            <div>
              <Label>Connection price (R$)</Label>
              <Input type="number" step="0.01" value={form.pricing.connectionPrice} onChange={(e)=> setForm(prev => ({...prev, pricing:{...prev.pricing, connectionPrice: e.target.value}}))} />
            </div>
          </div>
          <div>
            <Label>Setores liberados após compra</Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
              {allSectors.map(s => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.sectors.includes(s)} onCheckedChange={()=> toggleSector(s)} />
                  {s}
                </label>
              ))}
            </div>
            {form.productType === 'setor' && (
              <div className="text-xs text-muted-foreground mt-2">
                ✓ Ao comprar, o usuário receberá acesso aos setores selecionados
              </div>
            )}
            {form.productType === 'usuario' && (
              <div className="text-xs text-amber-600 mt-2">
                ⚠️ Comprar usuário também pode liberar setores selecionados
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button onClick={save} disabled={loading || !form.key || !form.name}>{editingId ? 'Salvar' : 'Criar produto'}</Button>
            {editingId ? <Button variant="secondary" onClick={()=>{ setEditingId(''); setForm(empty) }}>Cancelar</Button> : null}
          </div>
        </CardContent>
      </Card>

  <Card className="bg-muted/30">
        <CardHeader className="bg-muted/50 rounded-t-xl">
          <CardTitle>Produtos</CardTitle>
          <CardDescription>Lista de produtos cadastrados</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 bg-muted/20 rounded-b-xl">
          {items.map(it => (
            <div key={it.id} className="border rounded p-3 flex items-center justify-between">
              <div className="flex-1">
                <div className="font-medium flex items-center gap-2">
                  {it.name} 
                  <span className="text-xs text-muted-foreground">({it.key})</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${it.productType === 'usuario' ? 'bg-amber-500/20 text-amber-700' : 'bg-blue-500/20 text-blue-700'}`}>
                    {it.productType === 'usuario' ? '👤 Usuário' : '🔓 Setor'}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${it.paymentMethod === 'creditos' ? 'bg-green-500/20 text-green-700' : 'bg-purple-500/20 text-purple-700'}`}>
                    {it.paymentMethod === 'creditos' ? '💰 Créditos' : '💳 PIX'}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Setores: {(it.sectors||[]).join(', ') || '-'}
                </div>
                <div className="text-xs text-muted-foreground">
                  Base: R$ {it.pricing?.basePrice || 0} | Usuário: R$ {it.pricing?.userPrice || 0}
                </div>
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
    </div>
  )
}

