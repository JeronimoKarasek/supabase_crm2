# Implementações Avançadas - Página de Clientes

## ✅ Funcionalidades Implementadas

### 1. **Botão "Visualizar" - Personalização de Colunas**
- Adicionado ao lado do botão "Filtro"
- Abre dialog com checkboxes para todas as colunas disponíveis
- Estado `visibleColumns` controla quais colunas aparecem na tabela
- 20 colunas disponíveis para seleção
- 9 colunas visíveis por padrão

### 2. **Coluna de Ações na Tabela**
- Nova coluna "Ações" adicionada à direita da tabela
- **Botão Refresh (🔄)**: Apenas na aba Carteira
  - Chama API `/api/consulta-status`
  - Consulta webhook configurado no banco
  - Atualiza dados da linha automaticamente
  - Indicador visual de loading (ícone gira)
  
- **Botão Editar (✏️)**: Em todas as abas
  - Abre popup de edição com 4 abas
  - Permite editar todos os campos do cliente

### 3. **API de Consulta de Status**
- **Rota**: `POST /api/consulta-status`
- **Parâmetro**: `{ rowId: string }`
- **Fluxo**:
  1. Busca registro na tabela `Carteira`
  2. Identifica banco do cliente
  3. Busca webhook de consulta em `global_settings.banks[].webhookConsulta`
  4. Chama webhook com cpf, proposta e rowId
  5. Atualiza registro com dados retornados
- **Campos atualizados**:
  - status
  - Valor liberado
  - simulou
  - digitou
  - proposta
  - valorContrato
  - valorParcela
  - prazo
  - data da atualização

### 4. **Popup de Edição Multi-Aba**
- **Dimensão**: max-w-4xl (grande para edição confortável)
- **Link de Formalização**: Fixo no topo se não vazio
- **4 Abas**:
  
  #### **Aba 1: Cadastro**
  - Nome, CPF, Telefone
  - Data Nascimento, Sexo
  - Email, WhatsApp
  - Renda, Nome da Mãe
  
  #### **Aba 2: Endereço**
  - CEP, Rua, Número
  - Bairro, Cidade, UF
  
  #### **Aba 3: Dados Bancários**
  - Banco, Agência, Conta
  - Tipo de Conta (corrente/poupança)
  - Dígito Conta
  - PIX, Tipo de PIX (cpf/email/telefone/aleatório)
  
  #### **Aba 4: Proposta** (só aparece se `digitou = true`)
  - Valor Contrato, Proposta
  - Vendedor
  - Valor Parcela, Prazo
  - Valor Seguro

- **Botões**: Cancelar | Salvar (com loading)
- **Salvamento**: PUT `/api/{tableName}/{id}` com service_role bypass

### 5. **Campo Webhook de Consulta em Configurações**
- Adicionado terceiro campo de webhook nos bancos
- **Campos por banco**:
  1. Nome do banco
  2. Webhook (consulta em lote) - usado em lotes/batch
  3. **Webhook (consulta de status)** - novo campo para refresh individual
  4. Checkboxes: Lote | Simular/Digitar

## 📁 Arquivos Modificados

### `app/clientes/page.js`
- ✅ Importado ícone `Edit` do lucide-react
- ✅ Estado `refreshing` para controle de loading
- ✅ Função `onRefreshRow(rowId)` - chama API de consulta
- ✅ Função `onEditRow(row)` - abre popup de edição
- ✅ Função `onEditSave()` - salva alterações via API
- ✅ Botão "Visualizar" adicionado ao header
- ✅ Coluna "Ações" com botões refresh e editar
- ✅ Dialog de personalização de colunas
- ✅ Dialog de edição com 4 abas

### `app/api/consulta-status/route.js` (NOVO)
- ✅ POST handler com validação de rowId
- ✅ Busca configurações em global_settings
- ✅ Identifica banco por nome
- ✅ Chama webhook configurado
- ✅ Atualiza registro na Carteira
- ✅ Logs detalhados para debug

### `app/configuracao/page.js`
- ✅ Adicionado input "Webhook (consulta de status)"
- ✅ Grid ajustado para 4 colunas (md:grid-cols-4)
- ✅ State automaticamente salva `webhookConsulta` por banco

## 🔧 Configuração Necessária

### 1. Configurar Webhook de Consulta
No painel de Configurações → Bancos:
1. Para cada banco, preencher campo "Webhook (consulta de status)"
2. Webhook deve aceitar POST com:
```json
{
  "cpf": "12345678900",
  "proposta": "123456",
  "rowId": "uuid"
}
```
3. Webhook deve retornar:
```json
{
  "status": "aprovado",
  "valorLiberado": 5000,
  "simulou": true,
  "digitou": true,
  "proposta": "123456",
  "valorContrato": 5000,
  "valorParcela": 250,
  "prazo": 24
}
```

