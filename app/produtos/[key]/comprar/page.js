"use client"

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

export default function ComprarProdutoPage() {
  const params = useParams()
  const key = Array.isArray(params?.key) ? params.key[0] : params?.key
  const [product, setProduct] = useState(null)
  const [form, setForm] = useState({ nome: '', telefone: '', cpf: '', email: '', empresa: '' })
  const [isSubmitting, setSubmitting] = useState(false)
  const [payment, setPayment] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        if (!key) return
        const res = await fetch(`/api/products/public?key=${encodeURIComponent(key)}`)
        const json = await res.json()
        setProduct(json.product || null)
      } catch {}
    })()
  }, [key])

  const basePrice = useMemo(() => Number(product?.pricing?.basePrice || 0), [product])

  const concluir = async () => {
    if (!product) return
    setSubmitting(true)
    try {
      const referenceId = `${key}_${Date.now()}`
      const body = {
        productKey: key,
        returnPath: `/produtos/${key}/comprar`,
        amount: Number(basePrice.toFixed(2)),
        referenceId,
        buyer: {
          firstName: form.nome.split(' ')[0] || form.nome,
          lastName: form.nome.split(' ').slice(1).join(' ') || form.empresa,
          document: form.cpf,
          email: form.email,
          phone: form.telefone,
        },
        buyerForm: { ...form },
        metadata: { empresa: form.empresa },
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
    } finally { setSubmitting(false) }
  }

  const checkStatus = async () => {
    if (!payment) return
    try {
      const url = new URL(payment.paymentUrl)
      const ref = new URLSearchParams(url.search).get('referenceId') || ''
      const res = await fetch(`/api/picpay/status?ref=${encodeURIComponent(ref)}`)
      const json = await res.json()
      if (json.status === 'paid') setMessage('Pagamento confirmado!')
      else { setMessage(`Status: ${json.status}`); setTimeout(()=>setMessage(''), 2000) }
    } catch {}
  }

  if (!product) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-sm text-muted-foreground">Carregando produto...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto py-8 px-4">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>Adquirir: {product.name}</CardTitle>
            <CardDescription>{product.description || 'Confirme seus dados para iniciar o pagamento.'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {message && <div className="text-amber-600 text-sm">{message}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input placeholder="Nome" value={form.nome} onChange={(e)=> setForm(prev => ({...prev, nome: e.target.value}))} />
              <Input placeholder="Telefone" value={form.telefone} onChange={(e)=> setForm(prev => ({...prev, telefone: e.target.value}))} />
              <Input placeholder="CPF" value={form.cpf} onChange={(e)=> setForm(prev => ({...prev, cpf: e.target.value}))} />
              <Input placeholder="Email" type="email" value={form.email} onChange={(e)=> setForm(prev => ({...prev, email: e.target.value}))} />
              <Input placeholder="Nome da empresa" className="md:col-span-2" value={form.empresa} onChange={(e)=> setForm(prev => ({...prev, empresa: e.target.value}))} />
            </div>
            <div className="flex items-center justify-between">
              <div className="text-lg">Valor</div>
              <div className="text-2xl font-bold">R$ {basePrice.toFixed(2)}</div>
            </div>
            <div className="flex justify-end">
              <Button onClick={concluir} disabled={isSubmitting || !(basePrice > 0)}>{isSubmitting ? 'Processando...' : 'Concluir'}</Button>
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

