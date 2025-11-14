# Fix: Invalid Payload no Vercel (File System)

## Problema

Após deploy no Vercel, a rota `/api/lote` retornava `Invalid payload` ao tentar fazer upload de CSV. No localhost funcionava perfeitamente.

## Causa Raiz

**Vercel é uma plataforma serverless sem file system persistente.** O código tentava usar:

```javascript
import fs from 'fs'
import path from 'path'

const storePath = path.join(process.cwd(), '.emergent', 'lote.json')
function writeStore(obj) { 
  fs.writeFileSync(storePath, JSON.stringify(obj, null, 2), 'utf8') 
}
```

No Vercel:
- ✅ **Leitura de arquivos estáticos** funciona (durante build)
- ❌ **Escrita de arquivos** não funciona (serverless functions são efêmeras)
- ❌ `fs.writeFileSync()`, `fs.mkdirSync()` causam erros silenciosos ou "Invalid payload"

## Solução Implementada

**Migrar armazenamento de `fileName` do file system para o banco de dados.**

### 1. Nova coluna no banco

```sql
-- scripts/sql/add_base_filename_to_lote.sql
ALTER TABLE lote_items 
ADD COLUMN IF NOT EXISTS base_filename TEXT;

CREATE INDEX IF NOT EXISTS idx_lote_items_lote_id ON lote_items(lote_id);
```

### 2. Refatoração do código

**ANTES** (quebrava no Vercel):
```javascript
// Linha 420
if (fileName) upsertBaseFile(id, fileName)

// Linha 280
base: hasReal ? (getBaseFile(loteKey) || null) : null,
```

**DEPOIS** (funciona em qualquer ambiente):
```javascript
// POST - Incluir no payload de insert
const payload = rows.map(r => ({
  // ... outros campos
  base_filename: fileName,
}))

// GET - Buscar do banco
.select('id, lote_id, produto, banco_simulado, status, created_at, consultado, cliente, base_filename')

// Usar campo do banco
base: hasReal ? (r.base_filename || null) : null,
```

### 3. Código removido

- ❌ `import fs from 'fs'`
- ❌ `import path from 'path'`
- ❌ `storePath`, `ensureDir()`, `readStore()`, `writeStore()`
- ❌ `upsertBaseFile()`, `getBaseFile()`, `pruneStoreOlderThan()`

## Verificação

```bash
# 1. Execute SQL no Supabase
node -e "console.log(require('fs').readFileSync('scripts/sql/add_base_filename_to_lote.sql', 'utf8'))"

# 2. Build local deve passar
npm run build

# 3. Deploy no Vercel
git add .
git commit -m "fix: remove file system usage for Vercel compatibility"
git push
```

## Por que funcionava no localhost?

- **Next.js dev**: Tem acesso total ao file system local
- **Vercel**: Serverless functions rodam em containers efêmeros sem disco persistente

## Alternativas consideradas

1. **Vercel Blob Storage** - Pago, complexo para metadados simples
2. **Redis/Upstash** - Já usado para outros casos, mas desnecessário
3. **✅ PostgreSQL (Supabase)** - Ideal: único source of truth, RLS nativo, gratuito

## Impacto

- ✅ **Zero breaking changes** para usuários
- ✅ **Sem dependências externas** adicionais
- ✅ **Performance igual ou melhor** (1 query ao invés de I/O de arquivo)
- ✅ **RLS automático** protege dados por usuário

## Arquivos Modificados

- `app/api/lote/route.js` - Removidas ~50 linhas de file system
- `scripts/sql/add_base_filename_to_lote.sql` - Nova migration

## Lição Aprendida

**Never use `fs.writeFileSync()` in API routes for Next.js apps deployed to serverless platforms.**

Use:
- Database (PostgreSQL, MongoDB)
- Object storage (S3, Vercel Blob)
- Redis (Upstash)

---

**Data**: 14 de novembro de 2025  
**Ambiente**: Next.js 14 + Vercel + Supabase  
**Status**: ✅ Resolvido
