# Endpoints API Shift Data - Guia Completo

Este documento descreve todos os endpoints implementados no sistema de higienização de dados.

## 🔐 Autenticação

Todos os endpoints requerem autenticação via token Bearer obtido no login.

### Login
```
POST https://api.shiftdata.com.br/api/Login
Content-Type: application/json

{
  "accessKey": "SEU_ACCESS_KEY_AQUI"
}
```

**Resposta:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## 📋 Endpoints de Consulta

### 1. Pessoa Física (CPF)

Retorna dados cadastrais de pessoa física.

**Endpoint:** `POST https://api.shiftdata.com.br/api/PessoaFisica`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Body:**
```json
{
  "cpf": "12345678901"
}
```

**Formato CSV:**
```csv
Nome;CPF;Email
João Silva;123.456.789-01;joao@email.com
Maria Santos;987.654.321-00;maria@email.com
```

**Resposta (exemplo):**
```json
{
  "success": true,
  "data": {
    "nome": "JOAO DA SILVA",
    "data_nascimento": "1990-05-15",
    "situacao_cpf": "REGULAR",
    "nome_mae": "MARIA DA SILVA",
    "sexo": "M",
    "naturalidade": "SÃO PAULO",
    "uf_nascimento": "SP"
  }
}
```

---

### 2. Pessoa Jurídica (CNPJ)

Retorna dados cadastrais de empresa.

**Endpoint:** `POST https://api.shiftdata.com.br/api/PessoaJuridica`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Body:**
```json
{
  "cnpj": "12345678000190"
}
```

**Formato CSV:**
```csv
Empresa;CNPJ;Contato
Empresa Exemplo LTDA;12.345.678/0001-90;contato@empresa.com
Outra Empresa SA;98.765.432/0001-00;comercial@outra.com
```

**Resposta (exemplo):**
```json
{
  "success": true,
  "data": {
    "razao_social": "EMPRESA EXEMPLO LTDA",
    "nome_fantasia": "EXEMPLO",
    "cnpj": "12345678000190",
    "data_abertura": "2015-03-10",
    "situacao_cadastral": "ATIVA",
    "atividade_principal": "Comércio varejista",
    "capital_social": "100000.00",
    "natureza_juridica": "Sociedade Empresária Limitada",
    "endereco": {
      "logradouro": "Rua das Empresas",
      "numero": "123",
      "bairro": "Centro",
      "municipio": "São Paulo",
      "uf": "SP",
      "cep": "01234567"
    },
    "socios": [
      {
        "nome": "JOÃO DA SILVA",
        "cpf": "12345678901",
        "qualificacao": "Sócio-Administrador"
      }
    ]
  }
}
```

---

### 3. Veículos (Placa)

Retorna dados de veículos.

**Endpoint:** `POST https://api.shiftdata.com.br/api/Veiculos`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Body:**
```json
{
  "placa": "ABC1D23"
}
```

**Formato CSV:**
```csv
Veiculo;Placa;Proprietario
Carro 1;ABC-1234;João Silva
Moto 1;XYZ-9876;Maria Santos
```

**Resposta (exemplo):**
```json
{
  "success": true,
  "data": {
    "placa": "ABC1D23",
    "renavam": "12345678901",
    "chassi": "9BWZZZ377VT004251",
    "marca": "VOLKSWAGEN",
    "modelo": "GOL 1.0",
    "ano_fabricacao": "2020",
    "ano_modelo": "2021",
    "cor": "PRATA",
    "tipo": "AUTOMOVEL",
    "especie": "PASSAGEIRO",
    "combustivel": "FLEX",
    "municipio": "SÃO PAULO",
    "uf": "SP",
    "situacao": "REGULAR",
    "proprietario": {
      "nome": "JOÃO DA SILVA",
      "documento": "12345678901",
      "tipo_documento": "CPF"
    }
  }
}
```

---

### 4. Telefone

Retorna dados sobre telefone.

