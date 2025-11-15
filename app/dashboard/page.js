"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { supabase } from '@/lib/supabase'
import { TrendingUp, TrendingDown, DollarSign, Users, Target, Award, Activity, Zap, CheckCircle, Clock, XCircle, AlertCircle, Settings } from 'lucide-react'

const fmtBRL = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n || 0))
const fmtNum = (n) => new Intl.NumberFormat('pt-BR').format(Number(n || 0))

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [metaMensal, setMetaMensal] = useState(0)
  const [editandoMeta, setEditandoMeta] = useState(false)
  const [metaTemp, setMetaTemp] = useState('')
  
  // Aba ativa
  const [abaAtiva, setAbaAtiva] = useState('carteira') // 'carteira' ou 'vendas-ias'
  
  // Filtros de data
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [incluirSemData, setIncluirSemData] = useState(false)
  
  // Dados do funil
  const [funil, setFunil] = useState({
    total: 0,
    simulou: 0,
    digitou: 0,
    vendasConcluidas: 0,
    valorVendasConcluidas: 0,
    contatosDigitados: 0,
    valorContatosDigitados: 0,
    valorTotal: 0
  })
  
  // Dados por status
  const [statusData, setStatusData] = useState({
    pendente: 0,
    aprovado: 0,
    reprovado: 0,
    emAnalise: 0
  })
  
  // Top vendedores
  const [topVendedores, setTopVendedores] = useState([])
  
  // Produtos mais vendidos
  const [topProdutos, setTopProdutos] = useState([])

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async (filtroDataInicio = null, filtroDataFim = null, filtroSemData = false, tabela = null) => {
    try {
      setLoading(true)
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      
      // Carregar meta mensal do localStorage
      const savedMeta = localStorage.getItem('dashboard_meta_mensal')
      if (savedMeta) setMetaMensal(Number(savedMeta))

      // Buscar dados da tabela selecionada
      const tabelaAtual = tabela || abaAtiva === 'vendas-ias' ? 'Vendas_IAs' : 'Carteira'
      const res = await fetch(`/api/table-data?table=${tabelaAtual}&pageSize=10000`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      })
      const json = await res.json()
      const data = json?.data || []

      // Filtrar dados por data de atualização ou todos os registros
      let dadosMes = data
      
      if (filtroDataInicio || filtroDataFim) {
        // Filtro por período personalizado usando updated_at
        dadosMes = data.filter(item => {
          const dataAtualizacao = item.updated_at ? new Date(item.updated_at) : null
          
          // Se incluir sem data e não tem updated_at, incluir
          if (filtroSemData && !dataAtualizacao) return true
          
          // Se não tem data e não deve incluir sem data, excluir
          if (!dataAtualizacao) return false
          
          // Verificar se está no período
          if (filtroDataInicio) {
            const inicio = new Date(filtroDataInicio)
            inicio.setHours(0, 0, 0, 0)
            if (dataAtualizacao < inicio) return false
          }
          
          if (filtroDataFim) {
            const fim = new Date(filtroDataFim)
            fim.setHours(23, 59, 59, 999)
            if (dataAtualizacao > fim) return false
          }
          
          return true
        })
      } else {
        // Filtro padrão: TODOS os registros (muitos não têm created_at)
        dadosMes = data
      }

      // FUNIL DE VENDAS
      const total = dadosMes.length // Total de linhas cadastradas
      const simulou = dadosMes.filter(i => i.simulou === true || i.simulou === 'true' || i.simulou === 1).length
      const digitou = dadosMes.filter(i => i.digitou === true || i.digitou === 'true' || i.digitou === 1).length
      
      // Vendas Concluídas (pago = true)
      const vendasConcluidas = dadosMes.filter(i => i.pago === true || i.pago === 'true' || i.pago === 1).length
      const valorVendasConcluidas = dadosMes
        .filter(i => i.pago === true || i.pago === 'true' || i.pago === 1)
        .reduce((acc, i) => {
          const val = parseFloat(i['Valor liberado'] || 0)
          return acc + (isNaN(val) ? 0 : val)
        }, 0)

      // Contratos Digitados (digitou = true)
      const contatosDigitados = dadosMes.filter(i => i.digitou === true || i.digitou === 'true').length
      const valorContatosDigitados = dadosMes
        .filter(i => i.digitou === true || i.digitou === 'true')
        .reduce((acc, i) => {
          const val = parseFloat(i['Valor liberado'] || 0)
          return acc + (isNaN(val) ? 0 : val)
        }, 0)
      
      // VALORES TOTAIS
      const valorTotal = dadosMes.reduce((acc, i) => {
        const val = parseFloat(i['Valor liberado'] || i.valorContrato || 0)
        return acc + (isNaN(val) ? 0 : val)
      }, 0)

      setFunil({ 
        total, 
        simulou, 
        digitou, 
        vendasConcluidas, 
        valorVendasConcluidas,
        contatosDigitados,
        valorContatosDigitados,
        valorTotal 
      })

      // STATUS
      const statusCount = {
        pendente: 0,
        aprovado: 0,
        reprovado: 0,
        emAnalise: 0
      }
      
      dadosMes.forEach(i => {
        const st = String(i.status || '').toLowerCase()
        if (st.includes('aprovado') || st.includes('pago') || st.includes('aprovada')) {
          statusCount.aprovado++
        } else if (st.includes('reprovad') || st.includes('negad') || st.includes('cancelad')) {
          statusCount.reprovado++
        } else if (st.includes('analise') || st.includes('análise') || st.includes('processando')) {
          statusCount.emAnalise++
        } else {
          statusCount.pendente++
        }
      })
      setStatusData(statusCount)

      // TOP VENDEDORES
      const vendedoresMap = {}
      dadosMes.forEach(i => {
        const vendedor = i.vendedor || i.cliente || 'Sem vendedor'
        if (!vendedoresMap[vendedor]) {
          vendedoresMap[vendedor] = { nome: vendedor, vendas: 0, valor: 0 }
        }
        vendedoresMap[vendedor].vendas++
        const val = parseFloat(i['Valor liberado'] || i.valorContrato || 0)
        vendedoresMap[vendedor].valor += isNaN(val) ? 0 : val
      })
      const topVend = Object.values(vendedoresMap)
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 5)
      setTopVendedores(topVend)

      // TOP PRODUTOS
      const produtosMap = {}
      dadosMes.forEach(i => {
        const produto = i.produto || 'Sem produto'
        if (!produtosMap[produto]) {
          produtosMap[produto] = { nome: produto, vendas: 0, valor: 0 }
        }
        produtosMap[produto].vendas++
        const val = parseFloat(i['Valor liberado'] || i.valorContrato || 0)
        produtosMap[produto].valor += isNaN(val) ? 0 : val
      })
      const topProd = Object.values(produtosMap)
        .sort((a, b) => b.vendas - a.vendas)
        .slice(0, 5)
      setTopProdutos(topProd)

    } catch (e) {
      console.error('Erro ao carregar dashboard:', e)
    } finally {
      setLoading(false)
    }
  }

  const salvarMeta = () => {
    const valor = parseFloat(metaTemp)
    if (!isNaN(valor) && valor >= 0) {
      setMetaMensal(valor)
      localStorage.setItem('dashboard_meta_mensal', String(valor))
      setEditandoMeta(false)
      setMetaTemp('')
    }
  }
  
  const aplicarFiltros = () => {
    loadDashboard(dataInicio, dataFim, incluirSemData)
  }
  
  const limparFiltros = () => {
    setDataInicio('')
    setDataFim('')
    setIncluirSemData(false)
    loadDashboard()
  }
  
  const trocarAba = (aba) => {
    setAbaAtiva(aba)
    const tabela = aba === 'vendas-ias' ? 'Vendas_IAs' : 'Carteira'
    loadDashboard(dataInicio, dataFim, incluirSemData, tabela)
  }

  const percentMeta = metaMensal > 0 ? Math.min(100, (funil.valorVendasConcluidas / metaMensal) * 100) : 0

  // Calcular taxas de conversão
  const taxaSimulacao = funil.total > 0 ? (funil.simulou / funil.total) * 100 : 0
  const taxaDigitacao = funil.simulou > 0 ? (funil.digitou / funil.simulou) * 100 : 0
  const taxaAprovacao = funil.digitou > 0 ? (funil.vendasConcluidas / funil.digitou) * 100 : 0
  const taxaConversaoGeral = funil.total > 0 ? (funil.vendasConcluidas / funil.total) * 100 : 0

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <Activity className="h-12 w-12 animate-spin mx-auto text-blue-500 mb-4" />
            <p className="text-muted-foreground">Carregando dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Abas */}
        <div className="flex gap-2 border-b border-border pb-2">
          <button
            onClick={() => trocarAba('carteira')}
            className={`px-6 py-2 font-semibold rounded-t-lg transition-colors ${
              abaAtiva === 'carteira'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Carteira
          </button>
          <button
            onClick={() => trocarAba('vendas-ias')}
            className={`px-6 py-2 font-semibold rounded-t-lg transition-colors ${
              abaAtiva === 'vendas-ias'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            Vendas IAs
          </button>
        </div>
        
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Dashboard de Vendas
              </h1>
              <p className="text-muted-foreground mt-1">Visão completa do funil e performance</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Início:</label>
                <Input 
                  type="date" 
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="h-9 w-[140px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Fim:</label>
                <Input 
                  type="date" 
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="h-9 w-[140px]"
                />
              </div>
              <Button onClick={aplicarFiltros} size="sm" variant="secondary">
                Filtrar
              </Button>
              {(dataInicio || dataFim) && (
                <Button onClick={limparFiltros} variant="ghost" size="sm">
                  Limpar
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => loadDashboard(dataInicio, dataFim, incluirSemData)}>
                <Activity className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </div>
        </div>

        {/* Layout Principal: Velocimetro + Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Velocimetro - Lateral */}
          <Card className="lg:col-span-1 shadow-lg flex flex-col items-center justify-center p-6">
            {/* Velocimetro Analógico */}
            <div className="relative w-48 h-48">
              {/* Arco do velocimetro */}
              <svg viewBox="0 0 200 120" className="w-full">
                {/* Background arc */}
                <path
                  d="M 20 100 A 80 80 0 0 1 180 100"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="20"
                  className="text-muted/20"
                />
                {/* Progress arc */}
                <path
                  d="M 20 100 A 80 80 0 0 1 180 100"
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="20"
                  strokeDasharray={`${percentMeta * 2.51} 251`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="50%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
                {/* Ponteiro */}
                <line
                  x1="100"
                  y1="100"
                  x2={100 + 60 * Math.cos((percentMeta * 1.8 - 90) * Math.PI / 180)}
                  y2={100 + 60 * Math.sin((percentMeta * 1.8 - 90) * Math.PI / 180)}
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="text-foreground transition-all duration-1000"
                />
                <circle cx="100" cy="100" r="6" fill="currentColor" className="text-foreground" />
              </svg>
            </div>
            
            {/* Valores */}
            <div className="text-center space-y-2 mt-4">
              <div className="flex items-center gap-2 justify-center">
                <Target className="h-4 w-4 text-blue-600" />
                <h3 className="font-semibold text-sm">Meta Mensal</h3>
              </div>
              <p className="text-3xl font-bold">{percentMeta.toFixed(0)}%</p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Realizado: <span className="font-semibold text-foreground">{fmtBRL(funil.valorVendasConcluidas)}</span></p>
                <p>Meta: <span className="font-semibold text-foreground">{fmtBRL(metaMensal)}</span></p>
              </div>
              {!editandoMeta ? (
                <Button size="sm" variant="outline" onClick={() => { setEditandoMeta(true); setMetaTemp(String(metaMensal)) }} className="mt-2">
                  <Settings className="h-3 w-3 mr-1" />
                  Editar
                </Button>
              ) : (
                <div className="flex flex-col gap-2 mt-2">
                  <Input 
                    type="number" 
                    value={metaTemp} 
                    onChange={(e) => setMetaTemp(e.target.value)}
                    placeholder="Valor da meta"
                    className="h-8 text-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={salvarMeta} className="flex-1">Salvar</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditandoMeta(false); setMetaTemp('') }}>X</Button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Cards de Resumo */}
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-blue-500 dark:border-l-blue-400">
              <CardHeader className="pb-2">
                <CardDescription>Total de Leads</CardDescription>
                <CardTitle className="text-3xl">{fmtNum(funil.total)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>Linhas cadastradas</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500 dark:border-l-green-400">
              <CardHeader className="pb-2">
                <CardDescription>Vendas Concluídas</CardDescription>
                <CardTitle className="text-3xl">{fmtNum(funil.vendasConcluidas)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  <span>{fmtBRL(funil.valorVendasConcluidas)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500 dark:border-l-purple-400">
              <CardHeader className="pb-2">
                <CardDescription>Contratos Digitados</CardDescription>
                <CardTitle className="text-3xl">{fmtNum(funil.contatosDigitados)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400">
                  <DollarSign className="h-4 w-4" />
                  <span>{fmtBRL(funil.valorContatosDigitados)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
          
        </div>

        {/* Funil de Vendas */}
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <CardTitle>Funil de Conversão</CardTitle>
            </div>
            <CardDescription>Visualize o fluxo de conversão do lead até a venda</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Etapa 1: Total de Leads */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <Users className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg">Leads Cadastrados</h4>
                      <p className="text-sm text-muted-foreground">Base total do funil</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-blue-600">{fmtNum(funil.total)}</p>
                    <Badge variant="secondary" className="mt-1">100%</Badge>
                  </div>
                </div>
                <div className="relative h-3 bg-gradient-to-r from-blue-200 to-blue-500 rounded-full overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-600 animate-pulse opacity-50"></div>
                </div>
              </div>

              {/* Seta */}
              <div className="flex justify-center">
                <div className="text-center">
                  <TrendingDown className="h-6 w-6 text-muted-foreground mx-auto" />
                  <p className="text-xs text-muted-foreground mt-1">{taxaSimulacao.toFixed(1)}% avançam</p>
                </div>
              </div>

              {/* Etapa 2: Simularam */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                      <Activity className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg">Simularam</h4>
                      <p className="text-sm text-muted-foreground">Interesse demonstrado</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-green-600">{fmtNum(funil.simulou)}</p>
                    <Badge variant="secondary" className="mt-1">{taxaSimulacao.toFixed(1)}%</Badge>
                  </div>
                </div>
                <div className="relative h-3 rounded-full overflow-hidden" style={{ width: `${taxaSimulacao}%`, background: 'linear-gradient(to right, #86efac, #22c55e)' }}>
                  <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-green-600 animate-pulse opacity-50"></div>
                </div>
              </div>

              {/* Seta */}
              <div className="flex justify-center">
                <div className="text-center">
                  <TrendingDown className="h-6 w-6 text-muted-foreground mx-auto" />
                  <p className="text-xs text-muted-foreground mt-1">{taxaDigitacao.toFixed(1)}% avançam</p>
                </div>
              </div>

              {/* Etapa 3: Digitaram */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                      <Zap className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg">Digitaram</h4>
                      <p className="text-sm text-muted-foreground">Proposta formalizada</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-yellow-600">{fmtNum(funil.digitou)}</p>
                    <Badge variant="secondary" className="mt-1">{funil.total > 0 ? ((funil.digitou / funil.total) * 100).toFixed(1) : 0}%</Badge>
                  </div>
                </div>
                <div className="relative h-3 rounded-full overflow-hidden" style={{ width: `${funil.total > 0 ? (funil.digitou / funil.total) * 100 : 0}%`, background: 'linear-gradient(to right, #fde047, #eab308)' }}>
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-yellow-600 animate-pulse opacity-50"></div>
                </div>
              </div>

              {/* Seta */}
              <div className="flex justify-center">
                <div className="text-center">
                  <TrendingDown className="h-6 w-6 text-muted-foreground mx-auto" />
                  <p className="text-xs text-muted-foreground mt-1">{taxaAprovacao.toFixed(1)}% convertem</p>
                </div>
              </div>

              {/* Etapa 4: Aprovados */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                      <CheckCircle className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg">Aprovados 🎉</h4>
                      <p className="text-sm text-muted-foreground">Venda concretizada</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-purple-600">{fmtNum(funil.aprovados)}</p>
                    <Badge className="mt-1 bg-purple-600">{taxaConversaoGeral.toFixed(1)}%</Badge>
                  </div>
                </div>
                <div className="relative h-3 rounded-full overflow-hidden" style={{ width: `${taxaConversaoGeral}%`, background: 'linear-gradient(to right, #c084fc, #9333ea)' }}>
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-purple-600 animate-pulse opacity-50"></div>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Cards de Status e Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Status das Propostas */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" />
                <CardTitle>Status das Propostas</CardTitle>
              </div>
              <CardDescription>Distribuição por situação atual</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                  <span className="font-medium">Pendentes</span>
                </div>
                <Badge variant="outline" className="text-lg">{fmtNum(statusData.pendente)}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="font-medium">Aprovadas</span>
                </div>
                <Badge variant="outline" className="text-lg">{fmtNum(statusData.aprovado)}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-3">
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <span className="font-medium">Reprovadas</span>
                </div>
                <Badge variant="outline" className="text-lg">{fmtNum(statusData.reprovado)}</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span className="font-medium">Em Análise</span>
                </div>
                <Badge variant="outline" className="text-lg">{fmtNum(statusData.emAnalise)}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Top Vendedores */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-yellow-600" />
                <CardTitle>Top Vendedores</CardTitle>
              </div>
              <CardDescription>Maiores volumes de vendas no mês</CardDescription>
            </CardHeader>
            <CardContent>
              {topVendedores.length > 0 ? (
                <div className="space-y-3">
                  {topVendedores.map((v, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-lg border dark:border-slate-600">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                          idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-orange-600' : 'bg-slate-500'
                        }`}>
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-foreground">{v.nome}</p>
                          <p className="text-xs text-muted-foreground">{fmtNum(v.vendas)} vendas</p>
                        </div>
                      </div>
                      <span className="font-bold text-green-600 dark:text-green-400">{fmtBRL(v.valor)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum vendedor registrado este mês</p>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Top Produtos */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <CardTitle>Produtos Mais Vendidos</CardTitle>
            </div>
            <CardDescription>Ranking de produtos por volume de vendas</CardDescription>
          </CardHeader>
          <CardContent>
            {topProdutos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {topProdutos.map((p, idx) => (
                  <div key={idx} className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="secondary">#{idx + 1}</Badge>
                      <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{fmtNum(p.vendas)}</span>
                    </div>
                    <h4 className="font-semibold text-sm mb-1 truncate">{p.nome}</h4>
                    <p className="text-xs text-green-600 dark:text-green-400 font-semibold">{fmtBRL(p.valor)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum produto vendido este mês</p>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
