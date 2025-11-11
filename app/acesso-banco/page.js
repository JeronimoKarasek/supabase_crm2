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
    if (res.ok) {
      setMessage('✓ Credenciais salvas com sucesso!')
      setTimeout(() => setMessage(''), 3000)
    }
  }

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
          <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-500 shadow-lg">
            <Key className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-600 to-amber-600 bg-clip-text text-transparent">
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
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => fillExample(b.key)}
                      className="text-xs"
                    >
                      Preencher exemplo
                    </Button>
                    <div className="hidden md:flex items-center gap-2 text-[10px] font-medium">
                      {b.forBatch ? <span className="px-2 py-1 rounded bg-muted text-muted-foreground border border-border">Lote</span> : null}
                      {b.forSimular ? <span className="px-2 py-1 rounded bg-muted text-muted-foreground border border-border">Simular/Digitar</span> : null}
                    </div>
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
        <div className="flex justify-between items-center gap-3 pt-2">
          {message && <div className="text-green-600 text-sm font-medium">{message}</div>}
          <Button onClick={save} className="ml-auto bg-primary hover:bg-accent text-primary-foreground">Salvar todas as credenciais</Button>
        </div>
      </div>
    </div>
  )
}
