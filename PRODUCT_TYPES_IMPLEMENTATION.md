# Sistema de Produtos - Tipos e Métodos de Pagamento

## Alterações Implementadas

### 1. Novos Campos no Produto

Adicionados dois novos campos na tabela `products`:

#### `product_type` (Tipo de Produto)
- **Valores**: `'setor'` | `'usuario'`
- **Default**: `'setor'`
- **Descrição**:
  - `setor`: Produto que libera setores para o usuário comprador
  - `usuario`: Produto que aumenta o limite de usuários (`user_limit`) da empresa

#### `payment_method` (Método de Pagamento)
- **Valores**: `'pix'` | `'creditos'`
- **Default**: `'pix'`
- **Descrição**:
  - `pix`: Pagamento via PIX através do Mercado Pago
  - `creditos`: Pagamento usando saldo de créditos da empresa

### 2. Migração do Banco de Dados

Execute o script SQL no Supabase Dashboard → SQL Editor:

```bash
scripts/sql/add_product_type_payment_method.sql
```

O script:
- Adiciona as colunas `product_type` e `payment_method`
- Define valores default ('setor' e 'pix')
- Adiciona CHECKs para validar valores permitidos
- Atualiza produtos existentes com valores default

### 3. Interface de Criação de Produtos

**Arquivo**: `app/criacao-produtos/page.js`

**Novas Seções**:
1. **Tipo de Produto** (Radio Buttons):
   - 🔓 Liberar Setor - Compra libera setores selecionados
   - 👤 Comprar Usuário - Adiciona quantidade ao user_limit da empresa

2. **Método de Pagamento** (Radio Buttons):
   - 💳 PIX - Pagamento via PIX Mercado Pago
   - 💰 Sistema de Créditos - Usa saldo de créditos da empresa

**Campos de Preço**:
- `basePrice`: Preço base (ou valor em créditos quando paymentMethod = 'creditos')
- `userPrice`: 
  - Se productType = 'setor': Preço por usuário adicional
  - Se productType = 'usuario': **Quantidade de usuários** adicionados ao limite
- `connectionPrice`: Preço por conexão (banking)

**Indicadores Visuais**:
- Labels contextuais nos campos de preço
- Avisos sobre comportamento específico para tipo 'usuario'
- Badges coloridos na lista de produtos mostrando tipo e método de pagamento

### 4. API de Produtos

**Arquivo**: `app/api/products/route.js`

**Mudanças**:
- GET: Inclui `product_type` e `payment_method` no SELECT
- POST: Salva novos campos com valores default
- PUT: Atualiza campos quando fornecidos
- Mapeamento snake_case ↔ camelCase (product_type ↔ productType)

### 5. Lista de Produtos

A lista agora mostra:
- 🔓 Setor / 👤 Usuário (badge azul/amarelo)
- 💳 PIX / 💰 Créditos (badge roxo/verde)
- Preços: Base e Usuário
- Setores liberados

## Próximos Passos

### 1. Implementar Fluxo de Compra com Créditos

**Arquivo**: `app/produtos/[key]/comprar/page.js` (ou similar)

**Lógica**:
```javascript
// 1. Buscar produto
const product = await fetch(`/api/products/public?key=${key}`)

// 2. Verificar método de pagamento
if (product.paymentMethod === 'creditos') {
  // Usar basePrice como valor
  const price = product.pricing.basePrice
  
  // Verificar saldo da empresa
  const empresa = await getEmpresaForUser(userId)
  if (empresa.credits < price) {
    return { error: 'Saldo insuficiente' }
  }
  
  // Deduzir créditos
  await deductCredits(empresaId, price)
  
  // Processar compra (próximo passo)
} else {
  // Fluxo PIX existente (Mercado Pago)
}
```

### 2. Processar Compra (Grant Sectors / Increase User Limit)

**Novo Endpoint**: `app/api/products/purchase/route.js`

```javascript
export async function POST(request) {
  const { productId, userId, empresaId } = await request.json()
  
  // 1. Buscar produto
  const product = await getProduct(productId)
  
  // 2. Verificar pagamento já processado (se PIX)
  // ou deduzir créditos (se creditos)
  
  // 3. Grant sectors
  if (product.sectors.length > 0) {
    await grantSectors(userId, product.sectors)
  }
  
  // 4. Increase user_limit (se productType = 'usuario')
  if (product.productType === 'usuario') {
    const quantity = product.pricing.userPrice // Qtd de usuários
    await increaseUserLimit(empresaId, quantity)
  }
  
  // 5. Trigger webhook
  if (product.webhook_url) {
    await fetch(product.webhook_url, {
      method: 'POST',
      body: JSON.stringify({
        event: 'product_purchased',
        userId,
        empresaId,
        productKey: product.key,
        sectorsGranted: product.sectors,
        userLimitIncreased: product.productType === 'usuario' ? product.pricing.userPrice : 0,
        timestamp: new Date().toISOString()
      })
    })
  }
  
  return { success: true }
}
```

### 3. Helpers Necessários

