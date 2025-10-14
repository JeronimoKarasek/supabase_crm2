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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Acesso Banco</CardTitle>
            <CardDescription>Informe suas credenciais para cada banco configurado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {banks.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhum banco configurado. Cadastre em Configuração.</div>
            ) : banks.map((b) => (
              <div key={b.key} className="p-3 border rounded space-y-2">
                <div className="font-medium">{b.name}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {(b.fields || []).map((f, idx) => (
                    <Input key={idx} placeholder={f.label || f.key} value={creds?.[b.key]?.[f.key] || ''} onChange={(e) => setCreds(prev => ({ ...prev, [b.key]: { ...(prev[b.key]||{}), [f.key]: e.target.value } }))} />
                  ))}
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-2 items-center">
              {message && <div className="text-emerald-600 text-sm">{message}</div>}
              <Button onClick={save}>Salvar credenciais</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
