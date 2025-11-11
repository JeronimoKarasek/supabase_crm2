# Melhorias no Sistema de SMS

## 📱 Resumo das Implementações

### 1. ✅ Links Curtos Personalizados (farolbase.com/{slug})

**Problema anterior:** Links longos do WhatsApp (wa.me/...) ocupavam muito espaço no SMS

**Solução implementada:**
- Sistema de links curtos com domínio personalizado: `farolbase.com/l/{slug}`
- Slugs únicos de 8 caracteres gerados automaticamente
- Rastreamento de cliques
- Suporte a DDI 55 automático (se número não tiver, adiciona)

**Como usar:**
1. Na tela de SMS, preencha:
   - **Número WhatsApp**: Ex: `11999887766` (DDI 55 será adicionado automaticamente)
   - **Mensagem do link WhatsApp**: Ex: `Quero saber mais sobre essa oferta`
2. Clique em "Inserir link WhatsApp"
3. O sistema criará automaticamente um link curto como: `farolbase.com/l/aB3dE9fG`

**Arquivos criados:**
- `scripts/sql/short_links.sql` - Tabela e políticas RLS
- `app/api/short-link/route.js` - API para criar e listar links
- `app/l/[slug]/page.js` - Página de redirecionamento

### 2. ✅ Confirmação de Envio com Cálculo de Custos

**Problema anterior:** SMS eram enviados sem confirmação, usuário não sabia quanto seria debitado

**Solução implementada:**
- Dialog de confirmação antes do envio
- Mostra:
  - Quantidade de números válidos
  - Custo por SMS (R$)
  - **Total a ser debitado** (em destaque)
  - Aviso que créditos serão debitados automaticamente
- Botões:
  - ❌ **Cancelar** - Cancela o envio
  - ✅ **Confirmar e Enviar** - Processa o envio

**Fluxo:**
1. Usuário clica em "Enviar"
2. Sistema calcula custos e mostra popup
3. Usuário confirma ou cancela
4. Se confirmado, envia e debita créditos

### 3. ✅ Cobrança de Créditos Funcionando

**Status:** Sistema JÁ estava funcionando corretamente!

O código em `app/api/disparo-sms/send/route.js` já implementava:
- Verificação de saldo suficiente antes do envio (linha 101-113)
- Cobrança apenas de mensagens válidas (linha 233-240)
- Retorno de informações de créditos na resposta

**O que foi melhorado:**
- Adicionada mensagem clara na UI mostrando créditos debitados
- Popup de confirmação mostrando custo total antes do envio

### 4. ⚠️ Observação sobre Botão Cancelar

O botão cancelar está disponível no Dialog de confirmação. Para cancelar envios em andamento (agendados), o sistema já possui a função `cancelarAgendamento()` que pode ser ativada quando necessário.

## 🔧 Configuração Necessária

### 1. Executar SQL no Supabase

Execute o arquivo `scripts/sql/short_links.sql` no **SQL Editor** do Supabase Dashboard para criar a tabela de links curtos.

### 2. Configurar URL Base

No arquivo `.env.local`, certifique-se de ter:

```bash
NEXT_PUBLIC_BASE_URL=https://crm.farolbase.com
```

Isso garante que os links curtos usem o domínio correto.

## 📊 Como Funciona o Sistema de Créditos

### Fluxo Completo:

1. **Antes do Envio:**
   - Sistema conta quantos SMS válidos serão enviados
   - Calcula: `total = quantidade × custo_por_sms`
   - Verifica se há saldo suficiente

2. **Popup de Confirmação:**
   - Mostra quantidade de números válidos
   - Mostra custo total
   - Usuário confirma ou cancela

3. **Durante o Envio:**
   - Envia para API Kolmeya
   - Kolmeya retorna: válidos, inválidos, blacklist, não perturbe

4. **Após Envio:**
   - **Cobra apenas SMS válidos** (enviados com sucesso)
   - Atualiza status de cada mensagem
   - Mostra mensagem de sucesso com valor debitado

### Exemplo:

```
Importados: 100 números
Válidos: 95
Inválidos: 3
Blacklist: 1
Não perturbe: 1

Custo por SMS: R$ 0,10
Total debitado: R$ 9,50 (95 válidos × R$ 0,10)
```

## 🎯 Melhorias Futuras Sugeridas

1. **Dashboard de Links:** Tela para visualizar todos os links criados, clicks, etc.
2. **Expiração de Links:** Opção para definir data de validade
3. **QR Code:** Gerar QR Code para cada link curto
4. **Analytics:** Gráficos de cliques por link, horário, etc.

## 🐛 Troubleshooting

### Links curtos não funcionam

1. Verifique se executou o SQL: `scripts/sql/short_links.sql`
2. Verifique `NEXT_PUBLIC_BASE_URL` no .env.local
3. Teste manualmente: `farolbase.com/l/testeslug`

### Créditos não sendo debitados

1. Verifique se `smsMessageValue` está configurado em `global_settings`
2. Verifique se a empresa/usuário tem `credits` > 0
3. Olhe os logs da API: `/api/disparo-sms/send`

### Popup de confirmação não aparece

1. Verifique se a tabela `sms_disparo` existe
2. Verifique se há mensagens com status `queued` no batch
