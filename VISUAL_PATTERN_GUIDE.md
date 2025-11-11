# Padrão Visual Futurista - Guia de Implementação

## 🎨 Objetivo
Aplicar visual moderno, futurista e consistente em todos os setores, seguindo o padrão do setor "Higienizar Dados".

## ✅ Setor Atualizado
- **Dashboard**: Header modernizado com ícone gradiente

## 📋 Checklist de Elementos Visuais

### 1. Header do Setor (OBRIGATÓRIO)
```jsx
<div className="mb-8">
  <div className="flex items-center gap-3 mb-2">
    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[COR1] to-[COR2] flex items-center justify-center shadow-lg">
      <IconeDoSetor className="h-6 w-6 text-white" />
    </div>
    <div>
      <h1 className="text-3xl font-bold text-foreground">Nome do Setor</h1>
      <p className="text-sm text-muted-foreground">Descrição curta e objetiva</p>
    </div>
  </div>
</div>
```

**Gradientes por Setor:**
- Dashboard: `from-blue-500 to-cyan-500`
- Clientes: `from-violet-500 to-purple-500`
- Usuários: `from-cyan-500 to-blue-500`
- Senha de banco: `from-amber-500 to-orange-500`
- Consulta em lote: `from-emerald-500 to-green-500`
- Simular/Digitar: `from-pink-500 to-rose-500`
- Disparo Whats API: `from-green-400 to-green-600` (verde WhatsApp)
- Disparo SMS: `from-teal-500 to-cyan-500`
- Higienizar Dados: `from-purple-500 to-pink-500` ✅ (já está)
- NOVIDADES: `from-orange-500 to-amber-500`
- Criação de produtos: `from-indigo-500 to-purple-500`
- Configuração: `from-slate-500 to-gray-500`

### 2. Container Principal
```jsx
<div className="-m-4 min-h-[calc(100vh-56px)] bg-background">
  <div className="container mx-auto py-6 px-6">
    {/* Conteúdo aqui */}
  </div>
</div>
```

### 3. Alertas/Mensagens
```jsx
{/* Sucesso */}
<Alert className="mb-4 border-green-200 bg-green-50 dark:bg-green-900/20">
  <AlertCircle className="h-4 w-4 text-green-600" />
  <AlertDescription className="text-green-700 dark:text-green-400">
    {mensagem}
  </AlertDescription>
</Alert>

{/* Erro */}
<Alert className="mb-4" variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertDescription>{erro}</AlertDescription>
</Alert>

{/* Info */}
<Alert className="mb-4 border-blue-200 bg-blue-50 dark:bg-blue-900/20">
  <AlertCircle className="h-4 w-4 text-blue-600" />
  <AlertDescription className="text-blue-700 dark:text-blue-400">
    {info}
  </AlertDescription>
</Alert>
```

### 4. Cards com Bordas Coloridas
```jsx
<Card className="border-l-4 border-l-blue-500">
  <CardHeader className="pb-3">
    <CardTitle className="flex items-center gap-2 text-lg">
      <Icone className="h-5 w-5 text-blue-500" />
      Título do Card
    </CardTitle>
  </CardHeader>
  <CardContent>
    {/* Conteúdo */}
  </CardContent>
</Card>
```

### 5. Badges com Variantes
```jsx
{/* Status */}
<Badge variant="default">Ativo</Badge>
<Badge variant="secondary">Pendente</Badge>
<Badge variant="destructive">Erro</Badge>
<Badge variant="outline">Info</Badge>

{/* Com cores customizadas */}
<Badge className="bg-green-500 text-white">WhatsApp</Badge>
<Badge className="bg-blue-500 text-white">SMS</Badge>
```

### 6. Botões com Ícones
```jsx
<Button onClick={handleAction} disabled={loading}>
  {loading ? (
    <>
      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
      Processando...
    </>
  ) : (
    <>
      <Icone className="h-4 w-4 mr-2" />
      Texto do Botão
    </>
  )}
</Button>
```

### 7. Tabelas Estilizadas
```jsx
<div className="border rounded-lg overflow-hidden">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Coluna 1</TableHead>
        <TableHead>Coluna 2</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {items.map((item) => (
        <TableRow key={item.id}>
          <TableCell className="font-medium">{item.name}</TableCell>
          <TableCell>{item.value}</TableCell>
        </TableRow>
      ))}
      {items.length === 0 && (
        <TableRow>
          <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
            Nenhum registro encontrado
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  </Table>
</div>
```

### 8. Progress Bar
```jsx
<div className="space-y-1 min-w-[150px]">
  <Progress value={progresso} className="h-2" />
  <p className="text-xs text-muted-foreground">
    {processados}/{total} ({percentual}%)
  </p>
</div>
```

### 9. Tabs (Abas)
```jsx
<Tabs defaultValue="tab1" className="mb-8">
  <TabsList className="mb-4">
    <TabsTrigger value="tab1">Aba 1</TabsTrigger>
    <TabsTrigger value="tab2">Aba 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">
    {/* Conteúdo aba 1 */}
  </TabsContent>
  <TabsContent value="tab2">
    {/* Conteúdo aba 2 */}
  </TabsContent>
</Tabs>
```

### 10. Inputs Estilizados
```jsx
<div className="space-y-2">
  <label className="text-xs font-medium">Label do Campo</label>
  <Input 
    placeholder="Digite aqui..." 
    value={valor} 
    onChange={e => setValor(e.target.value)}
    className="border-input"
  />
  <p className="text-[10px] text-muted-foreground">
    Texto de ajuda ou informação adicional
  </p>
</div>
```

## 🎯 Ordem de Prioridade para Atualização

1. **Dashboard** ✅ (Header atualizado)
2. **Clientes** (alto uso)
3. **Disparo SMS** (alto uso)
4. **Disparo Whats API** (alto uso)
5. **Consulta em lote** (médio uso)
6. **Produtos/NOVIDADES** (médio uso)
7. **Simular/Digitar** (baixo uso)
8. **Usuários** (admin)
9. **Configuração** (admin)
10. **Senha de banco** (admin)
11. **Criação de produtos** (admin)

## 📦 Imports Necessários

```jsx
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { 
  AlertCircle, 
  RefreshCw, 
  [IconeEspecificoDoSetor] 
} from 'lucide-react'
```

## 🚀 Como Aplicar

1. Abrir o arquivo `page.js` do setor
2. Adicionar imports necessários
3. Substituir header antigo pelo header modernizado
4. Atualizar container principal
5. Aplicar estilos nos cards, tabelas e alertas
6. Testar visualmente

---

**Status Atual:**
- ✅ Higienizar Dados (referência)
- ✅ Dashboard (header atualizado)
- ⏳ Demais setores pendentes

**Próximo:** Clientes