### 2. Permissões na Tabela Carteira
RLS já foi desabilitado previamente. API usa `supabaseAdmin` (service_role).

## 🎯 Como Usar

### Personalizar Colunas
1. Clicar em "Visualizar" ao lado de "Filtro"
2. Marcar/desmarcar colunas desejadas
3. Fechar dialog - tabela atualiza automaticamente

### Atualizar Dados de um Cliente (Aba Carteira)
1. Clicar no botão 🔄 na linha desejada
2. Sistema chama webhook de consulta
3. Dados são atualizados automaticamente
4. Alert de sucesso ou erro

### Editar Cliente
1. Clicar no botão ✏️ em qualquer linha
2. Popup grande abre com 4 abas
3. Navegar entre abas e editar campos
4. Clicar "Salvar" - dados são atualizados
5. Tabela reflete mudanças imediatamente

## 🚨 Pontos de Atenção

### 1. Autenticação
- Todas as chamadas usam `Authorization: Bearer <token>`
- Token obtido via `supabase.auth.getSession()`

### 2. Filtro Supremo
- Refresh e edição respeitam permissões por role
- Admin vê tudo, Gestor por empresa, Viewer por email

### 3. Webhook de Consulta
- Deve ser configurado POR BANCO em Configurações
- Se não configurado, botão refresh retorna erro 400
- Webhook deve estar acessível publicamente

### 4. Aba Proposta
- Só aparece no popup se `digitou = true`
- Validação no frontend via conditional rendering

### 5. Link de Formalização
- Aparece fixo no topo do popup
- Só exibe se campo `link de formalização` não está vazio
- Abre em nova aba ao clicar

## 📊 Estrutura de Dados

### Estado `visibleColumns` (array)
```javascript
['Nome', 'cpf', 'telefone', 'Valor liberado', 'simulou', 'digitou', 'produto', 'status', 'cliente']
```

### Estado `editForm` (object)
```javascript
{
  Nome: 'João Silva',
  cpf: '12345678900',
  telefone: '11999999999',
  'data nascimento': '1990-01-01',
  sexo: 'M',
  email: 'joao@email.com',
  whats: '11999999999',
  renda: 5000,
  nomeMãe: 'Maria Silva',
  cep: '12345-678',
  rua: 'Rua A',
  numero: '123',
  bairro: 'Centro',
  cidade: 'São Paulo',
  UF: 'SP',
  Banco: 'Itaú',
  agencia: '1234',
  conta: '12345-6',
  'corrente ou poupança': 'corrente',
  digitoconta: '6',
  pix: '11999999999',
  'tipo de pix': 'telefone',
  valorContrato: 5000,
  proposta: '123456',
  'link de formalização': 'https://...',
  vendedor: 'João Vendedor',
  valorParcela: 250,
  prazo: 24,
  valorSeguro: 100
}
```

## 🔄 Fluxo de Atualização

```
Usuário clica em 🔄
  ↓
setRefreshing(rowId) - ícone começa a girar
  ↓
POST /api/consulta-status { rowId }
  ↓
API busca registro na Carteira
  ↓
API identifica banco e busca webhookConsulta
  ↓
API chama webhook externo
  ↓
Webhook retorna dados atualizados
  ↓
API atualiza registro no Supabase
  ↓
fetchTableData() - reload da tabela
  ↓
setRefreshing(null) - ícone para de girar
  ↓
Alert de sucesso
```

## ✅ Testes Recomendados

1. **Teste de Personalização**:
   - Abrir dialog "Visualizar"
   - Desmarcar todas as colunas exceto 3
   - Confirmar tabela exibe apenas 3 colunas

2. **Teste de Refresh** (Carteira):
   - Configurar webhook em Configurações
   - Clicar em 🔄 em uma linha
   - Verificar loading e atualização

3. **Teste de Edição**:
   - Clicar em ✏️ em qualquer linha
   - Editar campo em cada aba
   - Salvar e verificar dados na tabela

4. **Teste de Proposta**:
   - Editar cliente com `digitou = false`
   - Verificar aba Proposta não aparece
   - Editar cliente com `digitou = true`
   - Verificar aba Proposta aparece

5. **Teste de Link**:
   - Editar cliente com link de formalização
   - Verificar link aparece no topo
   - Clicar e verificar abre em nova aba

---

**Status**: ✅ Todas as funcionalidades implementadas  
**Pronto para uso**: Sim  
**Próximos passos**: Configurar webhooks de consulta nos bancos
