# API - Criar Empresa e Usuário

Endpoint para criar uma nova empresa e seu usuário administrador via chamada externa.

## Endpoint

```
POST https://crm.farolbase.com/api/companies/create
```

## Headers Obrigatórios

```
x-api-key: Msr+bd5cGkJ9KuMKokVnFdArjxxd74lpiDW5IFZiMys=
Content-Type: application/json
```

## Body (JSON)

```json
{
  "company": {
    "name": "Nome da Empresa",
    "cnpj": "12.345.678/0001-90",
    "phone": "(11) 98765-4321",
    "email": "contato@empresa.com",
    "address": "Rua Example, 123 - São Paulo/SP"
  },
  "user": {
    "email": "admin@empresa.com",
    "password": "senha123",
    "name": "João Silva",
    "phone": "(11) 91234-5678"
  }
}
```

### Campos Obrigatórios

**Company:**
- `name` (string) - Nome da empresa

**User:**
- `email` (string) - Email válido
- `password` (string) - Mínimo 6 caracteres
- `name` (string) - Nome do usuário

### Campos Opcionais

**Company:**
- `cnpj`, `phone`, `email`, `address`

**User:**
- `phone`

---

## Exemplos de Chamadas

### cURL (Bash/Linux/Mac)

```bash
curl -X POST https://crm.farolbase.com/api/companies/create \
  -H "x-api-key: Msr+bd5cGkJ9KuMKokVnFdArjxxd74lpiDW5IFZiMys=" \
  -H "Content-Type: application/json" \
  -d '{
    "company": {
      "name": "Empresa Teste LTDA",
      "cnpj": "12.345.678/0001-90",
      "phone": "(11) 98765-4321",
      "email": "contato@empresateste.com",
      "address": "Av. Paulista, 1000 - São Paulo/SP"
    },
    "user": {
      "email": "admin@empresateste.com",
      "password": "senhaSegura123",
      "name": "Maria Souza",
      "phone": "(11) 91234-5678"
    }
  }'
```

### PowerShell (Windows)

```powershell
$headers = @{
    "x-api-key" = "Msr+bd5cGkJ9KuMKokVnFdArjxxd74lpiDW5IFZiMys="
    "Content-Type" = "application/json"
}

$body = @{
    company = @{
        name = "Empresa Teste LTDA"
        cnpj = "12.345.678/0001-90"
        phone = "(11) 98765-4321"
        email = "contato@empresateste.com"
        address = "Av. Paulista, 1000 - São Paulo/SP"
    }
    user = @{
        email = "admin@empresateste.com"
        password = "senhaSegura123"
        name = "Maria Souza"
        phone = "(11) 91234-5678"
    }
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://crm.farolbase.com/api/companies/create" -Method POST -Headers $headers -Body $body
```

### JavaScript (Node.js)

```javascript
const response = await fetch('https://crm.farolbase.com/api/companies/create', {
  method: 'POST',
  headers: {
    'x-api-key': 'Msr+bd5cGkJ9KuMKokVnFdArjxxd74lpiDW5IFZiMys=',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    company: {
      name: 'Empresa Teste LTDA',
      cnpj: '12.345.678/0001-90',
      phone: '(11) 98765-4321',
      email: 'contato@empresateste.com',
      address: 'Av. Paulista, 1000 - São Paulo/SP'
    },
    user: {
      email: 'admin@empresateste.com',
      password: 'senhaSegura123',
      name: 'Maria Souza',
      phone: '(11) 91234-5678'
    }
  })
})

const data = await response.json()
console.log(data)
```

### Python

```python
import requests

url = "https://crm.farolbase.com/api/companies/create"
headers = {
    "x-api-key": "Msr+bd5cGkJ9KuMKokVnFdArjxxd74lpiDW5IFZiMys=",
    "Content-Type": "application/json"
}
payload = {
    "company": {
        "name": "Empresa Teste LTDA",
        "cnpj": "12.345.678/0001-90",
        "phone": "(11) 98765-4321",
        "email": "contato@empresateste.com",
        "address": "Av. Paulista, 1000 - São Paulo/SP"
    },
    "user": {
        "email": "admin@empresateste.com",
        "password": "senhaSegura123",
        "name": "Maria Souza",
        "phone": "(11) 91234-5678"
    }
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())
```

---

## Resposta de Sucesso (200)

```json
{
  "success": true,
  "message": "Empresa e usuário criados com sucesso",
  "company": {
    "id": 1,
    "name": "Empresa Teste LTDA",
    "cnpj": "12.345.678/0001-90",
    "phone": "(11) 98765-4321",
    "email": "contato@empresateste.com",
    "address": "Av. Paulista, 1000 - São Paulo/SP",
    "active": true,
    "created_at": "2025-11-08T10:30:00Z"
  },
  "user": {
    "id": "uuid-do-usuario",
    "email": "admin@empresateste.com",
    "name": "Maria Souza",
    "phone": "(11) 91234-5678",
    "role": "admin",
    "company_id": 1,
    "active": true,
    "created_at": "2025-11-08T10:30:00Z"
  }
}
```

## Respostas de Erro

### 401 - API Key inválida

```json
{
  "error": "API Key inválida ou não fornecida"
}
```

### 400 - Dados inválidos

```json
{
  "error": "Nome da empresa é obrigatório"
}
```

```json
{
  "error": "Email já está em uso"
}
```

```json
{
  "error": "Senha deve ter no mínimo 6 caracteres"
}
```

### 500 - Erro interno

```json
{
  "error": "Erro ao criar empresa",
  "details": "mensagem de erro detalhada"
}
```

---

## Antes de Usar

1. **Execute o SQL no Supabase:**
   ```bash
   # Arquivo: scripts/sql/companies.sql
   ```
   - Cria a tabela `companies`
   - Adiciona coluna `company_id` em `users`
   - Configura políticas de segurança (RLS)

2. **Configure a API Key no Vercel:**
   - Variável: `INTERNAL_API_KEY`
   - Valor: `Msr+bd5cGkJ9KuMKokVnFdArjxxd74lpiDW5IFZiMys=`

---

## Notas Importantes

- ✅ O email do usuário é **auto-confirmado** (não precisa verificação)
- ✅ O usuário criado terá role `admin` da empresa
- ✅ A empresa é criada como `active: true`
- ✅ Se houver erro, há **rollback automático** (empresa e usuário são deletados)
- ⚠️ Email já cadastrado retorna erro 400
- ⚠️ CNPJ duplicado **não é validado** (pode repetir)
- 🔒 API Key deve ser mantida em **segredo**

---

## Teste Rápido

```bash
# Copie e cole no terminal (substitua os dados)
curl -X POST https://crm.farolbase.com/api/companies/create \
  -H "x-api-key: Msr+bd5cGkJ9KuMKokVnFdArjxxd74lpiDW5IFZiMys=" \
  -H "Content-Type: application/json" \
  -d '{
    "company": {"name": "Teste API"},
    "user": {
      "email": "teste@example.com",
      "password": "teste123",
      "name": "Usuário Teste"
    }
  }'
```
