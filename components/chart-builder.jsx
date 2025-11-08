"use client"

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell, LineChart, Line } from 'recharts'

export default function ChartBuilder() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Fonte e filtros
  const [dataSource, setDataSource] = useState('by_number') // by_number | series
  const [periodType, setPeriodType] = useState('7d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [credentials, setCredentials] = useState([])
  const [selectedCredentialId, setSelectedCredentialId] = useState('')
  const [phoneNumbers, setPhoneNumbers] = useState([])
  const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState('') // opcional (para series)

  // Métricas e apresentação
  const [metric, setMetric] = useState('sent') // sent|delivered|received (by_number) ou status em series
  const [chartType, setChartType] = useState('bar') // bar|line|pie
  const [topN, setTopN] = useState(10)

  // Dados
  const [rows, setRows] = useState([]) // by_number rows ou series rows

  function computeRange() {
    const now = new Date()
    if (periodType === 'today') {
      const s = new Date(); s.setUTCHours(0,0,0,0)
      return { start: s.toISOString(), end: now.toISOString() }
    }
    if (periodType === '7d') {
      const s = new Date(Date.now() - 6*24*60*60*1000); s.setUTCHours(0,0,0,0)
      return { start: s.toISOString(), end: now.toISOString() }
    }
    if (periodType === '30d') {
      const s = new Date(Date.now() - 29*24*60*60*1000); s.setUTCHours(0,0,0,0)
      return { start: s.toISOString(), end: now.toISOString() }
    }
    const s = customStart ? new Date(`${customStart}T00:00:00.000Z`) : new Date()
    const e = customEnd ? new Date(`${customEnd}T23:59:59.999Z`) : new Date()
    return { start: s.toISOString(), end: e.toISOString() }
  }

  useEffect(() => {
    ;(async () => {
      try {
        setError('')
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        const res = await fetch('/api/disparo-api/credentials', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const data = await res.json()
        if (res.ok) setCredentials(Array.isArray(data?.credentials) ? data.credentials : [])
      } catch { setError('Falha ao carregar credenciais') }
    })()
  }, [])

  // Carregar números quando seleciona credencial
  useEffect(() => {
    ;(async () => {
      if (!selectedCredentialId) { setPhoneNumbers([]); setSelectedPhoneNumberId(''); return }
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        const res = await fetch(`/api/disparo-api/meta/phone-numbers?credential_id=${encodeURIComponent(selectedCredentialId)}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const data = await res.json()
        if (res.ok) setPhoneNumbers(data?.numbers || [])
      } catch {}
    })()
  }, [selectedCredentialId])

  const refresh = async () => {
    if (!selectedCredentialId) return
    try {
      setLoading(true)
      setError('')
      const { start, end } = computeRange()
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (dataSource === 'by_number') {
        const qp = [
          `credential_id=${encodeURIComponent(selectedCredentialId)}`,
          `start=${encodeURIComponent(start)}`,
          `end=${encodeURIComponent(end)}`,
        ]
        const res = await fetch(`/api/disparo-api/meta/insights/by-number?${qp.join('&')}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const json = await res.json()
        if (res.ok) setRows(Array.isArray(json?.rows) ? json.rows : [])
        else setError(json?.error || 'Falha ao buscar dados')
      } else {
        const qp = [
          `status=${encodeURIComponent(metric)}`,
          `start=${encodeURIComponent(start)}`,
          `end=${encodeURIComponent(end)}`,
          `credential_id=${encodeURIComponent(selectedCredentialId)}`,
          ...(selectedPhoneNumberId ? [`phone_number_id=${encodeURIComponent(selectedPhoneNumberId)}`] : []),
        ]
        const res = await fetch(`/api/disparo-api/meta/events/series?${qp.join('&')}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const json = await res.json()
        if (res.ok) setRows(Array.isArray(json?.series) ? json.series : [])
        else setError(json?.error || 'Falha ao buscar série')
      }
    } catch { setError('Erro inesperado ao carregar dados') }
    finally { setLoading(false) }
  }

  useEffect(() => { refresh() }, [dataSource, metric, periodType, customStart, customEnd, selectedCredentialId, selectedPhoneNumberId])

  // Preparar dados para os gráficos
  const mappedRows = useMemo(() => {
    if (dataSource === 'by_number') {
      const map = new Map((phoneNumbers||[]).map(p => [p.id, p.display_phone_number]))
      const items = (rows||[]).map(r => ({
        id: r.phone_number_id,
        label: map.get(r.phone_number_id) || (r.phone_number_id || '-'),
        value: Number(r[metric] || 0)
      }))
      // ordenar e limitar topN
      return items.sort((a,b)=>b.value-a.value).slice(0, Math.max(1, parseInt(topN||10,10)))
    } else {
      // series: rows = [{ date, value }]
      return (rows||[]).map(r => ({ label: r.date, value: Number(r.value||0) }))
    }
  }, [rows, phoneNumbers, metric, topN, dataSource])

  const downloadCsv = () => {
    if (!mappedRows || !mappedRows.length) return
    const header = dataSource === 'by_number' ? ['label','phone_number_id','value'] : ['date','value']
    const body = dataSource === 'by_number'
      ? mappedRows.map(r => [r.label, r.id || '', r.value])
      : mappedRows.map(r => [r.label, r.value])
    const csv = [header.join(',')].concat(body.map(r => r.join(','))).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'grafico_dinamico.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gráfico Dinâmico</CardTitle>
        <CardDescription>Monte gráficos como em planilhas: escolha a fonte, métrica, agrupamento e tipo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? <div className="text-red-600 text-sm">{error}</div> : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Fonte</Label>
            <Select value={dataSource} onValueChange={setDataSource}>
              <SelectTrigger><SelectValue placeholder="Selecione a fonte" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="by_number">Por número (enviadas/entregues/recebidas)</SelectItem>
                <SelectItem value="series">Série por dia (status)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Credencial</Label>
            <Select value={selectedCredentialId} onValueChange={setSelectedCredentialId}>
              <SelectTrigger><SelectValue placeholder="Selecione a credencial" /></SelectTrigger>
              <SelectContent>
                {credentials.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.label || c.waba_id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {dataSource === 'series' && (
            <div className="space-y-2">
              <Label>Phone Number (opcional)</Label>
              <Select value={selectedPhoneNumberId} onValueChange={setSelectedPhoneNumberId}>
                <SelectTrigger><SelectValue placeholder="Todos os números" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {phoneNumbers.map(n => (
                    <SelectItem key={n.id} value={n.id}>{n.display_phone_number} ({n.id.slice(-6)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Métrica</Label>
            <Select value={metric} onValueChange={setMetric}>
              <SelectTrigger><SelectValue placeholder="Selecione a métrica" /></SelectTrigger>
              <SelectContent>
                {dataSource === 'by_number' ? (
                  <>
                    <SelectItem value="sent">Enviadas</SelectItem>
                    <SelectItem value="delivered">Entregues</SelectItem>
                    <SelectItem value="received">Recebidas</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="sent">Enviadas</SelectItem>
                    <SelectItem value="delivered">Entregues</SelectItem>
                    <SelectItem value="read">Lidas</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Período</Label>
            <Select value={periodType} onValueChange={setPeriodType}>
              <SelectTrigger><SelectValue placeholder="Selecione o Período" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {periodType === 'custom' && (
            <>
              <div className="space-y-2">
                <Label>Início</Label>
                <Input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fim</Label>
                <Input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label>Tipo de gráfico</Label>
            <Select value={chartType} onValueChange={setChartType}>
              <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Barras</SelectItem>
                <SelectItem value="line">Linha</SelectItem>
                <SelectItem value="pie">Pizza</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {dataSource === 'by_number' && (
            <div className="space-y-2">
              <Label>Top N</Label>
              <Input type="number" min={1} max={50} value={topN} onChange={e=>setTopN(e.target.value)} />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={refresh} disabled={loading} variant="outline">Atualizar</Button>
          <Button onClick={downloadCsv} variant="outline">Baixar CSV</Button>
        </div>

        <Separator />

        {/* Renderização dinâmica */}
        {(() => {
          if (!mappedRows || !mappedRows.length) return <div className="text-sm text-muted-foreground">Sem dados no período selecionado.</div>
          if (chartType === 'pie') {
            const config = {}
            return (
              <ChartContainer config={config} className="h-72">
                <PieChart>
                  <Pie data={mappedRows} dataKey="value" nameKey="label" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {mappedRows.map((d, idx) => (
                      <Cell key={idx} fill={`hsl(${(idx*47)%360} 70% 55%)`} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                </PieChart>
              </ChartContainer>
            )
          }
          if (dataSource === 'series') {
            if (chartType === 'line') {
              return (
                <ChartContainer config={{}} className="h-72">
                  <LineChart data={mappedRows}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent hideIndicator />} />
                    <Line type="monotone" dataKey="value" stroke="hsl(210 90% 60%)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ChartContainer>
              )
            }
            return (
              <ChartContainer config={{}} className="h-72">
                <BarChart data={mappedRows}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Bar dataKey="value" fill="hsl(210 90% 60%)" />
                </BarChart>
              </ChartContainer>
            )
          }
          // by_number
          if (chartType === 'line') {
            return (
              <ChartContainer config={{}} className="h-72">
                <LineChart data={mappedRows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={70} />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent hideIndicator />} />
                  <Line type="monotone" dataKey="value" stroke="hsl(210 90% 60%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            )
          }
          return (
            <ChartContainer config={{}} className="h-72">
              <BarChart data={mappedRows}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={70} />
                <YAxis allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey="value" fill="hsl(210 90% 60%)" />
              </BarChart>
            </ChartContainer>
          )
        })()}

        {/* Preview em tabela */}
        <div className="border rounded">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{dataSource === 'series' ? 'Data' : 'Número'}</TableHead>
                {dataSource === 'by_number' && <TableHead>Phone Number ID</TableHead>}
                <TableHead>Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappedRows.map((r, idx) => (
                <TableRow key={idx}>
                  <TableCell>{r.label}</TableCell>
                  {dataSource === 'by_number' && <TableCell>{r.id || '-'}</TableCell>}
                  <TableCell>{r.value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

