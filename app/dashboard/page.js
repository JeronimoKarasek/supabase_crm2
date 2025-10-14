"use client"

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { Database } from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend
} from 'recharts'

const COLORS = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf']

const parseMoney = (val) => {
  if (typeof val === 'number') return val
  if (val === null || typeof val === 'undefined') return 0
  const s = String(val).trim()
  if (!s) return 0
  const cleaned = s.replace(/\./g, '').replace(/,/g, '.').replace(/[^0-9.\-]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}
const fmtBRL = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n || 0))

export default function DashboardPage() {
  const [tables, setTables] = useState([])
  const [table, setTable] = useState('')
  const [columns, setColumns] = useState([])
  const [xCol, setXCol] = useState('')
  const [yCol, setYCol] = useState('')
  const [agg, setAgg] = useState('count') // count | sum
  const [chartType, setChartType] = useState('bar') // bar | line | pie
  const [groupBy, setGroupBy] = useState('none') // none | day | month
  const [filterColumn, setFilterColumn] = useState('')
  const [filterType, setFilterType] = useState('contains')
  const [filterValue, setFilterValue] = useState('')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState([]) // [{id, table, xCol, yCol, agg, chartType, title, order}]
  const [loadingSaved, setLoadingSaved] = useState(false)
  const [valorPago, setValorPago] = useState(0)
  const [totaisPorTabela, setTotaisPorTabela] = useState({}) // { [table]: total }
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')

  const [userId, setUserId] = useState('')
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data?.user?.id || '')) }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        const res = await fetch('/api/tables', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const json = await res.json()
        if (res.ok) setTables(json.tables || [])
        else setError(json.error || 'Falha ao listar tabelas')
      } catch (e) {
        setError('Falha ao carregar tabelas')
      }
    })()
  }, [])

  // Load saved charts and valorPago list
  useEffect(() => {
    if (!userId) return
    try {
      const raw = localStorage.getItem(`charts:${userId}`)
      const arr = raw ? JSON.parse(raw) : []
      setSaved(Array.isArray(arr) ? arr : [])
    } catch {}

    ;(async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        const sres = await fetch('/api/global-settings')
        const sjson = await sres.json()
        const list = Array.isArray(sjson?.settings?.valorPagoList) ? sjson.settings.valorPagoList : (sjson?.settings?.valorPago ? [sjson.settings.valorPago] : [])
        if (list.length) {
          let sum = 0
          const porTabela = {}
          for (const cfg of list) {
            if (!(cfg?.table && cfg?.sumColumn)) continue
            const url = new URL('/api/aggregate', window.location.origin)
            url.searchParams.set('table', cfg.table)
            url.searchParams.set('sumColumn', cfg.sumColumn)
            if (cfg.cond?.column && cfg.cond?.value) {
              url.searchParams.set('condColumn', cfg.cond.column)
              url.searchParams.set('condType', cfg.cond.type || 'contains')
              url.searchParams.set('condValue', cfg.cond.value)
            }
            if (periodStart) url.searchParams.set('periodStart', periodStart)
            if (periodEnd) url.searchParams.set('periodEnd', periodEnd)
            const res = await fetch(url.toString(), { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
            const json = await res.json()
            if (res.ok) {
              const val = Number(json.total) || 0
              sum += val
              porTabela[cfg.table] = (porTabela[cfg.table] || 0) + val
            }
          }
          setValorPago(sum)
          setTotaisPorTabela(porTabela)
        } else {
          setValorPago(0)
          setTotaisPorTabela({})
        }
      } catch {}
    })()
  }, [userId, periodStart, periodEnd])

  useEffect(() => {
    ;(async () => {
      if (!table) { setColumns([]); return }
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        const res = await fetch(`/api/table-columns?table=${encodeURIComponent(table)}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const json = await res.json()
        if (res.ok) setColumns(json.columns || [])
      } catch {}
    })()
  }, [table])

  const [chartDataMap, setChartDataMap] = useState({}) // id -> data
  useEffect(() => {
    ;(async () => {
      if (!saved.length) { setChartDataMap({}); return }
      setLoadingSaved(true)
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        const map = {}
        for (const c of saved) {
          const qs = new URLSearchParams({ table: c.table, page: '1', pageSize: '1000' })
          if (periodStart) qs.set('periodStart', periodStart)
          if (periodEnd) qs.set('periodEnd', periodEnd)
          const res = await fetch(`/api/table-data?${qs.toString()}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
          const json = await res.json()
          const rows = json.data || []
          const aggMap = new Map()
          for (const r of rows) {
            const xv = r[c.xCol]
            const yv = c.agg === 'sum' ? parseMoney(r[c.yCol]) : 1
            aggMap.set(xv, (aggMap.get(xv) || 0) + yv)
          }
          map[c.id] = Array.from(aggMap.entries()).map(([x,y]) => ({ x, y }))
        }
        setChartDataMap(map)
      } finally {
        setLoadingSaved(false)
      }
    })()
  }, [saved, periodStart, periodEnd])

  const createChart = async () => {
    setLoading(true)
    setError('')
    try {
      if (!table || !xCol || (agg === 'sum' && !yCol)) {
        setError('Selecione tabela, coluna X e (se soma) coluna Y')
        setLoading(false)
        return
      }
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const qs = new URLSearchParams({ table, page: '1', pageSize: '1000' })
      if (periodStart) qs.set('periodStart', periodStart)
      if (periodEnd) qs.set('periodEnd', periodEnd)
      if (filterColumn && filterValue) {
        qs.set('filterColumn', filterColumn)
        qs.set('filterType', filterType)
        qs.set('filterValue', filterValue)
      }
      const res = await fetch(`/api/table-data?${qs.toString()}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Falha ao buscar dados')
        setLoading(false)
        return
      }
      const rows = json.data || []
      const dateCol = 'horario da ultima resposta'
      const map = new Map()
      for (const r of rows) {
        let xv = r[xCol]
        if (groupBy !== 'none' && r[dateCol]) {
          const d = new Date(r[dateCol])
          if (isFinite(d)) {
            xv = groupBy === 'day'
              ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
              : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
          }
        }
        const yv = agg === 'sum' ? parseMoney(r[yCol]) : 1
        map.set(xv, (map.get(xv) || 0) + yv)
      }
      const out = Array.from(map.entries()).map(([x, y]) => ({ x, y }))
      setData(out)
    } catch (e) {
      setError('Falha ao criar gráfico')
    } finally {
      setLoading(false)
    }
  }

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
                <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="h-8 w-auto" />
                <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="h-8 w-auto" />
              </div>
              <div className="text-sm font-medium">Total Pago: <span className="font-semibold">{fmtBRL(valorPago)}</span></div>
            </div>
            {Object.keys(totaisPorTabela).length > 0 && (
              <div className="mt-2 text-xs text-muted-foreground flex gap-3 flex-wrap">
                {Object.entries(totaisPorTabela).map(([t, v]) => (
                  <div key={t} className="px-2 py-1 rounded border bg-muted/30">
                    <span className="font-medium">{t}:</span> {fmtBRL(v)}
                  </div>
                ))}
              </div>
            )}
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Criar gráfico</CardTitle>
            <CardDescription>Escolha a tabela, colunas e tipo de gráfico</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <Select value={table} onValueChange={(v) => { setTable(v); setXCol(''); setYCol('') }}>
                <SelectTrigger>
                  <SelectValue placeholder="Tabela" />
                </SelectTrigger>
                <SelectContent>
                  {tables.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={xCol} onValueChange={setXCol} disabled={!table}>
                <SelectTrigger>
                  <SelectValue placeholder="Coluna X (agrupamento)" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map(c => (
                    <SelectItem key={c.column_name} value={c.column_name}>{c.column_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={agg} onValueChange={setAgg}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="count">Contagem de linhas</SelectItem>
                  <SelectItem value="sum">Soma de coluna</SelectItem>
                </SelectContent>
              </Select>

              <Select value={yCol} onValueChange={setYCol} disabled={agg !== 'sum'}>
                <SelectTrigger>
                  <SelectValue placeholder="Coluna Y (qualquer)" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map(c => (
                    <SelectItem key={c.column_name} value={c.column_name}>{c.column_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={chartType} onValueChange={setChartType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Barras</SelectItem>
                  <SelectItem value="line">Linhas</SelectItem>
                  <SelectItem value="pie">Pizza</SelectItem>
                </SelectContent>
              </Select>

              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem agrupamento por data</SelectItem>
                  <SelectItem value="day">Agrupar por dia</SelectItem>
                  <SelectItem value="month">Agrupar por mês</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Optional filter for chart */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Select value={filterColumn} onValueChange={setFilterColumn}>
                <SelectTrigger>
                  <SelectValue placeholder="Coluna (filtro opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map(c => (
                    <SelectItem key={c.column_name} value={c.column_name}>{c.column_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">Contém</SelectItem>
                  <SelectItem value="notContains">Não contém</SelectItem>
                  <SelectItem value="equals">Igual</SelectItem>
                  <SelectItem value="notEquals">Diferente</SelectItem>
                  <SelectItem value="greaterThan">Maior que</SelectItem>
                  <SelectItem value="lessThan">Menor que</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder="Valor do filtro" value={filterValue} onChange={(e) => setFilterValue(e.target.value)} />
            </div>

            <div className="flex gap-2 justify-end">
              <Button onClick={createChart} variant="outline" disabled={!table || !xCol || (agg === 'sum' && !yCol) || loading}>
                {loading ? 'Gerando...' : 'Pré-visualizar'}
              </Button>
              <Button onClick={() => {
                if (!table || !xCol || (agg === 'sum' && !yCol)) return
                const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`
                const newItem = { id, table, xCol, yCol, agg, chartType, title: `${chartType} ${table} por ${xCol}`, order: (saved[saved.length-1]?.order || 0) + 1 }
                const next = [...saved, newItem]
                setSaved(next)
                if (userId) localStorage.setItem(`charts:${userId}`, JSON.stringify(next))
              }}>Salvar no Dashboard</Button>
            </div>

            {error && (
              <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg border border-destructive/20 text-sm">{error}</div>
            )}

            {data.length > 0 && (
              <div className="h-[420px]">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'bar' ? (
                    <BarChart data={data}>
                      <XAxis dataKey="x" /><YAxis /><Tooltip /><Legend />
                      <Bar dataKey="y" fill="#1f77b4" />
                    </BarChart>
                  ) : chartType === 'line' ? (
                    <LineChart data={data}>
                      <XAxis dataKey="x" /><YAxis /><Tooltip /><Legend />
                      <Line type="monotone" dataKey="y" stroke="#1f77b4" />
                    </LineChart>
                  ) : (
                    <PieChart>
                      <Tooltip /><Legend />
                      <Pie data={data} dataKey="y" nameKey="x" outerRadius={150} label>
                        {data.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Saved charts grid */}
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
                    <div key={c.id}
                         className="border rounded-lg p-2 bg-background"
                         draggable
                         onDragStart={(e) => e.dataTransfer.setData('text/chart-id', c.id)}
                         onDragOver={(e) => e.preventDefault()}
                         onDrop={(e) => {
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
                        <Button size="sm" variant="outline" onClick={() => {
                          const next = saved.filter(s => s.id !== c.id)
                          setSaved(next)
                          if (userId) localStorage.setItem(`charts:${userId}`, JSON.stringify(next))
                        }}>Excluir</Button>
                      </div>
                      <div className="w-full h-[240px]">
                        <ResponsiveContainer width="100%" height="100%">
                          {c.chartType === 'bar' ? (
                            <BarChart data={chartDataMap[c.id] || []}>
                              <XAxis dataKey="x" /><YAxis /><Tooltip />
                              <Bar dataKey="y" fill="#1f77b4" />
                            </BarChart>
                          ) : c.chartType === 'line' ? (
                            <LineChart data={chartDataMap[c.id] || []}>
                              <XAxis dataKey="x" /><YAxis /><Tooltip />
                              <Line type="monotone" dataKey="y" stroke="#1f77b4" />
                            </LineChart>
                          ) : (
                            <PieChart>
                              <Tooltip />
                              <Pie data={chartDataMap[c.id] || []} dataKey="y" nameKey="x" outerRadius={90}>
                                {(chartDataMap[c.id] || []).map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                            </PieChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
