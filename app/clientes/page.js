"use client"

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Database, Filter, Search, X, Download, ChevronLeft, ChevronRight, Send, Upload, Plus } from 'lucide-react'
import { exportToCsv } from '@/lib/export'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'

export default function App() {
  const [tables, setTables] = useState([])
  const [selectedTable, setSelectedTable] = useState('')
  const [tableData, setTableData] = useState([])
  const [columns, setColumns] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 100
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [filtersList, setFiltersList] = useState([])
  const [exportingAll, setExportingAll] = useState(false)
  
  // Filter state
  const [filterColumn, setFilterColumn] = useState('')
  const [filterValue, setFilterValue] = useState('')
  const [filterType, setFilterType] = useState('contains')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [sendOpen, setSendOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [banks, setBanks] = useState([])
  const [products, setProducts] = useState([])
  const [sendBank, setSendBank] = useState('')
  const [sendProduct, setSendProduct] = useState('')
  const [canSendBatch, setCanSendBatch] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({})
  const [addLoading, setAddLoading] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importTable, setImportTable] = useState('')
  const [importFileName, setImportFileName] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState('')
  const [importColumns, setImportColumns] = useState([])

  // Fetch all tables on mount
  useEffect(() => {
    fetchTables()
  }, [])

  // Load products and banks for sending to batch
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/global-settings')
        const json = await res.json()
        if (res.ok) {
          setBanks(Array.isArray(json?.settings?.banks) ? json.settings.banks : [])
          setProducts(Array.isArray(json?.settings?.products) ? json.settings.products : [])
        }
      } catch {}
    })()
  }, [])

  // Determine permission to send to batch (sector: Consulta em lote or admin)
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

  // Load columns for import dialog when table changes
  useEffect(() => {
    ;(async () => {
      if (!importTable) { setImportColumns([]); return }
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        const response = await fetch(`/api/table-columns?table=${encodeURIComponent(importTable)}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const data = await response.json()
        if (response.ok) setImportColumns(data.columns || [])
      } catch {}
    })()
  }, [importTable])

  // Fetch table data when selected table changes
  useEffect(() => {
    if (selectedTable) {
      fetchTableData()
      fetchTableColumns()
    }
  }, [selectedTable, page])

  const fetchTables = async () => {
    try {
      setLoading(true)
      setError('')
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const response = await fetch('/api/tables', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      const data = await response.json()
      
      if (response.ok) {
        setTables(data.tables || [])
      } else {
        setError(data.error || 'Failed to fetch tables')
      }
    } catch (err) {
      setError('Failed to connect to the server')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchTableColumns = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const response = await fetch(`/api/table-columns?table=${selectedTable}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      const data = await response.json()
      
      if (response.ok) {
        setColumns(data.columns || [])
      }
    } catch (err) {
      console.error('Failed to fetch columns:', err)
    }
  }

  const fetchTableData = async (applyFilter = false) => {
    try {
      setLoading(true)
      setError('')
      
      let url = `/api/table-data?table=${selectedTable}&page=${page}&pageSize=${pageSize}`
      if (periodStart) url += `&periodStart=${encodeURIComponent(periodStart)}`
      if (periodEnd) url += `&periodEnd=${encodeURIComponent(periodEnd)}`

      if (applyFilter && filterColumn && filterValue) {
        url += `&filterColumn=${encodeURIComponent(filterColumn)}&filterValue=${encodeURIComponent(filterValue)}&filterType=${encodeURIComponent(filterType)}`
      }
      if (filtersList && filtersList.length > 0) {
        try {
          url += `&filters=${encodeURIComponent(JSON.stringify(filtersList))}`
        } catch {}
      }
      
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      const data = await response.json()
      
      if (response.ok) {
        setTableData(data.data || [])
        setTotal(data.count || 0)
        setTotalPages(data.totalPages || 1)
      } else {
        setError(data.error || 'Failed to fetch table data')
        setTableData([])
      }
    } catch (err) {
      setError('Failed to fetch table data')
      setTableData([])
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const applyFilter = () => {
    setPage(1)
    fetchTableData(true)
  }

  const clearFilter = () => {
    setFilterColumn('')
    setFilterValue('')
    setFilterType('contains')
    setPeriodStart('')
    setPeriodEnd('')
    setFiltersList([])
    setPage(1)
    fetchTableData(false)
  }

  const getFilterTypeLabel = (type) => {
    const labels = {
      contains: 'Contains',
      equals: 'Equals',
      greaterThan: 'Greater Than',
      lessThan: 'Less Than',
      greaterThanOrEqual: 'Greater or Equal',
      lessThanOrEqual: 'Less or Equal'
    }
    return labels[type] || type
  }

  const getDataType = (columnName) => {
    const column = columns.find(c => c.column_name === columnName)
    return column?.data_type || 'text'
  }

  const isNumericType = (dataType) => {
    return ['integer', 'bigint', 'numeric', 'real', 'double precision', 'smallint'].includes(dataType?.toLowerCase())
  }

  const isDateType = (dataType) => {
    return ['timestamp', 'date', 'time'].some(t => dataType?.toLowerCase().includes(t))
  }

  const renderFilterOptions = () => {
    if (!filterColumn) return null
    
    const dataType = getDataType(filterColumn)
    
    if (isNumericType(dataType)) {
      return (
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="equals">Equals</SelectItem>
            <SelectItem value="notEquals">Not Equal</SelectItem>
            <SelectItem value="greaterThan">Greater Than</SelectItem>
            <SelectItem value="lessThan">Less Than</SelectItem>
            <SelectItem value="greaterThanOrEqual">Greater or Equal</SelectItem>
            <SelectItem value="lessThanOrEqual">Less or Equal</SelectItem>
          </SelectContent>
        </Select>
      )
    }
    
    if (isDateType(dataType)) {
      return (
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="equals">Equals</SelectItem>
            <SelectItem value="greaterThan">After</SelectItem>
            <SelectItem value="lessThan">Before</SelectItem>
          </SelectContent>
        </Select>
      )
    }
    
    return (
      <Select value={filterType} onValueChange={setFilterType}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="contains">Contains</SelectItem>
          <SelectItem value="notContains">Does Not Contain</SelectItem>
          <SelectItem value="equals">Equals</SelectItem>
          <SelectItem value="notEquals">Not Equal</SelectItem>
        </SelectContent>
      </Select>
    )
  }

  const exportAll = async () => {
    if (!selectedTable) return
    try {
      setExportingAll(true)
      // Build base url with filters and period
      const baseParams = new URLSearchParams()
      baseParams.set('table', selectedTable)
      baseParams.set('pageSize', String(pageSize))
      if (periodStart) baseParams.set('periodStart', periodStart)
      if (periodEnd) baseParams.set('periodEnd', periodEnd)
      if (filtersList && filtersList.length > 0) {
        try { baseParams.set('filters', JSON.stringify(filtersList)) } catch {}
      }
      if (filterColumn && filterValue) {
        baseParams.set('filterColumn', filterColumn)
        baseParams.set('filterValue', String(filterValue))
        baseParams.set('filterType', filterType)
      }

      // First page to get totalPages
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const firstRes = await fetch(`/api/table-data?${baseParams.toString()}&page=1`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      const firstJson = await firstRes.json()
      if (!firstRes.ok) {
        throw new Error(firstJson?.error || 'Falha ao buscar dados para exportação')
      }
      const allRows = [...(firstJson?.data || [])]
      const totalPagesLocal = Math.max(1, parseInt(firstJson?.totalPages || 1, 10))

      for (let p = 2; p <= totalPagesLocal; p++) {
        const res = await fetch(`/api/table-data?${baseParams.toString()}&page=${p}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const json = await res.json()
        if (res.ok) {
          const rows = Array.isArray(json?.data) ? json.data : []
          if (rows.length) allRows.push(...rows)
        }
      }

      exportToCsv(allRows, `clientes_${selectedTable}_all.csv`)
    } catch (e) {
      console.error('Export all failed', e)
      setError(e?.message || 'Falha na exportação')
    } finally {
      setExportingAll(false)
    }
  }

  const sendToBatch = async () => {
    if (!selectedTable || !sendBank || !sendProduct) return
    try {
      setSending(true)
      // Build query like exportAll to fetch all filtered rows
      const baseParams = new URLSearchParams()
      baseParams.set('table', selectedTable)
      baseParams.set('pageSize', String(pageSize))
      if (periodStart) baseParams.set('periodStart', periodStart)
      if (periodEnd) baseParams.set('periodEnd', periodEnd)
      if (filtersList && filtersList.length > 0) {
        try { baseParams.set('filters', JSON.stringify(filtersList)) } catch {}
      }
      if (filterColumn && filterValue) {
        baseParams.set('filterColumn', filterColumn)
        baseParams.set('filterValue', String(filterValue))
        baseParams.set('filterType', filterType)
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const firstRes = await fetch(`/api/table-data?${baseParams.toString()}&page=1`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      const firstJson = await firstRes.json()
      if (!firstRes.ok) throw new Error(firstJson?.error || 'Falha ao buscar dados')
      const allRows = [...(firstJson?.data || [])]
      const totalPagesLocal = Math.max(1, parseInt(firstJson?.totalPages || 1, 10))
      for (let p = 2; p <= totalPagesLocal; p++) {
        const res = await fetch(`/api/table-data?${baseParams.toString()}&page=${p}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const json = await res.json()
        if (res.ok) {
          const rows = Array.isArray(json?.data) ? json.data : []
          if (rows.length) allRows.push(...rows)
        }
      }

      // Map rows to csv (nome,telefone,cpf)
      const norm = (s) => (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      const first = allRows[0] || {}
      const keys = Object.keys(first)
      const nameKey = keys.find(k => norm(k).includes('nome')) || 'nome'
      const phoneKey = keys.find(k => { const nk = norm(k); return nk.includes('telefone') || nk.includes('celular') || nk === 'fone' || nk.includes('phone') }) || 'telefone'
      const cpfKey = keys.find(k => norm(k) === 'cpf') || 'cpf'

      const esc = (val) => {
        if (val === null || typeof val === 'undefined') return ''
        const s = String(val)
        if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
        return s
      }
      const lines = ['nome,telefone,cpf']
      for (const row of allRows) {
        const nome = row?.[nameKey] ?? ''
        const telefone = row?.[phoneKey] ?? ''
        const cpf = row?.[cpfKey] ?? ''
        lines.push([esc(nome), esc(telefone), esc(cpf)].join(','))
      }
      const csv = lines.join('\n')

      // Send to importar API (same flow as Consulta em lote upload)
      const postRes = await fetch('/api/importar', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ csv, produto: sendProduct, banco: sendBank }) })
      const postJson = await postRes.json().catch(() => ({}))
      if (!postRes.ok) throw new Error(postJson?.error || 'Falha ao enviar para consulta em lote')

      setSendOpen(false)
      try { window.location.href = '/consulta-lote' } catch {}
    } catch (e) {
      setError(e?.message || 'Erro ao enviar para consulta em lote')
    } finally {
      setSending(false)
    }
  }

  const preferredInputOrder = ['Nome','cpf','telefone','instancia','saldo','status','respondeu','simulou','digitou','pausa ia','produto','proposta fgts','cliente']
  const norm = (s) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const orderedColumns = () => {
    const keys = (columns || []).map(c => c.column_name)
    const pref = preferredInputOrder.map(norm)
    const vis = keys.filter(k => pref.includes(norm(k)))
    vis.sort((a,b) => pref.indexOf(norm(a)) - pref.indexOf(norm(b)))
    if (vis.length === 0) return keys
    // include remaining keys at the end
    const remain = keys.filter(k => !vis.includes(k))
    return [...vis, ...remain]
  }

  const onAddSubmit = async () => {
    if (!selectedTable) { setAddOpen(false); return }
    try {
      setAddLoading(true)
      const payload = {}
      for (const [k,v] of Object.entries(addForm || {})) {
        if (v !== '' && typeof v !== 'undefined' && v !== null) payload[k] = v
      }
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/table-row', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ table: selectedTable, row: payload }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Falha ao inserir')
      setAddOpen(false)
      setAddForm({})
      // Refresh data
      fetchTableData(false)
    } catch (e) {
      setError(e?.message || 'Erro ao inserir')
    } finally {
      setAddLoading(false)
    }
  }

  const onImportTemplate = () => {
    const cols = (importColumns || []).map(c => c.column_name)
    if (!cols.length) return
    const header = cols.join(',')
    const blob = new Blob([header + '\n'], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `modelo_${importTable || 'tabela'}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const onImportOk = async () => {
    try {
      setImportError('')
      if (!importTable) throw new Error('Selecione a tabela')
      const input = document.getElementById('importFile')
      const file = input?.files?.[0]
      if (!file) throw new Error('Selecione um arquivo CSV')
      setImportLoading(true)
      const text = await file.text()
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
      if (lines.length < 2) throw new Error('Arquivo vazio')
      const headers = lines[0].split(',').map(h => h.trim())
      const tableCols = (importColumns || []).map(c => c.column_name)
      const keepIdx = headers.map((h, i) => ({ h, i })).filter(x => tableCols.includes(x.h))
      const rows = []
      for (let li = 1; li < lines.length; li++) {
        const parts = lines[li].split(',')
        const obj = {}
        for (const { h, i } of keepIdx) obj[h] = parts[i] ?? ''
        rows.push(obj)
      }
      // Insert in chunks
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const chunkSize = 500
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize)
        const res = await fetch('/api/table-row', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ table: importTable, rows: chunk }) })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Falha ao importar')
      }
      setImportOpen(false)
      if (selectedTable === importTable) fetchTableData(false)
    } catch (e) {
      setImportError(e?.message || 'Erro ao importar')
    } finally {
      setImportLoading(false)
      setImportFileName('')
      const input = document.getElementById('importFile'); if (input) input.value = ''
    }
  }

  return (
    <div className="-m-4 min-h-[calc(100vh-56px)] bg-background">
      <div className="container mx-auto py-6 px-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Database className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold text-foreground">Clientes</h1>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground">Visualize e filtre os dados dos clientes</p>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded border hover:bg-muted"
                disabled={!selectedTable}
                onClick={() => { setAddForm({}); setAddOpen(true) }}
              >
                <Plus className="h-4 w-4" /> Adicionar cliente
              </button>
              <button
                className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded border hover:bg-muted"
                disabled={!selectedTable || loading || exportingAll}
                onClick={() => exportAll()}
              >
                <Download className="h-4 w-4" /> Exportar Excel (tudo)
              </button>
              <button
                className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded border hover:bg-muted"
                onClick={() => { setImportTable(selectedTable || ''); setImportOpen(true) }}
              >
                <Upload className="h-4 w-4" /> Importar
              </button>
            </div>
          </div>
        </div>

        {/* Main Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Select a Table</CardTitle>
            <CardDescription>
              Choose a table from your Supabase database to view its data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Table Selector */}
            <div className="flex gap-4 items-center">
              <div className="flex-1">
                <Select value={selectedTable} onValueChange={(v) => { setSelectedTable(v); setPage(1) }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a table..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tables.map((table) => {
                      const tableName = typeof table === 'string' ? table : table.table_name
                      const displayName = typeof table === 'string' ? table : table.display_name
                      return (
                        <SelectItem key={tableName} value={tableName}>
                          {displayName}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
              {tables.length > 0 && (
                <Badge variant="secondary">
                  {tables.length} {tables.length === 1 ? 'table' : 'tables'}
                </Badge>
              )}
            </div>

            {/* Filters */}
            {selectedTable && columns.length > 0 && (
              <Card className="bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filters
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <Select value={filterColumn} onValueChange={setFilterColumn}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select column..." />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col) => (
                          <SelectItem key={col.column_name} value={col.column_name}>
                            {col.column_name} <span className="text-xs text-muted-foreground">({col.data_type})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {renderFilterOptions()}

                    <Input
                      placeholder="Filter value..."
                      value={filterValue}
                      onChange={(e) => setFilterValue(e.target.value)}
                      type={isNumericType(getDataType(filterColumn)) ? 'number' : isDateType(getDataType(filterColumn)) ? 'date' : 'text'}
                      disabled={!filterColumn}
                    />

                    <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} placeholder="Início" />
                    <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} placeholder="Fim" />

                    <div className="flex gap-2 flex-wrap">
                      <Button 
                        onClick={applyFilter} 
                        disabled={loading || (!filterColumn && !periodStart && !periodEnd)}
                      >
                        <Search className="h-4 w-4 mr-2" />
                        Aplicar
                      </Button>
                      <Button variant="outline" onClick={() => {
                        if (!filterColumn || !filterValue) return
                        setFiltersList(prev => [...prev, { column: filterColumn, type: filterType, value: filterValue }])
                        setFilterColumn(''); setFilterValue(''); setFilterType('contains')
                      }}>Adicionar filtro</Button>
                      <Button variant="outline" onClick={clearFilter} disabled={!filterColumn && !filterValue && filtersList.length===0 && !periodStart && !periodEnd}>
                        <X className="h-4 w-4" /> Limpar
                      </Button>
                      <Button variant="outline" onClick={exportAll} disabled={loading || exportingAll || !selectedTable}>
                        <Download className="h-4 w-4 mr-2" /> Exportar (tudo)
                      </Button>
                      {canSendBatch && (
                        <Button variant="outline" onClick={() => setSendOpen(true)} disabled={loading || !selectedTable}>
                          <Send className="h-4 w-4 mr-2" /> Enviar p/ consulta em lote
                        </Button>
                      )}
                    </div>
                    <div className="md:col-span-6 flex items-center gap-3 mt-2">
                      <Badge variant="outline">Total: {total}</Badge>
                      {exportingAll && <span className="text-xs text-muted-foreground">Exportando tudo...</span>}
                    </div>
                    {filtersList.length > 0 && (
                      <div className="md:col-span-6 flex flex-wrap gap-2">
                        {filtersList.map((f, idx) => (
                          <div key={idx} className="px-2 py-1 border rounded text-xs bg-muted/50 flex items-center gap-2">
                            <span>{f.column} {getFilterTypeLabel(f.type)} {String(f.value)}</span>
                            <button className="text-muted-foreground hover:text-destructive" onClick={() => setFiltersList(prev => prev.filter((_,i)=>i!==idx))}>remover</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Send to batch Dialog */}
            {canSendBatch && (
            <Dialog open={sendOpen} onOpenChange={setSendOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enviar para consulta em lote</DialogTitle>
                  <DialogDescription>Selecione o produto e o banco para processar sua base filtrada.</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
                  <Select value={sendProduct} onValueChange={setSendProduct}>
                    <SelectTrigger>
                      <SelectValue placeholder="Produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p,i) => {
                        const name = typeof p === 'string' ? p : (p?.name || '')
                        return (
                          <SelectItem key={i} value={name}>{name}</SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  <Select value={sendBank} onValueChange={setSendBank}>
                    <SelectTrigger>
                      <SelectValue placeholder="Banco" />
                    </SelectTrigger>
                    <SelectContent>
                      {banks.map((b) => (
                        <SelectItem key={b.key} value={b.key}>{b.name || b.key}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSendOpen(false)}>Cancelar</Button>
                  <Button onClick={sendToBatch} disabled={sending || !sendProduct || !sendBank}>{sending ? 'Enviando...' : 'Enviar'}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            )}

            {/* Add row Dialog */}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar cliente</DialogTitle>
                  <DialogDescription>Preencha os campos desejados para criar uma nova linha.</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2 max-h-[60vh] overflow-auto">
                  {orderedColumns().map((col) => (
                    <div key={col} className="space-y-1">
                      <div className="text-xs text-muted-foreground">{col}</div>
                      <Input value={addForm[col] || ''} onChange={(e)=> setAddForm(prev => ({...prev, [col]: e.target.value}))} />
                    </div>
                  ))}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
                  <Button onClick={onAddSubmit} disabled={addLoading || !selectedTable}>{addLoading ? 'Adicionando...' : 'Adicionar'}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Import Dialog */}
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Importar</DialogTitle>
                  <DialogDescription>Selecione a tabela e o arquivo CSV para importar.</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 py-2">
                  <Select value={importTable} onValueChange={setImportTable}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tabela" />
                    </SelectTrigger>
                    <SelectContent>
                      {tables.map((t) => {
                        const tableName = typeof t === 'string' ? t : t.table_name
                        const displayName = typeof t === 'string' ? t : t.display_name
                        return (
                          <SelectItem key={tableName} value={tableName}>{displayName}</SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  <div>
                    <Input id="importFile" type="file" accept=".csv" onChange={(e)=> setImportFileName(e.target.files?.[0]?.name || '')} />
                    {importFileName && <div className="text-xs text-muted-foreground mt-1">{importFileName}</div>}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">Modelo: gera CSV com cabeçalho de colunas e sem linhas.</div>
                  <Button variant="outline" onClick={onImportTemplate} disabled={!importTable || importColumns.length === 0}>Baixar modelo</Button>
                </div>
                {importError && (
                  <div className="text-destructive text-sm">{importError}</div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button>
                  <Button onClick={onImportOk} disabled={importLoading || !importTable}>{importLoading ? 'Importando...' : 'OK'}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Error Message */}
            {error && (
              <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg border border-destructive/20">
                {error}
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="text-center py-8">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                <p className="mt-2 text-muted-foreground">Loading...</p>
              </div>
            )}

            {/* Data Table */}
            {!loading && selectedTable && tableData.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Table Data</h3>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">
                      Página {page} de {totalPages}
                    </Badge>
                    <div className="flex items-center gap-2">
                      <button
                        className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded border hover:bg-muted disabled:opacity-50"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" /> Anterior
                      </button>
                      <button
                        className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded border hover:bg-muted disabled:opacity-50"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                      >
                        Próxima <ChevronRight className="h-4 w-4" />
                      </button>
                  </div>
                  </div>
                </div>
                <div className="border rounded-lg overflow-auto max-h-[600px]">
                  <Table>
                    {(() => {
                      const norm = (s) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
                      const preferred = ['Nome','cpf','telefone','instancia','saldo','status','respondeu','simulou','digitou','pausa ia','produto','proposta fgts','cliente']
                      const preferredNorm = preferred.map(norm)
                      const keys = Object.keys(tableData[0] || {})
                      let visibleKeys = keys.filter(k => preferredNorm.includes(norm(k)))
                      visibleKeys.sort((a,b) => preferredNorm.indexOf(norm(a)) - preferredNorm.indexOf(norm(b)))
                      if (visibleKeys.length === 0) visibleKeys = keys
                      return (
                        <>
                          <TableHeader className="sticky top-0 z-10">
                            <TableRow>
                              {visibleKeys.map((key) => (
                                <TableHead key={key} className="font-semibold bg-muted/70 backdrop-blur supports-[backdrop-filter]:bg-muted/50">
                                  {key}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {tableData.map((row, idx) => (
                              <TableRow key={idx}>
                                {visibleKeys.map((key) => {
                                  const value = row[key]
                                  return (
                                    <TableCell key={key} className="max-w-xs truncate">
                                      {value === null ? (
                                        <span className="text-muted-foreground italic">null</span>
                                      ) : typeof value === 'object' ? (
                                        <span className="text-xs font-mono">{JSON.stringify(value)}</span>
                                      ) : (
                                        String(value)
                                      )}
                                    </TableCell>
                                  )
                                })}
                              </TableRow>
                            ))}
                          </TableBody>
                        </>
                      )
                    })()}
                  </Table>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!loading && selectedTable && tableData.length === 0 && !error && (
              <div className="text-center py-12 text-muted-foreground">
                <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No data found in this table</p>
              </div>
            )}

            {/* No Table Selected */}
            {!selectedTable && !loading && (
              <div className="text-center py-12 text-muted-foreground">
                <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Select a table to view its data</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
