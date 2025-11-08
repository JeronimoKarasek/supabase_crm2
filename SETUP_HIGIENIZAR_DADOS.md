# Setup - Sistema de Higienização de Dados

Este documento descreve os passos necessários para ativar o sistema de higienização de dados com a API Shift Data.

## 📋 Pré-requisitos

- Acesso ao Supabase SQL Editor
- Access Key da Shift Data: `96FA65CEC7234FFDA72D2D97EA6A457B`
- Custo por consulta definido (padrão: R$ 0,10)

## 🔧 Passo 1: Executar SQL no Supabase

1. Acesse o Supabase Dashboard
2. Vá em **SQL Editor**
3. Crie uma nova query
4. Copie o conteúdo do arquivo `scripts/sql/enrichment.sql`
5. Cole no editor e execute

### O que o SQL cria:

**Tabela: `enrichment_jobs`**
- Armazena informações dos lotes de processamento
- Campos: lote_id, user_email, status, progresso, créditos usados
- Status possíveis: `pendente`, `processando`, `concluido`, `erro`

**Tabela: `enrichment_records`**
- Armazena os registros individuais de cada CPF
- Campos: lote_id, cpf, original_data (JSONB), enriched_data (JSONB)
- Status por registro: `pending`, `success`, `failed`

**RLS Policies:**
- Usuários só veem seus próprios jobs/records
- Service role tem acesso total (necessário para processamento background)

## ⚙️ Passo 2: Configurar Credenciais

1. Inicie o servidor local:
   ```bash
   npm run dev
   ```

2. Acesse: http://localhost:3000/configuracao

3. Vá na aba **"APIs Externas"**

4. Preencha os campos:
   - **Access Key**: `96FA65CEC7234FFDA72D2D97EA6A457B`
   - **Custo por Consulta**: `0.10` (ou valor fornecido pela Shift Data)

5. Clique em **"Salvar Configurações Shift Data"**

## 🧪 Passo 3: Testar o Sistema

### 3.1 Preparar CSV de Teste

Crie um arquivo CSV com pelo menos uma coluna chamada "CPF" (case insensitive):

```csv
Nome;CPF;Email
João Silva;12345678901;joao@email.com
Maria Santos;98765432100;maria@email.com
```

### 3.2 Usar a Interface

1. Acesse: http://localhost:3000/higienizar-dados

2. **Upload do CSV:**
   - Clique em "Escolher arquivo"
   - Selecione seu CSV
   - Clique em "Enviar"
   - Você verá o job criado na tabela

3. **Processar o Lote:**
   - Localize o job na lista (status: "pendente")
   - Clique no botão **"Processar"**
   - O sistema começará a enriquecer os dados
   - A página atualiza automaticamente a cada 5 segundos

4. **Acompanhar Progresso:**
   - Barra de progresso mostra: processados/total
   - Contadores de sucessos e falhas
   - Créditos gastos em tempo real

5. **Baixar Resultados:**
   - Quando status = "concluido"
   - Botão **"Baixar"** fica disponível
   - Download de CSV combinado (dados originais + enriquecidos)

### 3.3 Estrutura do CSV Exportado

O arquivo baixado contém:
- Todas as colunas originais com prefixo `original_`
- Dados enriquecidos com prefixo `enriquecido_`
- Colunas especiais:
  - `status_enriquecimento`: success/failed
  - `erro_enriquecimento`: mensagem de erro (se houver)

Exemplo:
```csv
original_Nome;original_CPF;original_Email;enriquecido_nome;enriquecido_data_nascimento;enriquecido_situacao_cpf;status_enriquecimento;erro_enriquecimento
João Silva;12345678901;joao@email.com;JOÃO DA SILVA;1990-05-15;REGULAR;success;
```

## 🔍 Verificação

### Verificar Tabelas Criadas

Execute no Supabase SQL Editor:

```sql
-- Verificar estrutura da tabela de jobs
SELECT * FROM enrichment_jobs LIMIT 1;

-- Verificar estrutura da tabela de records
SELECT * FROM enrichment_records LIMIT 1;

-- Contar jobs existentes
SELECT COUNT(*) as total_jobs FROM enrichment_jobs;
```

### Verificar Configurações

Execute no Supabase SQL Editor:

```sql
SELECT 
  data->>'shiftDataAccessKey' as access_key,
  data->>'shiftDataCostPerQuery' as cost_per_query
FROM global_settings 
WHERE id = 'global';
```

