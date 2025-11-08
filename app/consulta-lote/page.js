"use client"

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

export default function ConsultaLotePage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState({}) // id -> true (para reprocessar/excluir)
  const [banks, setBanks] = useState([])
  const [products, setProducts] = useState([])
  const [sendBank, setSendBank] = useState('')
  const [sendProduct, setSendProduct] = useState('')
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState('')
  const [sending, setSending] = useState(false)
  const [canSendBatch, setCanSendBatch] = useState(false)

  const loadItems = async () => {
    try {
      setLoading(true)
      setError('')
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/importar', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Falha ao listar lotes')
      setItems(Array.isArray(json?.items) ? json.items : [])
    } catch (e) {
      setError(e?.message || 'Falha ao listar lotes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadItems() }, [])

  // Carregar bancos e produtos
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/global-settings')
        const json = await res.json().catch(() => ({}))
        if (res.ok) {
          const allBanks = Array.isArray(json?.settings?.banks) ? json.settings.banks : []
          const allProducts = Array.isArray(json?.settings?.products) ? json.settings.products : []
          setBanks(allBanks.filter(b => !!b.forBatch))
          setProducts(allProducts.filter(p => (typeof p === 'string' ? true : !!p.forBatch)))
        }
      } catch {}
    })()
  }, [])

  // Permissão para envio em lote
  useEffect(() => {
    let active = true
    const norm = (s) => { try { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() } catch { return String(s || '').toLowerCase() } }
    const check = async () => {
      try {
        const { data } = await supabase.auth.getUser()
        const user = data?.user
        const role = user?.user_metadata?.role || 'viewer'
        const sectors = Array.isArray(user?.user_metadata?.sectors) ? user.user_metadata.sectors : []
        const has = sectors.some((s) => norm(s) === norm('Consulta em lote'))
        if (active) setCanSendBatch(role === 'admin' || has)
      } catch { if (active) setCanSendBatch(false) }
    }
    check()
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const user = session?.user
      const role = user?.user_metadata?.role || 'viewer'
      const sectors = Array.isArray(user?.user_metadata?.sectors) ? user.user_metadata.sectors : []
      const has = sectors.some((s) => norm(s) === norm('Consulta em lote'))
      if (active) setCanSendBatch(role === 'admin' || has)
    })
    return () => { active = false; sub?.subscription?.unsubscribe?.() }
  }, [])

  const onFileChange = async (e) => {
    try {
      const f = e?.target?.files?.[0]
      if (!f) { setFileName(''); setCsvText(''); return }
      setFileName(f.name)
      const text = await f.text().catch(() => '')
      setCsvText(text || '')
    } catch {
      setFileName('')
      setCsvText('')
    }
  }

  const onSend = async () => {
    if (!csvText || !sendProduct || !sendBank) return
    
    // Validar se o usuário do banco específico está preenchido
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const credRes = await fetch('/api/banks/credentials', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      const credJson = await credRes.json().catch(() => ({}))
      const userCreds = credJson.credentials || {}
      
      // Verificar se o banco selecionado tem credenciais preenchidas
      const selectedBankCreds = userCreds[sendBank]
      const selectedBank = banks.find(b => b.key === sendBank)
      
      if (!selectedBankCreds || !selectedBank) {
        setError(`Você precisa cadastrar suas credenciais para o banco "${selectedBank?.name || sendBank}" em "Senha de banco" antes de enviar o lote.`)
        return
      }
      
      // Verificar se todos os campos obrigatórios estão preenchidos
      const missingFields = []
      if (selectedBank.fields && Array.isArray(selectedBank.fields)) {
        for (const field of selectedBank.fields) {
          const value = selectedBankCreds[field.key]
          if (!value || String(value).trim() === '') {
            missingFields.push(field.label || field.key)
          }
        }
      }
      
      if (missingFields.length > 0) {
        setError(`Preencha os seguintes campos em "Senha de banco" para o banco "${selectedBank.name || sendBank}": ${missingFields.join(', ')}`)
        return
      }
      
    } catch (e) {
      setError('Erro ao verificar credenciais do banco: ' + (e?.message || 'Erro desconhecido'))
      return
    }
    
    try {
      setSending(true)
      setError('')
      setMessage('')
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/importar', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ csv: csvText, produto: sendProduct, banco: sendBank }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Falha ao enviar lote')
      setMessage('Lote enviado para processamento.')
      setCsvText(''); setFileName(''); setSendBank(''); setSendProduct('')
      loadItems()
    } catch (e) {
      setError(e?.message || 'Falha ao enviar lote')
    } finally {
      setSending(false)
    }
  }

  const onDownload = async (id) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch(`/api/importar?downloadId=${encodeURIComponent(id)}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lote_${id}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {}
  }

  const onReprocess = async (id) => {
    try {
      setBusy(prev => ({ ...prev, [id]: true }))
      setError('')
      setMessage('')
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/importar', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ id }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Falha ao reprocessar lote')
      setMessage('Webhook disparado para o lote.')
    } catch (e) {
      setError(e?.message || 'Falha ao reprocessar lote')
    } finally {
      setBusy(prev => ({ ...prev, [id]: false }))
    }
  }

  // Removido: ação de excluir lote (solicitado para retirar a opção de exclusão na lista)

  return (
    <div className="-m-4 min-h-[calc(100vh-56px)] bg-background">
      <div className="py-6 px-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Consulta em lote</h1>
          <p className="text-sm text-muted-foreground">Acompanhe os lotes enviados e seu progresso.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadItems} disabled={loading}>Atualizar</Button>
          <Button asChild variant="secondary"><a href="/clientes">Enviar via Clientes</a></Button>
        </div>
      </div>

      {message ? <div className="text-green-600 text-sm">{message}</div> : null}
      {error ? <div className="text-red-600 text-sm">{error}</div> : null}

      {canSendBatch && (
        <Card className="bg-muted/30">
          <CardHeader className="bg-muted/50 rounded-t-xl">
            <CardTitle>Enviar novo lote</CardTitle>
              <CardDescription>Selecione o produto, o banco e envie um arquivo CSV com colunas nome, telefone, cpf, nb.</CardDescription>
          </CardHeader>
          <CardContent className="bg-muted/20 rounded-b-xl">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Produto</div>
                <Select value={sendProduct} onValueChange={setSendProduct}>
                  <SelectTrigger><SelectValue placeholder="Produto" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p, i) => {
                      const name = typeof p === 'string' ? p : (p?.name || '')
                      if (!name) return null
                      return (<SelectItem key={i} value={name}>{name}</SelectItem>)
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">Banco</div>
                <Select value={sendBank} onValueChange={setSendBank}>
                  <SelectTrigger><SelectValue placeholder="Banco" /></SelectTrigger>
                  <SelectContent>
                    {banks.map((b) => (
                      <SelectItem key={b.key} value={b.key}>{b.name || b.key}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <div className="text-xs text-muted-foreground">Arquivo CSV</div>
                <Input type="file" accept=".csv,text/csv" onChange={onFileChange} />
                {fileName ? <div className="text-xs text-muted-foreground">Selecionado: {fileName}</div> : null}
              </div>
              <div className="md:col-span-4 flex gap-2">
                <Button onClick={onSend} disabled={sending || !csvText || !sendProduct || !sendBank}>{sending ? 'Enviando...' : 'Enviar'}</Button>
                <Button variant="outline" onClick={() => { setCsvText(''); setFileName(''); }} disabled={!csvText}>Limpar arquivo</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-muted/30">
        <CardHeader className="bg-muted/50 rounded-t-xl">
          <CardTitle>Lotes</CardTitle>
          <CardDescription>Listagem de lotes por usuário e status de processamento.</CardDescription>
        </CardHeader>
        <CardContent className="bg-muted/20 rounded-b-xl">
          <div className="border rounded overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lote</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-mono text-xs">{String(it.id).slice(0, 12)}</TableCell>
                    <TableCell>{it.produto || '-'}</TableCell>
                    <TableCell>{it.bancoName || '-'}</TableCell>
                    <TableCell>{it.status || '-'}</TableCell>
                    <TableCell>
                      {it.progress ? (
                        <span className="text-sm">{it.progress.done}/{it.progress.total} ({it.progress.percent}%)</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">N/D</span>
                      )}
                    </TableCell>
                    <TableCell className="space-x-2 whitespace-nowrap">
                      <Button size="sm" variant="outline" onClick={() => onDownload(it.id)}>Baixar</Button>
                      <Button size="sm" variant="outline" onClick={() => onReprocess(it.id)} disabled={!!busy[it.id]}>Reprocessar</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!items || items.length === 0) && (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Nenhum lote encontrado.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
