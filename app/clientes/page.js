"use client"

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Database, Filter, Download, ChevronLeft, ChevronRight, Send, Upload, Plus, AlertCircle, RefreshCw, X, Edit } from 'lucide-react'
import { exportToExcel } from '@/lib/export'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function ClientesPage() {
  const [activeTab, setActiveTab] = useState('carteira') // carteira, lote, vendas_ia
  const [tableData, setTableData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 100
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [filtersList, setFiltersList] = useState([])
  const [exportingAll, setExportingAll] = useState(false)
  
  // User context (role, email, empresa_id)
  const [userRole, setUserRole] = useState('viewer')
  const [userEmail, setUserEmail] = useState('')
  const [empresaId, setEmpresaId] = useState(null)

  // Filter popup state
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterColumn, setFilterColumn] = useState('')
  const [filterValue, setFilterValue] = useState('')
  const [filterType, setFilterType] = useState('contains')
  
  // Global search state
  const [globalSearch, setGlobalSearch] = useState('')

  // Send buttons state
  const [sendOpen, setSendOpen] = useState(false)
  const [sendType, setSendType] = useState('') // 'whatsapp', 'sms', 'batch'
  const [sending, setSending] = useState(false)
  const [banks, setBanks] = useState([])
  const [products, setProducts] = useState([])
  const [sendBank, setSendBank] = useState('')
  const [sendProduct, setSendProduct] = useState('')
  const [canSendBatch, setCanSendBatch] = useState(false)
  const [canSendWhatsApp, setCanSendWhatsApp] = useState(false)
  const [canSendSMS, setCanSendSMS] = useState(false)

  // Add/Import dialogs
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({})
  const [addLoading, setAddLoading] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importFileName, setImportFileName] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState('')
  
  // Refresh webhook
  const [refreshing, setRefreshing] = useState(null) // stores row id being refreshed

  // All available columns
  const allColumns = ['Nome', 'cpf', 'telefone', 'Valor liberado', 'simulou', 'digitou', 'produto', 'status', 'vendedor', 'data da atualização', 'Banco', 'agencia', 'conta', 'cidade', 'UF', 'email', 'whats', 'banco simulado', 'proposta', 'link de formalização']
  
  // Visible columns state (default columns)
  const [visibleColumns, setVisibleColumns] = useState(['Nome', 'cpf', 'telefone', 'Valor liberado', 'simulou', 'digitou', 'produto', 'status', 'vendedor', 'data da atualização'])
  
  // Column widths state with localStorage persistence
  const [columnWidths, setColumnWidths] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('clientes_column_widths')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {}
      }
    }
    return {}
  })
  
  // Column visibility dialog
  const [columnsOpen, setColumnsOpen] = useState(false)
  
  // Edit row dialog
  const [editOpen, setEditOpen] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editLoading, setEditLoading] = useState(false)
  const [editTab, setEditTab] = useState('cadastro')

  // Map tab to table name
  const getTableName = () => {
    if (activeTab === 'carteira') return 'Carteira'
    if (activeTab === 'lote') return 'lote_items'
    if (activeTab === 'vendas_ia') return 'Clientes_IA'
    return 'Carteira'
  }
  
  // Refresh individual row (Carteira only)
  const onRefreshRow = async (rowId) => {
    try {
      setRefreshing(rowId)
      const response = await fetch('/api/consulta-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({ rowId })
      })
      
      if (!response.ok) throw new Error('Erro ao atualizar')
      
      await fetchTableData()
      alert('Dados atualizados com sucesso!')
    } catch (err) {
      console.error('[Refresh Row Error]', err)
      alert('Erro ao atualizar dados: ' + err.message)
    } finally {
      setRefreshing(null)
    }
  }
  
  // Open edit dialog
  const onEditRow = (row) => {
    setEditRow(row)
    setEditForm({ ...row })
    setEditTab('cadastro')
    setEditOpen(true)
  }
  
  // Save edited row
  const onEditSave = async () => {
    try {
      setEditLoading(true)
      const tableName = getTableName()
      
      const response = await fetch(`/api/${tableName}/${editRow.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify(editForm)
      })
      
      if (!response.ok) throw new Error('Erro ao salvar')
      
      setTableData(prev => prev.map(row => row.id === editRow.id ? { ...row, ...editForm } : row))
      setEditOpen(false)
      alert('Dados salvos com sucesso!')
    } catch (err) {
      console.error('[Edit Save Error]', err)
      alert('Erro ao salvar: ' + err.message)
    } finally {
      setEditLoading(false)
    }
  }

  // Load user context
  useEffect(() => {
    let active = true
    const loadUser = async () => {
      try {
        const { data } = await supabase.auth.getUser()
        const user = data?.user
        if (!user || !active) return
        const role = user?.user_metadata?.role || 'viewer'
        const email = user?.email || ''
        setUserRole(role)
        setUserEmail(email)
        
        // Load saved column preferences
        const savedColumns = localStorage.getItem(`clientes_columns_${user.id}`)
        if (savedColumns) {
          try {
            setVisibleColumns(JSON.parse(savedColumns))
          } catch {}
        }

        // Get empresa_id
        if (role !== 'admin') {
          const { data: empData } = await supabase
            .from('empresa_users')
            .select('empresa_id')
            .eq('user_id', user.id)
            .single()
          if (empData?.empresa_id && active) setEmpresaId(empData.empresa_id)
        }
      } catch {}
    }
    loadUser()
    const { data: sub } = supabase.auth.onAuthStateChange(() => loadUser())
    return () => { active = false; sub?.subscription?.unsubscribe?.() }
  }, [])

  // Save visible columns to localStorage when changed
  useEffect(() => {
    if (userEmail) {
      const userId = userEmail.replace(/[^a-zA-Z0-9]/g, '_')
      localStorage.setItem(`clientes_columns_${userId}`, JSON.stringify(visibleColumns))
    }
  }, [visibleColumns, userEmail])

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

  // Determine permissions (batch, whatsapp, sms)
  useEffect(() => {
    let active = true
    const norm = (s) => { try { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() } catch { return String(s || '').toLowerCase() } }
    const check = async () => {
      try {
        const { data } = await supabase.auth.getUser()
        const user = data?.user
        const role = user?.user_metadata?.role || 'viewer'
        const sectors = Array.isArray(user?.user_metadata?.sectors) ? user.user_metadata.sectors : []
        
        const hasBatch = sectors.some((s) => norm(s) === norm('Consulta em lote'))
        const hasWhatsApp = sectors.some((s) => norm(s) === norm('Disparo Whats API'))
        const hasSMS = sectors.some((s) => norm(s) === norm('Disparo SMS'))
        
        if (active) {
          setCanSendBatch(role === 'admin' || hasBatch)
          setCanSendWhatsApp(role === 'admin' || hasWhatsApp)
          setCanSendSMS(role === 'admin' || hasSMS)
        }
      } catch { 
        if (active) {
          setCanSendBatch(false)
          setCanSendWhatsApp(false)
          setCanSendSMS(false)
        }
      }
    }
    check()
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const user = session?.user
      const role = user?.user_metadata?.role || 'viewer'
      const sectors = Array.isArray(user?.user_metadata?.sectors) ? user.user_metadata.sectors : []
      
      const hasBatch = sectors.some((s) => norm(s) === norm('Consulta em lote'))
      const hasWhatsApp = sectors.some((s) => norm(s) === norm('Disparo Whats API'))
      const hasSMS = sectors.some((s) => norm(s) === norm('Disparo SMS'))
      
      if (active) {
        setCanSendBatch(role === 'admin' || hasBatch)
        setCanSendWhatsApp(role === 'admin' || hasWhatsApp)
        setCanSendSMS(role === 'admin' || hasSMS)
      }
    })
    return () => { active = false; sub?.subscription?.unsubscribe?.() }
  }, [])

  // Fetch table data when tab or page changes
  useEffect(() => {
    fetchTableData()
  }, [activeTab, page, filtersList, userRole, userEmail, empresaId, globalSearch])

  const fetchTableData = async () => {
    try {
      setLoading(true)
      setError('')
      
      const tableName = getTableName()
      let url = `/api/table-data?table=${tableName}&page=${page}&pageSize=${pageSize}`

      // Apply filters
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
        let rows = data.data || []
        
        // Use server-provided pagination info
        const serverTotal = data.count || data.data?.length || 0
        const serverTotalPages = data.totalPages || 1
        
        // Apply view filter based on role
        // Admin: vê tudo (sem filtro)
        // Gestor: vê linhas onde empresa = empresaId
        // Usuário (viewer): vê linhas onde cliente = userEmail
        if (userRole !== 'admin') {
          if (userRole === 'gestor' && empresaId) {
            rows = rows.filter(r => r.empresa === empresaId)
          } else if (userRole === 'viewer') {
            rows = rows.filter(r => r.cliente === userEmail)
          }
        }

        // Apply global search filter (searches all columns)
        if (globalSearch && globalSearch.trim() !== '') {
          const searchLower = globalSearch.toLowerCase()
          rows = rows.filter(row => {
            return Object.values(row).some(value => {
              if (value === null || value === undefined) return false
              return String(value).toLowerCase().includes(searchLower)
            })
          })
        }

        setTableData(rows)
        setTotal(serverTotal)
        setTotalPages(serverTotalPages)
      } else {
        setError(data.error || 'Falha ao buscar dados')
        setTableData([])
      }
    } catch (err) {
      setError('Falha ao buscar dados')
      setTableData([])
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const addFilter = () => {
    const requiresValue = filterType !== 'isBlank' && filterType !== 'isNotBlank'
    if (!filterColumn || (requiresValue && !filterValue)) return
    setFiltersList(prev => [...prev, { column: filterColumn, type: filterType, value: filterValue || '' }])
    setFilterColumn('')
    setFilterValue('')
    setFilterType('contains')
  }

  const clearFilters = () => {
    setFiltersList([])
    setPage(1)
  }

  const applyFilters = () => {
    setPage(1)
    setFilterOpen(false)
    fetchTableData()
  }

  const exportAll = async () => {
    try {
      setExportingAll(true)
      const tableName = getTableName()
      
      // Build base url with filters
      const baseParams = new URLSearchParams()
      baseParams.set('table', tableName)
      baseParams.set('pageSize', '10000') // Large page to get all
      if (filtersList && filtersList.length > 0) {
        try { baseParams.set('filters', JSON.stringify(filtersList)) } catch {}
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch(`/api/table-data?${baseParams.toString()}&page=1`, { 
        headers: token ? { Authorization: `Bearer ${token}` } : undefined 
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Falha ao buscar dados')
      
      let allRows = json?.data || []
      
      // Apply view filter (admin vê tudo)
      if (userRole !== 'admin') {
        if (userRole === 'gestor' && empresaId) {
          allRows = allRows.filter(r => r.empresa === empresaId)
        } else if (userRole === 'viewer') {
          allRows = allRows.filter(r => r.cliente === userEmail)
        }
      }

      exportToExcel(allRows, `clientes_${tableName}_all`)
    } catch (e) {
      console.error('Export failed', e)
      setError(e?.message || 'Falha na exportação')
    } finally {
      setExportingAll(false)
    }
  }

  const sendToWhatsApp = async () => {
    try {
      setSending(true)
      const tableName = getTableName()
      
      const baseParams = new URLSearchParams()
      baseParams.set('table', tableName)
      baseParams.set('pageSize', '10000')
      if (filtersList && filtersList.length > 0) {
        try { baseParams.set('filters', JSON.stringify(filtersList)) } catch {}
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch(`/api/table-data?${baseParams.toString()}&page=1`, { 
        headers: token ? { Authorization: `Bearer ${token}` } : undefined 
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Falha ao buscar dados')
      
      let allRows = json?.data || []
      
      // Apply view filter (admin vê tudo)
      if (userRole !== 'admin') {
        if (userRole === 'gestor' && empresaId) {
          allRows = allRows.filter(r => r.empresa === empresaId)
        } else if (userRole === 'viewer') {
          allRows = allRows.filter(r => r.cliente === userEmail)
        }
      }

      // Build CSV
      const esc = (val) => {
        if (val === null || typeof val === 'undefined') return ''
        const s = String(val)
        if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
        return s
      }
      const first = allRows[0] || {}
      const allColumns = Object.keys(first)
      const lines = [allColumns.map(esc).join(',')]
      for (const row of allRows) {
        const rowValues = allColumns.map(col => esc(row?.[col] ?? ''))
        lines.push(rowValues.join(','))
      }
      const csv = lines.join('\n')

      localStorage.setItem('whatsapp_csv_data', csv)
      localStorage.setItem('whatsapp_csv_source', 'base_csv')
      window.location.href = '/disparo-api#disparo'
    } catch (e) {
      console.error('Send to WhatsApp failed', e)
      setError(e?.message || 'Erro ao enviar para WhatsApp')
    } finally {
      setSending(false)
    }
  }

  const sendToSMS = async () => {
    try {
      setSending(true)
      const tableName = getTableName()
      
      const baseParams = new URLSearchParams()
      baseParams.set('table', tableName)
      baseParams.set('pageSize', '10000')
      if (filtersList && filtersList.length > 0) {
        try { baseParams.set('filters', JSON.stringify(filtersList)) } catch {}
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch(`/api/table-data?${baseParams.toString()}&page=1`, { 
        headers: token ? { Authorization: `Bearer ${token}` } : undefined 
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Falha ao buscar dados')
      
      let allRows = json?.data || []
      
      // Apply view filter (admin vê tudo)
      if (userRole !== 'admin') {
        if (userRole === 'gestor' && empresaId) {
          allRows = allRows.filter(r => r.empresa === empresaId)
        } else if (userRole === 'viewer') {
          allRows = allRows.filter(r => r.cliente === userEmail)
        }
      }

      // Build CSV
      const esc = (val) => {
        if (val === null || typeof val === 'undefined') return ''
        const s = String(val)
        if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
        return s
      }
      const first = allRows[0] || {}
      const allColumns = Object.keys(first)
      const lines = [allColumns.map(esc).join(',')]
      for (const row of allRows) {
        const rowValues = allColumns.map(col => esc(row?.[col] ?? ''))
        lines.push(rowValues.join(','))
      }
      const csv = lines.join('\n')

      localStorage.setItem('sms_csv_data', csv)
      localStorage.setItem('sms_csv_source', 'base_csv')
      window.location.href = '/disparo-sms#nova-campanha'
    } catch (e) {
      console.error('Send to SMS failed', e)
      setError(e?.message || 'Erro ao enviar para SMS')
    } finally {
      setSending(false)
    }
  }

  const sendToBatch = async () => {
    if (!sendBank || !sendProduct) return
    try {
      setSending(true)
      const tableName = getTableName()
      
      const baseParams = new URLSearchParams()
      baseParams.set('table', tableName)
      baseParams.set('pageSize', '10000')
      if (filtersList && filtersList.length > 0) {
        try { baseParams.set('filters', JSON.stringify(filtersList)) } catch {}
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch(`/api/table-data?${baseParams.toString()}&page=1`, { 
        headers: token ? { Authorization: `Bearer ${token}` } : undefined 
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Falha ao buscar dados')
      
      let allRows = json?.data || []
      
      // Apply view filter (admin vê tudo)
      if (userRole !== 'admin') {
        if (userRole === 'gestor' && empresaId) {
          allRows = allRows.filter(r => r.empresa === empresaId)
        } else if (userRole === 'viewer') {
          allRows = allRows.filter(r => r.cliente === userEmail)
        }
      }

      // Build CSV
      const esc = (val) => {
        if (val === null || typeof val === 'undefined') return ''
        const s = String(val)
        if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
        return s
      }
      const first = allRows[0] || {}
      const allColumns = Object.keys(first)
      const lines = [allColumns.map(esc).join(',')]
      for (const row of allRows) {
        const rowValues = allColumns.map(col => esc(row?.[col] ?? ''))
        lines.push(rowValues.join(','))
      }
      const csv = lines.join('\n')

      // Send to lote API
      const postRes = await fetch('/api/lote', { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          ...(token ? { Authorization: `Bearer ${token}` } : {}) 
        }, 
        body: JSON.stringify({ csv, produto: sendProduct, banco: sendBank }) 
      })
      const postJson = await postRes.json().catch(() => ({}))
      if (!postRes.ok) throw new Error(postJson?.error || 'Falha ao enviar para lote')

      setSendOpen(false)
      window.location.href = '/consulta-lote'
    } catch (e) {
      setError(e?.message || 'Erro ao enviar para lote')
    } finally {
      setSending(false)
    }
  }

  const onAddSubmit = async () => {
    const tableName = getTableName()
    try {
      setAddLoading(true)
      const payload = {}
      for (const [k,v] of Object.entries(addForm || {})) {
        if (v !== '' && typeof v !== 'undefined' && v !== null) payload[k] = v
      }
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/table-row', { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          ...(token ? { Authorization: `Bearer ${token}` } : {}) 
        }, 
        body: JSON.stringify({ table: tableName, row: payload }) 
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Falha ao inserir')
      setAddOpen(false)
      setAddForm({})
      fetchTableData()
    } catch (e) {
      setError(e?.message || 'Erro ao inserir')
    } finally {
      setAddLoading(false)
    }
  }

  const onImportOk = async () => {
    try {
      setImportError('')
      const tableName = getTableName()
      const input = document.getElementById('importFile')
      const file = input?.files?.[0]
      if (!file) throw new Error('Selecione um arquivo CSV')
      setImportLoading(true)
      const text = await file.text()
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
      if (lines.length < 2) throw new Error('Arquivo vazio')
      const headers = lines[0].split(',').map(h => h.trim())
      const rows = []
      for (let li = 1; li < lines.length; li++) {
        const parts = lines[li].split(',')
        const obj = {}
        for (let i = 0; i < headers.length; i++) {
          obj[headers[i]] = parts[i] ?? ''
        }
        rows.push(obj)
      }
      // Insert in chunks
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const chunkSize = 500
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize)
        const res = await fetch('/api/table-row', { 
          method: 'POST', 
          headers: { 
            'Content-Type': 'application/json', 
            ...(token ? { Authorization: `Bearer ${token}` } : {}) 
          }, 
          body: JSON.stringify({ table: tableName, rows: chunk }) 
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Falha ao importar')
      }
      setImportOpen(false)
      fetchTableData()
    } catch (e) {
      setImportError(e?.message || 'Erro ao importar')
    } finally {
      setImportLoading(false)
      setImportFileName('')
      const input = document.getElementById('importFile'); if (input) input.value = ''
    }
  }

  const handleRefreshRow = async (row) => {
    if (!row?.id) return
    try {
      setRefreshing(row.id)
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      
      // Call webhook to refresh status
      const res = await fetch('/api/consultar-proposta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ rowId: row.id, cpf: row.cpf, proposta: row.proposta })
      })
      
      if (!res.ok) throw new Error('Falha ao consultar proposta')
      
      // Refresh table data
      await fetchTableData()
    } catch (e) {
      setError(e?.message || 'Erro ao atualizar')
    } finally {
      setRefreshing(null)
    }
  }

  const handleEditRow = (row) => {
    setEditRow(row)
    setEditForm(row)
    setEditTab('cadastro')
    setEditOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editRow?.id) return
    try {
      setEditLoading(true)
      const tableName = getTableName()
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      
      const res = await fetch('/api/table-row', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ table: tableName, id: editRow.id, updates: editForm })
      })
      
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Falha ao atualizar')
      
      setEditOpen(false)
      setEditRow(null)
      setEditForm({})
      fetchTableData()
    } catch (e) {
      setError(e?.message || 'Erro ao salvar')
    } finally {
      setEditLoading(false)
    }
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      // Could add toast notification here
    })
  }

  return (
    <div className="-m-4 min-h-[calc(100vh-56px)] bg-background">
      <div className="container mx-auto py-6 px-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center shadow-lg">
                <Database className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
                <p className="text-sm text-muted-foreground">Gerencie sua base de clientes</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setAddForm({}); setAddOpen(true) }}
                className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 border-blue-200 dark:border-blue-800"
              >
                <Plus className="h-4 w-4 mr-2" /> Adicionar
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={loading || exportingAll}
                onClick={exportAll}
                className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 border-blue-200 dark:border-blue-800"
              >
                {exportingAll ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Exportando...</>
                ) : (
                  <><Download className="h-4 w-4 mr-2" /> Exportar</>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setImportFileName(''); setImportOpen(true) }}
                className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 border-blue-200 dark:border-blue-800"
              >
                <Upload className="h-4 w-4 mr-2" /> Importar
              </Button>
              {(canSendBatch || canSendWhatsApp || canSendSMS) && (
                <Button 
                  onClick={() => setSendOpen(true)} 
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Send className="h-4 w-4 mr-2" /> Enviar
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Main Card with Tabs */}
        <Card className="shadow-lg border-l-4 border-l-violet-500">
          <CardContent className="pt-6">
            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setPage(1) }}>
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between">
                  <TabsList>
                    <TabsTrigger value="carteira">Carteira</TabsTrigger>
                    <TabsTrigger value="lote">Consulta em Lote</TabsTrigger>
                    <TabsTrigger value="vendas_ia">Vendas IA</TabsTrigger>
                  </TabsList>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setColumnsOpen(true)}
                      className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 border-blue-200 dark:border-blue-800"
                    >
                      <Database className="h-4 w-4 mr-2" /> Visualizar
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setFilterOpen(true)}
                      className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 border-blue-200 dark:border-blue-800"
                    >
                      <Filter className="h-4 w-4 mr-2" /> Filtro
                      {filtersList.length > 0 && <Badge variant="secondary" className="ml-2">{filtersList.length}</Badge>}
                    </Button>
                  </div>
                </div>
                
                {/* Global Search Bar */}
                <div className="relative">
                  <Input
                    placeholder="Pesquisar em todas as colunas..."
                    value={globalSearch}
                    onChange={(e) => { setGlobalSearch(e.target.value); setPage(1) }}
                    className="pl-10"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Database className="h-4 w-4" />
                  </div>
                  {globalSearch && (
                    <button
                      onClick={() => { setGlobalSearch(''); setPage(1) }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <TabsContent value="carteira" className="mt-0">
                <DataTableView 
                  data={tableData} 
                  loading={loading} 
                  page={page} 
                  totalPages={totalPages}
                  total={total}
                  onPageChange={setPage}
                  columnNames={visibleColumns}
                  activeTab={activeTab}
                  onRefreshRow={onRefreshRow}
                  onEditRow={onEditRow}
                  refreshing={refreshing}
                />
              </TabsContent>

              <TabsContent value="lote" className="mt-0">
                <DataTableView 
                  data={tableData} 
                  loading={loading} 
                  page={page} 
                  totalPages={totalPages}
                  total={total}
                  onPageChange={setPage}
                  columnNames={visibleColumns}
                  activeTab={activeTab}
                  onRefreshRow={onRefreshRow}
                  onEditRow={onEditRow}
                  refreshing={refreshing}
                />
              </TabsContent>

              <TabsContent value="vendas_ia" className="mt-0">
                <DataTableView 
                  data={tableData} 
                  loading={loading} 
                  page={page} 
                  totalPages={totalPages}
                  total={total}
                  onPageChange={setPage}
                  columnNames={visibleColumns}
                  activeTab={activeTab}
                  onRefreshRow={onRefreshRow}
                  onEditRow={onEditRow}
                  refreshing={refreshing}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <Alert className="mt-4" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Filter Dialog */}
        <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Filtros</DialogTitle>
              <DialogDescription>Configure filtros para refinar sua busca</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Select value={filterColumn} onValueChange={setFilterColumn}>
                  <SelectTrigger>
                    <SelectValue placeholder="Coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    {allColumns.map((col) => (
                      <SelectItem key={col} value={col}>{col}</SelectItem>
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
                    <SelectItem value="equals">Igual a</SelectItem>
                    <SelectItem value="notEquals">Diferente de</SelectItem>
                    <SelectItem value="isBlank">Está em branco</SelectItem>
                    <SelectItem value="isNotBlank">Não está em branco</SelectItem>
                  </SelectContent>
                </Select>

                {filterType !== 'isBlank' && filterType !== 'isNotBlank' && (
                  <Input
                    placeholder="Valor"
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    disabled={!filterColumn}
                  />
                )}
              </div>

              <div className="flex gap-2">
                <Button onClick={addFilter} disabled={!filterColumn}>Adicionar Filtro</Button>
                <Button variant="outline" onClick={clearFilters}>Limpar Todos</Button>
              </div>

              {filtersList.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium">Filtros Ativos:</div>
                  <div className="flex flex-wrap gap-2">
                    {filtersList.map((f, idx) => (
                      <div key={idx} className="px-3 py-1 border rounded-full text-sm bg-muted/50 flex items-center gap-2">
                        <span>{f.column} {f.type} {f.value}</span>
                        <button 
                          className="text-muted-foreground hover:text-destructive" 
                          onClick={() => setFiltersList(prev => prev.filter((_,i)=>i!==idx))}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFilterOpen(false)}>Cancelar</Button>
              <Button onClick={applyFilters}>Aplicar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Send Dialog */}
        <Dialog open={sendOpen} onOpenChange={(open) => { setSendOpen(open); if (!open) setSendType('') }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Enviar Base Filtrada</DialogTitle>
              <DialogDescription>
                {!sendType ? 'Escolha para onde deseja enviar sua base:' : 
                 sendType === 'batch' ? 'Configure o envio para Consulta em Lote' :
                 sendType === 'whatsapp' ? 'Redirecionar para WhatsApp API' :
                 'Redirecionar para Disparo SMS'}
              </DialogDescription>
            </DialogHeader>

            {!sendType ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
                {canSendWhatsApp && (
                  <button
                    onClick={() => setSendType('whatsapp')}
                    className="group rounded-lg border-2 border-border hover:border-green-500 transition-all p-6 flex flex-col items-center gap-3 hover:shadow-lg hover:scale-105"
                  >
                    <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center group-hover:bg-green-500 transition-colors">
                      <Send className="h-8 w-8 text-green-600 dark:text-green-400 group-hover:text-white" />
                    </div>
                    <h3 className="font-semibold text-lg">WhatsApp API</h3>
                  </button>
                )}

                {canSendSMS && (
                  <button
                    onClick={() => setSendType('sms')}
                    className="group rounded-lg border-2 border-border hover:border-blue-500 transition-all p-6 flex flex-col items-center gap-3 hover:shadow-lg hover:scale-105"
                  >
                    <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                      <Send className="h-8 w-8 text-blue-600 dark:text-blue-400 group-hover:text-white" />
                    </div>
                    <h3 className="font-semibold text-lg">SMS</h3>
                  </button>
                )}

                {canSendBatch && (
                  <button
                    onClick={() => setSendType('batch')}
                    className="group rounded-lg border-2 border-border hover:border-purple-500 transition-all p-6 flex flex-col items-center gap-3 hover:shadow-lg hover:scale-105"
                  >
                    <div className="h-16 w-16 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center group-hover:bg-purple-500 transition-colors">
                      <Database className="h-8 w-8 text-purple-600 dark:text-purple-400 group-hover:text-white" />
                    </div>
                    <h3 className="font-semibold text-lg">Consulta em Lote</h3>
                  </button>
                )}
              </div>
            ) : sendType === 'batch' ? (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Produto</label>
                    <Select value={sendProduct} onValueChange={setSendProduct}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p,i) => {
                          const name = typeof p === 'string' ? p : (p?.name || '')
                          return <SelectItem key={i} value={name}>{name}</SelectItem>
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Banco</label>
                    <Select value={sendBank} onValueChange={setSendBank}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {banks.map((b) => (
                          <SelectItem key={b.key} value={b.key}>{b.name || b.key}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="bg-muted/50 p-3 rounded text-sm">
                  <strong>Total:</strong> {total} registros
                </div>
              </div>
            ) : (
              <div className="py-6 text-center space-y-4">
                <p className="text-muted-foreground">
                  Você será redirecionado com a base filtrada já carregada.
                </p>
                <div className="bg-muted/50 p-3 rounded text-sm">
                  <strong>Total:</strong> {total} registros
                </div>
              </div>
            )}

            <DialogFooter>
              {sendType && <Button variant="outline" onClick={() => setSendType('')}>Voltar</Button>}
              <Button variant="outline" onClick={() => { setSendOpen(false); setSendType('') }}>Cancelar</Button>
              {sendType === 'batch' && (
                <Button onClick={sendToBatch} disabled={sending || !sendProduct || !sendBank}>
                  {sending ? 'Enviando...' : 'Enviar'}
                </Button>
              )}
              {sendType === 'whatsapp' && (
                <Button onClick={sendToWhatsApp} disabled={sending}>
                  {sending ? 'Preparando...' : 'Ir para WhatsApp'}
                </Button>
              )}
              {sendType === 'sms' && (
                <Button onClick={sendToSMS} disabled={sending}>
                  {sending ? 'Preparando...' : 'Ir para SMS'}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Dialog */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Adicionar Cliente</DialogTitle>
            </DialogHeader>
            
            <Tabs defaultValue="cadastro">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
                <TabsTrigger value="endereco">Endereço</TabsTrigger>
                <TabsTrigger value="bancario">Dados Bancários</TabsTrigger>
                <TabsTrigger value="proposta">Proposta</TabsTrigger>
              </TabsList>
              
              <TabsContent value="cadastro" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Nome</Label><Input value={addForm.Nome || ''} onChange={(e) => setAddForm(prev => ({ ...prev, Nome: e.target.value }))} /></div>
                  <div><Label>CPF</Label><Input value={addForm.cpf || ''} onChange={(e) => setAddForm(prev => ({ ...prev, cpf: e.target.value }))} /></div>
                  <div><Label>Telefone</Label><Input value={addForm.telefone || ''} onChange={(e) => setAddForm(prev => ({ ...prev, telefone: e.target.value }))} /></div>
                  <div><Label>Data Nascimento</Label><Input value={addForm['data nascimento'] || ''} onChange={(e) => setAddForm(prev => ({ ...prev, 'data nascimento': e.target.value }))} /></div>
                  <div><Label>Sexo</Label><Select value={addForm.sexo || ''} onValueChange={(val) => setAddForm(prev => ({ ...prev, sexo: val }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="M">Masculino</SelectItem><SelectItem value="F">Feminino</SelectItem></SelectContent></Select></div>
                  <div><Label>Email</Label><Input value={addForm.email || ''} onChange={(e) => setAddForm(prev => ({ ...prev, email: e.target.value }))} /></div>
                  <div><Label>WhatsApp</Label><Input value={addForm.whats || ''} onChange={(e) => setAddForm(prev => ({ ...prev, whats: e.target.value }))} /></div>
                  <div><Label>Renda</Label><Input type="number" value={addForm.renda || ''} onChange={(e) => setAddForm(prev => ({ ...prev, renda: e.target.value }))} /></div>
                  <div className="col-span-2"><Label>Nome da Mãe</Label><Input value={addForm['nomeMãe'] || ''} onChange={(e) => setAddForm(prev => ({ ...prev, 'nomeMãe': e.target.value }))} /></div>
                </div>
              </TabsContent>
              
              <TabsContent value="endereco" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>CEP</Label><Input value={addForm.cep || ''} onChange={(e) => setAddForm(prev => ({ ...prev, cep: e.target.value }))} /></div>
                  <div><Label>Rua</Label><Input value={addForm.rua || ''} onChange={(e) => setAddForm(prev => ({ ...prev, rua: e.target.value }))} /></div>
                  <div><Label>Número</Label><Input value={addForm.numero || ''} onChange={(e) => setAddForm(prev => ({ ...prev, numero: e.target.value }))} /></div>
                  <div><Label>Bairro</Label><Input value={addForm.bairro || ''} onChange={(e) => setAddForm(prev => ({ ...prev, bairro: e.target.value }))} /></div>
                  <div><Label>Cidade</Label><Input value={addForm.cidade || ''} onChange={(e) => setAddForm(prev => ({ ...prev, cidade: e.target.value }))} /></div>
                  <div><Label>UF</Label><Input value={addForm.UF || ''} onChange={(e) => setAddForm(prev => ({ ...prev, UF: e.target.value }))} maxLength={2} /></div>
                </div>
              </TabsContent>
              
              <TabsContent value="bancario" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Banco</Label><Input value={addForm.Banco || ''} onChange={(e) => setAddForm(prev => ({ ...prev, Banco: e.target.value }))} /></div>
                  <div><Label>Agência</Label><Input value={addForm.agencia || ''} onChange={(e) => setAddForm(prev => ({ ...prev, agencia: e.target.value }))} /></div>
                  <div><Label>Conta</Label><Input value={addForm.conta || ''} onChange={(e) => setAddForm(prev => ({ ...prev, conta: e.target.value }))} /></div>
                  <div><Label>Tipo Conta</Label><Select value={addForm['corrente ou poupança'] || ''} onValueChange={(val) => setAddForm(prev => ({ ...prev, 'corrente ou poupança': val }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="corrente">Corrente</SelectItem><SelectItem value="poupança">Poupança</SelectItem></SelectContent></Select></div>
                  <div><Label>Dígito Conta</Label><Input value={addForm.digitoconta || ''} onChange={(e) => setAddForm(prev => ({ ...prev, digitoconta: e.target.value }))} /></div>
                  <div><Label>PIX</Label><Input value={addForm.pix || ''} onChange={(e) => setAddForm(prev => ({ ...prev, pix: e.target.value }))} /></div>
                  <div className="col-span-2"><Label>Tipo de PIX</Label><Select value={addForm['tipo de pix'] || ''} onValueChange={(val) => setAddForm(prev => ({ ...prev, 'tipo de pix': val }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cpf">CPF</SelectItem><SelectItem value="email">Email</SelectItem><SelectItem value="telefone">Telefone</SelectItem><SelectItem value="aleatorio">Chave Aleatória</SelectItem></SelectContent></Select></div>
                </div>
              </TabsContent>
              
              <TabsContent value="proposta" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Valor Contrato</Label><Input type="number" value={addForm.valorContrato || ''} onChange={(e) => setAddForm(prev => ({ ...prev, valorContrato: e.target.value }))} /></div>
                  <div><Label>Proposta</Label><Input value={addForm.proposta || ''} onChange={(e) => setAddForm(prev => ({ ...prev, proposta: e.target.value }))} /></div>
                  <div><Label>Vendedor</Label><Input value={addForm.vendedor || ''} onChange={(e) => setAddForm(prev => ({ ...prev, vendedor: e.target.value }))} /></div>
                  <div><Label>Valor Parcela</Label><Input type="number" value={addForm.valorParcela || ''} onChange={(e) => setAddForm(prev => ({ ...prev, valorParcela: e.target.value }))} /></div>
                  <div><Label>Prazo</Label><Input type="number" value={addForm.prazo || ''} onChange={(e) => setAddForm(prev => ({ ...prev, prazo: e.target.value }))} /></div>
                  <div><Label>Valor Seguro</Label><Input type="number" value={addForm.valorSeguro || ''} onChange={(e) => setAddForm(prev => ({ ...prev, valorSeguro: e.target.value }))} /></div>
                </div>
              </TabsContent>
            </Tabs>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
              <Button onClick={onAddSubmit} disabled={addLoading}>{addLoading ? 'Adicionando...' : 'Adicionar'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Import Dialog */}
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Importar CSV</DialogTitle>
              <DialogDescription>Selecione arquivo CSV para importar na aba atual</DialogDescription>
            </DialogHeader>
            <div className="py-2 space-y-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  const csvContent = 'Nome,cpf,telefone,Valor liberado,simulou,digitou,produto,status,vendedor,Banco,agencia,conta,cidade,UF,email,whats,banco simulado,proposta\n'
                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
                  const link = document.createElement('a')
                  link.href = URL.createObjectURL(blob)
                  link.download = 'modelo_importacao_clientes.csv'
                  link.click()
                }}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" /> Baixar Modelo CSV
              </Button>
              <Input id="importFile" type="file" accept=".csv" onChange={(e)=> setImportFileName(e.target.files?.[0]?.name || '')} />
              {importFileName && <div className="text-xs text-muted-foreground mt-1">{importFileName}</div>}
            </div>
            {importError && (
              <div className="text-destructive text-sm">{importError}</div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button>
              <Button onClick={onImportOk} disabled={importLoading}>{importLoading ? 'Importando...' : 'OK'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Personalizar Colunas */}
        <Dialog open={columnsOpen} onOpenChange={setColumnsOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Personalizar Colunas</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {allColumns.map((col) => (
                <label key={col} className="flex items-center gap-2 cursor-pointer hover:bg-muted p-2 rounded">
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(col)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setVisibleColumns(prev => [...prev, col])
                      } else {
                        setVisibleColumns(prev => prev.filter(c => c !== col))
                      }
                    }}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">{col}</span>
                </label>
              ))}
            </div>
            <DialogFooter>
              <Button onClick={() => setColumnsOpen(false)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Editar Cliente */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Cliente</DialogTitle>
              {editForm['link de formalização'] && (
                <div className="mt-2">
                  <a
                    href={editForm['link de formalização']}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-sm"
                  >
                    🔗 Link de Formalização
                  </a>
                </div>
              )}
            </DialogHeader>
            
            <Tabs value={editTab} onValueChange={setEditTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="cadastro">Cadastro</TabsTrigger>
                <TabsTrigger value="endereco">Endereço</TabsTrigger>
                <TabsTrigger value="bancario">Dados Bancários</TabsTrigger>
                {editForm.digitou && <TabsTrigger value="proposta">Proposta</TabsTrigger>}
              </TabsList>
              
              <TabsContent value="cadastro" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Nome</Label><Input value={editForm.Nome || ''} onChange={(e) => setEditForm(prev => ({ ...prev, Nome: e.target.value }))} /></div>
                  <div><Label>CPF</Label><Input value={editForm.cpf || ''} onChange={(e) => setEditForm(prev => ({ ...prev, cpf: e.target.value }))} /></div>
                  <div><Label>Telefone</Label><Input value={editForm.telefone || ''} onChange={(e) => setEditForm(prev => ({ ...prev, telefone: e.target.value }))} /></div>
                  <div><Label>Data Nascimento</Label><Input value={editForm['data nascimento'] || ''} onChange={(e) => setEditForm(prev => ({ ...prev, 'data nascimento': e.target.value }))} /></div>
                  <div><Label>Sexo</Label><Select value={editForm.sexo || ''} onValueChange={(val) => setEditForm(prev => ({ ...prev, sexo: val }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="M">Masculino</SelectItem><SelectItem value="F">Feminino</SelectItem></SelectContent></Select></div>
                  <div><Label>Email</Label><Input value={editForm.email || ''} onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))} /></div>
                  <div><Label>WhatsApp</Label><Input value={editForm.whats || ''} onChange={(e) => setEditForm(prev => ({ ...prev, whats: e.target.value }))} /></div>
                  <div><Label>Renda</Label><Input type="number" value={editForm.renda || ''} onChange={(e) => setEditForm(prev => ({ ...prev, renda: e.target.value }))} /></div>
                  <div className="col-span-2"><Label>Nome da Mãe</Label><Input value={editForm['nomeMãe'] || ''} onChange={(e) => setEditForm(prev => ({ ...prev, 'nomeMãe': e.target.value }))} /></div>
                </div>
              </TabsContent>
              
              <TabsContent value="endereco" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>CEP</Label><Input value={editForm.cep || ''} onChange={(e) => setEditForm(prev => ({ ...prev, cep: e.target.value }))} /></div>
                  <div><Label>Rua</Label><Input value={editForm.rua || ''} onChange={(e) => setEditForm(prev => ({ ...prev, rua: e.target.value }))} /></div>
                  <div><Label>Número</Label><Input value={editForm.numero || ''} onChange={(e) => setEditForm(prev => ({ ...prev, numero: e.target.value }))} /></div>
                  <div><Label>Bairro</Label><Input value={editForm.bairro || ''} onChange={(e) => setEditForm(prev => ({ ...prev, bairro: e.target.value }))} /></div>
                  <div><Label>Cidade</Label><Input value={editForm.cidade || ''} onChange={(e) => setEditForm(prev => ({ ...prev, cidade: e.target.value }))} /></div>
                  <div><Label>UF</Label><Input value={editForm.UF || ''} onChange={(e) => setEditForm(prev => ({ ...prev, UF: e.target.value }))} maxLength={2} /></div>
                </div>
              </TabsContent>
              
              <TabsContent value="bancario" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Banco</Label><Input value={editForm.Banco || ''} onChange={(e) => setEditForm(prev => ({ ...prev, Banco: e.target.value }))} /></div>
                  <div><Label>Agência</Label><Input value={editForm.agencia || ''} onChange={(e) => setEditForm(prev => ({ ...prev, agencia: e.target.value }))} /></div>
                  <div><Label>Conta</Label><Input value={editForm.conta || ''} onChange={(e) => setEditForm(prev => ({ ...prev, conta: e.target.value }))} /></div>
                  <div><Label>Tipo Conta</Label><Select value={editForm['corrente ou poupança'] || ''} onValueChange={(val) => setEditForm(prev => ({ ...prev, 'corrente ou poupança': val }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="corrente">Corrente</SelectItem><SelectItem value="poupança">Poupança</SelectItem></SelectContent></Select></div>
                  <div><Label>Dígito Conta</Label><Input value={editForm.digitoconta || ''} onChange={(e) => setEditForm(prev => ({ ...prev, digitoconta: e.target.value }))} /></div>
                  <div><Label>PIX</Label><Input value={editForm.pix || ''} onChange={(e) => setEditForm(prev => ({ ...prev, pix: e.target.value }))} /></div>
                  <div className="col-span-2"><Label>Tipo de PIX</Label><Select value={editForm['tipo de pix'] || ''} onValueChange={(val) => setEditForm(prev => ({ ...prev, 'tipo de pix': val }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cpf">CPF</SelectItem><SelectItem value="email">Email</SelectItem><SelectItem value="telefone">Telefone</SelectItem><SelectItem value="aleatorio">Chave Aleatória</SelectItem></SelectContent></Select></div>
                </div>
              </TabsContent>
              
              {editForm.digitou && (
                <TabsContent value="proposta" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Valor Contrato</Label><Input type="number" value={editForm.valorContrato || ''} onChange={(e) => setEditForm(prev => ({ ...prev, valorContrato: e.target.value }))} /></div>
                    <div><Label>Proposta</Label><Input value={editForm.proposta || ''} onChange={(e) => setEditForm(prev => ({ ...prev, proposta: e.target.value }))} /></div>
                    <div><Label>Vendedor</Label><Input value={editForm.vendedor || ''} onChange={(e) => setEditForm(prev => ({ ...prev, vendedor: e.target.value }))} /></div>
                    <div><Label>Valor Parcela</Label><Input type="number" value={editForm.valorParcela || ''} onChange={(e) => setEditForm(prev => ({ ...prev, valorParcela: e.target.value }))} /></div>
                    <div><Label>Prazo</Label><Input type="number" value={editForm.prazo || ''} onChange={(e) => setEditForm(prev => ({ ...prev, prazo: e.target.value }))} /></div>
                    <div><Label>Valor Seguro</Label><Input type="number" value={editForm.valorSeguro || ''} onChange={(e) => setEditForm(prev => ({ ...prev, valorSeguro: e.target.value }))} /></div>
                  </div>
                </TabsContent>
              )}
            </Tabs>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button onClick={onEditSave} disabled={editLoading}>{editLoading ? 'Salvando...' : 'Salvar'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

// Component for displaying data table
function DataTableView({ data, loading, page, totalPages, total, onPageChange, columnNames, activeTab, onRefreshRow, onEditRow, refreshing }) {
  const [resizing, setResizing] = useState(null)
  const [startX, setStartX] = useState(0)
  const [startWidth, setStartWidth] = useState(0)
  const [widths, setWidths] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('clientes_column_widths')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch {}
      }
    }
    return {}
  })

  const handleMouseDown = (col, e) => {
    setResizing(col)
    setStartX(e.clientX)
    setStartWidth(widths[col] || 150)
  }

  const handleMouseMove = (e) => {
    if (!resizing) return
    const diff = e.clientX - startX
    const newWidth = Math.max(80, startWidth + diff)
    setWidths(prev => ({ ...prev, [resizing]: newWidth }))
  }

  const handleMouseUp = () => {
    if (resizing) {
      localStorage.setItem('clientes_column_widths', JSON.stringify(widths))
      setResizing(null)
    }
  }

  useEffect(() => {
    if (resizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [resizing, startX, startWidth])

  if (loading) {
    return (
      <div className="text-center py-12">
        <RefreshCw className="h-8 w-8 mx-auto animate-spin text-primary" />
        <p className="mt-2 text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Database className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Nenhum dado encontrado</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="outline">Total: {total} registros</Badge>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Página {page} de {totalPages}</Badge>
          <button
            className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded border hover:bg-muted disabled:opacity-50"
            onClick={() => onPageChange((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </button>
          <button
            className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded border hover:bg-muted disabled:opacity-50"
            onClick={() => onPageChange((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Próxima <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      <div className="border rounded-lg overflow-auto max-h-[600px]" style={{ userSelect: resizing ? 'none' : 'auto' }}>
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/70 backdrop-blur">
            <TableRow>
              {columnNames.map((col) => (
                <TableHead 
                  key={col} 
                  className="font-semibold relative group"
                  style={{ width: widths[col] || 150, minWidth: '80px' }}
                >
                  <div className="flex items-center justify-between pr-2">
                    <span className="truncate">{col}</span>
                    <div 
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400 hover:opacity-50 opacity-0 group-hover:opacity-100 transition-opacity"
                      onMouseDown={(e) => handleMouseDown(col, e)}
                      title="Arrastar para redimensionar"
                    />
                  </div>
                </TableHead>
              ))}
              <TableHead className="font-semibold text-right" style={{ width: 120 }}>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, idx) => (
              <TableRow key={idx}>
                {columnNames.map((col) => {
                  const norm = (s) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
                  const rowKeys = Object.keys(row)
                  const matchingKey = rowKeys.find(k => norm(k) === norm(col))
                  const value = matchingKey ? row[matchingKey] : null
                  return (
                    <TableCell key={col} className="max-w-xs truncate">
                      {value === null || value === undefined ? (
                        <span className="text-muted-foreground italic">-</span>
                      ) : typeof value === 'object' ? (
                        <span className="text-xs font-mono">{JSON.stringify(value)}</span>
                      ) : (
                        String(value)
                      )}
                    </TableCell>
                  )
                })}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {activeTab === 'carteira' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onRefreshRow(row.id)}
                        disabled={refreshing === row.id}
                        className="h-8 w-8 p-0"
                      >
                        <RefreshCw className={`h-4 w-4 ${refreshing === row.id ? 'animate-spin' : ''}`} />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onEditRow(row)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
