import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

/**
 * Debug endpoint - Mostra as configurações salvas (apenas para admin)
 */
export async function GET(request) {
  try {
    // Busca configurações
    const { data: settingsData, error } = await supabaseAdmin
      .from('global_settings')
      .select('data')
      .eq('id', 'global')
      .single()
    
    if (error) {
      return NextResponse.json({ 
        error: 'Erro ao buscar configurações', 
        details: error.message 
      }, { status: 500 })
    }

    const payments = settingsData?.data?.payments || {}
    
    return NextResponse.json({
      success: true,
      payments: {
        provider: payments.provider,
        hasPicpayToken: !!payments.picpaySellerToken,
        hasMercadopagoToken: !!payments.mercadopagoAccessToken,
        mercadopagoTokenLength: payments.mercadopagoAccessToken?.length || 0,
        mercadopagoTokenStart: payments.mercadopagoAccessToken?.substring(0, 20) || 'VAZIO',
        mercadopagoTokenEnd: payments.mercadopagoAccessToken ? payments.mercadopagoAccessToken.substring(payments.mercadopagoAccessToken.length - 10) : 'VAZIO',
        hasSpaces: payments.mercadopagoAccessToken?.includes(' ') || false,
        hasNewlines: payments.mercadopagoAccessToken?.includes('\n') || payments.mercadopagoAccessToken?.includes('\r') || false,
        rawToken: payments.mercadopagoAccessToken // REMOVER ISSO EM PRODUÇÃO
      },
      fullData: settingsData?.data
    })
  } catch (e) {
    return NextResponse.json({ 
      error: 'Erro no debug', 
      details: e.message 
    }, { status: 500 })
  }
}
