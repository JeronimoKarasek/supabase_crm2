# Teste Rápido da API - Exemplos cURL e PowerShell

## 🔑 Sua INTERNAL_API_KEY
```
Msr+bd5cGkJ9KuMKokVnFdArjxxd74lpiDW5IFZiMys=
```

---

## Exemplo 1: Consultar Créditos

### cURL (Linux/Mac/Git Bash):
```bash
curl -X GET "https://crm.farolbase.com/api/credits?email=seuemail@exemplo.com" \
  -H "x-api-key: Msr+bd5cGkJ9KuMKokVnFdArjxxd74lpiDW5IFZiMys="
```

### PowerShell (Windows):
```powershell
$headers = @{ "x-api-key" = "Msr+bd5cGkJ9KuMKokVnFdArjxxd74lpiDW5IFZiMys=" }
Invoke-RestMethod -Uri "https://crm.farolbase.com/api/credits?email=seuemail@exemplo.com" -Headers $headers
```

---

## Exemplo 2: Adicionar R$ 100,00 de Crédito

### cURL:
```bash
curl -X POST "https://crm.farolbase.com/api/credits/add" \
  -H "x-api-key: Msr+bd5cGkJ9KuMKokVnFdArjxxd74lpiDW5IFZiMys=" \
  -H "Content-Type: application/json" \
  -d '{"email":"seuemail@exemplo.com","amountBRL":100.00}'
```

### PowerShell:
```powershell
$headers = @{
    "x-api-key" = "Msr+bd5cGkJ9KuMKokVnFdArjxxd74lpiDW5IFZiMys="
    "Content-Type" = "application/json"
}
$body = '{"email":"seuemail@exemplo.com","amountBRL":100.00}'
Invoke-RestMethod -Uri "https://crm.farolbase.com/api/credits/add" -Method POST -Headers $headers -Body $body
```

---

## Exemplo 3: Cobrar R$ 25,00

### cURL:
```bash
curl -X POST "https://crm.farolbase.com/api/credits/charge" \
  -H "x-api-key: Msr+bd5cGkJ9KuMKokVnFdArjxxd74lpiDW5IFZiMys=" \
  -H "Content-Type: application/json" \
  -d '{"email":"seuemail@exemplo.com","amountBRL":25.00}'
```

### PowerShell:
```powershell
$body = '{"email":"seuemail@exemplo.com","amountBRL":25.00}'
Invoke-RestMethod -Uri "https://crm.farolbase.com/api/credits/charge" -Method POST -Headers $headers -Body $body
```

---

## Exemplo 4: Ver Assinaturas Pendentes

### cURL:
```bash
curl -X GET "https://crm.farolbase.com/api/subscriptions/charge-monthly" \
  -H "x-api-key: Msr+bd5cGkJ9KuMKokVnFdArjxxd74lpiDW5IFZiMys="
```

### PowerShell:
```powershell
Invoke-RestMethod -Uri "https://crm.farolbase.com/api/subscriptions/charge-monthly" -Headers $headers
```

---

## Exemplo 5: Executar Cobranças Mensais

### cURL:
```bash
curl -X POST "https://crm.farolbase.com/api/subscriptions/charge-monthly" \
  -H "x-api-key: Msr+bd5cGkJ9KuMKokVnFdArjxxd74lpiDW5IFZiMys="
```

### PowerShell:
```powershell
Invoke-RestMethod -Uri "https://crm.farolbase.com/api/subscriptions/charge-monthly" -Method POST -Headers $headers
```

---

## 🧪 Script de Teste Interativo

Execute o script completo:
```powershell
.\test-api.ps1
```

---

## ⚠️ IMPORTANTE

1. **Reinicie o servidor** para carregar o novo `.env.local`:
   ```bash
   npm run dev
   ```

2. **Teste localmente** antes de produção:
   - Substitua `https://crm.farolbase.com` por `http://localhost:3000`

3. **Nunca compartilhe** esta chave publicamente!

---

## 📋 Checklist de Configuração

- [x] `.env.local` criado com INTERNAL_API_KEY
- [ ] Servidor reiniciado
- [ ] Testado endpoint /api/credits
- [ ] Testado endpoint /api/credits/add
- [ ] Testado endpoint /api/subscriptions/charge-monthly
- [ ] Documentação lida (API_USAGE_GUIDE.md)

---

## 🔗 Links Úteis

- Documentação completa: `API_USAGE_GUIDE.md`
- Variáveis de ambiente: `.env.local`
- Template: `.env.local.example`
