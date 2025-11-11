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
      console.log('[Redirect] Iniciando redirecionamento para slug:', slug)
      
      if (!slug) {
        setError('Link inválido')
        return
      }

      try {
        // Buscar link curto (público, sem autenticação)
        console.log('[Redirect] Buscando link no banco...')
        const { data, error } = await supabase
          .from('short_links')
          .select('real_url, id, clicks')
          .eq('slug', slug)
          .single()

        console.log('[Redirect] Resultado da busca:', { data, error })

        if (error || !data) {
          console.error('[Redirect] Link não encontrado:', error)
          setError('Link não encontrado')
          setTimeout(() => router.push('/'), 3000)
          return
        }

        console.log('[Redirect] Link encontrado:', { slug, realUrl: data.real_url, clicks: data.clicks })

        // Incrementar contador de cliques
        const newClickCount = (data.clicks || 0) + 1
        const { error: updateError } = await supabase
          .from('short_links')
          .update({ clicks: newClickCount })
          .eq('id', data.id)

        if (updateError) {
          console.error('[Redirect] Erro ao incrementar clicks:', updateError)
        } else {
          console.log('[Redirect] Clicks incrementado:', newClickCount)
        }

        // Redirecionar para URL real (WhatsApp)
        console.log('[Redirect] Redirecionando para:', data.real_url)
        window.location.href = data.real_url
      } catch (e) {
        console.error('[Redirect] Exception:', e)
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
