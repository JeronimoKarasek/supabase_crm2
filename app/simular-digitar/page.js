"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'

export default function SimularDigitarPage() {
  const [cpf, setCpf] = useState('')
  const [banks, setBanks] = useState([])
  const [credsByBank, setCredsByBank] = useState({})
  const [results, setResults] = useState([]) // [{bankKey, bankName, products:[{product, data|error, loading?}]}]
  const [loading, setLoading] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [currentBank, setCurrentBank] = useState(null)
  const [currentProduct, setCurrentProduct] = useState('')
  const [digForm, setDigForm] = useState({})
  const [digLoading, setDigLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/global-settings')
        const json = await res.json()
        if (res.ok) {
          const list = Array.isArray(json?.settings?.banks) ? json.settings.banks : []
          setBanks(list.filter(b => b.forSimular))
        }
      } catch {}
    })()
  }, [])

  // carrega credenciais por banco (para filtrar apenas os que possuem senha/cred salvo)
  useEffect(() => {
    ;(async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        const res = await fetch('/api/banks/credentials', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const json = await res.json()
        if (res.ok) setCredsByBank(json?.credentials || {})
      } catch {}
    })()
  }, [])

  // execução paralela, atualizando conforme cada webhook responde
  const callAllStreaming = async () => {
    if (!cpf) { setMessage('Informe o CPF'); setTimeout(()=>setMessage(''), 2000); return }
    const hasCred = (key) => {
      const c = credsByBank?.[key]
      return c && Object.keys(c || {}).length > 0
    }
    const target = (banks || []).filter(b => b.forSimular && hasCred(b.key))
    const initial = target.map(b => {
      const cfgs = Array.isArray(b.productConfigs) && b.productConfigs.length ? b.productConfigs : [{ product: 'default' }]
      return { bankKey: b.key, bankName: b.name || b.key, products: cfgs.map(pc => ({ product: pc.product || 'default', loading: true })) }
    })
    setResults(initial)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }

    const tasks = []
    for (const b of target) {
      const cfgs = Array.isArray(b.productConfigs) && b.productConfigs.length ? b.productConfigs : [{ product: null }]
      for (const pc of cfgs) {
        const prod = pc.product
        const body = { cpf, bankKey: b.key, ...(prod ? { product: prod } : {}) }
        tasks.push({ bankKey: b.key, product: prod || 'default', promise: fetch('/api/simular', { method: 'POST', headers, body: JSON.stringify(body) }) })
      }
    }
    setLoading(true)
    setPendingCount(tasks.length)
    for (const t of tasks) {
      t.promise
        .then(async (res) => {
          const json = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(json?.error || json?.message || `HTTP ${res.status}`)
          const updatedBank = json.results?.[0]
          setResults(prev => prev.map(r => {
            if (r.bankKey !== t.bankKey) return r
            const idx = r.products.findIndex(p => p.product === t.product)
            const prodVal = (updatedBank?.products?.[0]) || { product: t.product, error: 'Sem dados' }
            const next = [...r.products]
            next[idx >= 0 ? idx : 0] = { ...prodVal, loading: false }
            return { ...r, products: next }
          }))
        })
        .catch((e) => {
          setResults(prev => prev.map(r => {
            if (r.bankKey !== t.bankKey) return r
            const idx = r.products.findIndex(p => p.product === t.product)
            const next = [...r.products]
            next[idx >= 0 ? idx : 0] = { product: t.product, error: e.message, loading: false }
            return { ...r, products: next }
          }))
        })
        .finally(() => setPendingCount(c => { const n = Math.max(0, c - 1); if (n === 0) setLoading(false); return n }))
    }
  }

  const callAll = async () => {
    if (!cpf) { setMessage('Informe o CPF'); setTimeout(()=>setMessage(''), 2000); return }
    setLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/simular', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ cpf }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Falha na simulação')
      setResults(json.results || [])
    } catch (e) {
      setMessage(e?.message || 'Erro ao consultar')
      setTimeout(()=>setMessage(''), 2500)
    } finally {
      setLoading(false)
    }
  }

  const retryOne = async (bankKey, product) => {
    if (!cpf) { setMessage('Informe o CPF'); setTimeout(()=>setMessage(''), 2000); return }
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/simular', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ cpf, bankKey, product }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Falha na simulação')
      const updatedBank = json.results?.[0]
      const updated = results.map(r => (r.bankKey === bankKey ? (updatedBank || r) : r))
      setResults(updated)
    } catch (e) {
      setMessage(e?.message || 'Erro ao consultar')
      setTimeout(()=>setMessage(''), 2500)
    }
  }

  const openDigitar = (r, product) => {
    const bank = banks.find(b => b.key === r.bankKey)
    setCurrentBank(bank || null)
    setCurrentProduct(product || '')
    setDigForm({})
    setOpen(true)
  }

  const canDigit = (item) => {
    const d = item?.data || {}
    let val = d.valor_liberado ?? d.valorLiberado ?? d.valor_cliente ?? d.valor
    const hasVal = (x) => !(x === null || typeof x === 'undefined' || String(x).toString().trim() === '')
    if (hasVal(val)) return true
    const src = d._raw || {}
    const norm = (s) => { try { return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'') } catch { return String(s||'').toLowerCase() } }
    const syns = ['valor_liberado','valor liberado','valorLiberado','liberado']
    const map = new Map(Object.keys(src).map(k => [norm(k), k]))
    for (const s of syns) { const key = map.get(norm(s)); if (key) { val = src[key]; if (hasVal(val)) return true } }
    return false
  }

  const doDigitar = async () => {
    if (!currentBank) return
    setDigLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/digitar', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ bankKey: currentBank.key, cpf, payload: digForm, product: currentProduct }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Falha ao enviar digitação')
      setOpen(false)
      // Extrai link retornado pelo webhook e anexa ao cartão
      const resp = json?.response || {}
      const urlKnown = resp.link || resp.url || resp.proposta_url || resp.propostaLink || resp.proposta || resp.pdf || resp.contrato || ''
      const findFirstUrl = (obj) => {
        if (!obj || typeof obj !== 'object') return ''
        for (const [k,v] of Object.entries(obj)) {
          if (typeof v === 'string' && v.startsWith('http')) return v
          if (v && typeof v === 'object') { const r = findFirstUrl(v); if (r) return r }
        }
        return ''
      }
      const url = (typeof urlKnown === 'string' && urlKnown.startsWith('http')) ? urlKnown : findFirstUrl(resp)
      const mensagem = resp.mensagem || resp.message || resp.msg || ''
      setResults(prev => prev.map(r => {
        if (r.bankKey !== (currentBank?.key)) return r
        const next = (r.products || []).map(p => {
          if (p.product !== currentProduct) return p
          return { ...p, submit: { url, mensagem, raw: resp } }
        })
        return { ...r, products: next }
      }))
      setMessage('Enviado com sucesso')
      setTimeout(()=>setMessage(''), 2000)
    } catch (e) {
      setMessage(e?.message || 'Erro ao enviar')
      setTimeout(()=>setMessage(''), 2500)
    } finally {
      setDigLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto py-8 px-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Simular/Digitar</CardTitle>
            <CardDescription>Informe o CPF e consulte em todos os bancos habilitados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-3 items-start md:items-end">
              <div className="flex-1">
                <Input placeholder="CPF" value={cpf} onChange={(e)=> setCpf(e.target.value)} onKeyDown={(e)=> { if (e.key==='Enter') callAllStreaming() }} />
              </div>
              <Button onClick={callAllStreaming} disabled={loading}>{loading ? `Consultando (${pendingCount})...` : 'Consultar'}</Button>
            </div>
            {message && <div className="mt-2 text-amber-600 text-sm">{message}</div>}
          </CardContent>
        </Card>

        <div className="space-y-3">
          {results.map((r, i) => (
            <Card key={r.bankKey || i}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{r.bankName}</CardTitle>
                    <CardDescription>Resultado do simulador por produto</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {r.error && <div className="text-destructive">{r.error}</div>}
                <div className="space-y-3">
                  {(r.products || []).map((item, idx) => {
                    const d = item.data || {}
                    return (
                      <div key={idx} className="border rounded p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium">Produto: {item.product}</div>
                          <div className="flex gap-2">
                            <Button variant="outline" onClick={() => retryOne(r.bankKey, item.product)}>Tentar novamente</Button>
                            {canDigit(item) && <Button onClick={() => openDigitar(r, item.product)}>Digitar</Button>}
                          </div>
                        </div>
                        {item.loading ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Carregando...
                          </div>
                        ) : item.error ? (
                          <div className="text-destructive text-sm">{item.error}</div>
                        ) : (
                          <div className="space-y-2 text-sm">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              {d.mensagem && <div><span className="font-medium">Mensagem:</span> {String(d.mensagem)}</div>}
                              {typeof d.valor_cliente !== 'undefined' && <div><span className="font-medium">Valor cliente:</span> {String(d.valor_cliente)}</div>}
                              {typeof d.valor_liberado !== 'undefined' && <div><span className="font-medium">Valor liberado:</span> {String(d.valor_liberado)}</div>}
                              {typeof d.taxa !== 'undefined' && <div><span className="font-medium">Taxa:</span> {String(d.taxa)}</div>}
                              {typeof d.tabela !== 'undefined' && <div><span className="font-medium">Tabela:</span> {String(d.tabela)}</div>}
                              {typeof d.prazo !== 'undefined' && <div><span className="font-medium">Prazo:</span> {String(d.prazo)}</div>}
                              {typeof d.valor_bloqueado !== 'undefined' && <div><span className="font-medium">Valor bloqueado:</span> {String(d.valor_bloqueado)}</div>}
                            </div>
                            {item.submit && (item.submit.url || item.submit.mensagem) ? (
                              <div className="border rounded p-2 bg-muted/30">
                                <div className="text-xs font-medium mb-1">Proposta</div>
                                {item.submit.url ? (
                                  <div><a className="text-primary underline" href={item.submit.url} target="_blank" rel="noreferrer">Abrir proposta</a></div>
                                ) : null}
                                {item.submit.mensagem ? (
                                  <div className="text-xs text-muted-foreground">{item.submit.mensagem}</div>
                                ) : null}
                              </div>
                            ) : null}
                            {(() => {
                              const known = new Set(['mensagem','valor_cliente','valor_liberado','taxa','tabela','prazo','valor_bloqueado','_raw'])
                              const extra = Object.entries(d._raw || {}).filter(([k]) => !known.has(k))
                              if (extra.length === 0) return null
                              return (
                                <div className="border rounded p-2 bg-muted/30">
                                  <div className="text-xs font-medium mb-1">Detalhes</div>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                    {extra.map(([k,v]) => (
                                      <div key={k}><span className="font-medium">{k}:</span> {typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>
                                    ))}
                                  </div>
                                </div>
                              )
                            })()}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Digitar: {currentBank?.name} {currentProduct ? `- ${currentProduct}` : ''}</DialogTitle>
              <DialogDescription>Preencha os dados para envio</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2 max-h-[60vh] overflow-auto">
              {(currentBank?.digitarFields || []).map((f, i) => (
                <div key={i}>
                  <div className="text-xs text-muted-foreground">{f.label || f.key}</div>
                  {f.type === 'select' && Array.isArray(f.options) && f.options.length > 0 ? (
                    <select className="border rounded h-10 px-2 bg-background w-full" value={digForm[f.key] || ''} onChange={(e)=> setDigForm(prev => ({ ...prev, [f.key]: e.target.value }))}>
                      <option value=""></option>
                      {f.options.map((o,oi)=> <option key={oi} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <Input value={digForm[f.key] || ''} onChange={(e)=> setDigForm(prev => ({ ...prev, [f.key]: e.target.value }))} />
                  )}
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={doDigitar} disabled={digLoading}>{digLoading ? 'Enviando...' : 'Enviar'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
