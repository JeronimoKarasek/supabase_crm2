# Fix: Histórico Completo de Campanhas SMS

## Problema Identificado

A rota `/api/disparo-sms/batches` estava limitada a **1000 registros** devido ao limite padrão do Supabase nas queries. Quando você tinha mais de 1000 registros na tabela `sms_disparo`:

- A query trazia apenas os 1000 registros mais recentes
- Batch IDs mais antigos ficavam de fora
- Na UI, só aparecia 1 campanha (ou poucas campanhas), mesmo tendo criado várias
- Ao cancelar uma campanha, outra mais antiga aparecia (pois estava "escondida" pelo limite)

## Solução Implementada

Substituí a query simples por um **loop de paginação** que busca TODOS os registros em blocos de 1000, até não ter mais dados:

```javascript
// ANTES (limitado a 1000 registros)
const { data: allRecords } = await supabaseAdmin
  .from('sms_disparo')
  .select('batch_id, created_at')
  .order('created_at', { ascending: false })

// DEPOIS (busca tudo com paginação)
let allBatchIds = new Set()
let page = 0
const pageSize = 1000
let hasMore = true

while (hasMore) {
  const { data: pageRecords } = await supabaseAdmin
    .from('sms_disparo')
    .select('batch_id')
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)
  
  if (!pageRecords || pageRecords.length === 0) {
    hasMore = false
  } else {
    pageRecords.forEach(r => allBatchIds.add(r.batch_id))
    if (pageRecords.length < pageSize) {
      hasMore = false
    }
    page++
  }
}
```

### Logs Adicionados

A rota agora loga o progresso da paginação:

- `📊 [SMS Batches] Iniciando busca paginada de batch_ids...`
- `📊 [SMS Batches] Página N: X registros, Y batch_ids únicos acumulados`
- `📊 [SMS Batches] Total de campanhas únicas encontradas: Z`

## Como Testar

1. **Reinicie o servidor de desenvolvimento**:
   ```powershell
   # Ctrl+C no terminal onde está rodando npm run dev
   npm run dev
   ```

2. **Acesse a tela de Disparo SMS**:
   - `http://localhost:3000/disparo-sms`
   - Vá na seção "Campanhas Importadas"

3. **Observe os logs no terminal**:
   - Procure por `[SMS Batches] Página N: ...`
   - Confirme que mostra todas as páginas até não ter mais dados
   - Veja o total final: `Total de campanhas únicas encontradas: X`

4. **Observe os logs no console do navegador** (F12 → Console):
   - `📊 [CampaignsList] Total de campanhas recebidas da API: X`
   - Esse número agora deve bater com o total real de campanhas no banco

5. **Confira a UI**:
   - O texto acima dos cards deve mostrar: `Total de campanhas: X (Página N de M)`
   - Se tiver mais de 6 campanhas, use os botões "Anterior"/"Próxima" para navegar
   - **Todas** as campanhas criadas devem aparecer, das mais recentes às mais antigas

## Resultado Esperado

### Antes da Correção
- UI mostrava apenas 1 campanha
- Ao cancelar, outra aparecia "do nada" (era uma mais antiga)
- Logs: `Total de campanhas únicas encontradas: 1` (mas havia mais no banco)

### Depois da Correção
- UI mostra **TODAS** as campanhas existentes no banco (visíveis para aquele usuário)
- Logs: `Página 1: 1000 registros...`, `Página 2: 500 registros...`, etc.
- Total: `Total de campanhas únicas encontradas: 4` (se você criou 4 campanhas de teste)
- UI: `Total de campanhas: 4 (Página 1 de 1)` ou mais páginas se tiver muitas

## Impacto na Performance

- **Primeira chamada pode ser mais lenta** se você tiver milhares de registros (ex: 10.000 registros = ~10 queries de 1000)
- Mas garante que você vê **100% do histórico**, sem campanhas "escondidas"
- O resultado é cacheado no frontend até você clicar em "Atualizar"

## Próximos Passos (Opcional)

Se a performance ficar lenta com muitos registros, podemos:

1. **Adicionar cache em Redis** para a lista de batch_ids
2. **Criar índice no banco** em `(user_id, created_at, batch_id)` para acelerar a query
3. **Implementar paginação também no frontend** (buscar apenas 20 campanhas por vez, em vez de todas)

Mas para uso típico (centenas de campanhas), a solução atual é suficiente e garante histórico completo.

---

**Data da Correção**: 14/11/2025  
**Arquivo Modificado**: `app/api/disparo-sms/batches/route.js`
