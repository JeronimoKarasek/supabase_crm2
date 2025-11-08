import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'


export const dynamic = 'force-dynamic'
/**
 * Add Credits API
 * 
 * Gera link de pagamento para adicionar créditos
 * Suporta: PicPay e Mercado Pago
 * O provedor é selecionado nas configurações globais
 */

async function getUser(request) {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!auth || !auth.toLowerCase().startsWith('bearer ')) return null
  const token = auth.split(' ')[1]
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error) return null
  return data?.user || null
}

export async function POST(request) {
  try {
    // Busca usuário autenticado
    const user = await getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Lê o body da requisição
    const body = await request.json()
    const amount = parseFloat(body.amount)
    const description = body.description || body.email || user.email
    const productKey = body.productKey // Detecta se é compra de produto

    // Valida valor
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Valor inválido' }, { status: 400 })
    }

    // Busca configurações de pagamento
    let provider = 'picpay'
    let settings = null
    let productData = null
    
    try {
      const { data: settingsData } = await supabaseAdmin
        .from('global_settings')
        .select('data')
        .eq('id', 'global')
        .single()
      settings = settingsData?.data?.payments || {}
      provider = settings.provider || 'picpay'
    } catch {}

    // Se for compra de produto, busca dados do produto
    if (productKey) {
      try {
        const { data: prod } = await supabaseAdmin
          .from('products')
          .select('id, key, name, sectors')
          .eq('key', productKey)
          .single()
        
        if (!prod) {
          return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
        }
        productData = prod
      } catch (e) {
        return NextResponse.json({ error: 'Erro ao buscar produto' }, { status: 500 })
      }
    }

    // Gera referenceId único
    // IMPORTANTE: Para produtos usa "product_", para créditos usa "credits_"
    const referenceId = productKey 
      ? `product_${productKey}_${user.id}_${Date.now()}`
      : `credits_${user.id}_${Date.now()}`
    
    const baseUrl = process.env.APP_BASE_URL || new URL(request.url).origin

    // Log para debug
    console.log('💳 Payment Request Summary:', {
      isProductPurchase: !!productData,
      productKey: productKey,
      productId: productData?.id,
      productName: productData?.name,
      referenceId: referenceId,
      amount: amount,
      provider: provider,
      userId: user.id
    })

    // Processa pagamento com o provedor selecionado
    if (provider === 'mercadopago') {
      // ============== MERCADO PAGO ==============
      let accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || settings.mercadopagoAccessToken
      
      console.log('🔍 Debug Mercado Pago:')
      console.log('- Provider:', provider)
      console.log('- Access Token exists:', !!accessToken)
      console.log('- Access Token (primeiros 20 chars):', accessToken?.substring(0, 20))
      console.log('- Settings:', JSON.stringify(settings, null, 2))
      
      if (!accessToken) {
        console.error('❌ Access Token não encontrado!')
        return NextResponse.json({ error: 'Mercado Pago access token não configurado' }, { status: 500 })
      }

      // Cria pagamento Pix direto (sem checkout redirect)
      const payment = {
        transaction_amount: Number(amount.toFixed(2)),
        description: `Créditos - ${user.email}`,
        payment_method_id: 'pix', // Pagamento via Pix
        payer: {
          email: user.email,
          first_name: user.user_metadata?.name?.split(' ')[0] || user.email.split('@')[0],
          last_name: user.user_metadata?.name?.split(' ').slice(1).join(' ') || 'Usuario',
          identification: {
            type: 'CPF',
            number: user.user_metadata?.document || '00000000000'
          }
        },
        notification_url: `${baseUrl}/api/mercadopago/webhook`,
        external_reference: referenceId,
        statement_descriptor: 'FAROLTECH CREDITOS',
        metadata: {
          type: 'credit_addition',
          user_id: user.id
        }
      }

      console.log('📤 Enviando para Mercado Pago:', JSON.stringify(payment, null, 2))

      const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'X-Idempotency-Key': referenceId
        },
        body: JSON.stringify(payment),
      })

      const mpData = await mpResponse.json()
      console.log('📥 Resposta Mercado Pago:', JSON.stringify(mpData, null, 2))

      if (!mpResponse.ok) {
        console.error('❌ Erro do Mercado Pago:', mpData)
        return NextResponse.json(
          { error: 'Erro ao gerar pagamento Pix', details: mpData },
          { status: mpResponse.status }
        )
      }

      // Se for compra de produto, cria registro em product_purchases
      if (productKey && !productData) {
        console.error('🚨 CRITICAL: productKey exists but productData is null!', {
          productKey: productKey,
          productData: productData
        })
      }
      
      if (productData) {
        console.log('📝 Creating product_purchase record (Mercado Pago)', {
          user_id: user.id,
          product_id: productData.id,
          product_key: productData.key,
          reference_id: referenceId,
          amount: amount
        })
        
        const { data: purchaseRecord, error: purchaseError } = await supabaseAdmin
          .from('product_purchases')
          .insert({
            user_id: user.id,
            product_id: productData.id,
            reference_id: referenceId,
            amount: amount,
            status: 'pending',
            payment_method: 'pix',
            provider: 'mercadopago'
          })
          .select()
          .single()
        
        if (purchaseError) {
          console.error('❌ CRITICAL: Failed to create purchase record!', {
            error: purchaseError,
            errorMessage: purchaseError.message,
            errorDetails: purchaseError
          })
          // Não retorna erro para não bloquear o pagamento, mas loga fortemente
        } else {
          console.log('✅ Purchase record created successfully:', {
            purchaseId: purchaseRecord?.id,
            referenceId: referenceId,
            userId: user.id,
            productId: productData.id
          })
        }
      }

      // Forma unificada de resposta (flatten + data)
      const flatResponse = {
        paymentId: mpData.id,
        status: mpData.status, // 'pending' para Pix
        paymentMethod: 'pix',
        qrCode: mpData.point_of_interaction?.transaction_data?.qr_code || null,
        qrCodeBase64: mpData.point_of_interaction?.transaction_data?.qr_code_base64 || null,
        ticketUrl: mpData.point_of_interaction?.transaction_data?.ticket_url || null,
        referenceId: referenceId,
        amount: amount,
        currency: 'BRL',
        description: description,
        provider: 'mercadopago',
        expirationDate: mpData.date_of_expiration || null
      }
      return NextResponse.json({ ...flatResponse, data: flatResponse })
    } else {
      // ============== PICPAY (padrão) ==============
      // Prepara payload para o PicPay
      const picpayPayload = {
        referenceId: referenceId,
        callbackUrl: `${baseUrl}/api/picpay/callback`,
        returnUrl: `${baseUrl}/dashboard`,
        value: Number(amount.toFixed(2)),
        buyer: {
          firstName: user.user_metadata?.name?.split(' ')[0] || user.email.split('@')[0],
          lastName: user.user_metadata?.name?.split(' ').slice(1).join(' ') || 'Usuário',
          document: '00000000000',
          email: user.email,
          phone: user.user_metadata?.phone || '+5500000000000',
        },
      }

      // Chama API do PicPay para criar pagamento (não precisa de token)
      const picpayResponse = await fetch('https://appws.picpay.com/ecommerce/public/payments', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(picpayPayload),
      })

      if (!picpayResponse.ok) {
        const errorData = await picpayResponse.json()
        return NextResponse.json(
          { error: 'Erro ao gerar link de pagamento', details: errorData },
          { status: picpayResponse.status }
        )
      }

      const picpayData = await picpayResponse.json()

      // Se for compra de produto, cria registro em product_purchases
      if (productKey && !productData) {
        console.error('🚨 CRITICAL: productKey exists but productData is null (PicPay)!', {
          productKey: productKey,
          productData: productData
        })
      }
      
      if (productData) {
        console.log('📝 Creating product_purchase record (PicPay)', {
          user_id: user.id,
          product_id: productData.id,
          product_key: productData.key,
          reference_id: referenceId,
          amount: amount
        })
        
        const { data: purchaseRecord, error: purchaseError } = await supabaseAdmin
          .from('product_purchases')
          .insert({
            user_id: user.id,
            product_id: productData.id,
            reference_id: referenceId,
            amount: amount,
            status: 'pending',
            payment_method: 'pix',
            provider: 'picpay'
          })
          .select()
          .single()
        
        if (purchaseError) {
          console.error('❌ CRITICAL: Failed to create purchase record (PicPay)!', {
            error: purchaseError,
            errorMessage: purchaseError.message,
            errorDetails: purchaseError
          })
        } else {
          console.log('✅ Purchase record created successfully (PicPay):', {
            purchaseId: purchaseRecord?.id,
            referenceId: referenceId,
            userId: user.id,
            productId: productData.id
          })
        }
      }

      // Retorna dados do PicPay
      const picpayQrContent = picpayData?.qrcode?.content || picpayData?.qrcode?.qrcodeContent || null
      const picpayQrBase64 = picpayData?.qrcode?.base64 || picpayData?.qrcode?.image || null
      const flatResponse = {
        paymentId: picpayData?.referenceId || referenceId,
        status: picpayData?.status || 'pending',
        paymentMethod: 'pix', // PicPay usa Pix por trás ao gerar QR
        qrCode: picpayQrContent,
        qrCodeBase64: picpayQrBase64,
        paymentUrl: picpayData.paymentUrl || null,
        referenceId: referenceId,
        amount: amount,
        currency: 'BRL',
        description: description,
        provider: 'picpay'
      }
      return NextResponse.json({ ...flatResponse, data: { ...flatResponse, raw: picpayData } })
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao processar requisição', details: error.message },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
