// Helper para integração com Mercado Pago
// Responsabilidades:
//  - Obter access token (env > global_settings)
//  - Fallback para gerar novo token via client_credentials quando receber 401 invalid access token
//  - Mascara logs para não vazar credenciais
//  - Padronizar referenceId para fluxos de créditos (prefixo credits_)

import { supabaseAdmin } from '@/lib/supabase-admin'

function maskToken(token) {
  if (!token) return 'TOKEN_EMPTY'
  if (token.length <= 14) return token
  return token.slice(0, 8) + '...' + token.slice(-4)
}

// Lê global_settings uma única vez por chamada
async function getGlobalSettings() {
  try {
    const { data } = await supabaseAdmin
      .from('global_settings')
      .select('data')
      .eq('id', 'global')
      .single()
    return data?.data || {}
  } catch {
    return {}
  }
}

export async function getMercadoPagoAccessToken() {
  // 1. ENV direto
  if (process.env.MERCADOPAGO_ACCESS_TOKEN) {
    return { token: String(process.env.MERCADOPAGO_ACCESS_TOKEN).trim(), source: 'env' }
  }
  // 2. Buscar em global_settings.data.payments.mercadopagoAccessToken
  const settings = await getGlobalSettings()
  const token = (settings?.payments?.mercadopagoAccessToken || '').trim()
  return { token, source: 'settings' }
}

export async function maybeRefreshAccessToken(previousToken) {
  // Só tenta refresh se existir clientId/secret (env)
  const clientId = process.env.MERCADOPAGO_CLIENT_ID
  const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return { token: previousToken, refreshed: false, reason: 'missing_client_credentials' }
  }
  try {
    const body = new URLSearchParams()
    body.set('grant_type', 'client_credentials')
    body.set('client_id', clientId)
    body.set('client_secret', clientSecret)
    const res = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.access_token) {
      console.error('[MercadoPago] Falha ao gerar novo access token', json)
      return { token: previousToken, refreshed: false, reason: 'request_failed', details: json }
    }
    console.info('[MercadoPago] Access token atualizado via client_credentials', { previous: maskToken(previousToken), next: maskToken(json.access_token) })
    return { token: json.access_token, refreshed: true }
  } catch (e) {
    console.error('[MercadoPago] Erro exception ao renovar token', e)
    return { token: previousToken, refreshed: false, reason: 'exception', details: e?.message }
  }
}

export function ensureCreditsReference(referenceId, isCredits) {
  if (!isCredits) return referenceId
  // Se já possui prefixo credits_ mantém
  if (referenceId.startsWith('credits_')) return referenceId
  return `credits_${referenceId}`.replace(/[^a-zA-Z0-9_\-]/g, '_')
}

export async function mpFetch(url, options = {}, retryOnInvalidToken = true) {
  // Adiciona Authorization caso não esteja presente
  const { token } = await getMercadoPagoAccessToken()
  const headers = {
    ...(options.headers || {}),
    Authorization: options.headers?.Authorization || `Bearer ${token}`,
  }
  const res = await fetch(url, { ...options, headers })
  if (res.status === 401 && retryOnInvalidToken) {
    const txt = await res.text().catch(() => '')
    if (/invalid access token/i.test(txt)) {
      const refreshed = await maybeRefreshAccessToken(token)
      if (refreshed.refreshed) {
        const headers2 = { ...(options.headers || {}), Authorization: `Bearer ${refreshed.token}` }
        return fetch(url, { ...options, headers: headers2 })
      }
    }
  }
  return res
}
