import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

/**
 * Webhook para atualizar status de digitação
 * Rota: POST /api/digitar/webhook/[trackingId]
 * 
 * O webhook externo deve chamar esta rota após processar a digitação,
 * enviando o link de formalização no body.
 */

export async function POST(request, { params }) {
  try {
    const trackingId = params.trackingId
    if (!trackingId) {
      return NextResponse.json({ error: 'trackingId obrigatório' }, { status: 400 })
    }

    // Busca registro existente
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('digitacao_requests')
      .select('*')
      .eq('id', trackingId)
      .single()

    if (fetchError || !existing) {
      console.error('❌ Tracking não encontrado:', trackingId, fetchError)
      return NextResponse.json({ error: 'Tracking não encontrado' }, { status: 404 })
    }

    // Parse body do webhook
    const body = await request.json().catch(() => ({}))
    
    // Extrai link de formalização (tenta várias propriedades comuns)
    const link = body.link || body.url || body.proposta_url || body.propostaLink || 
                 body.proposta || body.pdf || body.contrato || body.formalizacao_link || 
                 body.formalizacaoLink || null
    
    // Busca primeiro http em qualquer propriedade
    const findFirstUrl = (obj) => {
      if (!obj || typeof obj !== 'object') return ''
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string' && v.startsWith('http')) return v
        if (v && typeof v === 'object') {
          const r = findFirstUrl(v)
          if (r) return r
        }
      }
      return ''
    }
    
    const extractedLink = (typeof link === 'string' && link.startsWith('http')) 
      ? link 
      : findFirstUrl(body)

    const status = body.error || body.erro ? 'error' : 'completed'
    const errorMessage = body.error || body.erro || body.error_message || null

    // Atualiza registro
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('digitacao_requests')
      .update({
        status: status,
        webhook_response: body,
        formalizacao_link: extractedLink || null,
        error_message: errorMessage,
        completed_at: new Date().toISOString()
      })
      .eq('id', trackingId)
      .select()
      .single()

    if (updateError) {
      console.error('❌ Erro ao atualizar tracking:', updateError)
      return NextResponse.json({ error: 'Erro ao atualizar', details: updateError }, { status: 500 })
    }

    console.log('✅ Tracking atualizado:', {
      trackingId,
      status,
      hasLink: !!extractedLink,
      link: extractedLink?.substring(0, 50) + '...'
    })

    return NextResponse.json({ 
      ok: true, 
      trackingId,
      status,
      link: extractedLink
    })
  } catch (e) {
    console.error('❌ Erro no webhook:', e)
    return NextResponse.json({ error: 'Erro interno', details: e.message }, { status: 500 })
  }
}

// GET para verificar status
export async function GET(request, { params }) {
  try {
    const trackingId = params.trackingId
    if (!trackingId) {
      return NextResponse.json({ error: 'trackingId obrigatório' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('digitacao_requests')
      .select('id, status, formalizacao_link, error_message, created_at, completed_at')
      .eq('id', trackingId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Tracking não encontrado' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: 'Erro interno', details: e.message }, { status: 500 })
  }
}
