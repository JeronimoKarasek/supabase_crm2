"use client"

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

export default function AssinarFarolChat() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ nome: '', telefone: '', cpf: '', email: '', empresa: '' })
  const [settings, setSettings] = useState({ userPrice: 0, connectionPrice: 0 })
  const [qty, setQty] = useState({ users: 1, connections: 1 })
  const [isSubmitting, setSubmitting] = useState(false)
  const [payment, setPayment] = useState(null) // { paymentUrl, qrcode }
  const [message, setMessage] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/global-settings')
        const json = await res.json()
        const up = Number(json?.settings?.farolChat?.userPrice || 0)
        const cp = Number(json?.settings?.farolChat?.connectionPrice || 0)
        setSettings({ userPrice: up, connectionPrice: cp })
      } catch {}
    })()
  }, [])

  const totalUsers = useMemo(() => (qty.users || 0) * (settings.userPrice || 0), [qty.users, settings.userPrice])
  const totalConnections = useMemo(() => (qty.connections || 0) * (settings.connectionPrice || 0), [qty.connections, settings.connectionPrice])
  const total = useMemo(() => totalUsers + totalConnections, [totalUsers, totalConnections])

  const onNext = () => {
    if (!form.nome || !form.telefone || !form.cpf || !form.email || !form.empresa) {
      setMessage('Preencha todos os campos')
      setTimeout(() => setMessage(''), 2000)
      return
    }
    setStep(2)
  }

  const concluir = async () => {
    setSubmitting(true)
    try {
      const referenceId = `farol_${Date.now()}`
      const body = {
        amount: Number(total.toFixed(2)),
        referenceId,
        buyer: {
          firstName: form.nome.split(' ')[0] || form.nome,
          lastName: form.nome.split(' ').slice(1).join(' ') || form.empresa,
          document: form.cpf,
          email: form.email,
          phone: form.telefone,
        },
        metadata: { empresa: form.empresa, users: qty.users, connections: qty.connections }
      }
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/picpay/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Falha ao iniciar pagamento')
      setPayment({ paymentUrl: json.paymentUrl, qrcode: json.qrcode })
      window.open(json.paymentUrl, '_blank', 'noopener')
    } catch (e) {
      setMessage(e?.message || 'Erro ao criar pagamento')
      setTimeout(() => setMessage(''), 3000)
    } finally {
      setSubmitting(false)
    }
  }

  const checkStatus = async () => {
    if (!payment) return
    try {
      const url = new URL(payment.paymentUrl)
      const ref = new URLSearchParams(url.search).get('referenceId') || ''
      const res = await fetch(`/api/picpay/status?ref=${encodeURIComponent(ref)}`)
      const json = await res.json()
      if (json.status === 'paid') {
        setStep(3)
      } else {
        setMessage(`Status: ${json.status}`)
        setTimeout(() => setMessage(''), 2000)
      }
    } catch {}
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto py-8 px-4">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>Assinar FarolChat</CardTitle>
            <CardDescription>Complete seu cadastro e finalize a assinatura</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {message && <div className="text-amber-600 text-sm">{message}</div>}
            {step === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input placeholder="Nome" value={form.nome} onChange={(e)=> setForm(prev => ({...prev, nome: e.target.value}))} />
                <Input placeholder="Telefone" value={form.telefone} onChange={(e)=> setForm(prev => ({...prev, telefone: e.target.value}))} />
                <Input placeholder="CPF" value={form.cpf} onChange={(e)=> setForm(prev => ({...prev, cpf: e.target.value}))} />
                <Input placeholder="Email" type="email" value={form.email} onChange={(e)=> setForm(prev => ({...prev, email: e.target.value}))} />
                <Input placeholder="Nome da empresa" className="md:col-span-2" value={form.empresa} onChange={(e)=> setForm(prev => ({...prev, empresa: e.target.value}))} />
                <div className="md:col-span-2 flex justify-end">
                  <Button onClick={onNext}>Próximo</Button>
                </div>
              </div>
            )}
            {step === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                  <div>
                    <div className="text-sm font-medium">Usuários</div>
                    <Input type="number" min={0} value={qty.users} onChange={(e)=> setQty(prev => ({...prev, users: Number(e.target.value || 0)}))} />
                  </div>
                  <div className="text-right text-sm">R$ {settings.userPrice?.toFixed?.(2) || Number(settings.userPrice).toFixed(2)} cada — Total: <span className="font-medium">R$ {totalUsers.toFixed(2)}</span></div>
                  <div>
                    <div className="text-sm font-medium">Conexões</div>
                    <Input type="number" min={0} value={qty.connections} onChange={(e)=> setQty(prev => ({...prev, connections: Number(e.target.value || 0)}))} />
                  </div>
                  <div className="text-right text-sm">R$ {settings.connectionPrice?.toFixed?.(2) || Number(settings.connectionPrice).toFixed(2)} cada — Total: <span className="font-medium">R$ {totalConnections.toFixed(2)}</span></div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-lg">Valor total</div>
                  <div className="text-2xl font-bold">R$ {total.toFixed(2)}</div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={()=> setStep(1)}>Voltar</Button>
                  <Button onClick={concluir} disabled={isSubmitting || total <= 0}>{isSubmitting ? 'Processando...' : 'Concluir'}</Button>
                </div>
                {payment && (
                  <div className="border rounded p-3 space-y-2">
                    <div className="text-sm">Abra o PicPay no link gerado. Após o pagamento, clique em "Verificar".</div>
                    {payment.qrcode?.base64 && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`data:image/png;base64,${payment.qrcode.base64}`} alt="QR" className="w-48 h-48" />
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" asChild>
                        <a href={payment.paymentUrl} target="_blank" rel="noopener">Abrir no PicPay</a>
                      </Button>
                      <Button variant="secondary" onClick={checkStatus}>Verificar</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {step === 3 && (
              <div className="space-y-2">
                <div className="text-xl font-semibold">Tudo certo!</div>
                <div className="text-muted-foreground">Recebemos sua confirmação. Vamos entrar em contato enviando as credenciais.</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

