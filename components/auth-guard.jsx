"use client"

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthGuard({ children }) {
  const router = useRouter()
  const pathname = usePathname()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let mounted = true
    const run = async () => {
      const { data } = await supabase.auth.getSession()
      const hasSession = !!data?.session
      if (!hasSession && pathname !== '/login') {
        router.replace('/login')
      }
      if (hasSession) {
        // Sector guard: restrict by user_metadata.sectors unless admin
        const { data: udata } = await supabase.auth.getUser()
        const user = udata?.user
        const role = user?.user_metadata?.role || 'viewer'
        const sectors = Array.isArray(user?.user_metadata?.sectors) && user.user_metadata.sectors.length > 0 ? user.user_metadata.sectors : ['Clientes', 'Usuários']

        const pickDefaultRoute = () => {
          if (role === 'admin' || sectors.includes('Clientes')) return '/'
          if (sectors.includes('Usuários')) return '/usuarios'
          return '/login'
        }

        if (pathname === '/login') {
          const target = pickDefaultRoute()
          if (target !== '/login') router.replace(target)
        } else if (pathname.startsWith('/usuarios')) {
          if (!(role === 'admin' || sectors.includes('Usuários'))) {
            router.replace(pickDefaultRoute())
          }
        } else if (pathname === '/' || pathname.startsWith('/clientes')) {
          if (!(role === 'admin' || sectors.includes('Clientes'))) {
            router.replace(pickDefaultRoute())
          }
        }
      }
      if (mounted) setChecked(true)
    }
    run()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const hasSession = !!session
      if (!hasSession && pathname !== '/login') {
        router.replace('/login')
        return
      }
      if (hasSession) {
        const user = session.user
        const role = user?.user_metadata?.role || 'viewer'
        const sectors = Array.isArray(user?.user_metadata?.sectors) && user.user_metadata.sectors.length > 0 ? user.user_metadata.sectors : ['Clientes', 'Usuários']
        const pickDefaultRoute = () => {
          if (role === 'admin' || sectors.includes('Clientes')) return '/'
          if (sectors.includes('Usuários')) return '/usuarios'
          return '/login'
        }
        if (pathname === '/login') {
          const target = pickDefaultRoute()
          if (target !== '/login') router.replace(target)
        } else if (pathname.startsWith('/usuarios')) {
          if (!(role === 'admin' || sectors.includes('Usuários'))) {
            router.replace(pickDefaultRoute())
          }
        } else if (pathname === '/' || pathname.startsWith('/clientes')) {
          if (!(role === 'admin' || sectors.includes('Clientes'))) {
            router.replace(pickDefaultRoute())
          }
        }
      }
    })
    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [pathname, router])

  if (!checked) return null
  return children
}
