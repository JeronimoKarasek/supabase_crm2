import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'


export const dynamic = 'force-dynamic'
/**
 * Add Credits API
 * 
 * Gera pagamento Pix via Mercado Pago para adicionar créditos
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

    // Busca configurações de pagamento do Mercado Pago
    let settings = null
    let productData = null
    
    try {
      const { data: settingsData } = await supabaseAdmin
        .from('global_settings')
        .select('data')
        .eq('id', 'global')
        .single()
      settings = settingsData?.data?.payments || {}
      
      console.log('⚙️ Configurações completas:', {
        settingsData: settingsData,
        payments: settings,
        hasMercadoPagoToken: !!(settings.mercadopagoAccessToken || process.env.MERCADOPAGO_ACCESS_TOKEN),
        hasEnvToken: !!process.env.MERCADOPAGO_ACCESS_TOKEN,
        hasSettingsToken: !!settings.mercadopagoAccessToken,
        tokenPreview: settings.mercadopagoAccessToken ? settings.mercadopagoAccessToken.substring(0, 20) + '...' : 'VAZIO'
      })
    } catch (e) {
      console.error('❌ Erro ao buscar configurações:', e)
      return NextResponse.json({ 
        error: 'Erro ao buscar configurações de pagamento',
        details: e.message,
        hint: 'Verifique se as configurações estão salvas em Configuração > Pagamentos'
      }, { status: 500 })
    }

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

    // Busca Access Token do Mercado Pago (com trim para remover espaços)
    let accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN || settings.mercadopagoAccessToken
    
    if (!accessToken) {
      console.error('❌ Mercado Pago Access Token não configurado!')
      return NextResponse.json({ 
        error: 'Mercado Pago não configurado',
        hint: 'Configure o Access Token em: Configuração > Pagamentos > Mercado Pago Access Token'
      }, { status: 500 })
    }
    
    // Remove espaços em branco no início e fim
    accessToken = String(accessToken).trim()
    
    console.log('🔑 Token Info:', {
      tokenLength: accessToken.length,
      tokenStart: accessToken.substring(0, 15),
      tokenEnd: accessToken.substring(accessToken.length - 10),
      hasSpaces: accessToken.includes(' '),
      hasNewlines: accessToken.includes('\n') || accessToken.includes('\r')
    })

    // Gera referenceId único
    // IMPORTANTE: Para produtos usa "product_", para créditos usa "credits_"
    const referenceId = productKey 
      ? `product_${productKey}_${user.id}_${Date.now()}`
      : `credits_${user.id}_${Date.now()}`
    
    const baseUrl = process.env.APP_BASE_URL || new URL(request.url).origin

    console.log('💳 Gerando pagamento Mercado Pago:', {
      isProductPurchase: !!productData,
      productKey: productKey,
      referenceId: referenceId,
      amount: amount,
      userId: user.id,
      userEmail: user.email
    })

      // Cria pagamento Pix direto (sem checkout redirect)
      // IMPORTANTE: O Mercado Pago exige CPF VÁLIDO (com dígito verificador correto) para gerar QR Code PIX
      const { getValidCPF } = require('@/lib/mercadopago')
      const cpfValido = getValidCPF(user.user_metadata?.document || user.user_metadata?.cpf)
      
      const itemTitle = productData ? productData.name : `Créditos FarolTech - R$ ${amount.toFixed(2)}`
      const itemDescription = productData 
        ? `Acesso ao produto ${productData.name} da plataforma FarolTech CRM`
        : `Adição de ${amount.toFixed(2)} créditos na plataforma FarolTech CRM`
      
      const payment = {
        transaction_amount: Number(amount.toFixed(2)),
        description: itemDescription,
        payment_method_id: 'pix', // Pagamento via Pix
        payer: {
          email: user.email || 'contato@faroltech.com',
          first_name: user.user_metadata?.name?.split(' ')[0] || user.email?.split('@')[0] || 'Cliente',
          last_name: user.user_metadata?.name?.split(' ').slice(1).join(' ') || 'FarolTech',
          identification: {
            type: 'CPF',
            number: cpfValido // CPF válido com dígito verificador correto
          }
        },
        // Adiciona items[] conforme solicitado pelo Mercado Pago para melhorar taxa de aprovação
        additional_info: {
          items: [
            {
              id: productKey || `credit_${Date.now()}`, // ID único do item
              title: itemTitle, // Nome do item
              description: itemDescription, // Descrição detalhada
              category_id: productData ? 'services' : 'virtual_goods', // Categoria
              quantity: 1, // Quantidade
              unit_price: Number(amount.toFixed(2)) // Preço unitário
            }
          ],
          payer: {
            first_name: user.user_metadata?.name?.split(' ')[0] || user.email?.split('@')[0] || 'Cliente',
            last_name: user.user_metadata?.name?.split(' ').slice(1).join(' ') || 'FarolTech',
            phone: {
              area_code: user.user_metadata?.phone?.substring(0, 2) || '11',
              number: user.user_metadata?.phone?.substring(2) || '999999999'
            }
          }
        },
        notification_url: `${baseUrl}/api/mercadopago/webhook`,
        external_reference: referenceId,
        statement_descriptor: 'FAROLTECH',
        metadata: {
          type: productData ? 'product_purchase' : 'credit_addition',
          user_id: user.id,
          product_key: productKey || null,
          user_email: user.email
        }
      }
      
      console.log('📋 Payment payload:', {
        ...payment,
        payer: {
          ...payment.payer,
          identification: {
            type: payment.payer.identification.type,
            number: payment.payer.identification.number.substring(0, 3) + '****' + payment.payer.identification.number.substring(9)
          }
        }
      })

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
        console.error('❌ Erro do Mercado Pago:', {
          status: mpResponse.status,
          statusText: mpResponse.statusText,
          data: mpData,
          tokenUsed: accessToken.substring(0, 20) + '...'
        })
        
        // Extrai mensagem de erro mais específica
        const errorMessage = mpData?.message || mpData?.error || 'Erro ao gerar pagamento Pix'
        const errorCause = mpData?.cause?.[0]?.description || mpData?.cause?.[0]?.code || ''
        const fullError = errorCause ? `${errorMessage}: ${errorCause}` : errorMessage
        
        return NextResponse.json(
          { 
            error: fullError,
            details: {
              mercadoPagoError: mpData,
              status: mpResponse.status,
              statusText: mpResponse.statusText
            },
            hint: mpResponse.status === 401 
              ? 'Token de acesso inválido. Verifique se o Access Token está correto e não expirou.' 
              : 'Verifique se o Access Token do Mercado Pago está configurado corretamente em Configuração > Pagamentos'
          },
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

      // Retorna dados do pagamento Mercado Pago
      const response = {
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
      
      return NextResponse.json({ ...response, data: response })
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
