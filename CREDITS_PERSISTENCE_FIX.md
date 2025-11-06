# Solução: Créditos Sumindo Após Reload

## Problema Identificado
Os créditos estavam sendo armazenados apenas em **memória RAM** (Map JavaScript), que é resetada a cada:
- Reinício do servidor
- Reload da página (em alguns casos)
- Deploy/atualização do código

## Solução Implementada

### 1. Detecção Automática de Fallback
- O sistema agora detecta quando Redis não está configurado
- Automaticamente usa **Supabase** como persistência de backup
- Logs mostram qual modo está ativo

### 2. Tabela de Persistência no Supabase
Criamos a tabela `user_credits` para guardar os saldos permanentemente.

**Como criar a tabela:**
1. Acesse o Supabase Dashboard: https://supabase.com/dashboard
2. Vá em **SQL Editor**
3. Cole e execute o SQL do arquivo: `scripts/sql/user_credits.sql`

Ou execute direto:
```sql
CREATE TABLE IF NOT EXISTS user_credits (
  user_id TEXT PRIMARY KEY,
  balance_cents BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_credits_updated_at ON user_credits(updated_at DESC);
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own balance"
  ON user_credits FOR SELECT
  USING (auth.uid()::text = user_id);
```

### 3. Validação de Saldo Negativo
Agora o sistema **não permite** cobrar créditos se o saldo for insuficiente:
- Endpoint `/api/credits/charge` valida antes de descontar
- Retorna erro 402 (Payment Required) se saldo insuficiente
- Mensagem: "Saldo insuficiente"

## Como Verificar se Está Funcionando

### 1. Veja os logs do servidor
Ao iniciar, deve aparecer:
```
[Redis] Modo ativo: memory
[Redis] ⚠️ ATENÇÃO: Usando fallback em memória - dados serão perdidos ao reiniciar!
[Credits] Redis em memória detectado - usando Supabase como persistência
```

### 2. Teste o fluxo completo
1. Adicione créditos para um usuário
2. Verifique o saldo
3. **Reinicie o servidor** (Ctrl+C e `npm run dev` novamente)
4. Verifique o saldo novamente → deve estar lá!

### 3. Verifique no banco
No Supabase SQL Editor:
```sql
SELECT * FROM user_credits;
```

## Configuração Opcional: Redis Real (Recomendado para Produção)

Para melhor performance, configure um Redis real:

### Opção 1: Upstash (Gratuito, Serverless)
1. Crie conta em https://upstash.com
2. Crie um Redis database
3. Copie as credenciais REST
4. Adicione ao `.env`:
```env
UPSTASH_REDIS_REST_URL=https://sua-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=seu-token-aqui
```

### Opção 2: Redis Clássico
```env
REDIS_URL=redis://:senha@host:6379
# ou
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=sua-senha
```

## Status Atual

✅ **Persistência garantida** - Usa Supabase como backup
✅ **Saldo negativo bloqueado** - Não permite usar produtos sem saldo
✅ **Logs detalhados** - Mostra qual sistema está sendo usado
✅ **Migração automática** - Não precisa alterar código existente

## Testes de Validação

### Teste 1: Saldo Insuficiente
```bash
# Via API (substitua valores)
curl.exe -X POST "http://localhost:3000/api/credits/charge" ^
  -H "Content-Type: application/json" ^
  -H "x-api-key: <SUA_API_KEY>" ^
  -d "{\"userId\":\"<USER_ID>\",\"amount\":\"999999\"}"
```

Deve retornar:
```json
{
  "error": "Saldo insuficiente",
  "balanceCents": 1000,
  "balanceBRL": "R$ 10,00"
}
```

### Teste 2: Persistência
1. Adicione R$ 50 para um usuário
2. Pare o servidor (Ctrl+C)
3. Inicie novamente (`npm run dev`)
4. Consulte o saldo → deve estar R$ 50

## Próximos Passos

- [ ] Execute o SQL para criar a tabela `user_credits`
- [ ] Reinicie o servidor e verifique os logs
- [ ] Teste adicionar créditos
- [ ] Teste reload/restart
- [ ] (Opcional) Configure Upstash para melhor performance
