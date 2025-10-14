"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [branding, setBranding] = useState({ siteName: 'CRM', siteSubtitle: 'Supabase Viewer', logoUrl: '' })

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/global-settings')
        const json = await res.json()
        if (res.ok) setBranding({
          siteName: json?.settings?.siteName || 'CRM',
          siteSubtitle: json?.settings?.siteSubtitle || 'Supabase Viewer',
          logoUrl: json?.settings?.logoUrl || '',
        })
      } catch {}
    })()
  }, [])

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        router.replace('/')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader>
          <div className="flex flex-col items-center gap-2">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoUrl} alt="logo" className="h-10 w-10 object-contain" />
            ) : null}
            <div className="text-lg font-semibold">{branding.siteName}</div>
            <div className="text-xs text-muted-foreground">{branding.siteSubtitle}</div>
          </div>
          <CardTitle className="mt-2">Entrar</CardTitle>
          <CardDescription>Acesse com seu e-mail e senha</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <Input type="email" placeholder="email@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && (
              <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg border border-destructive/20 text-sm">{error}</div>
            )}
            <Button type="submit" disabled={loading} className="w-full">{loading ? 'Entrando...' : 'Entrar'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
