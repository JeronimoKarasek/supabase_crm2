"use client"

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Upload, Download, RefreshCw, FileText, Sparkles, AlertCircle, User, Phone, Mail, MapPin, Calendar, DollarSign, Briefcase, Home } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'

// Componente para exibir dados enriquecidos de forma visual
function EnrichedDataDisplay({ data }) {
  // Extrair dados do result ou da raiz
  const result = data?.result || data
  
  // Se não houver result, mostrar JSON raw
  if (!result || typeof result !== 'object') {
    return (
      <div className="p-4 border rounded bg-muted/40 text-sm overflow-auto max-h-96">
        <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Informações Principais */}
      {(result.Nome || result.CPF || result.CNPJ) && (
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-blue-500" />
              Informações Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.Nome && (
              <div>
                <p className="text-xs text-muted-foreground">Nome Completo</p>
                <p className="font-medium">{result.Nome}</p>
              </div>
            )}
            {result.CPF && (
              <div>
                <p className="text-xs text-muted-foreground">CPF</p>
                <p className="font-mono">{result.CPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}</p>
              </div>
            )}
            {result.CNPJ && (
              <div>
                <p className="text-xs text-muted-foreground">CNPJ</p>
                <p className="font-mono">{result.CNPJ}</p>
              </div>
            )}
            {result.DataNascimento && (
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Data de Nascimento
                </p>
                <p>{new Date(result.DataNascimento).toLocaleDateString('pt-BR')} {result.Idade && `(${result.Idade} anos)`}</p>
              </div>
            )}
            {result.Sexo && (
              <div>
                <p className="text-xs text-muted-foreground">Sexo</p>
                <p>{result.Sexo === 'M' ? 'Masculino' : result.Sexo === 'F' ? 'Feminino' : result.Sexo}</p>
              </div>
            )}
            {result.EstadoCivil && (
              <div>
                <p className="text-xs text-muted-foreground">Estado Civil</p>
                <p>{result.EstadoCivil}</p>
              </div>
            )}
            {result.NomeMae && (
              <div>
                <p className="text-xs text-muted-foreground">Nome da Mãe</p>
                <p>{result.NomeMae}</p>
              </div>
            )}
            {result.NomePai && result.NomePai.trim() && (
              <div>
                <p className="text-xs text-muted-foreground">Nome do Pai</p>
                <p>{result.NomePai}</p>
              </div>
            )}
            {result.Signo && (
              <div>
                <p className="text-xs text-muted-foreground">Signo</p>
                <p>{result.Signo}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Informações Profissionais */}
      {(result.CodigoCbo || result.DescricaoCbo || result.Renda) && (
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Briefcase className="h-5 w-5 text-green-500" />
              Informações Profissionais
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.DescricaoCbo && (
              <div>
                <p className="text-xs text-muted-foreground">Profissão (CBO)</p>
                <p className="font-medium">{result.DescricaoCbo}</p>
                {result.CodigoCbo && <p className="text-xs text-muted-foreground">Código: {result.CodigoCbo}</p>}
              </div>
            )}
            {result.Renda && (
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> Renda Estimada
                </p>
                <p className="font-medium text-green-600">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(result.Renda)}
                </p>
              </div>
            )}
            {result.Escolaridade && (
              <div>
                <p className="text-xs text-muted-foreground">Escolaridade</p>
                <p>{result.Escolaridade}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Endereços */}
      {result.Enderecos && Array.isArray(result.Enderecos) && result.Enderecos.length > 0 && (
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5 text-orange-500" />
              Endereços ({result.Enderecos.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.Enderecos.map((end, idx) => (
              <div key={idx} className="p-3 border rounded-lg bg-muted/30">
                <div className="flex items-start justify-between mb-2">
                  <Badge variant="outline" className="text-xs">
                    {end.Tipo === 'R' ? 'Residencial' : end.Tipo === 'C' ? 'Comercial' : end.Tipo}
                  </Badge>
                  {end.Ranking && (
                    <span className="text-xs text-muted-foreground">Ranking: {end.Ranking}</span>
                  )}
                </div>
                <p className="font-medium text-sm mb-1">
                  {end.Logradouro && `${end.Logradouro}, `}
                  {end.Numero}
                  {end.Complemento && ` - ${end.Complemento}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {end.Bairro && `${end.Bairro} - `}
                  {end.Cidade}/{end.UF}
                  {end.CEP && ` - CEP: ${end.CEP.replace(/(\d{5})(\d{3})/, '$1-$2')}`}
                </p>
                {(end.Latitude || end.Longitude) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    📍 Lat: {end.Latitude?.toFixed(6)}, Long: {end.Longitude?.toFixed(6)}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Telefones */}
      {result.Telefones && Array.isArray(result.Telefones) && result.Telefones.length > 0 && (
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Phone className="h-5 w-5 text-purple-500" />
              Telefones ({result.Telefones.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.Telefones.map((tel, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-mono font-medium">
                      ({tel.DDD}) {tel.Telefone.replace(/(\d{4,5})(\d{4})/, '$1-$2')}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{tel.TipoTelefone}</span>
                      {tel.Operadora && (
                        <Badge variant="secondary" className="text-xs">{tel.Operadora}</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {tel.WhatsApp && (
                    <Badge variant="default" className="bg-green-500 text-xs">WhatsApp</Badge>
                  )}
                  {tel.Procon === false && (
                    <Badge variant="outline" className="text-xs text-green-600">Sem Procon</Badge>
                  )}
                  {tel.Ranking && (
                    <span className="text-xs text-muted-foreground">#{tel.Ranking}</span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Emails */}
      {result.Emails && Array.isArray(result.Emails) && result.Emails.length > 0 && (
        <Card className="border-l-4 border-l-cyan-500">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="h-5 w-5 text-cyan-500" />
              E-mails ({result.Emails.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {result.Emails.map((email, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <p className="font-mono text-sm">{email.Email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {email.Particular && (
                    <Badge variant="secondary" className="text-xs">Particular</Badge>
                  )}
                  {email.Ranking && (
                    <span className="text-xs text-muted-foreground">#{email.Ranking}</span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Informações Adicionais da API */}
      {(data.code || data.message || data.elapsedTimeInMilliseconds) && (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-muted-foreground">Informações da Consulta</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {data.code && (
              <div>
                <p className="text-muted-foreground">Status</p>
                <Badge variant={data.code === 200 ? 'default' : 'destructive'}>{data.code}</Badge>
              </div>
            )}
            {data.message && (
              <div>
                <p className="text-muted-foreground">Mensagem</p>
                <p>{data.message}</p>
              </div>
            )}
            {data.elapsedTimeInMilliseconds && (
              <div>
                <p className="text-muted-foreground">Tempo de Resposta</p>
                <p className="font-mono">{data.elapsedTimeInMilliseconds}ms</p>
              </div>
            )}
            {data.apiVersion && (
              <div>
                <p className="text-muted-foreground">Versão da API</p>
                <p>{data.apiVersion}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function HigienizarDadosPage() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [processing, setProcessing] = useState({}) // { lote_id: true }
  const [fileName, setFileName] = useState('')
  const [csvText, setCsvText] = useState('')
  const [hasConfig, setHasConfig] = useState(false)
  const [bulkType, setBulkType] = useState('auto')
  const [costPerQuery, setCostPerQuery] = useState('0.10')
  const [individualLoading, setIndividualLoading] = useState(false)
  const [individualType, setIndividualType] = useState('cpf')
  const [individualValue, setIndividualValue] = useState('')
  const [individualResult, setIndividualResult] = useState(null)
  const [individualError, setIndividualError] = useState('')

  // Carregar configurações
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/global-settings')
        const json = await res.json()
        if (res.ok) {
          const settings = json?.settings || {}
          const hasCost = !!(settings.shiftDataCostPerQuery)
          console.log('🔧 [Higienizar] Config loaded:', { hasCost, settings })
          // Não bloquear por token ausente: fallback é aplicado no backend
          setHasConfig(true)
          setCostPerQuery(settings.shiftDataCostPerQuery || '0.07')
        }
      } catch (e) {
        console.error('🔧 [Higienizar] Error loading config:', e)
      }
    })()
  }, [])

  // Consulta individual
  const runIndividualQuery = async () => {
    setIndividualError('')
    setIndividualResult(null)
    if (!individualValue.trim()) {
      setIndividualError('Informe um valor para consulta')
      return
    }
    try {
      setIndividualLoading(true)
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/enrich/individual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ type: individualType, value: individualValue })
      })
      const json = await res.json()
      if (res.ok) {
        setIndividualResult(json?.data || json)
        setMessage(`✅ Consulta realizada! Custo: R$ ${(json?.cost || costPerQuery || 0.07).toFixed(2)}`)
        setTimeout(() => setMessage(''), 3000)
      } else {
        // Destacar erro de saldo insuficiente
        if (res.status === 402) {
          setIndividualError(`💳 ${json?.error || 'Saldo insuficiente'}`)
        } else {
          setIndividualError(json?.error || 'Erro na consulta')
        }
      }
    } catch (e) {
      setIndividualError(e.message)
    } finally {
      setIndividualLoading(false)
    }
  }

  // Carregar jobs
  const loadJobs = async () => {
    try {
      setLoading(true)
      setError('')
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch('/api/enrich/jobs', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      })
      const json = await res.json()
      if (res.ok) {
        setJobs(json?.jobs || [])
      } else {
        setError(json?.error || 'Erro ao listar jobs')
      }
    } catch (e) {
      setError(e?.message || 'Erro ao listar jobs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadJobs()
    const interval = setInterval(loadJobs, 5000) // Atualizar a cada 5s
    return () => clearInterval(interval)
  }, [])

  // Upload de arquivo
  const onFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (evt) => {
      setCsvText(evt.target?.result || '')
    }
    reader.readAsText(file, 'UTF-8')
  }

  const onUpload = async () => {
    if (!csvText) {
      setError('Selecione um arquivo CSV')
      return
    }

    // Nunca bloquear por falta de configuração: backend possui fallback

    try {
      setUploading(true)
      setError('')
      setMessage('')

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const res = await fetch('/api/enrich/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          csv: csvText,
          filename: fileName,
          type: bulkType !== 'auto' ? bulkType : undefined
        })
      })

      const json = await res.json()
      if (res.ok) {
        setMessage(`Upload concluído! ${json.total_rows} registros. Lote: ${json.lote_id.slice(0, 12)}...`)
        setCsvText('')
        setFileName('')
        const input = document.getElementById('fileInput')
        if (input) input.value = ''
        loadJobs()
      } else {
        setError(json?.error || 'Erro ao fazer upload')
      }
    } catch (e) {
      setError(e?.message || 'Erro ao fazer upload')
    } finally {
      setUploading(false)
    }
  }

  // Processar lote
  const onProcess = async (lote_id) => {
    try {
      setProcessing(prev => ({ ...prev, [lote_id]: true }))
      setError('')
      setMessage('')

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const res = await fetch('/api/enrich/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ lote_id })
      })

      const json = await res.json()
      if (res.ok) {
        setMessage(`✅ Processados: ${json.processed} | Sucesso: ${json.success_count} | Falhas: ${json.failed_count} | Créditos usados: R$ ${json.credits_used.toFixed(2)} | Saldo restante: R$ ${json.remaining_credits?.toFixed(2) || '0.00'}`)
        loadJobs()
      } else {
        // Destacar erro de saldo insuficiente
        if (res.status === 402) {
          setError(`💳 ${json?.error || 'Saldo insuficiente para processar este lote'}`)
        } else {
          setError(json?.error || 'Erro ao processar')
        }
      }
    } catch (e) {
      setError(e?.message || 'Erro ao processar')
    } finally {
      setProcessing(prev => ({ ...prev, [lote_id]: false }))
    }
  }

  // Download
  const onDownload = async (lote_id) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const res = await fetch(`/api/enrich/download?lote_id=${encodeURIComponent(lote_id)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      })
      if (!res.ok) {
        const json = await res.json()
        setError(json?.error || 'Erro ao baixar')
        return
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `enriquecimento_${lote_id.slice(0, 12)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      setError(e?.message || 'Erro ao baixar')
    }
  }

  const getStatusBadge = (status) => {
    const variants = {
      pendente: 'secondary',
      processando: 'default',
      concluido: 'success',
      erro: 'destructive'
    }
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>
  }

  return (
    <div className="-m-4 min-h-[calc(100vh-56px)] bg-background">
      <div className="container mx-auto py-6 px-6">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center shadow-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600 bg-clip-text text-transparent">Higienizar Dados</h1>
              <p className="text-sm text-muted-foreground">Enriqueça sua base com dados atualizados</p>
            </div>
          </div>
        </div>

        {message && (
          <Alert className="mb-4 border-green-200 bg-green-50 dark:bg-green-900/20">
            <AlertCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700 dark:text-green-400">{message}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert className="mb-4" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="importar" className="mb-8">
          <TabsList className="mb-4">
            <TabsTrigger value="importar">Importar Planilha</TabsTrigger>
            <TabsTrigger value="individual">Consulta Individual</TabsTrigger>
          </TabsList>
          <TabsContent value="importar">
            {/* Card de Upload */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Importar Planilha
                </CardTitle>
                <CardDescription>
                  Envie um arquivo CSV com coluna CPF, CNPJ, Placa ou Telefone. Cada consulta consome R$ {costPerQuery} em créditos.
                </CardDescription>
                <div className="mt-3 p-3 bg-muted/50 rounded-md border border-border/50">
                  <p className="text-xs text-muted-foreground">
                    <strong>Tipos de consulta suportados:</strong>
                  </p>
                  <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    <li>• <strong>CPF</strong> - Dados de Pessoa Física (nome, data nascimento, situação)</li>
                    <li>• <strong>CNPJ</strong> - Dados de Pessoa Jurídica (razão social, atividade, situação)</li>
                    <li>• <strong>Placa</strong> - Dados de Veículos (marca, modelo, ano, proprietário)</li>
                    <li>• <strong>Telefone</strong> - Dados de Telefone (operadora, tipo, localização)</li>
                  </ul>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
                    <div className="md:col-span-3">
                      <input
                        id="fileInput"
                        type="file"
                        accept=".csv"
                        onChange={onFileChange}
                        className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                      />
                      {fileName && (
                        <p className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          {fileName}
                        </p>
                      )}
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-xs font-medium">Tipo de Consulta (forçar)</label>
                      <select value={bulkType} onChange={e => setBulkType(e.target.value)} className="w-full border rounded px-2 py-2 text-sm bg-background">
                        <option value="auto">Automático (detectar coluna)</option>
                        <option value="cpf">CPF</option>
                        <option value="cnpj">CNPJ</option>
                        <option value="placa">Placa</option>
                        <option value="telefone">Telefone</option>
                      </select>
                      <p className="text-[10px] text-muted-foreground">Use esta opção apenas se quiser sobrescrever a detecção automática pela coluna.</p>
                    </div>
                  </div>

                  {/* Alerta removido: fallback de credencial é automático */}

                  <div className="flex gap-2">
                    <Button onClick={onUpload} disabled={uploading || !csvText}>
                      {uploading ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Importar
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCsvText('')
                        setFileName('')
                        const input = document.getElementById('fileInput')
                        if (input) input.value = ''
                      }}
                      disabled={!csvText}
                    >
                      Limpar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Lista de Jobs */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Processamentos</CardTitle>
                  <CardDescription>Histórico de enriquecimento de dados</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={loadJobs} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Arquivo</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Progresso</TableHead>
                        <TableHead>Sucesso</TableHead>
                        <TableHead>Falhas</TableHead>
                        <TableHead>Créditos</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobs.map((job) => (
                        <TableRow key={job.lote_id}>
                          <TableCell className="text-sm">
                            {new Date(job.created_at).toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell className="font-medium text-sm">{job.filename}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="uppercase font-mono text-xs">
                              {job.query_type || 'cpf'}
                            </Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(job.status)}</TableCell>
                          <TableCell>
                            <div className="space-y-1 min-w-[150px]">
                              <Progress value={job.progress?.percent || 0} className="h-2" />
                              <p className="text-xs text-muted-foreground">
                                {job.progress?.processed || 0}/{job.progress?.total || 0} ({job.progress?.percent || 0}%)
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-green-600 font-semibold">
                            {job.success_rows || 0}
                          </TableCell>
                          <TableCell className="text-sm text-red-600 font-semibold">
                            {job.failed_rows || 0}
                          </TableCell>
                          <TableCell className="text-sm font-mono">
                            R$ {(job.credits_used || 0).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {job.status === 'pendente' && (
                                <Button
                                  size="sm"
                                  onClick={() => onProcess(job.lote_id)}
                                  disabled={processing[job.lote_id]}
                                >
                                  {processing[job.lote_id] ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Sparkles className="h-4 w-4 mr-1" />
                                      Processar
                                    </>
                                  )}
                                </Button>
                              )}
                              {job.status === 'processando' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onProcess(job.lote_id)}
                                  disabled={processing[job.lote_id]}
                                >
                                  {processing[job.lote_id] ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>Continuar</>
                                  )}
                                </Button>
                              )}
                              {(job.status === 'concluido' || job.processed_rows > 0) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onDownload(job.lote_id)}
                                >
                                  <Download className="h-4 w-4 mr-1" />
                                  Baixar
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {jobs.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            Nenhum processamento ainda. Faça upload de uma planilha para começar.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="individual">
            {/* Aba de Consulta Individual */}
            <Card>
              <CardHeader>
                <CardTitle>Consulta Individual</CardTitle>
                <CardDescription>
                  Faça consultas pontuais de CPF, CNPJ, Placa ou Telefone sem subir planilha.
                  <span className="ml-2 text-orange-600 font-semibold">
                    💰 Custo: R$ {parseFloat(costPerQuery || 0.07).toFixed(2)} por consulta
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Tipo</label>
                    <select value={individualType} onChange={e => setIndividualType(e.target.value)} className="w-full border rounded px-2 py-2 text-sm bg-background">
                      <option value="cpf">CPF</option>
                      <option value="cnpj">CNPJ</option>
                      <option value="placa">Placa</option>
                      <option value="telefone">Telefone</option>
                    </select>
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-xs font-medium">Valor</label>
                    <Input 
                      placeholder="Digite o valor (ex: 12345678901, 12345678000190, ABC1234, 11999999999)" 
                      value={individualValue} 
                      onChange={e => setIndividualValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && individualValue.trim() && !individualLoading) {
                          runIndividualQuery()
                        }
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button onClick={runIndividualQuery} disabled={individualLoading || !individualValue}> {individualLoading ? 'Consultando...' : 'Consultar'} </Button>
                    <Button variant="outline" disabled={!individualValue || individualLoading} onClick={() => { setIndividualValue(''); setIndividualResult(null); setIndividualError('') }}>Limpar</Button>
                  </div>
                </div>
                {individualError && (
                  <Alert variant="destructive">
                    <AlertDescription>{individualError}</AlertDescription>
                  </Alert>
                )}
                {individualResult && (
                  <EnrichedDataDisplay data={individualResult} />
                )}
                {!individualResult && !individualError && (
                  <p className="text-xs text-muted-foreground">Insira o valor e clique em Consultar para ver os dados enriquecidos.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
