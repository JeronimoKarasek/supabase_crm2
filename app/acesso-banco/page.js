"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

export default function AcessoBancoPage() {
  const [banks, setBanks] = useState([])
  const [creds, setCreds] = useState({}) // { [bankKey]: { fieldKey: value } }
  const [message, setMessage] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/global-settings')
        const json = await res.json()
        setBanks(Array.isArray(json?.settings?.banks) ? json.settings.banks : [])
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData?.session?.access_token
        const cres = await fetch('/api/banks/credentials', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        const cjson = await cres.json()
        if (cres.ok) setCreds(cjson.credentials || {})
      } catch {}
    })()
  }, [])

  const save = async () => {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    const res = await fetch('/api/banks/credentials', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ credentials: creds }) })
    if (res.ok) setMessage('Salvo com sucesso')
  }

  return (
    <div className="-m-4 min-h-[calc(100vh-56px)] bg-background">
      <div className="max-w-full mx-auto py-6 px-6 space-y-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-foreground tracking-wide">Acesso Banco</h1>
          <p className="text-sm text-muted-foreground">Informe suas credenciais para cada banco configurado</p>
        </div>
        <div className="space-y-5">
          {banks.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhum banco configurado. Cadastre em Configuração.</div>
          ) : (
            banks.map((b) => (
              <div
                key={b.key}
                className="rounded-lg border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Banco</div>
                    <div className="text-lg font-semibold text-foreground">{b.name || b.key}</div>
                  </div>
                  <div className="hidden md:flex items-center gap-2 text-[10px] font-medium">
                    {b.forBatch ? <span className="px-2 py-1 rounded bg-muted text-muted-foreground border border-border">Lote</span> : null}
                    {b.forSimular ? <span className="px-2 py-1 rounded bg-muted text-muted-foreground border border-border">Simular/Digitar</span> : null}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {(b.fields || []).map((f, idx) => {
                    const val = creds?.[b.key]?.[f.key] || ''
                    const label = f.label || f.key
                    if (f.type === 'select' && Array.isArray(f.options) && f.options.length > 0) {
                      return (
                        <div key={idx} className="space-y-1.5">
                          <label className="text-xs font-medium text-muted-foreground">{label}</label>
                          <select
                            className="h-10 px-2 rounded border border-border bg-muted text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                            value={val}
                            onChange={(e) =>
                              setCreds((prev) => ({
                                ...prev,
                                [b.key]: { ...(prev[b.key] || {}), [f.key]: e.target.value },
                              }))
                            }
                          >
                            <option value="" className="text-black">Selecione...</option>
                            {f.options.map((o, i) => (
                              <option key={i} value={o} className="text-black">
                                {o}
                              </option>
                            ))}
                          </select>
                        </div>
                      )
                    }
                    return (
                      <div key={idx} className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">{label}</label>
                        <Input
                          placeholder={label}
                          value={val}
                          onChange={(e) =>
                            setCreds((prev) => ({
                              ...prev,
                              [b.key]: { ...(prev[b.key] || {}), [f.key]: e.target.value },
                            }))
                          }
                          className="h-10 bg-muted border border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/40"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          {message && <div className="text-success text-sm">{message}</div>}
          <Button onClick={save} className="bg-primary hover:bg-accent text-primary-foreground">Salvar credenciais</Button>
        </div>
      </div>
    </div>
  )
}
