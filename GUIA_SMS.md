# 🚀 Guia Rápido - Disparo SMS

## ✅ Correções Aplicadas

1. **Erro de Select vazio** → Adicionado valor "no-credentials" e "default" para evitar strings vazias
2. **Falta de feedback** → Mensagens informativas quando não há credenciais
3. **Labels confusas** → Botão agora mostra status dinâmico do que falta
4. **Campos obrigatórios** → Marcados com * e validação visual

---

## 📝 Como Usar (Passo a Passo)

### 1️⃣ Criar as Tabelas no Supabase

1. Abra o **Supabase SQL Editor**
2. Copie o SQL da aba **Configuração** (na página Disparo SMS)
3. Execute o script completo
4. Aguarde a confirmação "Success"

### 2️⃣ Adicionar Credencial Kolmeya

1. Acesse a aba **Configuração**
2. Preencha:
   - **Label** *: Nome descritivo (ex: "Produção")
   - **API Token** *: Seu token da Kolmeya (campo oculto por segurança)
   - **SMS API ID**: (opcional) ID específico da API
   - **Webhook URL**: (opcional) URL para receber callbacks
3. Clique em **Adicionar Credencial**
4. A credencial aparecerá na tabela abaixo

**Como obter o token:**
- Acesse https://kolmeya.com.br
- Faça login na sua conta
- Vá em Configurações → API → Tokens
- Copie o token gerado

### 3️⃣ Criar uma Campanha

1. Volte para a aba **Disparo**
2. **Selecione a Credencial** (dropdown agora funciona corretamente)
3. **(Opcional)** Selecione o **Centro de Custo**
4. Verifique o **Saldo disponível** (aparece automaticamente)

### 4️⃣ Escrever a Mensagem

```
Olá {{nome}}, seu CPF {{cpf}} tem saldo de R$ {{valor}}.
```

**Variáveis disponíveis:**
- Use `{{campo}}` para qualquer coluna do CSV
- O sistema mostra as variáveis disponíveis automaticamente após carregar o CSV
- Limite: 160 caracteres (contador aparece em tempo real)

### 5️⃣ Carregar o CSV

**Formato esperado:**
```csv
telefone,nome,cpf,valor
11987654321,João Silva,123.456.789-00,150.00
11912345678,Maria Santos,987.654.321-00,250.50
```

**Colunas aceitas para telefone:**
- `telefone`, `phone`, `celular`, `whatsapp`, `numero`, `fone`

**Outras colunas:**
- Qualquer nome de coluna pode ser usado como variável
- Exemplos: `nome`, `cpf`, `valor`, `data`, `codigo`, etc.

### 6️⃣ Visualizar Preview

Após carregar o CSV:
- Tabela mostra as primeiras 5 linhas
- Preview da mensagem personalizada aparece abaixo (com variáveis substituídas)

### 7️⃣ Importar Campanha

1. Clique em **Importar Campanha**
2. Aguarde a confirmação: "Importação concluída. N registros. Batch: xxx"
3. A campanha aparece na lista **Campanhas Importadas**

### 8️⃣ Enviar SMS

1. Na lista de campanhas, localize seu batch
2. Veja as contagens:
   - **T**: Total de registros
   - **Q**: Na fila (queued)
   - **S**: Enviados (sent)
   - **F**: Falhas (failed)
   - **B**: Blacklist
   - **N**: Não Perturbe
3. Clique em **Enviar**
4. Acompanhe o resultado:
   - "Válidos: X" → SMS enviados com sucesso
   - "Inválidos: X" → Números inválidos
   - "Blacklist: X" → Números bloqueados
   - "Não Perturbe: X" → Números com opt-out

---

## 🎯 Status dos SMS

| Status | Descrição | O que fazer |
|--------|-----------|-------------|
| `queued` | Na fila | Clique em "Enviar" |
| `sent` | Enviado | Aguarde entrega |
| `delivered` | Entregue | ✅ Sucesso |
| `failed` | Falhou | Clique em "Reenviar falhas" |
| `blacklist` | Bloqueado | Remova da base |
| `not_disturb` | Opt-out | Remova da base |

---

## ⚠️ Mensagens de Erro Comuns

### "⚠️ Tabelas não criadas!"
**Solução:** Execute o SQL na aba Configuração

### "Selecione credencial"
**Solução:** Adicione uma credencial na aba Configuração

### "Escreva a mensagem"
**Solução:** Preencha o campo de mensagem SMS

### "Carregue o CSV"
**Solução:** Faça upload de um arquivo CSV válido

### "Nenhuma credencial cadastrada"
**Solução:** Você ainda não possui credenciais. Acesse a aba Configuração.

---

## 📊 Dicas de Uso

### CSV Otimizado
✅ Use delimitadores: `;`, `,`, `\t` (detecta automaticamente)
✅ Primeira linha deve ser o cabeçalho
✅ Coluna de telefone obrigatória (aceita vários nomes)
✅ Telefones com ou sem DDD/DDI (sistema normaliza)

### Mensagem Efetiva
✅ Máximo 160 caracteres (1 SMS)
✅ Use variáveis para personalizar
✅ Teste com 1-2 números primeiro
✅ Evite caracteres especiais excessivos

### Performance
✅ Sistema envia até 1000 SMS por lote
✅ Campanhas grandes são divididas automaticamente
✅ Reenvio de falhas com limite de 3 tentativas
✅ Saldo atualizado após cada envio

---

## 🔗 Links Úteis

- **Documentação Kolmeya:** https://kolmeya.com.br/docs/api
- **Painel Kolmeya:** https://kolmeya.com.br/dashboard
- **Suporte:** Entre em contato com Kolmeya para questões da API

---

## ✅ Checklist de Setup

- [ ] SQL executado no Supabase ✓
- [ ] Credencial Kolmeya adicionada ✓
- [ ] Saldo verificado ✓
- [ ] CSV preparado com colunas corretas ✓
- [ ] Mensagem configurada com variáveis ✓
- [ ] Preview verificado ✓
- [ ] Primeira campanha importada ✓
- [ ] SMS enviados e status validado ✓

---

**Pronto! O sistema está 100% funcional e corrigido.** 🚀
