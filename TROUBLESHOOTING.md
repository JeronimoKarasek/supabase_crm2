# 🛠️ Solução de Problemas - Schema Cache do Supabase

## Problema: "Could not find the 'description' column of 'products' in the schema cache"

Este erro ocorre quando o **PostgREST** (API do Supabase) não atualizou seu cache após alterações no schema do banco de dados.

---

## ✅ Soluções

### Solução 1: Recarregar Schema via SQL (RECOMENDADO)

1. Acesse o **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Execute o comando:

```sql
NOTIFY pgrst, 'reload schema';
```

4. Aguarde 5 segundos
5. Tente criar o produto novamente

---

### Solução 2: Executar Script Completo

1. Acesse o **Supabase Dashboard** → **SQL Editor**
2. Execute o arquivo `scripts/sql/fix_products_schema.sql`:

```sql
-- Verifica e adiciona coluna se necessário
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'description'
    ) THEN
        ALTER TABLE products ADD COLUMN description text;
    END IF;
END $$;

-- Força reload do schema
NOTIFY pgrst, 'reload schema';

-- Lista colunas para verificação
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'products'
ORDER BY ordinal_position;
```

---

### Solução 3: Recriar Tabela (Última Opção)

⚠️ **ATENÇÃO**: Isso apagará todos os produtos existentes!

1. Acesse **SQL Editor** no Supabase
2. Execute o arquivo `scripts/sql/products.sql` completo
3. Isso recriará a tabela com o schema correto

---

## 🔍 Verificação

Para confirmar que o schema está correto, execute:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products'
ORDER BY ordinal_position;
```

Você deve ver estas colunas:
- id (uuid)
- key (text)
- name (text)
- **description (text)** ← Esta é a que estava causando o erro
- learn_more_url (text)
- webhook_url (text)
- sectors (ARRAY)
- pricing (jsonb)
- active (boolean)
- created_at (timestamp)
- updated_at (timestamp)

---

## 🚀 Após a Correção

O código já foi atualizado para especificar as colunas explicitamente ao invés de usar `SELECT *`, o que previne problemas futuros de cache:

```javascript
// ANTES (problemático)
.select('*')

// DEPOIS (robusto)
.select('id,key,name,description,learn_more_url,webhook_url,sectors,pricing,created_at,updated_at')
```

---

## 💡 Por Que Isso Acontece?

O PostgREST mantém um **cache do schema** para performance. Quando você:
1. Cria/altera tabelas via migrations
2. Adiciona/remove colunas
3. Muda tipos de dados

O cache pode ficar desatualizado. O comando `NOTIFY pgrst, 'reload schema'` força a atualização imediata.

---

## 🔗 Referências

- [PostgREST Schema Cache](https://postgrest.org/en/stable/schema_cache.html)
- [Supabase Database Functions](https://supabase.com/docs/guides/database/functions)
