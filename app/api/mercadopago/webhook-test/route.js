import { NextResponse } from 'next/server'

/**
 * Endpoint de teste para verificar se o webhook está acessível
 * 
 * GET /api/mercadopago/webhook-test
 * - Retorna status OK e timestamp
 * - Mercado Pago usa GET para validar URLs
 * 
 * POST /api/mercadopago/webhook-test
 * - Simula recebimento de notificação
 * - Loga payload recebido
 */

// CRÍTICO: Força modo dinâmico (não cachear esta rota)
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request) {
  const timestamp = new Date().toISOString()
  const allHeaders = Object.fromEntries(request.headers.entries())
  
  console.log('[MP Webhook Test] ========== GET RECEBIDO ==========')
  console.log('[MP Webhook Test] Timestamp:', timestamp)
  console.log('[MP Webhook Test] URL:', request.url)
  console.log('[MP Webhook Test] Headers:', JSON.stringify(allHeaders, null, 2))
  console.log('[MP Webhook Test] =====================================================')
  
  return NextResponse.json({ 
    ok: true, 
    message: 'Webhook endpoint está acessível!',
    timestamp,
    method: 'GET',
    url: request.url,
    headers: allHeaders,
    note: 'Este endpoint é público e não requer autenticação'
  }, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    }
  })
}

export async function POST(request) {
  const timestamp = new Date().toISOString()
  console.log('[MP Webhook Test] ========== POST RECEBIDO ==========')
  console.log('[MP Webhook Test] Timestamp:', timestamp)
  
  try {
    const body = await request.json().catch(() => ({}))
    console.log('[MP Webhook Test] Body:', JSON.stringify(body, null, 2))
    console.log('[MP Webhook Test] Headers:', Object.fromEntries(request.headers.entries()))
    
    return NextResponse.json({ 
      ok: true, 
      message: 'Notificação recebida com sucesso!',
      timestamp,
      method: 'POST',
      receivedBody: body,
      receivedHeaders: Object.fromEntries(request.headers.entries())
    })
  } catch (e) {
    console.error('[MP Webhook Test] Erro ao processar:', e)
    return NextResponse.json({ 
      ok: false, 
      error: e.message,
      timestamp 
    }, { status: 500 })
  }
}
