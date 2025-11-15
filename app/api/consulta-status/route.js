import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

async function getUserFromRequest(request) {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return null
  const token = auth.split(' ')[1]
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error) return null
  return data?.user || null
}

/**
 * POST /api/consulta-status
 * Consulta status de um cliente no webhook configurado e atualiza na Carteira
 */
export async function POST(request) {
  try {
    const { rowId } = await request.json()
    
    if (!rowId) {
      return NextResponse.json({ error: 'rowId é obrigatório' }, { status: 400 })
    }
    
    // Obter usuário autenticado
    const user = await getUserFromRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    
    // 1. Buscar configurações globais para obter webhook de consulta
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('global_settings')
      .select('data')
      .eq('id', 'global')
      .single()
    
    if (settingsError || !settings?.data?.banks) {
      console.error('[Consulta Status] Erro ao buscar configurações:', settingsError)
      return NextResponse.json({ error: 'Configurações não encontradas' }, { status: 500 })
    }
    
    // 2. Buscar registro na Carteira
    const { data: carteira, error: carteiraError } = await supabaseAdmin
      .from('Carteira')
      .select('*')
      .eq('id', rowId)
      .single()
    
    if (carteiraError || !carteira) {
      console.error('[Consulta Status] Registro não encontrado:', carteiraError)
      return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 })
    }
    
    // 3. Identificar banco do cliente pela coluna "banco simulado"
    const bankName = carteira['banco simulado'] || carteira.Banco || ''
    const bank = settings.data.banks.find(b => 
      b.name.toLowerCase() === bankName.toLowerCase()
    )
    
    if (!bank || !bank.webhookConsulta) {
      console.error('[Consulta Status] Webhook de consulta não configurado para banco:', bankName)
      return NextResponse.json({ error: 'Webhook não configurado para este banco' }, { status: 400 })
    }
    
    // 4. Buscar nome da empresa se o usuário estiver vinculado
    let empresaName = null
    try {
      if (user.user_metadata?.empresaId) {
        const { data: emp } = await supabaseAdmin
          .from('empresa')
          .select('name')
          .eq('id', user.user_metadata.empresaId)
          .single()
        empresaName = emp?.name || null
      }
    } catch {}
    
    // 5. Chamar webhook de consulta
    console.info(`[Consulta Status] Chamando webhook: ${bank.webhookConsulta}`)
    
    const webhookResponse = await fetch(bank.webhookConsulta, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': bank.authToken || ''
      },
      body: JSON.stringify({
        cpf: carteira.cpf,
        proposta: carteira.proposta,
        rowId: carteira.id,
        userName: user.user_metadata?.nome || null,
        userEmail: user.email,
        empresaName
      })
    })
    
    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text()
      console.error('[Consulta Status] Erro no webhook:', errorText)
      return NextResponse.json({ error: 'Erro ao consultar webhook' }, { status: 500 })
    }
    
    const webhookData = await webhookResponse.json()
    
    // 6. Atualizar registro na Carteira com dados recebidos
    const updatePayload = {
      status: webhookData.status || carteira.status,
      'Valor liberado': webhookData.valorLiberado || carteira['Valor liberado'],
      simulou: webhookData.simulou !== undefined ? webhookData.simulou : carteira.simulou,
      digitou: webhookData.digitou !== undefined ? webhookData.digitou : carteira.digitou,
      proposta: webhookData.proposta || carteira.proposta,
      valorContrato: webhookData.valorContrato || carteira.valorContrato,
      valorParcela: webhookData.valorParcela || carteira.valorParcela,
      prazo: webhookData.prazo || carteira.prazo,
      'data da atualização': new Date().toISOString()
    }
    
    const { error: updateError } = await supabaseAdmin
      .from('Carteira')
      .update(updatePayload)
      .eq('id', rowId)
    
    if (updateError) {
      console.error('[Consulta Status] Erro ao atualizar:', updateError)
      return NextResponse.json({ error: 'Erro ao atualizar registro' }, { status: 500 })
    }
    
    console.info('[Consulta Status] Registro atualizado com sucesso:', rowId)
    
    return NextResponse.json({
      success: true,
      message: 'Status atualizado com sucesso',
      data: updatePayload
    })
    
  } catch (error) {
    console.error('[Consulta Status] Erro:', error)
    return NextResponse.json({
      error: 'Erro ao processar consulta',
      details: error.message
    }, { status: 500 })
  }
}
