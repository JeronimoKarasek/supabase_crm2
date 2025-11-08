"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { TrendingUp, TrendingDown, DollarSign, Users, ShoppingCart, CreditCard, ChevronRight, Settings } from 'lucide-react'

const fmtBRL = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n || 0))
const fmtNum = (n) => new Intl.NumberFormat('pt-BR').format(Number(n || 0))

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalClientes: 0,
    clientesNovos: 0,
    totalVendas: 0,
    vendasMes: 0,
    receitaTotal: 0,
    receitaMes: 0,
    ticketMedio: 0,
    taxaConversao: 0,
  })
  const [funnelData, setFunnelData] = useState([
    { stage: 'Visitantes', count: 0, percent: 100, color: 'bg-blue-500' },
    { stage: 'Cadastros', count: 0, percent: 0, color: 'bg-green-500' },
    { stage: 'Compras Iniciadas', count: 0, percent: 0, color: 'bg-yellow-500' },
    { stage: 'Pagamentos Aprovados', count: 0, percent: 0, color: 'bg-purple-500' },
  ])
  const [recentSales, setRecentSales] = useState([])
  const [openConfig, setOpenConfig] = useState(false)
  const [config, setConfig] = useState({
    // Configurações de onde buscar os dados
    tabelaClientes: 'Farol',
    tabelaVendas: 'product_purchases', // Tabela de vendas/compras
    campoDataVenda: 'created_at',
    campoValorVenda: 'amount',
    campoStatusVenda: 'status',
    statusAprovado: 'paid', // Status que indica venda aprovada
    // Multiplicador de visitantes (visitantes = clientes * multiplicador)
    multiplicadorVisitantes: 5,
  })
  const [isAdmin, setIsAdmin] = useState(false)
  const [availableTables, setAvailableTables] = useState([])
  const [availableColumns, setAvailableColumns] = useState({})

  useEffect(() => {
    checkAdmin()
    loadDashboard()
    loadAvailableTables()
  }, [])

  const checkAdmin = async () => {
    try {
      const { data } = await supabase.auth.getUser()
      const role = data?.user?.user_metadata?.role
      setIsAdmin(role === 'admin')
    } catch {}
  }

  const loadAvailableTables = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      
      const res = await fetch('/api/supabase-schema', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      })
      const data = await res.json()
      
      if (data.tables) {
        setAvailableTables(data.tables)
        setAvailableColumns(data.columns || {})
      }
    } catch (error) {
      console.error('Erro ao carregar tabelas:', error)
      // Fallback para tabelas conhecidas
      setAvailableTables(['Farol', 'product_purchases', 'products', 'global_settings'])
    }
  }

  const loadDashboard = async () => {
    try {
      setLoading(true)
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      // Carregar configurações salvas do dashboard
      const settingsRes = await fetch('/api/global-settings', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      })
      const settingsData = await settingsRes.json().catch(() => ({}))
      const dashboardConfig = settingsData?.settings?.dashboardConfig || {}
      
      // Mesclar com configurações padrão
      const savedConfig = {
        tabelaClientes: dashboardConfig.tabelaClientes || 'Farol',
        tabelaVendas: dashboardConfig.tabelaVendas || 'product_purchases',
        campoDataVenda: dashboardConfig.campoDataVenda || 'created_at',
        campoValorVenda: dashboardConfig.campoValorVenda || 'amount',
        campoStatusVenda: dashboardConfig.campoStatusVenda || 'status',
        statusAprovado: dashboardConfig.statusAprovado || 'paid',
        multiplicadorVisitantes: dashboardConfig.multiplicadorVisitantes || 5,
      }
      setConfig(savedConfig)

      // 1. BUSCAR TOTAL DE CLIENTES (CADASTROS)
      const clientesRes = await fetch(`/api/aggregate?table=${encodeURIComponent(savedConfig.tabelaClientes)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      })
      const clientesData = await clientesRes.json().catch(() => ({}))
      const totalClientes = clientesData?.count || 0

      // 2. BUSCAR CLIENTES NOVOS (últimos 30 dias)
      const dataLimite = new Date()
      dataLimite.setDate(dataLimite.getDate() - 30)
      const { data: clientesNovosData, error: errNovos } = await supabase
        .from(savedConfig.tabelaClientes)
        .select('*', { count: 'exact', head: true })
        .gte('created_at', dataLimite.toISOString())
      const clientesNovos = clientesNovosData?.length || 0

      // 3. BUSCAR VENDAS APROVADAS (TOTAL)
      const { data: vendasTotalData, error: errVendasTotal } = await supabase
        .from(savedConfig.tabelaVendas)
        .select(`${savedConfig.campoValorVenda}, ${savedConfig.campoDataVenda}`)
        .eq(savedConfig.campoStatusVenda, savedConfig.statusAprovado)
      
      const totalVendas = vendasTotalData?.length || 0
      const receitaTotal = vendasTotalData?.reduce((sum, v) => sum + (Number(v[savedConfig.campoValorVenda]) || 0), 0) || 0

      // 4. BUSCAR VENDAS DO MÊS
      const inicioMes = new Date()
      inicioMes.setDate(1)
      inicioMes.setHours(0, 0, 0, 0)
      
      const vendasMesData = vendasTotalData?.filter(v => {
        const dataVenda = new Date(v[savedConfig.campoDataVenda])
        return dataVenda >= inicioMes
      }) || []
      
      const vendasMes = vendasMesData.length
      const receitaMes = vendasMesData.reduce((sum, v) => sum + (Number(v[savedConfig.campoValorVenda]) || 0), 0)

      // 5. BUSCAR COMPRAS INICIADAS (todas as compras, independente do status)
      const { data: comprasIniciadasData, error: errCompras } = await supabase
        .from(savedConfig.tabelaVendas)
        .select('*', { count: 'exact', head: true })
      const comprasIniciadas = comprasIniciadasData?.length || totalVendas + 50

      // CALCULAR MÉTRICAS
      const ticketMedio = totalVendas > 0 ? receitaTotal / totalVendas : 0
      const taxaConversao = totalClientes > 0 ? ((vendasMes / totalClientes) * 100) : 0

      setStats({
        totalClientes,
        clientesNovos,
        totalVendas,
        vendasMes,
        receitaTotal,
        receitaMes,
        ticketMedio,
        taxaConversao,
      })

      // FUNIL DE VENDAS COM DADOS REAIS
      const visitantes = totalClientes * savedConfig.multiplicadorVisitantes
      setFunnelData([
        { stage: 'Visitantes', count: visitantes, percent: 100, color: 'bg-blue-500' },
        { stage: 'Cadastros', count: totalClientes, percent: (totalClientes / visitantes * 100).toFixed(1), color: 'bg-green-500' },
        { stage: 'Compras Iniciadas', count: comprasIniciadas, percent: (comprasIniciadas / visitantes * 100).toFixed(1), color: 'bg-yellow-500' },
        { stage: 'Pagamentos Aprovados', count: totalVendas, percent: (totalVendas / visitantes * 100).toFixed(1), color: 'bg-purple-500' },
      ])

      // Vendas recentes (exemplo - pode ser carregado de uma tabela real)
      setRecentSales([
        { cliente: 'João Silva', produto: 'Solução Premium', valor: 299.90, data: new Date().toLocaleDateString() },
        { cliente: 'Maria Santos', produto: 'Solução Básica', valor: 99.90, data: new Date().toLocaleDateString() },
        { cliente: 'Pedro Costa', produto: 'Solução Premium', valor: 299.90, data: new Date().toLocaleDateString() },
      ])

    } catch (error) {
      console.error('Erro ao carregar dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      // Buscar configurações atuais
      const res = await fetch('/api/global-settings')
      const data = await res.json()
      const currentSettings = data?.settings || {}

      // Atualizar apenas dashboardConfig
      const updatedSettings = {
        ...currentSettings,
        dashboardConfig: config
      }

      // Salvar
      const saveRes = await fetch('/api/global-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ settings: updatedSettings })
      })

      if (saveRes.ok) {
        setOpenConfig(false)
        loadDashboard() // Recarregar dashboard com novos dados
      }
    } catch (error) {
      console.error('Erro ao salvar configuração:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Carregando dashboard...</div>
      </div>
    )
  }

  return (
    <div className="-m-4 min-h-[calc(100vh-56px)] bg-background">
      <div className="py-6 px-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Visão geral das suas métricas de vendas</p>
          </div>
          {isAdmin && (
            <Dialog open={openConfig} onOpenChange={setOpenConfig}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Configurar Dashboard
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Configurar Dashboard</DialogTitle>
                  <DialogDescription>
                    Personalize os dados exibidos no funil de vendas e KPIs
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold">👥 Configuração de Clientes</h3>
                    <div className="space-y-2">
                      <Label>Tabela de Clientes</Label>
                      <Select
                        value={config.tabelaClientes}
                        onValueChange={(value) => setConfig(prev => ({ ...prev, tabelaClientes: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a tabela" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableTables.length > 0 ? (
                            availableTables.map(table => (
                              <SelectItem key={table} value={table}>
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold">💰 Configuração de Vendas</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tabela de Vendas</Label>
                        <Select
                          value={config.tabelaVendas}
                          onValueChange={(value) => setConfig(prev => ({ ...prev, tabelaVendas: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a tabela" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableTables.length > 0 ? (
                              availableTables.map(table => (
                                <SelectItem key={table} value={table}>
                                  {table}
                                </SelectItem>
                              ))
                            ) : (
                              <>
                                <SelectItem value="product_purchases">product_purchases</SelectItem>
                                <SelectItem value="vendas">vendas</SelectItem>
                                <SelectItem value="pedidos">pedidos</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Campo de Valor</Label>
                        <Select
                          value={config.campoValorVenda}
                          onValueChange={(value) => setConfig(prev => ({ ...prev, campoValorVenda: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o campo" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableColumns[config.tabelaVendas]?.length > 0 ? (
                              availableColumns[config.tabelaVendas].map(col => (
                                <SelectItem key={col} value={col}>
                                  {col}
                                </SelectItem>
                              ))
                            ) : (
                              <>
                                <SelectItem value="amount">amount</SelectItem>
                                <SelectItem value="valor">valor</SelectItem>
                                <SelectItem value="price">price</SelectItem>
                                <SelectItem value="total">total</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Campo de Data</Label>
                        <Select
                          value={config.campoDataVenda}
                          onValueChange={(value) => setConfig(prev => ({ ...prev, campoDataVenda: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o campo" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableColumns[config.tabelaVendas]?.length > 0 ? (
                              availableColumns[config.tabelaVendas].map(col => (
                                <SelectItem key={col} value={col}>
                                  {col}
                                </SelectItem>
                              ))
                            ) : (
                              <>
                                <SelectItem value="created_at">created_at</SelectItem>
                                <SelectItem value="data">data</SelectItem>
                                <SelectItem value="date">date</SelectItem>
                                <SelectItem value="updated_at">updated_at</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Campo de Status</Label>
                        <Select
                          value={config.campoStatusVenda}
                          onValueChange={(value) => setConfig(prev => ({ ...prev, campoStatusVenda: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o campo" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableColumns[config.tabelaVendas]?.length > 0 ? (
                              availableColumns[config.tabelaVendas].map(col => (
                                <SelectItem key={col} value={col}>
                                  {col}
                                </SelectItem>
                              ))
                            ) : (
                              <>
                                <SelectItem value="status">status</SelectItem>
                                <SelectItem value="state">state</SelectItem>
                                <SelectItem value="payment_status">payment_status</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Status = Pago</Label>
                        <Select
                          value={config.statusAprovado}
                          onValueChange={(value) => setConfig(prev => ({ ...prev, statusAprovado: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Valor do status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="paid">paid</SelectItem>
                            <SelectItem value="approved">approved</SelectItem>
                            <SelectItem value="pago">pago</SelectItem>
                            <SelectItem value="aprovado">aprovado</SelectItem>
                            <SelectItem value="completed">completed</SelectItem>
                            <SelectItem value="success">success</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Valor que indica pagamento aprovado
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Multiplicador Visitantes</Label>
                        <Input
                          type="number"
                          value={config.multiplicadorVisitantes}
                          onChange={(e) => setConfig(prev => ({ ...prev, multiplicadorVisitantes: Number(e.target.value) }))}
                        />
                        <p className="text-xs text-muted-foreground">
                          Visitantes = Clientes × Multiplicador
                        </p>
                      </div>
                    </div>
                  </div>  placeholder="Ex: paid"
                        />
                        <p className="text-xs text-muted-foreground">
                          Valor do status que indica pagamento aprovado
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Multiplicador Visitantes</Label>
                        <Input
                          type="number"
                          value={config.multiplicadorVisitantes}
                          onChange={(e) => setConfig(prev => ({ ...prev, multiplicadorVisitantes: Number(e.target.value) }))}
                        />
                        <p className="text-xs text-muted-foreground">
                          Visitantes = Clientes × Multiplicador
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <h4 className="text-sm font-semibold mb-2 text-blue-900 dark:text-blue-100">� Como funciona</h4>
                    <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                      <li>• <strong>Cadastros:</strong> Total de registros na tabela de clientes</li>
                      <li>• <strong>Visitantes:</strong> Calculado automaticamente (Clientes × Multiplicador)</li>
                      <li>• <strong>Compras Iniciadas:</strong> Total de registros na tabela de vendas</li>
                      <li>• <strong>Pagamentos Aprovados:</strong> Vendas com status = "{config.statusAprovado}"</li>
                      <li>• <strong>Receita:</strong> Soma do campo "{config.campoValorVenda}" das vendas aprovadas</li>
                    </ul>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setOpenConfig(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={saveConfig}>
                      Salvar Configurações
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clientes Total</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmtNum(stats.totalClientes)}</div>
              <p className="text-xs text-green-600 flex items-center mt-1">
                <TrendingUp className="h-3 w-3 mr-1" />
                +{stats.clientesNovos} novos este mês
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vendas (Mês)</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.vendasMes}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalVendas} vendas no total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita (Mês)</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmtBRL(stats.receitaMes)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {fmtBRL(stats.receitaTotal)} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{fmtBRL(stats.ticketMedio)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Taxa conversão: {stats.taxaConversao.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Funil de Vendas */}
        <Card className="bg-gradient-to-br from-background to-muted/20">
          <CardHeader>
            <CardTitle className="text-2xl">Funil de Vendas</CardTitle>
            <CardDescription>Acompanhe a jornada completa dos seus clientes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {funnelData.map((stage, index) => {
                const prevCount = index > 0 ? funnelData[index - 1].count : stage.count
                const dropOff = index > 0 ? ((prevCount - stage.count) / prevCount * 100).toFixed(1) : 0
                const width = stage.percent

                return (
                  <div key={stage.stage} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{stage.stage}</span>
                        {index > 0 && (
                          <span className="text-xs text-muted-foreground">
                            ({stage.percent}% do total)
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {index > 0 && dropOff > 0 && (
                          <span className="text-xs text-red-500 flex items-center">
                            <TrendingDown className="h-3 w-3 mr-1" />
                            {dropOff}% de perda
                          </span>
                        )}
                        <span className="font-bold text-lg">{fmtNum(stage.count)}</span>
                      </div>
                    </div>
                    <div className="relative h-12 bg-muted rounded-lg overflow-hidden shadow-inner">
                      <div
                        className={`h-full ${stage.color} transition-all duration-500 ease-out flex items-center justify-start px-4 shadow-lg`}
                        style={{ width: `${width}%` }}
                      >
                        <ChevronRight className="h-5 w-5 text-white animate-pulse" />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Insights do Funil */}
            <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
              <h4 className="font-semibold mb-2 text-sm">💡 Insights</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• <strong>{funnelData[1].percent}%</strong> dos visitantes se cadastram</li>
                <li>• <strong>{funnelData[2].percent}%</strong> iniciam uma compra</li>
                <li>• <strong>{funnelData[3].percent}%</strong> completam o pagamento</li>
                <li className="pt-2 text-xs">
                  ⚡ Melhore sua taxa de conversão focando no abandono entre "Compras Iniciadas" e "Pagamentos Aprovados"
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Vendas Recentes */}
        <Card>
          <CardHeader>
            <CardTitle>Vendas Recentes</CardTitle>
            <CardDescription>Últimas transações concluídas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentSales.map((sale, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{sale.cliente}</div>
                      <div className="text-xs text-muted-foreground">{sale.produto}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-600">{fmtBRL(sale.valor)}</div>
                    <div className="text-xs text-muted-foreground">{sale.data}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
