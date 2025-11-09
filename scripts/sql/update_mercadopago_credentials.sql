-- Script SQL para salvar credenciais do Mercado Pago direto no Supabase
-- Execute este SQL no SQL Editor do Supabase Dashboard

-- 1. Verificar se registro existe
SELECT id, data FROM global_settings WHERE id = 'global';

-- 2. Se NÃO existir, criar:
INSERT INTO global_settings (id, data)
VALUES (
  'global',
  '{
    "payments": {
      "provider": "mercadopago",
      "mercadopagoAccessToken": "APP_USR-6832397982878428-110522-8212ccd1ba3e1dc85d31fe48a1cdb1ae-834403024",
      "mercadopagoPublicKey": "APP_USR-60cda7b7-9cb9-4c89-985f-f13741831fc7",
      "picpaySellerToken": "",
      "picpayClientId": "",
      "picpayClientSecret": "",
      "creditsWebhook": "",
      "addCreditsWebhook": ""
    }
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- 3. Se JÁ existir, atualizar apenas payments:
UPDATE global_settings
SET data = jsonb_set(
  COALESCE(data, '{}'::jsonb),
  '{payments}',
  '{
    "provider": "mercadopago",
    "mercadopagoAccessToken": "APP_USR-6832397982878428-110522-8212ccd1ba3e1dc85d31fe48a1cdb1ae-834403024",
    "mercadopagoPublicKey": "APP_USR-60cda7b7-9cb9-4c89-985f-f13741831fc7",
    "picpaySellerToken": "",
    "picpayClientId": "",
    "picpayClientSecret": "",
    "creditsWebhook": "",
    "addCreditsWebhook": ""
  }'::jsonb,
  true
)
WHERE id = 'global';

-- 4. Verificar se salvou
SELECT 
  id,
  data->'payments'->>'provider' as provider,
  data->'payments'->>'mercadopagoAccessToken' as access_token,
  data->'payments'->>'mercadopagoPublicKey' as public_key
FROM global_settings 
WHERE id = 'global';
