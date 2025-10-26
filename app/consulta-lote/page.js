"use client"

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function ConsultaLotePage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState({}) // id -> true (para reprocessar/excluir)

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
      a.download = `lote_${id}.csv`
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

  const onDelete = async (id) => {
    try {
      setBusy(prev => ({ ...prev, [id]: true }))
      setError('')
      setMessage('')
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/importar', { method: 'DELETE', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ id }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Falha ao excluir lote')
      setMessage('Lote excluído.')
      setItems(prev => prev.filter(it => it.id !== id))
    } catch (e) {
      setError(e?.message || 'Falha ao excluir lote')
    } finally {
      setBusy(prev => ({ ...prev, [id]: false }))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Consulta em lote</h1>
          <p className="text-sm text-muted-foreground">Acompanhe os lotes enviados e seu progresso.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadItems} disabled={loading}>Atualizar</Button>
          <Button asChild variant="secondary"><a href="/clientes">Enviar novo lote</a></Button>
        </div>
      </div>

      {message ? <div className="text-green-600 text-sm">{message}</div> : null}
      {error ? <div className="text-red-600 text-sm">{error}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle>Lotes</CardTitle>
          <CardDescription>Listagem de lotes por usuário e status de processamento.</CardDescription>
        </CardHeader>
        <CardContent>
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
                      <Button size="sm" variant="destructive" onClick={() => onDelete(it.id)} disabled={!!busy[it.id]}>Excluir</Button>
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
  )
}

