"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { Database } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend } from 'recharts'

const COLORS = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf']

function parseMoney(val) {
  if (val === null || typeof val === 'undefined') return null
  if (typeof val === 'number') return Number.isFinite(val) ? val : null
  let s = String(val).trim()
  if (!s) return null
  if (/[^0-9.,\-]/.test(s)) return null
  s = s.replace(/\s/g, '')
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(',')
    const lastDot = s.lastIndexOf('.')
    if (lastComma > lastDot) { s = s.replace(/\./g, '').replace(',', '.') } else { s = s.replace(/,/g, '') }
  } else if (hasComma) {
    s = s.replace(/\./g, '').replace(',', '.')
  }
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : null
}

const fmtBRL = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n || 0))

export default function DashboardPage() {
  const [tables, setTables] = useState([])
  const [table, setTable] = useState('')
  const [columns, setColumns] = useState([])
  const [dateCol, setDateCol] = useState('')
  const [xCol, setXCol] = useState('')
  const [yCol, setYCol] = useState('')
  const [agg, setAgg] = useState('count')
  const [chartType, setChartType] = useState('bar')
  const [groupBy, setGroupBy] = useState('none')
  const [filterColumn, setFilterColumn] = useState('')
  const [filterType, setFilterType] = useState('contains')
  const [filterValue, setFilterValue] = useState('')
  const [filters, setFilters] = useState([])
  const [data, setData] = useState([])
  const [error, setError] = useState('')
  const [saved, setSaved] = useState([])
  const [chartDataMap, setChartDataMap] = useState({})
  const [valorPago, setValorPago] = useState(0)
  const [totaisPorTabela, setTotaisPorTabela] = useState({})
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [openCreate, setOpenCreate] = useState(false)
  const [showTable, setShowTable] = useState(false)
  const [userId, setUserId] = useState('')
  // Consulta em lote removida do dashboard

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id || '')) }, [])

  useEffect(() => {
    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        const res = await fetch('/api/tables', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const json = await res.json()
        if (res.ok) setTables(json.tables || [])
      } catch {}
    })()
  }, [])

  useEffect(() => {
    (async () => {
      if (!table) { setColumns([]); return }
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        const res = await fetch(`/api/table-columns?table=${encodeURIComponent(table)}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const json = await res.json()
        if (res.ok) {
          const cols = json.columns || []
          setColumns(cols)
          const lower = new Set(cols.map(c => String(c.column_name || '').toLowerCase()))
          const candidates = ['created_at','updated_at','inserted_at','date','data','timestamp','hora','horario da ultima resposta']
          let pick = ''
          for (const n of candidates) { if (lower.has(n)) { pick = cols.find(c => String(c.column_name).toLowerCase()===n)?.column_name; break } }
          if (!pick) {
            const dt = cols.find(c => /date|time|timestamp/i.test(String(c.data_type || '')))
            if (dt) pick = dt.column_name
          }
          setDateCol(pick || '')
        }
      } catch {}
    })()
  }, [table])

  useEffect(() => {
    (async () => {
      try {
        if (!userId) return
        const raw = localStorage.getItem(`charts:${userId}`)
        const arr = raw ? JSON.parse(raw) : []
        setSaved(Array.isArray(arr) ? arr : [])
      } catch {}
    })()
  }, [userId])

  useEffect(() => {
    (async () => {
      if (!saved.length) { setChartDataMap({}); return }
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const map = {}
      for (const c of saved) {
        const qs = new URLSearchParams({ table: c.table, page: '1', pageSize: '1000' })
        if (periodStart) qs.set('periodStart', periodStart)
        if (periodEnd) qs.set('periodEnd', periodEnd)
        if (c.dateCol) qs.set('dateColumn', c.dateCol)
        if (Array.isArray(c.filters) && c.filters.length) qs.set('filters', JSON.stringify(c.filters))
        const res = await fetch(`/api/table-data?${qs.toString()}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const json = await res.json()
        const rows = json.data || []
        const aggMap = new Map()
        for (const r of rows) {
          let xv = r[c.xCol]
          if (c.groupBy && c.groupBy !== 'none' && c.dateCol && r[c.dateCol]) {
            const d = new Date(r[c.dateCol])
            if (isFinite(d)) {
              xv = c.groupBy === 'day' ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
            }
          }
          let yv = c.agg === 'sum' ? parseMoney(r[c.yCol]) : 1
          if (c.agg === 'sum' && yv === null) yv = 0
          aggMap.set(xv, (aggMap.get(xv) || 0) + yv)
        }
        map[c.id] = Array.from(aggMap.entries()).map(([x,y]) => ({ x, y }))
      }
      setChartDataMap(map)
    })()
  }, [saved, periodStart, periodEnd])

  async function createChart() {
    try {
      setError('')
      if (!table || !xCol || (agg === 'sum' && !yCol)) { setError('Selecione tabela, coluna X e (se soma) coluna Y'); return }
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const qs = new URLSearchParams({ table, page: '1', pageSize: '1000' })
      if (periodStart) qs.set('periodStart', periodStart)
      if (periodEnd) qs.set('periodEnd', periodEnd)
      if (dateCol) qs.set('dateColumn', dateCol)
      if (filterColumn && filterValue) { qs.set('filterColumn', filterColumn); qs.set('filterType', filterType); qs.set('filterValue', filterValue) }
      if (Array.isArray(filters) && filters.length) qs.set('filters', JSON.stringify(filters.filter(f=>f && f.column && (f.value || f.value===0))))
      const res = await fetch(`/api/table-data?${qs.toString()}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Falha ao buscar dados'); return }
      const rows = json.data || []
      const m = new Map()
      for (const r of rows) {
        let xv = r[xCol]
        if (groupBy !== 'none' && dateCol && r[dateCol]) {
          const d = new Date(r[dateCol])
          if (isFinite(d)) { xv = groupBy === 'day' ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }
        }
        let yv = agg === 'sum' ? parseMoney(r[yCol]) : 1
        if (agg === 'sum' && yv === null) continue
        m.set(xv, (m.get(xv) || 0) + (yv || 0))
      }
      setData(Array.from(m.entries()).map(([x,y])=>({ x, y })))
    } catch { setError('Falha ao criar gráfico') }
  }

  // (Removido) Auxiliares de CSV para consulta em lote

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Database className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold text-foreground">Dashboard</h1>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-muted-foreground">
              <span>Período:</span>
              <Input type="date" value={periodStart} onChange={(e)=>setPeriodStart(e.target.value)} className="h-8 w-auto" />
              <Input type="date" value={periodEnd} onChange={(e)=>setPeriodEnd(e.target.value)} className="h-8 w-auto" />
            </div>
            <div className="flex items-center gap-3">
              <div className="text-sm font-medium">Total Pago: <span className="font-semibold">{fmtBRL(valorPago)}</span></div>
              <Dialog open={openCreate} onOpenChange={setOpenCreate}>
                <Button variant="outline" onClick={()=>setOpenCreate(true)}>Criar gráfico</Button>
                <DialogContent className="max-w-5xl">
                  <DialogHeader>
                    <DialogTitle>Novo gráfico</DialogTitle>
                    <DialogDescription>Selecione base, campos e opções (estilo planilha).</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                      <Select value={table} onValueChange={(v)=>{ setTable(v); setXCol(''); setYCol('') }}>
                        <SelectTrigger><SelectValue placeholder="Tabela" /></SelectTrigger>
                        <SelectContent>{tables.map(t=> (<SelectItem key={t} value={t}>{t}</SelectItem>))}</SelectContent>
                      </Select>
                      <Select value={xCol} onValueChange={setXCol} disabled={!table}>
                        <SelectTrigger><SelectValue placeholder="Eixos (Categorias)" /></SelectTrigger>
                        <SelectContent>{columns.map(c=> (<SelectItem key={c.column_name} value={c.column_name}>{c.column_name}</SelectItem>))}</SelectContent>
                      </Select>
                      <Select value={agg} onValueChange={setAgg}>
                        <SelectTrigger><SelectValue placeholder="Agregação" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="count">Contagem de linhas</SelectItem>
                          <SelectItem value="sum">Soma de coluna</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={yCol} onValueChange={setYCol} disabled={agg !== 'sum'}>
                        <SelectTrigger><SelectValue placeholder="Valores (se Soma)" /></SelectTrigger>
                        <SelectContent>{columns.map(c=> (<SelectItem key={c.column_name} value={c.column_name}>{c.column_name}</SelectItem>))}</SelectContent>
                      </Select>
                      <Select value={dateCol} onValueChange={setDateCol} disabled={!table}>
                        <SelectTrigger><SelectValue placeholder="Coluna de data" /></SelectTrigger>
                        <SelectContent>{columns.map(c=> (<SelectItem key={c.column_name} value={c.column_name}>{c.column_name}</SelectItem>))}</SelectContent>
                      </Select>
                      <Select value={chartType} onValueChange={setChartType}>
                        <SelectTrigger><SelectValue placeholder="Tipo de gráfico" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bar">Barras</SelectItem>
                          <SelectItem value="line">Linhas</SelectItem>
                          <SelectItem value="pie">Pizza</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Select value={groupBy} onValueChange={setGroupBy}>
                        <SelectTrigger><SelectValue placeholder="Agrupar por (data)" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem agrupamento</SelectItem>
                          <SelectItem value="day">Dia</SelectItem>
                          <SelectItem value="month">Mês</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={filterColumn} onValueChange={setFilterColumn}>
                        <SelectTrigger><SelectValue placeholder="Filtro (coluna)" /></SelectTrigger>
                        <SelectContent>{columns.map(c=> (<SelectItem key={c.column_name} value={c.column_name}>{c.column_name}</SelectItem>))}</SelectContent>
                      </Select>
                      <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contains">Contém</SelectItem>
                          <SelectItem value="notContains">Não contém</SelectItem>
                          <SelectItem value="equals">Igual</SelectItem>
                          <SelectItem value="notEquals">Diferente</SelectItem>
                          <SelectItem value="greaterThan">Maior que</SelectItem>
                          <SelectItem value="lessThan">Menor que</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input placeholder="Valor" value={filterValue} onChange={(e)=> setFilterValue(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">Filtros adicionais</div>
                      {filters.map((f, idx) => (
                        <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-2">
                          <Select value={f.column} onValueChange={(v)=> setFilters(prev => prev.map((x,i)=> i===idx? { ...x, column: v } : x))}>
                            <SelectTrigger><SelectValue placeholder="Coluna" /></SelectTrigger>
                            <SelectContent>{columns.map(c=> (<SelectItem key={c.column_name} value={c.column_name}>{c.column_name}</SelectItem>))}</SelectContent>
                          </Select>
                          <Select value={f.type || 'contains'} onValueChange={(v)=> setFilters(prev => prev.map((x,i)=> i===idx? { ...x, type: v } : x))}>
                            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="contains">Contém</SelectItem>
                              <SelectItem value="notContains">Não contém</SelectItem>
                              <SelectItem value="equals">Igual</SelectItem>
                              <SelectItem value="notEquals">Diferente</SelectItem>
                              <SelectItem value="greaterThan">Maior que</SelectItem>
                              <SelectItem value="lessThan">Menor que</SelectItem>
                              <SelectItem value="greaterThanOrEqual">Maior/Igual</SelectItem>
                              <SelectItem value="lessThanOrEqual">Menor/Igual</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input placeholder="Valor" value={String(f.value ?? '')} onChange={(e)=> setFilters(prev => prev.map((x,i)=> i===idx? { ...x, value: e.target.value } : x))} />
                          <div className="flex items-center"><Button variant="outline" onClick={()=> setFilters(prev => prev.filter((_,i)=> i!==idx))}>Remover</Button></div>
                        </div>
                      ))}
                      <Button size="sm" variant="outline" onClick={()=> setFilters(prev => [...prev, { column: '', type: 'contains', value: '' }])}>Adicionar filtro</Button>
                    </div>
                    <div className="flex items-center gap-3">
                      <Checkbox checked={showTable} onCheckedChange={(v)=> setShowTable(Boolean(v))} id="show-table" />
                      <Label htmlFor="show-table">Mostrar tabela dinâmica ao lado do gráfico</Label>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button onClick={createChart} variant="outline">Pré-visualizar</Button>
                      <Button onClick={() => {
                        if (!table || !xCol || (agg === 'sum' && !yCol)) return
                        const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`
                        const newItem = { id, table, xCol, yCol, agg, chartType, dateCol, groupBy, filters, showTable, title: `${chartType} ${table} por ${xCol}`, order: (saved[saved.length-1]?.order || 0) + 1 }
                        const next = [...saved, newItem]
                        setSaved(next)
                        if (userId) localStorage.setItem(`charts:${userId}`, JSON.stringify(next))
                        setOpenCreate(false)
                      }}>Salvar gráfico</Button>
                    </div>
                    {error && (<div className="bg-destructive/10 text-destructive px-4 py-2 rounded border border-destructive/20 text-sm">{error}</div>)}
                    {data.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="h-[360px]">
                          <ResponsiveContainer width="100%" height="100%">
                            {chartType === 'bar' ? (
                              <BarChart data={data}><XAxis dataKey="x" /><YAxis /><Tooltip /><Legend /><Bar dataKey="y" fill="#1f77b4" /></BarChart>
                            ) : chartType === 'line' ? (
                              <LineChart data={data}><XAxis dataKey="x" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="y" stroke="#1f77b4" /></LineChart>
                            ) : (
                              <PieChart><Tooltip /><Legend /><Pie data={data} dataKey="y" nameKey="x" outerRadius={140} label>{data.map((e,i)=>(<Cell key={i} fill={COLORS[i%COLORS.length]} />))}</Pie></PieChart>
                            )}
                          </ResponsiveContainer>
                        </div>
                        {showTable && (
                          <div className="border rounded">
                            <Table>
                              <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead>Valor</TableHead></TableRow></TableHeader>
                              <TableBody>{data.map((r,idx)=>(<TableRow key={idx}><TableCell>{r.x}</TableCell><TableCell>{agg==='sum'? fmtBRL(r.y) : r.y}</TableCell></TableRow>))}</TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {Object.keys(totaisPorTabela).length > 0 && (
            <div className="mt-2 text-xs text-muted-foreground flex gap-3 flex-wrap">
              {Object.entries(totaisPorTabela).map(([t, v]) => (
                <div key={t} className="px-2 py-1 rounded border bg-muted/30"><span className="font-medium">{t}:</span> {fmtBRL(v)}</div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Meus gráficos</CardTitle>
              <CardDescription>Arraste para reordenar. Clique em excluir para remover.</CardDescription>
            </CardHeader>
            <CardContent>
              {saved.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhum gráfico salvo ainda.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {saved.map((c, idx) => (
                    <div key={c.id} className="border rounded-lg p-2 bg-background" draggable
                         onDragStart={(e)=> e.dataTransfer.setData('text/chart-id', c.id)}
                         onDragOver={(e)=> e.preventDefault()}
                         onDrop={(e)=> {
                           const id = e.dataTransfer.getData('text/chart-id')
                           if (!id || id === c.id) return
                           const current = [...saved]
                           const fromIdx = current.findIndex(ci => ci.id === id)
                           const toIdx = current.findIndex(ci => ci.id === c.id)
                           if (fromIdx === -1 || toIdx === -1) return
                           const [moved] = current.splice(fromIdx, 1)
                           current.splice(toIdx, 0, moved)
                           current.forEach((ci, i) => ci.order = i+1)
                           setSaved(current)
                           if (userId) localStorage.setItem(`charts:${userId}`, JSON.stringify(current))
                         }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium truncate">{c.title}</div>
                        <Button size="sm" variant="outline" onClick={()=>{
                          const next = saved.filter(s => s.id !== c.id)
                          setSaved(next)
                          if (userId) localStorage.setItem(`charts:${userId}`, JSON.stringify(next))
                        }}>Excluir</Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="w-full h-[240px]">
                          <ResponsiveContainer width="100%" height="100%">
                            {c.chartType === 'bar' ? (
                              <BarChart data={chartDataMap[c.id] || []}><XAxis dataKey="x" /><YAxis /><Tooltip /><Bar dataKey="y" fill="#1f77b4" /></BarChart>
                            ) : c.chartType === 'line' ? (
                              <LineChart data={chartDataMap[c.id] || []}><XAxis dataKey="x" /><YAxis /><Tooltip /><Line type="monotone" dataKey="y" stroke="#1f77b4" /></LineChart>
                            ) : (
                              <PieChart><Tooltip /><Pie data={chartDataMap[c.id] || []} dataKey="y" nameKey="x" outerRadius={90}>{(chartDataMap[c.id] || []).map((e,i)=>(<Cell key={i} fill={COLORS[i%COLORS.length]} />))}</Pie></PieChart>
                            )}
                          </ResponsiveContainer>
                        </div>
                        {c.showTable && (
                          <div className="border rounded overflow-auto">
                            <Table>
                              <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead>Valor</TableHead></TableRow></TableHeader>
                              <TableBody>{(chartDataMap[c.id] || []).map((r,idx)=>(<TableRow key={idx}><TableCell>{r.x}</TableCell><TableCell>{c.agg==='sum'? fmtBRL(r.y) : r.y}</TableCell></TableRow>))}</TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* (Removido) Consulta em lote (CSV) */}
      </div>
    </div>
  )
}
