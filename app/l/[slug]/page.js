"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ShortLinkRedirect() {
  const params = useParams()
  const router = useRouter()
  const [error, setError] = useState('')

  useEffect(() => {
    const redirect = async () => {
      const slug = params?.slug
      if (!slug) {
        setError('Link inválido')
        return
      }

      try {
        // Buscar link curto (público, sem autenticação)
        const { data, error } = await supabase
          .from('short_links')
          .select('real_url, id')
          .eq('slug', slug)
          .single()

        if (error || !data) {
          setError('Link não encontrado')
          setTimeout(() => router.push('/'), 3000)
          return
        }

        // Incrementar contador de cliques (best effort, não bloqueia)
        supabase
          .from('short_links')
          .update({ clicks: data.clicks + 1 })
          .eq('id', data.id)
          .then(() => {})
          .catch(() => {})

        // Redirecionar para URL real
        window.location.href = data.real_url
      } catch (e) {
        setError('Erro ao processar link')
        setTimeout(() => router.push('/'), 3000)
      }
    }

    redirect()
  }, [params, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        {error ? (
          <>
            <div className="text-lg text-red-600">{error}</div>
            <div className="text-sm text-muted-foreground">Redirecionando para a página inicial...</div>
          </>
        ) : (
          <>
            <div className="inline-block h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <div className="text-lg text-muted-foreground">Redirecionando...</div>
          </>
        )}
      </div>
    </div>
  )
}
