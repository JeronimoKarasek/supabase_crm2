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
  const [paymentApproved, setPaymentApproved] = useState(false)
  const [userQty, setUserQty] = useState(0)
  const [connectionQty, setConnectionQty] = useState(0)

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
  const userPrice = useMemo(() => Number(product?.pricing?.userPrice || 0), [product])
  const connectionPrice = useMemo(() => Number(product?.pricing?.connectionPrice || 0), [product])
  const total = useMemo(() => {
    const t = (basePrice || 0) + (userPrice * (userQty||0)) + (connectionPrice * (connectionQty||0))
    return Number.isFinite(t) ? Number(t.toFixed(2)) : 0
  }, [basePrice, userPrice, connectionPrice, userQty, connectionQty])

  const concluir = async () => {
    if (!product) return
    setSubmitting(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      // Se assinatura com cartão -> criar preapproval
      if (product?.billingMode === 'subscription' && product?.paymentMethod === 'card') {
        console.log('[Purchase] Creating subscription', { productKey: key, userQty, connectionQty })
        const res = await fetch('/api/mercadopago/subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ productKey: key, userQty, connectionQty })
        })
        const json = await res.json()
        console.log('[Purchase] Subscription response', { status: res.status, json })
        
        if (!res.ok) {
          const errorMsg = json?.message || json?.error || 'Falha ao criar assinatura'
          const details = json?.details ? JSON.stringify(json.details, null, 2) : ''
          console.error('[Purchase] Error creating subscription', json)
          throw new Error(`${errorMsg}${details ? '\n' + details : ''}`)
        }
        
        if (json.initPoint) {
          console.log('[Purchase] Redirecting to initPoint', json.initPoint)
          window.location.href = json.initPoint
          return
        }
        setMessage('Assinatura criada, mas sem initPoint. Verifique o console.')
        console.error('[Purchase] No initPoint in response', json)
        setTimeout(()=>setMessage(''), 2500)
        return
      }

      // Caso contrário, fluxo atual (ex.: PIX avulso)
      const referenceId = `${key}_${Date.now()}`
      const body = {
        productKey: key,
        returnPath: `/produtos/${key}/comprar`,
        amount: Number(total.toFixed(2)),
        referenceId,
        buyer: {
          firstName: form.nome.split(' ')[0] || form.nome,
          lastName: form.nome.split(' ').slice(1).join(' ') || form.empresa,
          document: form.cpf,
          email: form.email,
          phone: form.telefone,
        },
        buyerForm: { ...form },
        metadata: { empresa: form.empresa, userQty, connectionQty },
      }
      const res = await fetch('/api/payments/add-credits', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })
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
      const res = await fetch(`/api/mercadopago/status?paymentId=${encodeURIComponent(payment.paymentId)}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Falha ao verificar status')
      
      if (json.status === 'approved') {
        setPaymentApproved(true)
        setMessage('✅ Pagamento confirmado! Setores liberados. Recarregando...')
        
        // O webhook já vai liberar os setores automaticamente
        // Aguardar um pouco e recarregar a sessão do usuário
        setTimeout(async () => {
          try {
            await supabase.auth.refreshSession()
            window.location.href = '/dashboard' // Redirecionar para dashboard
          } catch (e) {
            console.error('Erro ao recarregar sessão:', e)
          }
        }, 2000)
      } else { 
        setMessage(`Status: ${json.status}`)
        setTimeout(()=>setMessage(''), 2000) 
      }
    } catch (e) {
      setMessage(e?.message || 'Erro ao verificar status')
      setTimeout(() => setMessage(''), 2000)
    }
  }
  
  const gerarNovoQR = () => {
    setPayment(null)
    setPaymentApproved(false)
    setMessage('')
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
            {/* Quantidades dinâmicas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {userPrice > 0 && (
                <div>
                  <div className="text-sm font-medium">Quantidade de usuários</div>
                  <Input type="number" min={0} value={userQty} onChange={(e)=> setUserQty(Math.max(0, parseInt(e.target.value||'0')))} />
                  <div className="text-xs text-muted-foreground mt-1">R$ {userPrice.toFixed(2)} por usuário</div>
                </div>
              )}
              {connectionPrice > 0 && (
                <div>
                  <div className="text-sm font-medium">Quantidade de conexões</div>
                  <Input type="number" min={0} value={connectionQty} onChange={(e)=> setConnectionQty(Math.max(0, parseInt(e.target.value||'0')))} />
                  <div className="text-xs text-muted-foreground mt-1">R$ {connectionPrice.toFixed(2)} por conexão</div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="text-lg">Valor total</div>
              <div className="text-2xl font-bold">R$ {total.toFixed(2)}</div>
            </div>
            <div className="flex justify-end">
              {payment && !paymentApproved ? (
                <Button onClick={gerarNovoQR} variant="outline">Gerar novo QR</Button>
              ) : (
                <Button onClick={concluir} disabled={isSubmitting || !(total > 0) || paymentApproved}>
                  {isSubmitting ? 'Processando...' : paymentApproved ? '✓ Pagamento Aprovado' : 'Concluir'}
                </Button>
              )}
            </div>
            {payment && product?.billingMode !== 'subscription' && (
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}