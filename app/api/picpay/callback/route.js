import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

async function grantSectorsToUser(userId, sectors){
  try {
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId)
    const meta = u?.user?.user_metadata || {}
    const current = Array.isArray(meta.sectors) ? meta.sectors : []
    const merged = Array.from(new Set([ ...current, ...(sectors || []) ]))
    await supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: { ...meta, sectors: merged } })
  } catch {}
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const ref = body?.referenceId || body?.reference || null
    const status = (body?.status || '').toLowerCase()
    if (!ref) return NextResponse.json({ ok: true })

    // find purchase
    const { data: purchase } = await supabaseAdmin.from('product_purchases').select('id,user_id,product_id,status').eq('reference_id', ref).single()
    if (purchase) {
      await supabaseAdmin.from('product_purchases').update({ status }).eq('id', purchase.id)
      if (status === 'paid') {
        const { data: prod } = await supabaseAdmin.from('products').select('sectors, webhook_url, name, key').eq('id', purchase.product_id).single()
        if (prod) {
          await grantSectorsToUser(purchase.user_id, prod.sectors)
          if (prod.webhook_url) {
            try {
              await fetch(prod.webhook_url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'purchase_paid', referenceId: ref, product: prod, purchaseId: purchase.id }) })
              await supabaseAdmin.from('product_purchases').update({ webhook_status: 'sent_ok' }).eq('id', purchase.id)
            } catch {
              await supabaseAdmin.from('product_purchases').update({ webhook_status: 'sent_error' }).eq('id', purchase.id)
            }
          }
        }
      }
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: true })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true })
}