**Endpoint:** `POST https://api.shiftdata.com.br/api/Telefone`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
```

**Body:**
```json
{
  "telefone": "11987654321"
}
```

**Formato CSV:**
```csv
Nome;Telefone;Email
João Silva;(11) 98765-4321;joao@email.com
Maria Santos;11-91234-5678;maria@email.com
```

**Resposta (exemplo):**
```json
{
  "success": true,
  "data": {
    "numero": "11987654321",
    "ddd": "11",
    "numero_formatado": "(11) 98765-4321",
    "operadora": "VIVO",
    "tipo": "MÓVEL",
    "uf": "SP",
    "municipio": "SÃO PAULO",
    "ativo": true,
    "portabilidade": false
  }
}
```

---

## 🔄 Como o Sistema Detecta o Tipo

O sistema detecta automaticamente o tipo de consulta baseado nas colunas do CSV:

**Prioridade de detecção:**
1. **CPF** - Se encontrar coluna exata "cpf" (case insensitive)
2. **CNPJ** - Se encontrar coluna exata "cnpj"
3. **Placa** - Se encontrar coluna exata "placa"
4. **Telefone** - Se encontrar coluna "telefone", "phone" ou "celular"

**Validações aplicadas:**
- **CPF**: Remove formatação e valida 11 dígitos
- **CNPJ**: Remove formatação e valida 14 dígitos
- **Placa**: Remove caracteres especiais e valida 7 caracteres (formato Mercosul ou antigo)
- **Telefone**: Remove formatação e valida mínimo 10 dígitos (DDD + número)

---

## 💾 Estrutura do Banco de Dados

### Tabela: `enrichment_jobs`

```sql
CREATE TABLE enrichment_jobs (
  id BIGSERIAL PRIMARY KEY,
  lote_id TEXT UNIQUE,
  query_type TEXT, -- 'cpf', 'cnpj', 'placa', 'telefone'
  filename TEXT,
  status TEXT,     -- 'pendente', 'processando', 'concluido', 'erro'
  total_rows INTEGER,
  processed_rows INTEGER,
  success_rows INTEGER,
  failed_rows INTEGER,
  credits_used NUMERIC(10,2),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Tabela: `enrichment_records`

```sql
CREATE TABLE enrichment_records (
  id BIGSERIAL PRIMARY KEY,
  lote_id TEXT,
  query_type TEXT,   -- 'cpf', 'cnpj', 'placa', 'telefone'
  query_value TEXT,  -- Valor da consulta (genérico)
  cpf TEXT,          -- Específico para CPF
  cnpj TEXT,         -- Específico para CNPJ
  placa TEXT,        -- Específico para Placa
  telefone TEXT,     -- Específico para Telefone
  original_data JSONB,   -- Dados originais do CSV
  enriched_data JSONB,   -- Resposta da API
  status TEXT,           -- 'pending', 'success', 'failed'
  error_message TEXT,
  processed_at TIMESTAMPTZ
);
```

---

## 📊 Exemplos de Uso

### Exemplo 1: Upload CPF

```javascript
// Frontend
const csv = `Nome;CPF;Email
João Silva;123.456.789-01;joao@email.com
Maria Santos;987.654.321-00;maria@email.com`

const response = await fetch('/api/enrich/upload', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    csv,
    filename: 'clientes.csv'
  })
})

const result = await response.json()
// { success: true, lote_id: "enrich_123...", query_type: "cpf", total_rows: 2 }
```

### Exemplo 2: Upload CNPJ

```javascript
const csv = `Empresa;CNPJ
Empresa A;12.345.678/0001-90
Empresa B;98.765.432/0001-00`

// Sistema detecta automaticamente query_type = 'cnpj'
```

### Exemplo 3: Upload Placa

```javascript
const csv = `Veiculo;Placa
Carro 1;ABC-1234
Moto 1;XYZ-9876`

// Sistema detecta automaticamente query_type = 'placa'
```

### Exemplo 4: Processar Lote

```javascript
const response = await fetch('/api/enrich/process', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    lote_id: 'enrich_123...'
  })
})

// Sistema chama automaticamente o endpoint correto baseado no query_type
```

---

## 🎯 Mapeamento de Endpoints

| Query Type | Coluna CSV | Endpoint API | Validação |
|-----------|-----------|-------------|-----------|
| `cpf` | cpf | `/api/PessoaFisica` | 11 dígitos numéricos |
| `cnpj` | cnpj | `/api/PessoaJuridica` | 14 dígitos numéricos |
| `placa` | placa | `/api/Veiculos` | 7 caracteres alfanuméricos |
| `telefone` | telefone, phone, celular | `/api/Telefone` | Mínimo 10 dígitos |

---

## 🔧 Configuração

### 1. Executar SQL de Migração

```sql
-- Execute no Supabase SQL Editor
-- scripts/sql/enrichment_update_multi_type.sql
```

### 2. Configurar Credenciais

Acesse `/configuracao` → Aba "APIs Externas":
- **Access Key**: Sua chave da API Shift Data
- **Custo por Consulta**: R$ 0.10 (ou valor acordado)

### 3. Testar

1. Acesse `/higienizar-dados`
2. Faça upload de um CSV com qualquer tipo de coluna (CPF, CNPJ, Placa, Telefone)
3. Sistema detecta automaticamente o tipo
4. Clique em "Processar"
5. Baixe os resultados combinados

---

## ⚠️ Tratamento de Erros

### Erros Comuns

**Erro: "CPF inválido (deve ter 11 dígitos)"**
- Verifique se o CPF está no formato correto
- Sistema aceita com ou sem formatação (123.456.789-01 ou 12345678901)

**Erro: "CNPJ inválido (deve ter 14 dígitos)"**
- CNPJ deve ter exatamente 14 dígitos numéricos

**Erro: "Placa inválida (deve ter 7 caracteres)"**
- Placa deve ter 7 caracteres (ABC1234 ou ABC-1234)

**Erro: "Telefone inválido (mínimo 10 dígitos)"**
- Telefone deve ter DDD + número (mínimo 10 dígitos)

---

## 📈 Monitoramento

### Verificar Jobs em Andamento

```sql
SELECT 
  lote_id,
  query_type,
  filename,
  status,
  processed_rows || '/' || total_rows as progress,
  credits_used
FROM enrichment_jobs
WHERE status = 'processando'
ORDER BY created_at DESC;
```

### Ver Registros de um Lote

```sql
SELECT 
  query_type,
  query_value,
  status,
  enriched_data,
  error_message
FROM enrichment_records
WHERE lote_id = 'SEU_LOTE_ID'
LIMIT 10;
```

---

## 🚀 Recursos Futuros

- [ ] Suporte para múltiplas colunas no mesmo CSV (CPF + CNPJ)
- [ ] Validação de dados antes do envio
- [ ] Retry automático para falhas temporárias
- [ ] Cache de resultados para economizar créditos
- [ ] Webhooks para notificar conclusão
- [ ] Dashboard com estatísticas de uso

---

**Documentação completa:** https://api.shiftdata.com.br/swagger/index.html