Deve retornar:
- `access_key`: começa com `96FA65CE...`
- `cost_per_query`: `"0.10"` ou valor configurado

## 🚨 Troubleshooting

### Erro: "Configurações Shift Data não encontradas"

**Causa**: Credenciais não foram salvas.

**Solução**: 
1. Vá em `/configuracao`
2. Aba "APIs Externas"
3. Preencha e salve novamente

### Erro: "Table enrichment_jobs does not exist"

**Causa**: SQL não foi executado.

**Solução**: Execute `scripts/sql/enrichment.sql` no Supabase

### Upload funciona mas processamento não inicia

**Causa Possível 1**: Access Key inválida.

**Verificação**:
```sql
SELECT data->>'shiftDataAccessKey' FROM global_settings WHERE id = 'global';
```

**Causa Possível 2**: Endpoint da Shift Data fora do ar.

**Teste Manual**:
```bash
# PowerShell
$body = @{ accessKey = "96FA65CEC7234FFDA72D2D97EA6A457B" } | ConvertTo-Json
Invoke-RestMethod -Uri "https://api.shiftdata.com.br/api/Login" -Method POST -Body $body -ContentType "application/json"
```

Deve retornar: `{ "success": true, "token": "..." }`

### Progresso não atualiza na tela

**Causa**: Auto-refresh não funcionando.

**Solução**: 
1. Abra o Console do navegador (F12)
2. Procure por erros de rede
3. Verifique se `/api/enrich/jobs` retorna 200 OK
4. Recarregue a página (Ctrl+R)

## 📊 Monitoramento

### Verificar Jobs em Andamento

```sql
SELECT 
  lote_id,
  filename,
  status,
  processed_rows || '/' || total_rows as progress,
  success_rows,
  failed_rows,
  credits_used,
  created_at
FROM enrichment_jobs
WHERE status = 'processando'
ORDER BY created_at DESC;
```

### Verificar Registros de um Lote

```sql
SELECT 
  cpf,
  status,
  original_data->>'Nome' as nome_original,
  enriched_data->>'nome' as nome_enriquecido,
  error_message
FROM enrichment_records
WHERE lote_id = 'SEU_LOTE_ID_AQUI'
LIMIT 10;
```

### Total de Créditos Gastos (Hoje)

```sql
SELECT 
  SUM(credits_used) as total_credits,
  COUNT(*) as total_jobs
FROM enrichment_jobs
WHERE DATE(created_at) = CURRENT_DATE;
```

## 🎯 Fluxo Completo

```
1. Usuário faz upload de CSV com coluna CPF
   ↓
2. Sistema cria job (pendente) + insere records (pending)
   ↓
3. Usuário clica "Processar"
   ↓
4. API autentica na Shift Data (Login endpoint)
   ↓
5. Para cada CPF:
   - Chama PessoaFisica endpoint
   - Salva enriched_data (JSON)
   - Atualiza contadores (success/failed)
   - Calcula créditos gastos
   - Aguarda 100ms (rate limit)
   ↓
6. Atualiza status do job para "concluido"
   ↓
7. Usuário baixa CSV com dados combinados
```

## 📚 Referências

- **Documentação Shift Data**: https://api.shiftdata.com.br/swagger/index.html
- **Código Frontend**: `app/higienizar-dados/page.js`
- **API Upload**: `app/api/enrich/upload/route.js`
- **API Process**: `app/api/enrich/process/route.js`
- **API Jobs**: `app/api/enrich/jobs/route.js`
- **API Download**: `app/api/enrich/download/route.js`

## ✅ Checklist Final

Antes de usar em produção:

- [ ] SQL executado no Supabase
- [ ] Tabelas `enrichment_jobs` e `enrichment_records` existem
- [ ] RLS policies ativas
- [ ] Access Key configurada em `/configuracao`
- [ ] Custo por consulta definido
- [ ] Teste com CSV pequeno (5-10 linhas)
- [ ] Verificar processamento completo
- [ ] Conferir CSV exportado
- [ ] Validar cálculo de créditos
- [ ] Testar com diferentes formatos de CPF (com/sem máscara)
- [ ] Deploy no Vercel com variável de ambiente (se necessário)

---

**Status**: Sistema pronto para uso local. Aguardando testes antes do commit.
