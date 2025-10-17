"use client"

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function ProdutosPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto py-8 px-4">
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-3xl">FarolChat</CardTitle>
                <CardDescription>CRM de conversação de whatsapp</CardDescription>
              </div>
              <div className="flex gap-2">
                <Link href="/produtos/farolchat">
                  <Button variant="outline">SABER MAIS</Button>
                </Link>
                <Link href="/produtos/farolchat/assinar">
                  <Button className="bg-emerald-600 hover:bg-emerald-700">ASSINAR</Button>
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Conheça nossa plataforma de conversação omnichannel otimizada para WhatsApp.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

