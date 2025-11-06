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
        const res = await fetch(/api/products/public?key=$\{encodeURIComponent(key)})
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
      const referenceId = $\{key}_$\{Date.now()}
      const body = {
        productKey: key,
        returnPath: /produtos/$\{key}/comprar,
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
      const res = await fetch('/api/payments/add-credits', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: Bearer $\{token} } : {}) }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Falha ao iniciar pagamento')
      setPayment({ qrCode: json.qrCode, qrCodeBase64: json.qrCodeBase64, paymentId: json.paymentId })
    } catch (e) {
      setMessage(e?.message || 'Erro ao criar pagamento')
      setTimeout(() => setMessage(''), 3000)
    } finally { setSubmitting(false) }
  }

  const checkStatus = async () => {
    if (!payment?.paymentId) return
    try {
      const res = await fetch(https://api.mercadopago.com/v1/payments/$\{payment.paymentId}, {
        headers: { 'Authorization': Bearer $\{process.env.NEXT_PUBLIC_MERCADOPAGO_ACCESS_TOKEN || ''} }
      })
      const json = await res.json()
      if (json.status === 'approved') setMessage('Pagamento confirmado!')
      else { setMessage(Status: $\{json.status}); setTimeout(()=>setMessage(''), 2000) }
    } catch {
      setMessage('Erro ao verificar status')
      setTimeout(() => setMessage(''), 2000)
    }
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
              <div className="text-2xl font-bold">R$\{basePrice.toFixed(2)}</div>
            </div>
            <div className="flex justify-end">
              <Button onClick={concluir} disabled={isSubmitting || !(basePrice > 0)}>{isSubmitting ? 'Processando...' : 'Concluir'}</Button>
            </div>
            {payment && (
              <div className="border rounded p-3 space-y-3">
                <div className="text-sm font-medium">Escaneie o QR Code para pagar via PIX</div>
                {payment.qrCodeBase64 && (
                  <div className="flex flex-col items-center gap-3 bg-white p-4 rounded">
                    <img src={data:image/png;base64,$\{payment.qrCodeBase64}} alt="QR Code PIX" className="w-64 h-64" />
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}