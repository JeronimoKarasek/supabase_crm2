"use client"

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Database, Filter, Search, X, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { exportToCsv } from '@/lib/export'

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
  
  // Filter state
  const [filterColumn, setFilterColumn] = useState('')
  const [filterValue, setFilterValue] = useState('')
  const [filterType, setFilterType] = useState('contains')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')

  // Fetch all tables on mount
  useEffect(() => {
    fetchTables()
  }, [])

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
        url += `&filterColumn=${filterColumn}&filterValue=${encodeURIComponent(filterValue)}&filterType=${filterType}`
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
          <SelectItem value="equals">Equals</SelectItem>
        </SelectContent>
      </Select>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto py-8 px-4">
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
                disabled={!selectedTable || tableData.length === 0}
                onClick={() => exportToCsv(tableData, `clientes_${selectedTable}_p${page}.csv`)}
              >
                <Download className="h-4 w-4" /> Exportar Excel
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

                    <div className="flex gap-2">
                      <Button 
                        onClick={applyFilter} 
                        disabled={loading || (!filterColumn && !periodStart && !periodEnd) || (filterColumn && !filterValue)}
                        className="flex-1"
                      >
                        <Search className="h-4 w-4 mr-2" />
                        Apply
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={clearFilter}
                        disabled={!filterColumn && !filterValue}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

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
                    <TableHeader>
                      <TableRow>
                        {Object.keys(tableData[0]).map((key) => (
                          <TableHead key={key} className="font-semibold bg-muted/50">
                            {key}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableData.map((row, idx) => (
                        <TableRow key={idx}>
                          {Object.entries(row).map(([key, value]) => (
                            <TableCell key={key} className="max-w-xs truncate">
                              {value === null ? (
                                <span className="text-muted-foreground italic">null</span>
                              ) : typeof value === 'object' ? (
                                <span className="text-xs font-mono">{JSON.stringify(value)}</span>
                              ) : (
                                String(value)
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
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
