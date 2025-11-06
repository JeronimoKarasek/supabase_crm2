"use client"

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function ProdutosPage() {
  const [products, setProducts] = useState([])
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/products/public')
        const json = await res.json()
        if (res.ok) setProducts(json.products || [])
      } catch {}
    })()
  }, [])

  return (
    <div className="-m-4 min-h-[calc(100vh-56px)] bg-background">
      <div className="container mx-auto py-6 px-6 space-y-4">
        {products.map((p) => (
          <Card key={p.id} className="shadow-sm bg-muted/30">
            <CardHeader className="bg-muted/50 rounded-t-xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl text-black dark:text-white">{p.name}</CardTitle>
                  <CardDescription className="text-black/70 dark:text-white/70">{p.description || '-'}</CardDescription>
                </div>
                <div className="flex gap-2">
                  {p.learn_more_url ? (
                    <Button variant="outline" asChild>
                      <a href={p.learn_more_url} target="_blank" rel="noopener">SABER MAIS</a>
                    </Button>
                  ) : null}
                  {p.key === 'farolchat' ? (
                    <Link href="/produtos/farolchat/assinar">
                      <Button className="bg-emerald-600 hover:bg-emerald-700">ASSINAR</Button>
                    </Link>
                  ) : (
                    <Link href={`/produtos/${p.key}/comprar`}>
                      <Button className="bg-emerald-600 hover:bg-emerald-700">ADQUIRIR</Button>
                    </Link>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="bg-muted/20 rounded-b-xl">
              <div className="text-xs text-muted-foreground">Secoes liberadas: {(p.sectors || []).join(', ') || '-'}</div>
            </CardContent>
          </Card>
        ))}
        {products.length === 0 && (
          <div className="text-sm text-muted-foreground">Nenhum produto disponivel.</div>
        )}
      </div>
    </div>
  )
}

