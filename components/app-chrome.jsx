"use client"

import { usePathname } from 'next/navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import AppNav from '@/components/app-nav'
import SignOutButton from '@/components/signout-button'
import ThemeToggle from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'

export default function AppChrome({ children }) {
  const pathname = usePathname()
  const isLogin = pathname === '/login'
  const [branding, setBranding] = useState({ siteName: 'FarolTech', siteSubtitle: 'Iluminando seu caminho', logoUrl: '' })
  const [loadingCredits, setLoadingCredits] = useState(false)
  const [creditsBRL, setCreditsBRL] = useState('R$ 0,00')
  const [smsBalance, setSmsBalance] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [loadingAddCredits, setLoadingAddCredits] = useState(false)
  const [creditsDialog, setCreditsDialog] = useState({ open: false, data: null, error: null })
  const [addCreditsDialog, setAddCreditsDialog] = useState({ open: false, data: null, error: null, step: 'form' })
  const [addCreditsAmount, setAddCreditsAmount] = useState('')
  const [addCreditsCpf, setAddCreditsCpf] = useState('')
  const [userCpf, setUserCpf] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/global-settings')
        const json = await res.json()
        if (res.ok) setBranding({
          siteName: json?.settings?.siteName || 'FarolTech',
          siteSubtitle: json?.settings?.siteSubtitle || 'Iluminando seu caminho',
          logoUrl: json?.settings?.logoUrl || '',
        })
      } catch {}
    })()
  }, [])

  const consultarCreditos = async () => {
    try {
      setLoadingCredits(true)
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/credits', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      const json = await res.json()
      if (res.ok) {
        setCreditsBRL(json?.balanceBRL || 'R$ 0,00')
      }
    } catch (e) {
      // silencioso no cabeçalho
    } finally {
      setLoadingCredits(false)
    }
  }

  useEffect(() => {
    // carrega saldo ao entrar e a cada 20s
    consultarCreditos()
    const id = setInterval(consultarCreditos, 20000)
    return () => clearInterval(id)
  }, [])

  const loadUserAndSmsBalance = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const user = sessionData?.session?.user
      const role = user?.user_metadata?.role || ''
  const cpf = user?.user_metadata?.cpf || user?.user_metadata?.document || ''
  setUserCpf(cpf)
  console.log('🔍 [App Chrome] Loading SMS balance...', { role, isAdmin: role === 'admin', hasCpf: !!cpf })
      setIsAdmin(role === 'admin')
      
      // Buscar saldo de SMS apenas para admin
      if (role === 'admin') {
        const token = sessionData?.session?.access_token
        console.log('🔍 [App Chrome] Fetching SMS balance from API...', { hasToken: !!token })
        const res = await fetch('/api/disparo-sms/balance', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
        const js = await res.json()
        console.log('🔍 [App Chrome] SMS balance response:', { ok: res.ok, status: res.status, balance: js?.balance, data: js })
        if (res.ok && js?.balance) {
          setSmsBalance(js.balance)
          console.log('✅ [App Chrome] SMS balance set:', js.balance)
        } else {
          console.error('❌ [App Chrome] Failed to load SMS balance:', js)
        }
      }
    } catch (e) {
      console.error('❌ [App Chrome] Exception loading SMS balance:', e)
    }
  }

  useEffect(() => {
    loadUserAndSmsBalance()
    const id = setInterval(loadUserAndSmsBalance, 25000)
    return () => clearInterval(id)
  }, [])

  const adicionarCreditos = async () => {
  // Abre o dialog no step de formulário e inicializa CPF
  setAddCreditsDialog({ open: true, data: null, error: null, step: 'form' })
  setAddCreditsAmount('')
  setAddCreditsCpf(userCpf) // Pre-fill com CPF do usuário se existir
  }

  const processarAddCreditos = async () => {
    // Valida valor
    const valor = parseFloat(addCreditsAmount)
    if (isNaN(valor) || valor <= 0) {
      setAddCreditsDialog(prev => ({ ...prev, error: 'Por favor, insira um valor válido maior que zero', step: 'form' }))
      return
    }

    try {
      setLoadingAddCredits(true)
      setAddCreditsDialog(prev => ({ ...prev, error: null }))
      
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const user = sessionData?.session?.user
      
      const res = await fetch('/api/payments/add-credits', { 
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}) 
        },
        body: JSON.stringify({ 
          amount: valor,
          email: user?.email || '',
          description: user?.email || '', // Email oculto na descrição
          cpf: addCreditsCpf || undefined // Envia CPF se fornecido
        })
      })
      const json = await res.json()
      
      if (!res.ok) {
        setAddCreditsDialog(prev => ({ ...prev, data: null, error: json?.error || 'Falha ao gerar link de pagamento', step: 'error' }))
        return
      }
      
      // Extrai os dados do webhook
      const webhookData = json?.data || json
      setAddCreditsDialog(prev => ({ ...prev, data: webhookData, error: null, step: 'success' }))
    } catch (e) {
      setAddCreditsDialog(prev => ({ ...prev, data: null, error: 'Erro ao processar requisição', step: 'error' }))
    } finally {
      setLoadingAddCredits(false)
    }
  }

  if (isLogin) {
    return children
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="px-2 py-1 flex items-center gap-2">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoUrl} alt="logo" className="h-6 w-6 object-contain" />
            ) : null}
            <div>
              <div className="text-lg font-semibold">{branding.siteName}</div>
              <div className="text-xs text-muted-foreground">{branding.siteSubtitle}</div>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <AppNav />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="flex items-center justify-between gap-2 p-2 border-b bg-background">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <span className="text-sm text-muted-foreground">Menu</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold px-2 py-1 rounded bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200 border border-green-300 dark:border-green-700 shadow-sm">Crédito: {creditsBRL}</div>
            {isAdmin && smsBalance && (
              <div className="text-sm font-semibold px-2 py-1 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                SMS Kolmeya: {smsBalance}
              </div>
            )}
            {/* Botão de atualizar saldo removido (auto refresh já implementado) */}
            <Button
              size="sm"
              variant="outline"
              onClick={adicionarCreditos}
              disabled={loadingAddCredits}
              className="border-primary text-primary hover:bg-muted dark:border-primary dark:text-primary h-8"
            >
              {loadingAddCredits ? 'Processando...' : 'Adicionar créditos'}
            </Button>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
        <div className="p-4">
          {children}
        </div>
      </SidebarInset>

      {/* Dialog de Créditos */}
      <Dialog open={creditsDialog.open} onOpenChange={(open) => setCreditsDialog(prev => ({ ...prev, open }))}>
        {/* Ajuste de largura e centralização para melhor enquadramento */}
        <DialogContent className="w-[96vw] max-w-[600px] md:max-w-[640px]">
          <DialogHeader>
            <DialogTitle className="text-2xl">💰 Consulta de Créditos</DialogTitle>
            <DialogDescription>
              {creditsDialog.error ? 'Ocorreu um erro ao consultar seus créditos' : 'Informações atualizadas do seu saldo'}
            </DialogDescription>
          </DialogHeader>
          
          {creditsDialog.error ? (
            <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="text-red-800 dark:text-red-200 font-medium">❌ Erro</div>
              <div className="text-red-600 dark:text-red-400 text-sm mt-1">{creditsDialog.error}</div>
            </div>
          ) : creditsDialog.data ? (
            <div className="space-y-4">
              <div className="p-6 rounded-lg border border-border bg-card">
                <div className="text-sm font-medium mb-2 text-success">Saldo Disponível</div>
                <div className="text-4xl font-bold text-foreground">
                  {creditsDialog.data.credits !== undefined ? creditsDialog.data.credits : 
                   creditsDialog.data.saldo !== undefined ? creditsDialog.data.saldo :
                   creditsDialog.data.balance !== undefined ? creditsDialog.data.balance : 
                   creditsDialog.data.valor !== undefined ? creditsDialog.data.valor : 
                   'N/A'}
                </div>
                {(creditsDialog.data.currency || creditsDialog.data.moeda) && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {creditsDialog.data.currency || creditsDialog.data.moeda}
                  </div>
                )}
              </div>
              
              {/* Informações adicionais */}
              {Object.keys(creditsDialog.data).filter(k => 
                !['credits', 'saldo', 'balance', 'valor', 'currency', 'moeda'].includes(k)
              ).length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">Informações Adicionais</div>
                  <div className="p-3 bg-muted border rounded-lg space-y-1 text-sm">
                    {Object.entries(creditsDialog.data).map(([key, value]) => {
                      if (['credits', 'saldo', 'balance', 'valor', 'currency', 'moeda'].includes(key)) return null
                      return (
                        <div key={key} className="flex justify-between">
                          <span className="text-muted-foreground capitalize">{key}:</span>
                          <span className="font-medium">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              
              <Button onClick={() => setCreditsDialog(prev => ({ ...prev, open: false }))} className="w-full">
                Fechar
              </Button>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              Nenhum dado disponível
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Add Créditos */}
  <Dialog open={addCreditsDialog.open} onOpenChange={(open) => {
        setAddCreditsDialog(prev => ({ ...prev, open }))
        if (!open) {
          // Reset ao fechar
          setAddCreditsAmount('')
          setAddCreditsCpf('')
          setAddCreditsDialog({ open: false, data: null, error: null, step: 'form' })
        }
      }}>
  {/* Ajuste de largura e centralização para melhor enquadramento */}
  <DialogContent className="w-[96vw] max-w-[600px] md:max-w-[640px]">
          <DialogHeader>
            <DialogTitle className="text-2xl">💳 Adicionar Créditos</DialogTitle>
            <DialogDescription>
              {addCreditsDialog.step === 'form' && 'Informe o valor que deseja adicionar'}
              {addCreditsDialog.step === 'success' && 'Link de pagamento gerado com sucesso'}
              {addCreditsDialog.step === 'error' && 'Ocorreu um erro ao processar'}
            </DialogDescription>
          </DialogHeader>
          
          {/* Formulário de Valor */}
          {addCreditsDialog.step === 'form' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Valor a adicionar (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Ex: 100.00"
                  value={addCreditsAmount}
                  onChange={(e) => setAddCreditsAmount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      processarAddCreditos()
                    }
                  }}
                  autoFocus
                />
                {addCreditsDialog.error && (
                  <div className="text-red-600 dark:text-red-400 text-sm">{addCreditsDialog.error}</div>
                )}
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">CPF {userCpf ? '(do cadastro)' : '(opcional)'}</label>
                <Input
                  type="text"
                  placeholder="000.000.000-00"
                  value={addCreditsCpf}
                  onChange={(e) => setAddCreditsCpf(e.target.value)}
                  disabled={!!userCpf}
                  maxLength={14}
                  className={userCpf ? 'bg-muted cursor-not-allowed' : ''}
                />
                {userCpf && (
                  <div className="text-xs text-muted-foreground">✓ CPF do seu cadastro será usado automaticamente</div>
                )}
              </div>
              
              <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  ℹ️ Será gerado um pagamento via Pix ou link conforme configuração
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setAddCreditsDialog(prev => ({ ...prev, open: false }))} 
                  className="flex-1"
                  disabled={loadingAddCredits}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={processarAddCreditos} 
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  disabled={loadingAddCredits || !addCreditsAmount}
                >
                  {loadingAddCredits ? 'Gerando...' : 'Concluir'}
                </Button>
              </div>
            </div>
          )}
          
          {/* Resultado com Link de Pagamento ou QR Code Pix */}
              {addCreditsDialog.step === 'success' && addCreditsDialog.data && (
            <div className="space-y-4">
              {/* QR Code Pix (Mercado Pago) */}
              {addCreditsDialog.data.provider === 'mercadopago' && addCreditsDialog.data.qrCode && (
                <div className="space-y-3">
                  {/* Card centralizado para conteúdo do PIX */}
                  <div className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 border border-blue-200 dark:border-blue-800 rounded-lg mx-auto">
                    <div className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-2">💳 Pagamento Pix</div>
                    <div className="flex flex-col items-center gap-3">
                      {addCreditsDialog.data.qrCodeBase64 && (
                        <div className="bg-white p-4 rounded-lg">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img 
                            src={`data:image/png;base64,${addCreditsDialog.data.qrCodeBase64}`} 
                            alt="QR Code Pix" 
                            className="w-64 h-64 mx-auto"
                          />
                        </div>
                      )}
                      <div className="text-center">
                        <div className="text-xs text-blue-600 dark:text-blue-400 mb-2">Ou copie o código Pix:</div>
                        <div className="p-3 bg-white dark:bg-slate-800 rounded border text-xs font-mono break-all max-h-24 overflow-y-auto">
                          {addCreditsDialog.data.qrCode}
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="mt-2"
                          onClick={() => {
                            navigator.clipboard.writeText(addCreditsDialog.data.qrCode)
                            alert('Código Pix copiado!')
                          }}
                        >
                          📋 Copiar Código Pix
                        </Button>
                      </div>
                    </div>
                    {addCreditsDialog.data.amount && (
                      <div className="text-sm text-blue-600 dark:text-blue-400 mt-3 text-center">
                        Valor: R$ {addCreditsDialog.data.amount}
                      </div>
                    )}
                  </div>
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded text-sm text-yellow-800 dark:text-yellow-200">
                    ⏱️ Após o pagamento, os créditos serão adicionados automaticamente (pode levar alguns segundos)
                  </div>
                </div>
              )}

              {/* Link de Pagamento (PicPay ou fallback) */}
              {(!addCreditsDialog.data.provider || addCreditsDialog.data.provider === 'picpay' || !addCreditsDialog.data.qrCode) && (
                <div className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-2">Link de Pagamento</div>
                  <div className="text-lg font-semibold text-blue-900 dark:text-blue-100 break-all">
                    {addCreditsDialog.data.paymentUrl || addCreditsDialog.data.url || addCreditsDialog.data.link || 'Link gerado'}
                  </div>
                  {(addCreditsDialog.data.amount || addCreditsDialog.data.valor) && (
                    <div className="text-sm text-blue-600 dark:text-blue-400 mt-2">
                      Valor: R$ {addCreditsDialog.data.amount || addCreditsDialog.data.valor}
                      {(addCreditsDialog.data.currency || addCreditsDialog.data.moeda) && ` ${addCreditsDialog.data.currency || addCreditsDialog.data.moeda}`}
                    </div>
                  )}
                </div>
              )}

              
              {/* Informações adicionais (oculta campos sensíveis) */}
              {Object.keys(addCreditsDialog.data).filter(k => 
                !['paymentUrl', 'url', 'link', 'amount', 'valor', 'currency', 'moeda', 'qrCode', 'qrCodeBase64', 'provider', 'paymentMethod'].includes(k)
              ).length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">Informações Adicionais</div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 border rounded-lg space-y-1 text-sm">
                    {Object.entries(addCreditsDialog.data).map(([key, value]) => {
                      if (['paymentUrl', 'url', 'link', 'amount', 'valor', 'currency', 'moeda', 'qrCode', 'qrCodeBase64', 'provider', 'paymentMethod'].includes(key)) return null
                      return (
                        <div key={key} className="flex justify-between">
                          <span className="text-muted-foreground capitalize">{key}:</span>
                          <span className="font-medium">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              
              <div className="flex gap-2">
                {/* Só mostra botão de abrir link se NÃO for Pix do Mercado Pago */}
                {!addCreditsDialog.data.qrCode && (addCreditsDialog.data.paymentUrl || addCreditsDialog.data.url || addCreditsDialog.data.link) && (
                  <Button asChild className="flex-1 bg-blue-600 hover:bg-blue-700">
                    <a href={addCreditsDialog.data.paymentUrl || addCreditsDialog.data.url || addCreditsDialog.data.link} target="_blank" rel="noopener noreferrer">
                      Abrir Link
                    </a>
                  </Button>
                )}
                <Button variant="outline" onClick={() => setAddCreditsDialog(prev => ({ ...prev, open: false }))} className="flex-1">
                  Fechar
                </Button>
              </div>
            </div>
          )}
          
          {/* Erro */}
          {addCreditsDialog.step === 'error' && (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="text-red-800 dark:text-red-200 font-medium">❌ Erro</div>
                <div className="text-red-600 dark:text-red-400 text-sm mt-1">{addCreditsDialog.error}</div>
              </div>
              <Button onClick={() => setAddCreditsDialog({ open: false, data: null, error: null, step: 'form' })} className="w-full">
                Tentar Novamente
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}
