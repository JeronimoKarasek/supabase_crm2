"use client"

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

export default function AssinarFarolChat() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ nome: '', telefone: '', cpf: '', email: '', empresa: '' })
  const [pricing, setPricing] = useState({ userPrice: 0, connectionPrice: 0 })
  const [qty, setQty] = useState({ users: 1, connections: 1 })
  const [isSubmitting, setSubmitting] = useState(false)
  const [payment, setPayment] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/products/public?key=farolchat')
        const json = await res.json()
        const p = json?.product?.pricing || {}
        const up = Number(p.userPrice || 0)
        const cp = Number(p.connectionPrice || 0)
        setPricing({ userPrice: up, connectionPrice: cp })
      } catch {}
    })()
  }, [])

  const totalUsers = useMemo(() => (qty.users || 0) * (pricing.userPrice || 0), [qty.users, pricing.userPrice])
  const totalConnections = useMemo(() => (qty.connections || 0) * (pricing.connectionPrice || 0), [qty.connections, pricing.connectionPrice])
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
        productKey: 'farolchat',
        returnPath: '/produtos/farolchat/assinar',
        amount: Number(total.toFixed(2)),
        referenceId,
        buyer: {
          firstName: form.nome.split(' ')[0] || form.nome,
          lastName: form.nome.split(' ').slice(1).join(' ') || form.empresa,
          document: form.cpf,
          email: form.email,
          phone: form.telefone,
        },
        buyerForm: { nome: form.nome, cpf: form.cpf, email: form.email, telefone: form.telefone, empresa: form.empresa },
        metadata: { empresa: form.empresa, users: qty.users, connections: qty.connections }
      }
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/payments/add-credits', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Falha ao iniciar pagamento')
      setPayment({ qrCode: json.qrCode, qrCodeBase64: json.qrCodeBase64, paymentId: json.paymentId })
    } catch (e) {
      setMessage(e?.message || 'Erro ao criar pagamento')
      setTimeout(() => setMessage(''), 3000)
    } finally {
      setSubmitting(false)
    }
  }

  const checkStatus = async () => {
    if (!payment?.paymentId) return
    try {
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${payment.paymentId}`, {
        headers: { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_MERCADOPAGO_ACCESS_TOKEN || ''}` }
      })
      const json = await res.json()
      if (json.status === 'approved') {
        setStep(3)
      } else {
        setMessage(`Status: ${json.status}`)
        setTimeout(() => setMessage(''), 2000)
      }
    } catch {
      setMessage('Erro ao verificar status')
      setTimeout(() => setMessage(''), 2000)
    }
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
                  <div className="text-right text-sm">R$ {pricing.userPrice?.toFixed?.(2) || Number(pricing.userPrice).toFixed(2)} cada  Total: <span className="font-medium">R$ {totalUsers.toFixed(2)}</span></div>
                  <div>
                    <div className="text-sm font-medium">Conexões</div>
                    <Input type="number" min={0} value={qty.connections} onChange={(e)=> setQty(prev => ({...prev, connections: Number(e.target.value || 0)}))} />
                  </div>
                  <div className="text-right text-sm">R$ {pricing.connectionPrice?.toFixed?.(2) || Number(pricing.connectionPrice).toFixed(2)} cada  Total: <span className="font-medium">R$ {totalConnections.toFixed(2)}</span></div>
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
                  <div className="border rounded p-3 space-y-3">
                    <div className="text-sm font-medium">Escaneie o QR Code para pagar via PIX</div>
                    {payment.qrCodeBase64 && (
                      <div className="flex flex-col items-center gap-3 bg-white p-4 rounded">
                        <img src={`data:image/png;base64,${payment.qrCodeBase64}`} alt="QR Code PIX" className="w-64 h-64" />
                        <div className="text-xs text-muted-foreground text-center max-w-sm break-all">
                          {payment.qrCode}
                        </div>
                        <Button variant="outline" size="sm" onClick={() => {
                          navigator.clipboard.writeText(payment.qrCode)
                          setMessage('Código PIX copiado!')
                          setTimeout(() => setMessage(''), 2000)
                        }}>
                          Copiar código PIX
                        </Button>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Após efetuar o pagamento, clique em "Verificar Status" ou aguarde a confirmação automática.
                    </div>
                    <Button variant="secondary" onClick={checkStatus} className="w-full">Verificar Status</Button>
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
