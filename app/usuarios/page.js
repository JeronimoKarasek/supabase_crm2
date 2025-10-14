"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Users } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { supabase } from '@/lib/supabase'
import { sectors } from '@/lib/sectors'

export default function UsuariosPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('viewer')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [users, setUsers] = useState([])
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
  const [editRole, setEditRole] = useState('viewer')
  const [editAllowedTables, setEditAllowedTables] = useState([])
  const [editSelectedSectors, setEditSelectedSectors] = useState([])
  const [editFilterTable, setEditFilterTable] = useState('')
  const [editFilterColumns, setEditFilterColumns] = useState([])
  const [editFilterColumn, setEditFilterColumn] = useState('')
  const [editFilterType, setEditFilterType] = useState('contains')
  const [editFilterValue, setEditFilterValue] = useState('')
  const [editFiltersByTable, setEditFiltersByTable] = useState({})

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
      } catch (e) {
        // ignore
      }
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
        role,
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
        setRole('viewer')
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
    setEditRole(meta.role || 'viewer')
    const allowed = meta.permissions?.allowedTables || []
    setEditAllowedTables(allowed)
    setEditSelectedSectors(Array.isArray(meta.sectors) ? meta.sectors : [])
    // support legacy single filter, but prefer filtersByTable
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
        allowedTables: editAllowedTables,
        filtersByTable: editFiltersByTable,
      }
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/users', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ ...payload, sectors: editSelectedSectors }) })
      const data = await res.json()
      if (res.ok) {
        setMessage('Usuário atualizado com sucesso.')
        setEditingId('')
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold text-foreground">Usuários</h1>
          </div>
          <p className="text-muted-foreground">Crie usuários com permissão de visualização (viewer) e defina o acesso</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Novo Usuário</CardTitle>
            <CardDescription>Informe e-mail, senha, permissão e acesso</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid grid-cols-1 md:grid-cols-4 gap-4" onSubmit={onSubmit}>
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
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
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
                {sectors.map((s) => (
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

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Usuários cadastrados</CardTitle>
              <CardDescription>Listagem básica de usuários</CardDescription>
            </CardHeader>
            <CardContent>
              {users?.length > 0 ? (
                <div className="border rounded-lg overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Permissão</TableHead>
                        <TableHead>Tabelas</TableHead>
                        <TableHead>Setores</TableHead>
                        <TableHead>Ações</TableHead>
                        <TableHead>ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => {
                        const allowed = u.user_metadata?.permissions?.allowedTables || []
                        const userSectors = Array.isArray(u.user_metadata?.sectors) ? u.user_metadata.sectors : []
                        const isSelf = false // optional: could compare with current session
                        return (
                          <TableRow key={u.id}>
                            <TableCell>{u.email}</TableCell>
                            <TableCell>{u.user_metadata?.role || '-'}</TableCell>
                            <TableCell className="text-xs">{allowed.length ? allowed.join(', ') : '—'}</TableCell>
                            <TableCell className="text-xs">{userSectors.length ? userSectors.join(', ') : '—'}</TableCell>
                            <TableCell className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => startEdit(u)}>Editar</Button>
                              <Button size="sm" variant="destructive" onClick={() => onDeleteUser(u)}>
                                Excluir
                              </Button>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{u.id}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-muted-foreground">Nenhum usuário encontrado</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Edit section */}
        {editingId && (
          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Editar usuário</CardTitle>
                <CardDescription>ID: {editingId}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Select value={editRole} onValueChange={setEditRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="md:col-span-3 flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setEditingId('')}>Cancelar</Button>
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
                    {sectors.map((s) => (
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
      </div>
    </div>
  )
}
