# Exportação de Lote - Todas as Colunas do Schema

## Modificação Realizada

Atualizado o endpoint `/api/importar?downloadId={id}` para exportar **TODAS as colunas do schema da tabela `importar`** no CSV, mesmo que estejam vazias.

## O que mudou

### Antes
- Exportava apenas colunas que existiam nos registros do lote
- Se uma coluna não tinha valores, ela não aparecia no CSV

### Depois
- Busca todas as colunas do schema da tabela `importar` usando `information_schema.columns`
- Inclui todas as colunas no CSV, mesmo que vazias
- Mantém ordem: colunas base → colunas do schema → colunas extras

## Implementação

**Arquivo**: `app/api/importar/route.js`

**Comportamento**:
1. Ao clicar em "Baixar Lote" em `/consulta-lote`
2. Busca o schema completo da tabela `importar`
3. Busca todos os registros do lote
4. Gera CSV com todas as colunas do schema, preenchendo com valores ou deixando vazio

## Colunas Base (Ordem Prioritária)
- `id`
- `created_at`
- `lote_id`
- `cliente`
- `produto`
- `banco_simulado`
- `nome`
- `telefone`
- `cpf`
- `nb`
- `status`
- `consultado`

## Fallback
Se não conseguir buscar o schema (erro de permissão), usa as colunas base acima como fallback.

## Testando

1. Acesse `/consulta-lote`
2. Selecione um lote
3. Clique em "Baixar Lote"
4. O CSV gerado terá **todas** as colunas da tabela `importar`, incluindo colunas vazias

---

**Data**: 10 de novembro de 2025
**Setor afetado**: Apenas "Consulta em lote"
