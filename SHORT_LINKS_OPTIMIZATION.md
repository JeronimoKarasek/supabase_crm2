# Links Curtos - Otimização para SMS

**Data**: 10 de novembro de 2025  
**Status**: ✅ Implementado

---

## 📊 Economia de Caracteres

### Antes (wa.me direto):
```
https://wa.me/5519999887766?text=Ol%C3%A1%2C+gostaria+de+saber+mais
```
**Total**: ~70 caracteres

### Depois (link curto):
```
https://farolbase.com/l/aBc12
```
**Total**: ~30 caracteres

**💰 Economia**: ~40 caracteres por link = **~0.25 SMS economizado por mensagem!**

---

## 🔧 Mudanças Implementadas

### 1. Slug Reduzido
- ❌ Antes: 8 caracteres (`aBcDeFgH`)
- ✅ Agora: **5 caracteres** (`aBc12`)
- **Economia**: 3 caracteres por link

### 2. Domínio Configurável
```javascript
// app/api/short-link/route.js
const baseUrl = process.env.NEXT_PUBLIC_SHORT_URL || 'https://farolbase.com'
```

**Variável de ambiente**: `NEXT_PUBLIC_SHORT_URL`

### 3. Redirecionamento Corrigido
**Problemas corrigidos:**
- ✅ Busca `clicks` do banco para incrementar corretamente
- ✅ Logs detalhados para debug
- ✅ Tratamento de erro melhorado
- ✅ Redirecionamento funcional para `wa.me`

---

## 🚀 Como Funciona

### Fluxo Completo:

1. **Usuário cria link no SMS:**
   - Informa número: `19999887766`
   - Mensagem personalizada: "Gostaria de saber mais"
   - Sistema adiciona DDI 55 automaticamente se necessário

2. **API cria link curto:**
   ```javascript
   POST /api/short-link
   {
     realUrl: "https://wa.me/5519999887766?text=Gostaria%20de%20saber%20mais",
     phone: "5519999887766",
     message: "Gostaria de saber mais"
   }
   ```

3. **Resposta:**
   ```json
   {
     "ok": true,
     "shortUrl": "https://farolbase.com/l/aBc12",
     "slug": "aBc12",
     "realUrl": "https://wa.me/..."
   }
   ```

4. **Link inserido na mensagem:**
   ```
   Olá {{nome}}, temos uma oferta especial!
   https://farolbase.com/l/aBc12
   ```

5. **Cliente clica no link:**
   - Acessa: `https://farolbase.com/l/aBc12`
   - Sistema incrementa contador de cliques
   - Redireciona para: `https://wa.me/5519999887766?text=...`
   - WhatsApp abre automaticamente com mensagem pré-preenchida

---

## 📋 Configuração (Opcional)

### Para usar domínio mais curto:

1. **Registrar domínio curto** (exemplos):
   - `fb.com.br` (Farol Base)
   - `farol.co`
   - `fl.com.br`

2. **Configurar DNS:**
   ```
   Tipo: CNAME
   Nome: @
   Valor: seu-projeto.vercel.app
   ```

3. **Adicionar no Vercel:**
   - Settings → Domains → Add Domain
   - Adicionar `fb.com.br`

4. **Atualizar .env.local:**
   ```bash
   NEXT_PUBLIC_SHORT_URL=https://fb.com.br
   ```

5. **Resultado:**
   ```
   https://fb.com.br/l/aBc12  (25 caracteres!)
   ```

---

## 🔍 Debug e Monitoramento

### Logs no Console (F12):

```javascript
[Redirect] Link encontrado: {
  slug: "aBc12",
  realUrl: "https://wa.me/5519999887766?text=...",
  clicks: 5
}
[Redirect] Clicks incrementado: 6
[Redirect] Redirecionando para: https://wa.me/...
```

### Verificar clicks no banco:

```sql
SELECT slug, real_url, clicks, created_at 
FROM short_links 
ORDER BY clicks DESC 
LIMIT 10;
```

---

## 📊 Tabela `short_links`

```sql
CREATE TABLE short_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(10) UNIQUE NOT NULL,        -- 5 caracteres
  real_url TEXT NOT NULL,                   -- wa.me URL completo
  phone VARCHAR(20),                        -- 5519999887766
  message TEXT,                             -- "Gostaria de saber mais"
  user_id UUID REFERENCES auth.users(id),
  clicks INTEGER DEFAULT 0,                 -- Contador de cliques
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_short_links_slug ON short_links(slug);
CREATE INDEX idx_short_links_user ON short_links(user_id);
```

---

## ✅ Checklist de Teste

- [x] Link curto criado com 5 caracteres
- [x] Link inserido corretamente na mensagem
- [x] Redirecionamento funcional para WhatsApp
- [x] Contador de cliques incrementando
- [x] Logs detalhados no console
- [x] Fallback para link direto em caso de erro
- [x] DDI 55 adicionado automaticamente

---

## 🎯 Próximos Passos (Opcional)

### 1. Analytics Avançado
- Dashboard de cliques por campanha
- Taxa de conversão (cliques vs envios)
- Horários de pico

### 2. QR Code
- Gerar QR code do link curto
- Usar em materiais impressos

### 3. Domínio Ainda Mais Curto
- Usar `.co` ou `.io` (2 caracteres a menos)
- Exemplo: `fl.io/aBc12` (15 caracteres!)

---

**Última atualização**: 10 de novembro de 2025
