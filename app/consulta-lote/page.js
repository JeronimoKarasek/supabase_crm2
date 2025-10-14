"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'

export default function ConsultaLotePage() {
  const [banks, setBanks] = useState([])
  const [products, setProducts] = useState([])
  const [bank, setBank] = useState('')
  const [product, setProduct] = useState('')
  const [fileName, setFileName] = useState('')
  const [list, setList] = useState([])

  useEffect(() => {
    ;(async () => {
      const res = await fetch('/api/global-settings')
      const json = await res.json()
      setBanks(Array.isArray(json?.settings?.banks) ? json.settings.banks : [])
      setProducts(Array.isArray(json?.settings?.products) ? json.settings.products : [])
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const lres = await fetch('/api/importar', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      const ljson = await lres.json()
      if (lres.ok) setList(ljson.items || [])
    })()
  }, [])

  const onUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const text = await file.text()
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    const res = await fetch('/api/importar', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ csv: text, produto: product, banco: bank }) })
    const json = await res.json()
    if (res.ok) setList(json.items || [])
  }

  const download = async (id) => {
    const res = await fetch(`/api/importar?downloadId=${encodeURIComponent(id)}`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `importar_${id}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Consulta em lote</CardTitle>
            <CardDescription>Importe um CSV com as colunas: nome, telefone, cpf</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Button variant="outline" onClick={() => {
                const sample = 'nome,telefone,cpf\nJoao,11999999999,12345678901\nMaria,11988888888,10987654321\n'
                const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'modelo.csv'
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
              }}>Modelo</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Select value={product} onValueChange={setProduct}>
                <SelectTrigger>
                  <SelectValue placeholder="Produto" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p,i) => <SelectItem key={i} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={bank} onValueChange={setBank}>
                <SelectTrigger>
                  <SelectValue placeholder="Banco" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((b) => <SelectItem key={b.key} value={b.key}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <div>
                <Input type="file" accept=".csv" onChange={onUpload} />
              </div>
            </div>

            <div className="mt-4">
              <div className="text-sm font-medium mb-2">Bases importadas</div>
              {list.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhuma base importada ainda.</div>
              ) : (
                <div className="space-y-2">
                  {list.map((it) => (
                    <div key={it.id} className="p-2 border rounded flex items-center justify-between">
                      <div className="text-sm">
                        <div><span className="font-medium">ID:</span> {it.id}</div>
                        <div><span className="font-medium">Produto:</span> {it.produto} | <span className="font-medium">Banco:</span> {it.bancoName}</div>
                        <div><span className="font-medium">Status:</span> {it.status}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => download(it.id)}>Exportar</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

