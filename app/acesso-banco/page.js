"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Key, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function AcessoBancoPage() {
  const [banks, setBanks] = useState([])
  const [legacyCreds, setLegacyCreds] = useState({}) // compat antigos
  const [usersByBank, setUsersByBank] = useState({}) // { bankKey: [ {id, alias, credentials, is_default} ] }
  const [currentBankKey, setCurrentBankKey] = useState('')
  const [message, setMessage] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [formAlias, setFormAlias] = useState('')
  const [formValues, setFormValues] = useState({})
  const [loadingUsers, setLoadingUsers] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/global-settings')
        const json = await res.json()
        const list = Array.isArray(json?.settings?.banks) ? json.settings.banks : []
        setBanks(list)
        if (list.length && !currentBankKey) setCurrentBankKey(list[0].key)
        await loadAllCreds()
      } catch {}
    })()
  }, [])

  const loadAllCreds = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/banks/credentials', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      const json = await res.json()
      if (res.ok) {
        setLegacyCreds(json.credentials || {})
        setUsersByBank(json.users || {})
      }
    } catch {}
  }

  const loadUsersForBank = async (bankKey) => {
    setLoadingUsers(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch(`/api/banks/credentials/users?bank_key=${encodeURIComponent(bankKey)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      const json = await res.json()
      if (res.ok) {
        setUsersByBank(prev => ({ ...prev, [bankKey]: json.items || [] }))
      }
    } catch {}
    finally { setLoadingUsers(false) }
  }

  useEffect(() => { if (currentBankKey) loadUsersForBank(currentBankKey) }, [currentBankKey])

  const openNewUser = () => {
    setEditingUser(null)
    setFormAlias('')
    setFormValues({})
    setModalOpen(true)
  }

  const openEditUser = (u) => {
    setEditingUser(u)
    setFormAlias(u.alias)
    setFormValues(u.credentials || {})
    setModalOpen(true)
  }

  const submitUser = async () => {
    const bankKey = currentBankKey
    if (!bankKey || !formAlias) return
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    if (editingUser) {
      const res = await fetch('/api/banks/credentials/users', { method: 'PUT', headers, body: JSON.stringify({ id: editingUser.id, alias: formAlias, credentials: formValues }) })
      if (res.ok) {
        setMessage('Usuário atualizado')
        setTimeout(()=>setMessage(''), 2500)
        setModalOpen(false)
        loadUsersForBank(bankKey)
      }
    } else {
      const res = await fetch('/api/banks/credentials/users', { method: 'POST', headers, body: JSON.stringify({ bank_key: bankKey, alias: formAlias, credentials: formValues }) })
      if (res.ok) {
        setMessage('Usuário criado')
        setTimeout(()=>setMessage(''), 2500)
        setModalOpen(false)
        loadUsersForBank(bankKey)
      }
    }
  }

  const deleteUser = async (u) => {
    if (!window.confirm('Remover este usuário?')) return
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    const res = await fetch('/api/banks/credentials/users', { method: 'DELETE', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ id: u.id }) })
    if (res.ok) {
      setMessage('Usuário removido')
      setTimeout(()=>setMessage(''), 2500)
      loadUsersForBank(currentBankKey)
    }
  }

  const setDefault = async (u) => {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    const res = await fetch('/api/banks/credentials/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ id: u.id }) })
    if (res.ok) {
      setMessage('Definido como padrão')
      setTimeout(()=>setMessage(''), 2500)
      loadUsersForBank(currentBankKey)
    }
  }

  const currentBank = banks.find(b => b.key === currentBankKey)
  const currentUsers = usersByBank[currentBankKey] || []

  const fillExample = (bankKey) => {
    const bank = banks.find(b => b.key === bankKey)
    if (!bank || !bank.fields) return
    
    const example = {}
    bank.fields.forEach(f => {
      if (f.type === 'select' && f.options && f.options.length > 0) {
        example[f.key] = f.options[0]
      } else {
        example[f.key] = `exemplo_${f.key}`
      }
    })
    
    setCreds(prev => ({
      ...prev,
      [bankKey]: { ...(prev[bankKey] || {}), ...example }
    }))
    setMessage(`✓ Valores de exemplo preenchidos para ${bank.name}`)
    setTimeout(() => setMessage(''), 2000)
  }

  return (
    <div className="-m-4 min-h-[calc(100vh-56px)] bg-background">
      <div className="max-w-full mx-auto py-6 px-6 space-y-6">
        {/* Header com gradiente */}
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg">
            <Key className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
              Senha de Banco
            </h1>
            <p className="text-muted-foreground mt-1">Informe suas credenciais para cada banco configurado</p>
          </div>
        </div>

        {message && (
          <Alert className="border-l-4 border-l-green-500 bg-green-50 dark:bg-green-950/20">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">{message}</AlertDescription>
          </Alert>
        )}
        {/* Selecionar banco */}
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Selecione o banco</div>
          <select className="h-10 px-2 rounded border border-border bg-card" value={currentBankKey} onChange={(e)=> setCurrentBankKey(e.target.value)}>
            {banks.map(b => <option key={b.key} value={b.key}>{b.name || b.key}</option>)}
          </select>
        </div>
        {currentBank ? (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{currentBank.name || currentBank.key}</div>
                <div className="text-xs text-muted-foreground">Usuários cadastrados para este banco</div>
              </div>
              <Button size="sm" onClick={openNewUser}>Novo usuário</Button>
            </div>
            <div className="border rounded divide-y">
              {loadingUsers && <div className="p-3 text-sm text-muted-foreground">Carregando...</div>}
              {!loadingUsers && currentUsers.length === 0 && <div className="p-3 text-sm text-muted-foreground">Nenhum usuário cadastrado.</div>}
              {currentUsers.map(u => (
                <div key={u.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-sm font-medium flex items-center gap-2">
                      {u.alias}
                      {u.is_default && <span className="px-2 py-0.5 text-[10px] rounded bg-green-600/20 text-green-700">Padrão</span>}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {Object.keys(u.credentials || {}).slice(0,6).map(k => (
                        <span key={k} className="text-[10px] px-2 py-0.5 rounded bg-muted border">{k}</span>
                      ))}
                      {Object.keys(u.credentials || {}).length > 6 && <span className="text-[10px] px-2">+{Object.keys(u.credentials || {}).length - 6}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!u.is_default && <Button size="sm" variant="outline" onClick={()=> setDefault(u)}>Padrão</Button>}
                    <Button size="sm" variant="outline" onClick={()=> openEditUser(u)}>Editar</Button>
                    <Button size="sm" variant="destructive" onClick={()=> deleteUser(u)}>Excluir</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {message && <div className="text-green-600 text-sm font-medium mt-4">{message}</div>}
        {/* Modal novo/editar usuário */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-card border rounded-lg w-full max-w-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold">{editingUser ? 'Editar usuário' : 'Novo usuário'}</div>
                <button className="text-sm text-muted-foreground" onClick={()=> setModalOpen(false)}>Fechar</button>
              </div>
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Apelido (alias)</div>
                <Input value={formAlias} onChange={(e)=> setFormAlias(e.target.value)} placeholder="Ex: Usuário 1" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[50vh] overflow-auto">
                {(currentBank?.fields || []).map((f, i) => {
                  const val = formValues[f.key] || ''
                  const label = f.label || f.key
                  if (f.type === 'select' && Array.isArray(f.options) && f.options.length > 0) {
                    return (
                      <div key={i} className="space-y-1">
                        <div className="text-[11px] text-muted-foreground">{label}</div>
                        <select className="h-9 w-full border rounded px-2 bg-muted" value={val} onChange={(e)=> setFormValues(prev => ({ ...prev, [f.key]: e.target.value }))}>
                          <option value=""></option>
                          {f.options.map((o,oi)=><option key={oi} value={o}>{o}</option>)}
                        </select>
                      </div>
                    )
                  }
                  return (
                    <div key={i} className="space-y-1">
                      <div className="text-[11px] text-muted-foreground">{label}</div>
                      <Input value={val} onChange={(e)=> setFormValues(prev => ({ ...prev, [f.key]: e.target.value }))} />
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={()=> setModalOpen(false)}>Cancelar</Button>
                <Button onClick={submitUser} disabled={!formAlias}>Salvar</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
