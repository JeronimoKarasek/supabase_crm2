import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { mpFetch } from '@/lib/mercadopago'
import { grantSectorsToUser, increaseUserLimit, getUserEmpresa } from '@/lib/sectors-grant'

export const dynamic = 'force-dynamic'

async function getUser(request){
  const auth = request.headers.get('authorization') || request.headers.get('Authorization')
  if(!auth || !auth.toLowerCase().startsWith('bearer ')) return null
  const token = auth.split(' ')[1]
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if(error) return null
  return data?.user || null
}

// Cria preapproval (assinatura mensal via cartão)
// Body esperado: { productKey, userQty, connectionQty }
export async function POST(request){
  const user = await getUser(request)
  if(!user) {
    console.error('[MP Subscription] Unauthorized - no user found')
    return NextResponse.json({ error: 'Unauthorized - faça login primeiro' }, { status: 401 })
  }
  
  console.info('[MP Subscription] User authenticated', { userId: user.id, email: user.email })
  
  try {
    const body = await request.json().catch(()=>({}))
    console.info('[MP Subscription] Request body', body)
    
    const productKey = body.productKey
    if(!productKey) return NextResponse.json({ error: 'productKey required' }, { status: 400 })
    const userQty = Math.max(0, parseInt(body.userQty||0))
    const connectionQty = Math.max(0, parseInt(body.connectionQty||0))

    const { data: product, error: pErr } = await supabaseAdmin.from('products').select('id,key,name,pricing,sectors,product_type,payment_method,billing_mode,webhook_url').eq('key', productKey).single()
    if(pErr || !product) {
      console.error('[MP Subscription] Product not found', { productKey, error: pErr })
      return NextResponse.json({ error: 'Produto não encontrado', details: pErr?.message }, { status: 404 })
    }
    
    console.info('[MP Subscription] Product found', { 
      key: product.key, 
      name: product.name, 
      billing_mode: product.billing_mode, 
      payment_method: product.payment_method 
    })
    
    if(product.billing_mode !== 'subscription') {
      return NextResponse.json({ 
        error: 'Produto não é assinatura', 
        productBillingMode: product.billing_mode 
      }, { status: 400 })
    }
    
    if(product.payment_method !== 'card') {
      return NextResponse.json({ 
        error: 'Método de pagamento inválido para assinatura (esperado card)', 
        productPaymentMethod: product.payment_method 
      }, { status: 400 })
    }

    const base = Number(product.pricing?.basePrice||0)
    const userPrice = Number(product.pricing?.userPrice||0)
    const connectionPrice = Number(product.pricing?.connectionPrice||0)
    const total = +(base + (userPrice * userQty) + (connectionPrice * connectionQty)).toFixed(2)
    if(total <= 0) return NextResponse.json({ error: 'Total inválido' }, { status: 400 })

    const referenceId = `sub_${productKey}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`

    // Preapproval payload (Mercado Pago assinatura)
    const preapproval = {
      reason: product.name || 'Assinatura',
      external_reference: referenceId,
      payer_email: user.email,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: total,
        currency_id: 'BRL'
      },
      back_url: (process.env.APP_BASE_URL || new URL(request.url).origin) + `/produtos/${productKey}/comprar?ok=sub`,
      status: 'pending'
    }

    console.info('[MP Subscription] Creating preapproval', { productKey, total, userQty, connectionQty, referenceId, userEmail: user.email })
    console.info('[MP Subscription] Payload', JSON.stringify(preapproval, null, 2))
    
    // API v1 do Mercado Pago para preapproval/subscription
    const res = await mpFetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Idempotency-Key': referenceId
      },
      body: JSON.stringify(preapproval)
    })
    
    const responseText = await res.text()
    console.info('[MP Subscription] Response status', res.status)
    console.info('[MP Subscription] Response text', responseText)
    
    let json = {}
    try {
      json = JSON.parse(responseText)
    } catch(e) {
      console.error('[MP Subscription] Failed to parse response as JSON', e)
      json = { raw: responseText }
    }
    console.info('[MP Subscription] Response body', JSON.stringify(json, null, 2))
    
    if(!res.ok){
      console.error('[MP Subscription] Error response', { status: res.status, body: json })
      return NextResponse.json({ 
        error: 'Falha ao criar assinatura no Mercado Pago', 
        details: json,
        message: json?.message || json?.error || 'Erro desconhecido',
        cause: json?.cause || []
      }, { status: res.status })
    }

    // Registrar assinatura local (product_subscriptions)
    const nextCharge = new Date()
    nextCharge.setMonth(nextCharge.getMonth()+1)
    await supabaseAdmin.from('product_subscriptions').insert({
      user_id: user.id,
      product_id: product.id,
      credit_price_cents: Math.round(total*100),
      status: 'active',
      next_charge_date: nextCharge.toISOString().slice(0,10),
      last_charge_status: null
    }).catch(()=>{})

    // Grant imediato de setores ao usuário
    if(Array.isArray(product.sectors) && product.sectors.length > 0){
      console.info('[MP Subscription] Granting sectors to user', { userId: user.id, sectors: product.sectors })
      const grantResult = await grantSectorsToUser(user.id, product.sectors)
      if(grantResult.success){
        console.info('[MP Subscription] ✅ Sectors granted successfully!', { sectors: grantResult.sectors })
      } else {
        console.error('[MP Subscription] ❌ Failed to grant sectors', { error: grantResult.error })
      }
    }
    
    // Aumentar user_limit se produto tipo 'usuario'
    if(product.product_type === 'usuario' && userQty > 0){
      console.info('[MP Subscription] Increasing user_limit', { userId: user.id, quantity: userQty })
      const empresaResult = await getUserEmpresa(user.id)
      if(empresaResult.success){
        const limitResult = await increaseUserLimit(empresaResult.empresaId, userQty)
        if(limitResult.success){
          console.info('[MP Subscription] ✅ User limit increased!', { newLimit: limitResult.newLimit })
        } else {
          console.error('[MP Subscription] ❌ Failed to increase user limit', { error: limitResult.error })
        }
      } else {
        console.error('[MP Subscription] ❌ Failed to get user empresa', { error: empresaResult.error })
      }
    }

    return NextResponse.json({
      subscriptionId: json.id,
      status: json.status,
      initPoint: json.init_point || json.sandbox_init_point || null,
      reason: json.reason,
      total,
      userQty,
      connectionQty
    })
  } catch(e){
    return NextResponse.json({ error: 'Invalid payload', details: e.message }, { status: 400 })
  }
}

export async function GET(){
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
