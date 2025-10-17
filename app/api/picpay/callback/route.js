import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    // PicPay envia {referenceId, authorizationId, status, ...}
    const _body = await request.json().catch(() => ({}))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true })
}

