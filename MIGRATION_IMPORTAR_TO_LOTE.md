# Migração: Tabela `importar` → `lote_items` & API `/api/importar` → `/api/lote`

**Data**: 13 de novembro de 2025  
**Status**: ✅ Código atualizado | ⏳ Aguardando execução SQL

---

## 📋 Resumo

Renomeação completa da tabela e API de **"importar"** para **"lote"** conforme solicitação do usuário, para melhor semântica e alinhamento com nomenclatura do sistema.

## 🔄 Mudanças Realizadas

### 1. **Tabela no Banco de Dados**
- **Antes**: `importar`
- **Depois**: `lote_items`
- **Arquivo SQL**: `scripts/sql/rename_importar_to_lote.sql`
- **Ação necessária**: Executar script no Supabase SQL Editor

### 2. **API Routes**
- **Antes**: `app/api/importar/`
- **Depois**: `app/api/lote/`
- Renomeados:
  - `app/api/lote/route.js` (GET, POST, PUT, DELETE)
  - `app/api/lote/status/route.js` (webhook callback)

### 3. **Arquivos Atualizados**

#### Backend (APIs)
- ✅ `app/api/lote/route.js`
  - Todas referências `from('importar')` → `from('lote_items')`
  - Chave Redis: `importar:cleanup:daily` → `lote:cleanup:daily`
  - Local storage: `importar.json` → `lote.json`
  - Logs e comentários atualizados

- ✅ `app/api/lote/status/route.js`
  - Atualizado `from('importar')` → `from('lote_items')`
  - Local storage: `importar.json` → `lote.json`

#### Frontend
- ✅ `app/consulta-lote/page.js`
  - Todas chamadas `/api/importar` → `/api/lote`
  - GET (listagem com paginação)
  - POST (upload)
  - PUT (reprocessar)
  - DELETE (remover)
  - GET download

- ✅ `app/clientes/page.js`
  - Comentário e fetch: `/api/importar` → `/api/lote`

#### Scripts
- ✅ `scripts/check_lotes.js`
  - Todas referências `from('importar')` → `from('lote_items')`
  - Log: "tabela importar" → "tabela lote_items"

### 4. **Compatibilidade Mantida**
- ✅ Estrutura de dados permanece inalterada
- ✅ Campos da tabela não foram modificados
- ✅ Lógica de negócio preservada
- ✅ Credenciais multi-usuário continuam funcionando
- ✅ Webhooks externos não afetados (payload permanece igual)

---

## 🚀 Passos para Ativar

### 1. Executar Migração no Supabase
```sql
-- No Supabase SQL Editor, execute:
-- File: scripts/sql/rename_importar_to_lote.sql

ALTER TABLE importar RENAME TO lote_items;
```

### 2. Verificar Aplicação
```powershell
# Reiniciar servidor dev
npm run dev
```

### 3. Testar Fluxo Completo
1. **Acessar** `/consulta-lote`
2. **Upload** de CSV
3. **Verificar** criação de lote
4. **Download** de resultado
5. **Reprocessar** lote existente
6. **Deletar** lote

### 4. Validar Backend
```powershell
# Verificar registros na nova tabela
node scripts/check_lotes.js
```

---

## ⚠️ Pontos de Atenção

### Não Precisa Atualizar
- ❌ **Webhooks de bancos externos**: continuam enviando para mesma URL do CRM
- ❌ **Credenciais salvas**: tabela `bank_credentials` não foi alterada
- ❌ **Usuários e permissões**: nenhuma mudança

### Precisa Atualizar (se existirem)
- ⚠️ **Scripts SQL manuais**: que referenciam `importar` diretamente
- ⚠️ **Documentação externa**: atualizar referências à tabela antiga
- ⚠️ **Webhooks de retorno**: se configurados com `/api/importar/status`, mudar para `/api/lote/status`

---

## 📂 Arquivos de Migração

| Arquivo | Propósito |
|---------|-----------|
| `scripts/sql/rename_importar_to_lote.sql` | Script de renomeação da tabela |
| `app/api/lote/` | Nova pasta da API (antiga importar) |
| `.emergent/lote.json` | Novo arquivo de metadados locais |

---

## 🔍 Verificação Pós-Migração

### Checklist
- [ ] SQL executado com sucesso no Supabase
- [ ] Tabela `lote_items` existe e contém dados
- [ ] API `/api/lote` responde (GET, POST, PUT, DELETE)
- [ ] Frontend lista lotes corretamente
- [ ] Upload de CSV cria novo lote
- [ ] Download gera CSV completo
- [ ] Reprocessar aciona webhook
- [ ] Deletar remove registros

### Rollback (se necessário)
```sql
-- Em caso de problemas, reverter:
ALTER TABLE lote_items RENAME TO importar;
```

Depois reverter código:
```powershell
git revert HEAD
```

---

## 📊 Impacto Estimado

- **Downtime**: ⏱️ ~5 segundos (execução do ALTER TABLE)
- **Dados afetados**: 0 (apenas renomeação)
- **Compatibilidade**: ✅ 100% mantida
- **Risco**: 🟢 Baixo (mudança estrutural simples)

---

## ✅ Status Final

**Código**: ✅ Atualizado e validado (sem erros de sintaxe)  
**Banco**: ⏳ Aguardando execução manual do SQL  
**Testes**: ⏳ Pendente após migração do banco

**Próximos passos**: Execute o SQL e teste o fluxo completo de Consulta em Lote.
