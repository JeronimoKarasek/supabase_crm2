"use client"

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Layers, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react'
import { exportToCsv } from '@/lib/export'

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
  const [isAdminUser, setIsAdminUser] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const itemsPerPage = 10
  // Lock imediato para evitar duplo clique antes do React re-render
  const reprocessLocks = useRef(new Set())

  const loadItems = async (pageToLoad = currentPage) => {
    try {
      setLoading(true)
      setError('')
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch(`/api/importar?page=${pageToLoad}&limit=${itemsPerPage}` , { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Falha ao listar lotes')
      const pageItems = Array.isArray(json?.items) ? json.items : []
      setItems(pageItems)
      setHasMore(!!json?.hasMore)
    } catch (e) {
      setError(e?.message || 'Falha ao listar lotes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadItems(1) }, [])
  useEffect(() => { loadItems(currentPage) }, [currentPage])

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
  const email = user?.email || ''
  const role = user?.user_metadata?.role || 'viewer'
        const sectors = Array.isArray(user?.user_metadata?.sectors) ? user.user_metadata.sectors : []
        const has = sectors.some((s) => norm(s) === norm('Consulta em lote'))
        const isAdmin = email === 'junior.karaseks@gmail.com'
        if (active) {
          setCanSendBatch(role === 'admin' || has)
          setIsAdminUser(isAdmin)
        }
      } catch { if (active) setCanSendBatch(false) }
    }
    check()
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const user = session?.user
  const email = user?.email || ''
  const role = user?.user_metadata?.role || 'viewer'
      const sectors = Array.isArray(user?.user_metadata?.sectors) ? user.user_metadata.sectors : []
      const has = sectors.some((s) => norm(s) === norm('Consulta em lote'))
      const isAdmin = email === 'junior.karaseks@gmail.com'
      if (active) {
        setCanSendBatch(role === 'admin' || has)
        setIsAdminUser(isAdmin)
      }
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
      
      // Verificar apenas os campos OBRIGATÓRIOS (required: true)
      const missingFields = []
      if (selectedBank.fields && Array.isArray(selectedBank.fields)) {
        for (const field of selectedBank.fields) {
          // Só valida se o campo for obrigatório
          if (field.required === true) {
            const value = selectedBankCreds[field.key]
            if (!value || String(value).trim() === '') {
              missingFields.push(field.label || field.key)
            }
          }
        }
      }
      
      if (missingFields.length > 0) {
        setError(`Preencha os seguintes campos obrigatórios em "Senha de banco" para o banco "${selectedBank.name || sendBank}": ${missingFields.join(', ')}`)
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
  const res = await fetch('/api/importar', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ csv: csvText, produto: sendProduct, banco: sendBank, fileName }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Falha ao enviar lote')
  setMessage('Lote enviado para processamento.')
      setCsvText(''); setFileName(''); setSendBank(''); setSendProduct('')
  loadItems(1); setCurrentPage(1)
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
      
      // Download direto do CSV retornado pela API, preservando TODAS as colunas
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lote_${String(id)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Erro ao baixar lote:', e)
      setError('Erro ao baixar lote: ' + (e?.message || 'Erro desconhecido'))
    }
  }

  const onReprocess = async (id) => {
    // Guarda contra duplo clique rápido
    if (reprocessLocks.current.has(id)) return
    reprocessLocks.current.add(id)
    try {
      setBusy(prev => ({ ...prev, [id]: true }))
      setError('')
      setMessage('')
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/importar', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ id }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Falha ao reprocessar lote')
      setMessage(json?.dedup ? 'Reprocessamento já em andamento.' : 'Webhook disparado para o lote.')
    } catch (e) {
      setError(e?.message || 'Falha ao reprocessar lote')
    } finally {
      setBusy(prev => ({ ...prev, [id]: false }))
      reprocessLocks.current.delete(id)
    }
  }

  const onCancelar = async (id) => {
    if (!window.confirm('Tem certeza que deseja cancelar este lote? Todos os registros serão excluídos.')) return
    try {
      setBusy(prev => ({ ...prev, [id]: true }))
      setError('')
      setMessage('')
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/importar', { method: 'DELETE', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ id }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Falha ao cancelar lote')
  setMessage('Lote cancelado com sucesso.')
  loadItems(currentPage)
    } catch (e) {
      setError(e?.message || 'Falha ao cancelar lote')
    } finally {
      setBusy(prev => ({ ...prev, [id]: false }))
    }
  }

  const currentItems = items
  const handlePrev = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }
  const handleNext = () => {
    if (hasMore) {
      setCurrentPage(currentPage + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  return (
    <div className="-m-4 min-h-[calc(100vh-56px)] bg-background">
      <div className="py-6 px-6 space-y-6">
      {/* Header com gradiente */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 shadow-lg">
            <Layers className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
              Consulta em Lote
            </h1>
            <p className="text-muted-foreground mt-1">Acompanhe os lotes enviados e seu progresso</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadItems} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button asChild variant="secondary"><a href="/clientes">Enviar via Clientes</a></Button>
        </div>
      </div>

      {message && (
        <Alert className="border-l-4 border-l-green-500 bg-green-50 dark:bg-green-950/20">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">{message}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert className="border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800 dark:text-red-200">{error}</AlertDescription>
        </Alert>
      )}

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
                  {isAdminUser && <TableHead>Email</TableHead>}
                  <TableHead>Lote</TableHead>
                  <TableHead>Base</TableHead>
                  <TableHead>Data/Hora Envio</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentItems.map((it) => {
                  const formatDate = (dateStr) => {
                    if (!dateStr) return '-'
                    try {
                      const date = new Date(dateStr)
                      return date.toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    } catch {
                      return '-'
                    }
                  }
                  
                  return (
                    <TableRow key={it.id}>
                      {isAdminUser && <TableCell className="text-sm">{it.userEmail || '-'}</TableCell>}
                      <TableCell className="font-mono text-xs">{String(it.id).slice(0, 12)}</TableCell>
                      <TableCell className="text-sm">{it.base || it.file_name || it.fileName || '-'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{formatDate(it.createdAt)}</TableCell>
                      <TableCell>{it.produto || '-'}</TableCell>
                      <TableCell>{it.bancoName || '-'}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-1 rounded ${
                          it.status === 'concluido' ? 'bg-green-500/20 text-green-700' :
                          it.status === 'processando' ? 'bg-blue-500/20 text-blue-700' :
                          it.status === 'erro' ? 'bg-red-500/20 text-red-700' :
                          'bg-yellow-500/20 text-yellow-700'
                        }`}>
                          {it.status || 'pendente'}
                        </span>
                      </TableCell>
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
                        {it.progress && it.progress.percent < 100 && (
                          <Button size="sm" variant="destructive" onClick={() => onCancelar(it.id)} disabled={!!busy[it.id]}>Cancelar</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {(!currentItems || currentItems.length === 0) && (
                  <TableRow><TableCell colSpan={isAdminUser ? 9 : 8} className="text-center text-sm text-muted-foreground">Nenhum lote encontrado.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Paginação simples (servidor) */}
          <div className="flex items-center justify-between px-2 py-4">
            <div className="text-sm text-muted-foreground">
              Página {currentPage}
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handlePrev}
                disabled={currentPage === 1 || loading}
              >
                Anterior
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleNext}
                disabled={!hasMore || loading}
              >
                Próxima
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
