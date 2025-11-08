import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

/**
 * Webhook da Kolmeya para receber status de mensagens SMS
 * Documentação: https://kolmeya.com.br/docs/api
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    console.log('📱 [SMS Webhook] Received:', JSON.stringify(body, null, 2))

    // Validar estrutura do webhook
    if (!body || typeof body !== 'object') {
      console.error('❌ [SMS Webhook] Invalid body')
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    // Extrair dados do webhook
    const {
      id,               // ID da mensagem
      status,           // Status: delivered, failed, sent, etc
      phone,            // Número de telefone
      message,          // Mensagem enviada
      segment_id,       // Centro de custo
      created_at,       // Data de criação
      updated_at,       // Data de atualização
      error_code,       // Código de erro (se houver)
      error_message     // Mensagem de erro (se houver)
    } = body

    console.log('📱 [SMS Webhook] Parsed data:', {
      id,
      status,
      phone,
      segment_id,
      has_error: !!error_code
    })

    // Salvar evento no banco de dados
    const { error: insertError } = await supabaseAdmin
      .from('sms_webhook_events')
      .insert({
        event_id: id,
        status,
        phone,
        message,
        segment_id,
        created_at,
        updated_at,
        error_code,
        error_message,
        raw_data: body
      })

    if (insertError) {
      console.error('❌ [SMS Webhook] Database insert error:', insertError)
      // Não retornar erro para não fazer a Kolmeya reenviar
    } else {
      console.log('✅ [SMS Webhook] Event saved to database')
    }

    // Sempre retornar 200 OK para a Kolmeya
    return NextResponse.json({ success: true, received: true })
  } catch (e) {
    console.error('❌ [SMS Webhook] Exception:', e)
    // Retornar 200 mesmo em erro para evitar reenvios
    return NextResponse.json({ success: false, error: e.message })
  }
}

// Também aceitar GET para verificação
export async function GET(request) {
  return NextResponse.json({ 
    status: 'active',
    webhook: 'SMS Kolmeya Webhook',
    endpoint: '/api/disparo-sms/webhook',
    timestamp: new Date().toISOString()
  })
}