**lib/empresa.js** (já existe):
```javascript
// Adicionar função para aumentar user_limit
export async function increaseUserLimit(empresaId, quantity) {
  const { data } = await supabaseAdmin
    .from('empresa')
    .select('user_limit')
    .eq('id', empresaId)
    .single()
  
  const newLimit = (data.user_limit || 0) + quantity
  
  await supabaseAdmin
    .from('empresa')
    .update({ user_limit: newLimit })
    .eq('id', empresaId)
  
  return newLimit
}
```

**lib/credits.js** (já existe):
```javascript
// Adicionar função para deduzir créditos
export async function deductCredits(empresaId, amount) {
  const { data } = await supabaseAdmin
    .from('empresa')
    .select('credits')
    .eq('id', empresaId)
    .single()
  
  const currentCredits = parseFloat(data?.credits) || 0
  const newCredits = currentCredits - amount
  
  if (newCredits < 0) {
    throw new Error('Saldo insuficiente')
  }
  
  await supabaseAdmin
    .from('empresa')
    .update({ credits: newCredits })
    .eq('id', empresaId)
  
  return newCredits
}
```

**Novo**: `lib/sectors-grant.js`
```javascript
import { supabaseAdmin } from './supabase-admin'

export async function grantSectors(userId, newSectors) {
  // 1. Buscar setores atuais do usuário
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId)
  const currentSectors = userData?.user?.user_metadata?.sectors || []
  
  // 2. Merge setores (sem duplicatas)
  const allSectors = [...new Set([...currentSectors, ...newSectors])]
  
  // 3. Atualizar user_metadata
  await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...userData?.user?.user_metadata,
      sectors: allSectors
    }
  })
  
  return allSectors
}
```

### 4. UI de Compra Atualizada

**app/produtos/[key]/comprar/page.js**:

```jsx
// Se paymentMethod === 'creditos'
{product.paymentMethod === 'creditos' ? (
  <div className="space-y-4">
    <Alert>
      <InfoIcon className="h-4 w-4" />
      <AlertTitle>Pagamento com Créditos</AlertTitle>
      <AlertDescription>
        Este produto será pago usando o saldo de créditos da sua empresa.
        <br />
        Valor: R$ {product.pricing.basePrice}
        <br />
        Saldo atual: R$ {empresa.credits}
      </AlertDescription>
    </Alert>
    
    {empresa.credits < product.pricing.basePrice ? (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Saldo Insuficiente</AlertTitle>
        <AlertDescription>
          Você precisa de R$ {(product.pricing.basePrice - empresa.credits).toFixed(2)} 
          adicionais para realizar esta compra.
        </AlertDescription>
      </Alert>
    ) : (
      <Button onClick={purchaseWithCredits} className="w-full">
        Comprar com Créditos
      </Button>
    )}
  </div>
) : (
  // Fluxo PIX existente
  <div>...</div>
)}
```

### 5. Tabela de Compras (Histórico)

**Nova Tabela**: `product_purchases`

```sql
CREATE TABLE product_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  user_id UUID NOT NULL,
  empresa_id UUID NOT NULL REFERENCES empresa(id),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'creditos')),
  amount_paid NUMERIC(10,2) NOT NULL,
  sectors_granted TEXT[] DEFAULT '{}',
  user_limit_increased INTEGER DEFAULT 0,
  payment_id TEXT, -- Mercado Pago payment ID (se PIX)
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_purchases_user ON product_purchases(user_id);
CREATE INDEX idx_purchases_empresa ON product_purchases(empresa_id);
CREATE INDEX idx_purchases_product ON product_purchases(product_id);
```

## Resumo das Funcionalidades

### Tipo: Setor (product_type = 'setor')
- ✅ Cliente compra produto
- ✅ Setores selecionados são adicionados ao `user_metadata.sectors`
- ✅ Cliente passa a ver esses setores no menu
- ✅ Pagamento: PIX ou Créditos

### Tipo: Usuário (product_type = 'usuario')
- ✅ Cliente compra produto
- ✅ `userPrice` = quantidade de usuários adicionados
- ✅ `empresa.user_limit` é incrementado por essa quantidade
- ✅ Setores também podem ser liberados (opcional)
- ✅ Pagamento: PIX ou Créditos

### Exemplo Prático

**Produto**: "Pacote 5 Usuários"
```json
{
  "key": "pacote-5-usuarios",
  "name": "Pacote 5 Usuários",
  "productType": "usuario",
  "paymentMethod": "creditos",
  "pricing": {
    "basePrice": 100.00,
    "userPrice": 5
  },
  "sectors": ["Dashboard", "Clientes"]
}
```

**Após compra**:
- Deduz R$ 100,00 dos créditos da empresa
- Aumenta `empresa.user_limit` em 5 usuários
- Adiciona setores "Dashboard" e "Clientes" ao comprador
- Empresa pode adicionar até 5 usuários a mais no sistema

---

**Status**: ✅ Interface e API atualizadas
**Pendente**: Implementar fluxo de compra e grant de setores/user_limit
