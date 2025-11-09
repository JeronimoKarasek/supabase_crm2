"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Users } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { supabase } from '@/lib/supabase'
import { sectors } from '@/lib/sectors'

export default function UsuariosPage() {
  // Empresas
  const [empresas, setEmpresas] = useState([])
  const [empresaNome, setEmpresaNome] = useState('')
  const [empresaCnpj, setEmpresaCnpj] = useState('')
  const [empresaResp, setEmpresaResp] = useState('')
  const [empresaTel, setEmpresaTel] = useState('')
  const [empresaMsg, setEmpresaMsg] = useState('')
  const [empresaErr, setEmpresaErr] = useState('')
  const [empresaUserLimit, setEmpresaUserLimit] = useState('1')
  const [selectedEmpresaId, setSelectedEmpresaId] = useState('')
  // const [editEmpresaId, setEditEmpresaId] = useState('') // duplicado, já declarado abaixo
  const [editEmpresaNome, setEditEmpresaNome] = useState('')
  const [editEmpresaCnpj, setEditEmpresaCnpj] = useState('')
  const [editEmpresaResp, setEditEmpresaResp] = useState('')
  const [editEmpresaTel, setEditEmpresaTel] = useState('')
  const [editEmpresaUserLimit, setEditEmpresaUserLimit] = useState('1')
  const [editEmpresaMsg, setEditEmpresaMsg] = useState('')
  const [editEmpresaErr, setEditEmpresaErr] = useState('')
  const [editingEmpresaId, setEditingEmpresaId] = useState('')
  const [addCreditsEmpresaId, setAddCreditsEmpresaId] = useState('')
  const [addCreditsAmount, setAddCreditsAmount] = useState('')
  const [addCreditsMsg, setAddCreditsMsg] = useState('')
  const [addCreditsErr, setAddCreditsErr] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [cpf, setCpf] = useState('')
  const [role, setRole] = useState('user')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [users, setUsers] = useState([])
  const [currentUserRole, setCurrentUserRole] = useState('user')
  const [currentUserSectors, setCurrentUserSectors] = useState([])
  const [tables, setTables] = useState([])
  const [selectedSectorsNew, setSelectedSectorsNew] = useState([])

  // create form: tables + optional filter
  const [allowedTablesNew, setAllowedTablesNew] = useState([])
  const [filterTableNew, setFilterTableNew] = useState('')
  const [filterColumnsNew, setFilterColumnsNew] = useState([])
  const [filterColumnNew, setFilterColumnNew] = useState('')
  const [filterTypeNew, setFilterTypeNew] = useState('contains')
  const [filterValueNew, setFilterValueNew] = useState('')
  const [filtersByTableNew, setFiltersByTableNew] = useState({})

  // edit state
  const [editingId, setEditingId] = useState('')
  const [editRole, setEditRole] = useState('user')
  const [editCpf, setEditCpf] = useState('')
  const [editEmpresaId, setEditEmpresaId] = useState('')
  const [editAllowedTables, setEditAllowedTables] = useState([])
  const [editSelectedSectors, setEditSelectedSectors] = useState([])
  const [editFilterTable, setEditFilterTable] = useState('')
  const [editFilterColumns, setEditFilterColumns] = useState([])
  const [editFilterColumn, setEditFilterColumn] = useState('')
  const [editFilterType, setEditFilterType] = useState('contains')
  const [editFilterValue, setEditFilterValue] = useState('')
  const [editFiltersByTable, setEditFiltersByTable] = useState({})
  const [editPassword, setEditPassword] = useState('')

  const fetchUsers = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/users', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      const data = await res.json()
      if (res.ok) {
        setUsers(data.users || [])
      }
    } catch (e) {
      // ignore list errors silently for now
    }
  }

  useEffect(() => {
    fetchUsers()
    // load tables for selections
    ;(async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        const res = await fetch('/api/tables', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const data = await res.json()
        if (res.ok) {
          const raw = data.tables || []
          const names = raw.map(t => typeof t === 'string' ? t : (t.table_name || t))
          setTables(names)
        }
      } catch (e) {}
    })()
    // Carregar empresas
    ;(async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        const res = await fetch('/api/empresas', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
        const data = await res.json()
        if (res.ok) setEmpresas(data.empresas || [])
      } catch {}
    })()
    // Carregar role do usuário atual
    ;(async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        if (!token) return
        const { data: me } = await supabase.auth.getUser()
        if (me?.user?.user_metadata?.role) setCurrentUserRole(me.user.user_metadata.role)
        if (Array.isArray(me?.user?.user_metadata?.sectors)) setCurrentUserSectors(me.user.user_metadata.sectors)
      } catch {}
    })()
  }, [])

  // fetch columns helper
  const fetchColumns = async (tableName) => {
    if (!tableName) return []
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch(`/api/table-columns?table=${encodeURIComponent(tableName)}`, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
      const data = await res.json()
      if (res.ok) return data.columns || []
      return []
    } catch (e) {
      return []
    }
  }

  // when filter table (create) changes, load columns
  useEffect(() => {
    if (!filterTableNew) {
      setFilterColumnsNew([])
      setFilterColumnNew('')
      return
    }
    ;(async () => {
      const cols = await fetchColumns(filterTableNew)
      setFilterColumnsNew(cols)
      setFilterColumnNew('')
    })()
  }, [filterTableNew])

  // when filter table (edit) changes, load columns
  useEffect(() => {
    if (!editFilterTable) {
      setEditFilterColumns([])
      setEditFilterColumn('')
      return
    }
    ;(async () => {
      const cols = await fetchColumns(editFilterTable)
      setEditFilterColumns(cols)
      setEditFilterColumn('')
    })()
  }, [editFilterTable])

  const onSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')
    try {
      const payload = {
        email,
        password,
        cpf,
        role,
        empresaId: selectedEmpresaId,
        allowedTables: allowedTablesNew,
        filtersByTable: filtersByTableNew,
      }
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ ...payload, sectors: selectedSectorsNew }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage('Usuário criado com sucesso.')
        setEmail('')
        setPassword('')
        setCpf('')
        setRole('user')
        setSelectedEmpresaId('')
        setAllowedTablesNew([])
        setFilterTableNew('')
        setFilterColumnsNew([])
        setFilterColumnNew('')
        setFilterTypeNew('contains')
        setFilterValueNew('')
        setFiltersByTableNew({})
        fetchUsers()
      } else {
        setError(data?.error || 'Falha ao criar usuário')
      }
    } catch (err) {
      setError('Erro inesperado ao criar usuário')
    } finally {
      setLoading(false)
    }
  }

  const toggleAllowedNew = (t) => {
    setAllowedTablesNew((prev) => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  const addFilterNew = () => {
    if (!filterTableNew || !filterColumnNew || String(filterValueNew).length === 0) return
    setFiltersByTableNew((prev) => {
      const list = prev[filterTableNew] ? [...prev[filterTableNew]] : []
      list.push({ column: filterColumnNew, type: filterTypeNew, value: filterValueNew })
      return { ...prev, [filterTableNew]: list }
    })
    setFilterColumnNew('')
    setFilterTypeNew('contains')
    setFilterValueNew('')
  }

  const removeFilterNew = (table, idx) => {
    setFiltersByTableNew((prev) => {
      const list = [...(prev[table] || [])]
      list.splice(idx, 1)
      const next = { ...prev }
      if (list.length) next[table] = list
      else delete next[table]
      return next
    })
  }

  const startEdit = (u) => {
  setEditingId(u.id)
  const meta = u.user_metadata || {}
  setEditRole(meta.role || 'user')
  setEditCpf(meta.cpf || '')
  setEditEmpresaId(meta.empresaId || '')
  const allowed = meta.permissions?.allowedTables || []
  setEditAllowedTables(allowed)
  setEditSelectedSectors(Array.isArray(meta.sectors) ? meta.sectors : [])
  // support legacy single filter, mas prefer filtersByTable
  const fbt = meta.permissions?.filtersByTable
  const legacy = meta.permissions?.filter
  let initial = {}
  if (fbt && typeof fbt === 'object') initial = fbt
  else if (legacy?.table) initial = { [legacy.table]: [{ column: legacy.column, type: legacy.type, value: legacy.value }] }
  setEditFiltersByTable(initial)
  setEditFilterTable('')
  setEditFilterColumn('')
  setEditFilterType('contains')
  setEditFilterValue('')
  }

  const toggleAllowedEdit = (t) => {
    setEditAllowedTables((prev) => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  const addFilterEdit = () => {
    if (!editFilterTable || !editFilterColumn || String(editFilterValue).length === 0) return
    setEditFiltersByTable((prev) => {
      const list = prev[editFilterTable] ? [...prev[editFilterTable]] : []
      list.push({ column: editFilterColumn, type: editFilterType, value: editFilterValue })
      return { ...prev, [editFilterTable]: list }
    })
    setEditFilterColumn('')
    setEditFilterType('contains')
    setEditFilterValue('')
  }

  const removeFilterEdit = (table, idx) => {
    setEditFiltersByTable((prev) => {
      const list = [...(prev[table] || [])]
      list.splice(idx, 1)
      const next = { ...prev }
      if (list.length) next[table] = list
      else delete next[table]
      return next
    })
  }

  const saveEdit = async () => {
    if (!editingId) return
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const payload = {
        id: editingId,
        role: editRole,
        cpf: editCpf,
        empresaId: editEmpresaId,
        allowedTables: editAllowedTables,
        filtersByTable: editFiltersByTable,
      }
      if (editPassword && editPassword.length >= 8) payload.password = editPassword
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/users', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ ...payload, sectors: editSelectedSectors }) })
      const data = await res.json()
      if (res.ok) {
        setMessage('Usuário atualizado com sucesso.')
        setEditingId('')
        setEditCpf('')
        setEditPassword('')
        await fetchUsers()
      } else {
        setError(data?.error || 'Falha ao atualizar usuário')
      }
    } catch (e) {
      setError('Erro inesperado ao atualizar usuário')
    } finally {
      setLoading(false)
    }
  }

  const onDeleteUser = async (u) => {
    if (!u?.id) return
    const ok = window.confirm(`Excluir usuário ${u.email}?`)
    if (!ok) return
    try {
      setLoading(true)
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ id: u.id }) })
      if (res.ok) {
        fetchUsers()
      } else {
        const data = await res.json()
        setError(data?.error || 'Falha ao excluir usuário')
      }
    } catch (e) {
      setError('Erro inesperado ao excluir usuário')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="-m-4 min-h-[calc(100vh-56px)] bg-background">
      <div className="container mx-auto py-6 px-6">
        <Tabs defaultValue="usuarios" className="space-y-6">
          <TabsList className={`grid w-full md:max-w-md mb-6 ${currentUserRole === 'admin' ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <TabsTrigger value="usuarios">Usuários</TabsTrigger>
            {currentUserRole === 'admin' && <TabsTrigger value="empresas">Empresas</TabsTrigger>}
          </TabsList>

          {/* Tab Usuários */}
          <TabsContent value="usuarios">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Novo Usuário</CardTitle>
                <CardDescription>Informe e-mail, senha, papel, empresa e acesso</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid grid-cols-1 md:grid-cols-6 gap-4" onSubmit={onSubmit}>
                  <Input
                    type="email"
                    placeholder="email@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <Input
                    type="password"
                    placeholder="Senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                  <Input
                    type="text"
                    placeholder="CPF (opcional)"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    maxLength={14}
                  />
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Papel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Usuário</SelectItem>
                      <SelectItem value="gestor">Gestor</SelectItem>
                        {currentUserRole === 'admin' && <SelectItem value="admin">Admin</SelectItem>}
                    </SelectContent>
                  </Select>
                  <Select value={selectedEmpresaId} onValueChange={setSelectedEmpresaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Empresa" />
                    </SelectTrigger>
                    <SelectContent>
                      {empresas.map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Salvando...' : 'Criar usuário'}
                  </Button>
                </form>
                {/* Allowed tables */}
                <div className="mt-6">
                  <div className="text-sm font-medium mb-2">Tabelas permitidas</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {tables.map((t) => (
                      <label key={t} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={allowedTablesNew.includes(t)} onCheckedChange={() => toggleAllowedNew(t)} />
                        <span>{t}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {/* Sectors */}
                <div className="mt-6">
                  <div className="text-sm font-medium mb-2">Setores</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {(currentUserRole === 'admin' ? sectors : sectors.filter(s => currentUserSectors.includes(s))).map((s) => (
                      <label key={s} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={selectedSectorsNew.includes(s)} onCheckedChange={() => setSelectedSectorsNew((prev) => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} />
                        <span>{s}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {/* Optional filters (multiple) */}
                <div className="mt-6">
                  <div className="text-sm font-medium mb-2">Filtros (você pode adicionar vários por tabela)</div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Select value={filterTableNew} onValueChange={setFilterTableNew}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tabela" />
                      </SelectTrigger>
                      <SelectContent>
                        {tables.map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={filterColumnNew} onValueChange={setFilterColumnNew} disabled={!filterTableNew}>
                      <SelectTrigger>
                        <SelectValue placeholder="Coluna" />
                      </SelectTrigger>
                      <SelectContent>
                        {filterColumnsNew.map(c => (
                          <SelectItem key={c.column_name} value={c.column_name}>{c.column_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={filterTypeNew} onValueChange={setFilterTypeNew} disabled={!filterTableNew || !filterColumnNew}>
                      <SelectTrigger>
                        <SelectValue placeholder="Tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contains">Contém</SelectItem>
                        <SelectItem value="equals">Igual</SelectItem>
                        <SelectItem value="greaterThan">Maior que</SelectItem>
                        <SelectItem value="lessThan">Menor que</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Input className="flex-1" placeholder="Valor" value={filterValueNew} onChange={(e) => setFilterValueNew(e.target.value)} disabled={!filterTableNew || !filterColumnNew} />
                      <Button type="button" variant="outline" onClick={addFilterNew} disabled={!filterTableNew || !filterColumnNew || !String(filterValueNew).length}>Adicionar</Button>
                    </div>
                  </div>
                  {/* List added filters */}
                  <div className="mt-3 space-y-2">
                    {Object.entries(filtersByTableNew).map(([table, list]) => (
                      <div key={table} className="text-sm">
                        <div className="font-medium">{table}</div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {list.map((f, idx) => (
                            <div key={idx} className="px-2 py-1 rounded border bg-muted/50">
                              <span className="font-mono text-xs">{f.column} {f.type} {String(f.value)}</span>
                              <Button size="sm" variant="ghost" className="ml-2 h-6 px-2" onClick={() => removeFilterNew(table, idx)}>Remover</Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {message && (
                  <div className="mt-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-4 py-3 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    {message}
                  </div>
                )}
                {error && (
                  <div className="mt-4 bg-destructive/10 text-destructive px-4 py-3 rounded-lg border border-destructive/20">
                    {error}
                  </div>
                )}
              </CardContent>
            </Card>
            {/* Edit section */}
            {editingId && (
              <div className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Editar usuário</CardTitle>
                    <CardDescription>ID: {editingId}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                      <Select value={editRole} onValueChange={setEditRole}>
                        <SelectTrigger>
                          <SelectValue placeholder="Papel" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">Usuário</SelectItem>
                          <SelectItem value="gestor">Gestor</SelectItem>
                          {currentUserRole === 'admin' && <SelectItem value="admin">Admin</SelectItem>}
                        </SelectContent>
                      </Select>
                      <Select value={editEmpresaId} onValueChange={setEditEmpresaId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Empresa" />
                        </SelectTrigger>
                        <SelectContent>
                          {empresas.map(e => (
                            <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input type="text" placeholder="CPF (opcional)" value={editCpf} onChange={(e)=> setEditCpf(e.target.value)} maxLength={14} />
                      <Input type="password" placeholder="Nova senha (opcional)" value={editPassword} onChange={(e)=> setEditPassword(e.target.value)} minLength={8} />
                      <div className="md:col-span-2 flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => { setEditingId(''); setEditCpf(''); setEditPassword('') }}>Cancelar</Button>
                        <Button onClick={saveEdit} disabled={loading}>{loading ? 'Salvando...' : 'Salvar alterações'}</Button>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-2">Tabelas permitidas</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {tables.map((t) => (
                          <label key={t} className="flex items-center gap-2 text-sm">
                            <Checkbox checked={editAllowedTables.includes(t)} onCheckedChange={() => toggleAllowedEdit(t)} />
                            <span>{t}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-2">Setores</div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {(currentUserRole === 'admin' ? sectors : sectors.filter(s => currentUserSectors.includes(s))).map((s) => (
                          <label key={s} className="flex items-center gap-2 text-sm">
                            <Checkbox checked={editSelectedSectors.includes(s)} onCheckedChange={() => setEditSelectedSectors((prev) => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} />
                            <span>{s}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium mb-2">Filtros (você pode adicionar vários por tabela)</div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Select value={editFilterTable} onValueChange={setEditFilterTable}>
                          <SelectTrigger>
                            <SelectValue placeholder="Tabela" />
                          </SelectTrigger>
                          <SelectContent>
                            {tables.map(t => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={editFilterColumn} onValueChange={setEditFilterColumn} disabled={!editFilterTable}>
                          <SelectTrigger>
                            <SelectValue placeholder="Coluna" />
                          </SelectTrigger>
                          <SelectContent>
                            {editFilterColumns.map(c => (
                              <SelectItem key={c.column_name} value={c.column_name}>{c.column_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={editFilterType} onValueChange={setEditFilterType} disabled={!editFilterTable || !editFilterColumn}>
                          <SelectTrigger>
                            <SelectValue placeholder="Tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="contains">Contém</SelectItem>
                            <SelectItem value="equals">Igual</SelectItem>
                            <SelectItem value="greaterThan">Maior que</SelectItem>
                            <SelectItem value="lessThan">Menor que</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2">
                          <Input className="flex-1" placeholder="Valor" value={editFilterValue} onChange={(e) => setEditFilterValue(e.target.value)} disabled={!editFilterTable || !editFilterColumn} />
                          <Button type="button" variant="outline" onClick={addFilterEdit} disabled={!editFilterTable || !editFilterColumn || !String(editFilterValue).length}>Adicionar</Button>
                        </div>
                      </div>
                      {/* List current filters */}
                      <div className="mt-3 space-y-2">
                        {Object.entries(editFiltersByTable).map(([table, list]) => (
                          <div key={table} className="text-sm">
                            <div className="font-medium">{table}</div>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {list.map((f, idx) => (
                                <div key={idx} className="px-2 py-1 rounded border bg-muted/50">
                                  <span className="font-mono text-xs">{f.column} {f.type} {String(f.value)}</span>
                                  <Button size="sm" variant="ghost" className="ml-2 h-6 px-2" onClick={() => removeFilterEdit(table, idx)}>Remover</Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
            {/* Lista de usuários */}
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>Usuários cadastrados</CardTitle>
                <CardDescription>Hierarquia aplicada: admin=todos, gestor=empresa, usuário=próprio.</CardDescription>
              </CardHeader>
              <CardContent>
                {users?.length ? (
                  <div className="border rounded-lg overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Papel</TableHead>
                          <TableHead>Empresa</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map(u => (
                          <TableRow key={u.id}>
                            <TableCell>{u.email}</TableCell>
                            <TableCell>{u.user_metadata?.role || '-'}</TableCell>
                            <TableCell>{u.user_metadata?.empresaId || '—'}</TableCell>
                            <TableCell className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => startEdit(u)}>Editar</Button>
                              <Button size="sm" variant="destructive" onClick={() => onDeleteUser(u)}>Excluir</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Nenhum usuário visível nesta hierarquia.</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab Empresas - apenas para admins */}
          {currentUserRole === 'admin' && <TabsContent value="empresas">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Nova Empresa</CardTitle>
                <CardDescription>Cadastre uma empresa para vincular usuários e créditos compartilhados</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid grid-cols-1 md:grid-cols-5 gap-4" onSubmit={async (e) => {
                  e.preventDefault()
                  setEmpresaMsg(''); setEmpresaErr('')
                  try {
                    const { data: sessionData } = await supabase.auth.getSession()
                    const token = sessionData?.session?.access_token
                    const res = await fetch('/api/empresas', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                      body: JSON.stringify({ nome: empresaNome, cnpj: empresaCnpj, responsavel: empresaResp, telefone: empresaTel, user_limit: empresaUserLimit || 1 })
                    })
                    const data = await res.json()
                    if (res.ok) {
                      setEmpresaMsg('Empresa cadastrada com sucesso!')
                      setEmpresaNome(''); setEmpresaCnpj(''); setEmpresaResp(''); setEmpresaTel(''); setEmpresaUserLimit('1')
                      // reload empresas
                      const res2 = await fetch('/api/empresas', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
                      const data2 = await res2.json()
                      if (res2.ok) setEmpresas(data2.empresas || [])
                    } else {
                      const errorMsg = data?.details 
                        ? `${data.error}\n\nDetalhes: ${data.details}\nCódigo: ${data.code}\n\nDica: ${data.hint || 'Execute o script SQL em scripts/sql/add_credits_to_empresa.sql no Supabase SQL Editor'}`
                        : (data?.error || 'Falha ao cadastrar empresa')
                      setEmpresaErr(errorMsg)
                    }
                  } catch (err) {
                    setEmpresaErr('Erro inesperado ao cadastrar empresa')
                  }
                }}>
                  <Input placeholder="Nome da empresa" value={empresaNome} onChange={e=>setEmpresaNome(e.target.value)} required />
                  <Input placeholder="CNPJ" value={empresaCnpj} onChange={e=>setEmpresaCnpj(e.target.value)} />
                  <Input placeholder="Responsável" value={empresaResp} onChange={e=>setEmpresaResp(e.target.value)} />
                  <Input placeholder="Telefone" value={empresaTel} onChange={e=>setEmpresaTel(e.target.value)} />
                  <Input placeholder="Limite usuários (padrão 1)" value={empresaUserLimit} onChange={e=>setEmpresaUserLimit(e.target.value)} />
                  <Button type="submit">Cadastrar empresa</Button>
                </form>
                {empresaMsg && <div className="mt-2 text-emerald-700 dark:text-emerald-300 text-sm">{empresaMsg}</div>}
                {empresaErr && <div className="mt-2 text-red-600 dark:text-red-400 text-sm">{empresaErr}</div>}
              </CardContent>
            </Card>
            <Card className="bg-card mt-8">
              <CardHeader>
                <CardTitle>Empresas cadastradas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>CNPJ</TableHead>
                        <TableHead>Responsável</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Limite</TableHead>
                        <TableHead>Créditos</TableHead>
                        <TableHead>ID</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {empresas.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell>{e.nome}</TableCell>
                          <TableCell>{e.cnpj}</TableCell>
                          <TableCell>{e.responsavel}</TableCell>
                          <TableCell>{e.telefone}</TableCell>
                          <TableCell>{e.user_limit || 1}</TableCell>
                          <TableCell>R$ {(parseFloat(e.credits) || 0).toFixed(2)}</TableCell>
                          <TableCell className="font-mono text-xs">{e.id}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => {
                                setEditingEmpresaId(e.id)
                                setEditEmpresaNome(e.nome || '')
                                setEditEmpresaCnpj(e.cnpj || '')
                                setEditEmpresaResp(e.responsavel || '')
                                setEditEmpresaTel(e.telefone || '')
                                setEditEmpresaUserLimit(String(e.user_limit || 1))
                              }}>Editar</Button>
                              <Button size="sm" variant="outline" onClick={() => {
                                setAddCreditsEmpresaId(e.id)
                                setAddCreditsAmount('')
                                setAddCreditsMsg('')
                                setAddCreditsErr('')
                              }}>+ Créditos</Button>
                              <Button size="sm" variant="destructive" onClick={async () => {
                                if (!window.confirm(`Excluir empresa "${e.nome}"?`)) return
                                try {
                                  const { data: sessionData } = await supabase.auth.getSession()
                                  const token = sessionData?.session?.access_token
                                  const res = await fetch('/api/empresas', {
                                    method: 'DELETE',
                                    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                                    body: JSON.stringify({ id: e.id })
                                  })
                                  const data = await res.json()
                                  if (res.ok) {
                                    const res2 = await fetch('/api/empresas', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
                                    const data2 = await res2.json()
                                    if (res2.ok) setEmpresas(data2.empresas || [])
                                  } else {
                                    alert(data?.error || 'Falha ao excluir empresa')
                                  }
                                } catch (err) {
                                  alert('Erro ao excluir empresa')
                                }
                              }}>Excluir</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
            {editingEmpresaId && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Editar Empresa</CardTitle>
                  <CardDescription>ID: {editingEmpresaId}</CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="grid grid-cols-1 md:grid-cols-6 gap-4" onSubmit={async (e) => {
                    e.preventDefault()
                    setEditEmpresaMsg(''); setEditEmpresaErr('')
                    try {
                      const { data: sessionData } = await supabase.auth.getSession()
                      const token = sessionData?.session?.access_token
                      const payload = { 
                        id: editingEmpresaId, 
                        nome: editEmpresaNome, 
                        cnpj: editEmpresaCnpj || null, 
                        responsavel: editEmpresaResp || null, 
                        telefone: editEmpresaTel || null, 
                        user_limit: parseInt(editEmpresaUserLimit) || 1 
                      }
                      const res = await fetch('/api/empresas', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                        body: JSON.stringify(payload)
                      })
                      const data = await res.json()
                      if (res.ok) {
                        setEditEmpresaMsg('Empresa atualizada com sucesso!')
                        const res2 = await fetch('/api/empresas', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
                        const data2 = await res2.json()
                        if (res2.ok) setEmpresas(data2.empresas || [])
                        setTimeout(() => setEditingEmpresaId(''), 1500)
                      } else {
                        const errorMsg = data?.details 
                          ? `${data.error}\n\nDetalhes: ${data.details}\nCódigo: ${data.code}\n\nDica: ${data.hint || 'Execute o script SQL em scripts/sql/add_credits_to_empresa.sql'}`
                          : (data?.error || 'Falha ao atualizar empresa')
                        setEditEmpresaErr(errorMsg)
                      }
                    } catch (err) {
                      setEditEmpresaErr('Erro inesperado ao atualizar empresa')
                    }
                  }}>
                    <Input placeholder="Nome da empresa" value={editEmpresaNome} onChange={e=>setEditEmpresaNome(e.target.value)} required />
                    <Input placeholder="CNPJ" value={editEmpresaCnpj} onChange={e=>setEditEmpresaCnpj(e.target.value)} />
                    <Input placeholder="Responsável" value={editEmpresaResp} onChange={e=>setEditEmpresaResp(e.target.value)} />
                    <Input placeholder="Telefone" value={editEmpresaTel} onChange={e=>setEditEmpresaTel(e.target.value)} />
                    <Input placeholder="Limite usuários" value={editEmpresaUserLimit} onChange={e=>setEditEmpresaUserLimit(e.target.value)} />
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => setEditingEmpresaId('')}>Cancelar</Button>
                      <Button type="submit">Salvar</Button>
                    </div>
                  </form>
                  {editEmpresaMsg && <div className="mt-2 text-emerald-700 dark:text-emerald-300 text-sm">{editEmpresaMsg}</div>}
                  {editEmpresaErr && <div className="mt-2 text-red-600 dark:text-red-400 text-sm">{editEmpresaErr}</div>}
                </CardContent>
              </Card>
            )}
            {addCreditsEmpresaId && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Ajustar Créditos</CardTitle>
                  <CardDescription>
                    Empresa: {empresas.find(e => e.id === addCreditsEmpresaId)?.nome} | 
                    Saldo atual: R$ {(parseFloat(empresas.find(e => e.id === addCreditsEmpresaId)?.credits) || 0).toFixed(2)}
                    <br />
                    <span className="text-xs text-muted-foreground">
                      Use valores positivos para adicionar ou negativos para remover créditos
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="grid grid-cols-1 md:grid-cols-3 gap-4" onSubmit={async (e) => {
                    e.preventDefault()
                    setAddCreditsMsg(''); setAddCreditsErr('')
                    try {
                      const empresa = empresas.find(e => e.id === addCreditsEmpresaId)
                      const currentCredits = parseFloat(empresa?.credits) || 0
                      const adjustAmount = parseFloat(addCreditsAmount) || 0
                      if (adjustAmount === 0) {
                        setAddCreditsErr('Valor não pode ser zero')
                        return
                      }
                      // Calcular novo saldo, não permitindo negativo
                      const newCredits = Math.max(0, currentCredits + adjustAmount)
                      const { data: sessionData } = await supabase.auth.getSession()
                      const token = sessionData?.session?.access_token
                      const res = await fetch('/api/empresas', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                        body: JSON.stringify({ 
                          id: addCreditsEmpresaId, 
                          nome: empresa.nome,
                          cnpj: empresa.cnpj,
                          responsavel: empresa.responsavel,
                          telefone: empresa.telefone,
                          user_limit: empresa.user_limit,
                          credits: newCredits
                        })
                      })
                      const data = await res.json()
                      if (res.ok) {
                        const acao = adjustAmount > 0 ? 'adicionados' : 'removidos'
                        setAddCreditsMsg(`Créditos ${acao}! Novo saldo: R$ ${newCredits.toFixed(2)}`)
                        const res2 = await fetch('/api/empresas', { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
                        const data2 = await res2.json()
                        if (res2.ok) setEmpresas(data2.empresas || [])
                        setTimeout(() => setAddCreditsEmpresaId(''), 2000)
                      } else {
                        const errorMsg = data?.details 
                          ? `${data.error}\n\nDetalhes: ${data.details}\n\nDica: ${data.hint || 'Execute o script SQL em scripts/sql/add_credits_to_empresa.sql'}`
                          : (data?.error || 'Falha ao ajustar créditos')
                        setAddCreditsErr(errorMsg)
                      }
                    } catch (err) {
                      setAddCreditsErr('Erro inesperado')
                    }
                  }}>
                    <Input 
                      type="number" 
                      step="0.01" 
                      placeholder="Valor (positivo ou negativo)" 
                      value={addCreditsAmount} 
                      onChange={e=>setAddCreditsAmount(e.target.value)} 
                      required 
                    />
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => setAddCreditsEmpresaId('')}>Cancelar</Button>
                      <Button type="submit">Aplicar</Button>
                    </div>
                  </form>
                  {addCreditsMsg && <div className="mt-2 text-emerald-700 dark:text-emerald-300 text-sm">{addCreditsMsg}</div>}
                  {addCreditsErr && <div className="mt-2 text-red-600 dark:text-red-400 text-sm">{addCreditsErr}</div>}
                </CardContent>
              </Card>
            )}
          </TabsContent>}


        </Tabs>
      </div>
    </div>
  )
}

function AdminAddCreditsForm(){
  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const submit = async () => {
    setLoading(true); setMsg(''); setErr('')
    try{
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/credits/admin-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ userId: userId || undefined, email: email || undefined, amount })
      })
      const j = await res.json()
      if (!res.ok) {
        setErr(j?.error || 'Falha ao adicionar créditos')
      } else {
        setMsg(`Novo saldo: ${j.balanceBRL}`)
        setUserId(''); setEmail(''); setAmount('')
      }
    } catch(e){
      setErr('Erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Input placeholder="ID do usuário (UUID)" value={userId} onChange={(e)=> setUserId(e.target.value)} />
        <Input placeholder="ou e-mail do usuário" value={email} onChange={(e)=> setEmail(e.target.value)} />
        <Input placeholder="Valor em R$ (ex: 50,00)" value={amount} onChange={(e)=> setAmount(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button onClick={submit} disabled={loading || (!userId && !email) || !amount}>
          {loading ? 'Processando...' : 'Adicionar Créditos'}
        </Button>
        {msg && <div className="text-emerald-700 dark:text-emerald-300 text-sm self-center">{msg}</div>}
        {err && <div className="text-red-600 dark:text-red-400 text-sm self-center">{err}</div>}
      </div>
      <div className="text-xs text-muted-foreground">
        Para liberar esta função, adicione seu e-mail em Configuração &gt; adminEmails (em global settings). Caso contrário, retorno será 403.
      </div>
    </div>
  )
}
