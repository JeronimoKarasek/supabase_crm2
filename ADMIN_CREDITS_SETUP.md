# Como Liberar a Função de Adicionar Créditos (Admin)

## Problema
Ao tentar adicionar créditos manualmente na página de Usuários, você vê a mensagem "Unauthorized".

## Solução

### Passo 1: Vá para Configuração
1. Acesse o menu lateral e clique em **Configuração**
2. Role até o final da página

### Passo 2: Configure os E-mails dos Administradores
1. Você verá um novo card chamado **"Administradores do Sistema"**
2. No campo **"E-mails dos Administradores"**, adicione seu e-mail (o mesmo que você usa para fazer login)
   - Exemplo: `pmorijo@gmail.com`
   - Para múltiplos admins: `pmorijo@gmail.com, outro@dominio.com`
3. Clique em **"Salvar administradores"**

### Passo 3: Teste Novamente
1. Volte para a página **Usuários**
2. Role até o card **"Adicionar Créditos para Usuário (Admin)"**
3. Agora você conseguirá adicionar créditos normalmente

## Como Funciona
- O sistema verifica se o seu e-mail está na lista de `adminEmails` antes de permitir adicionar créditos manualmente
- Somente usuários com e-mails cadastrados nessa lista podem usar esta função
- Isso garante que apenas administradores autorizados possam manipular os créditos dos usuários

## Observação
- Após salvar os e-mails, a configuração é persistida no banco de dados (global_settings)
- Você não precisa reiniciar o servidor
- A verificação acontece a cada requisição
