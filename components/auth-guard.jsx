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
        const { data: udata } = await supabase.auth.getUser()
        const user = udata?.user
        const role = user?.user_metadata?.role || 'viewer'
        const sectors = (Array.isArray(user?.user_metadata?.sectors) && user.user_metadata.sectors.length > 0)
          ? user.user_metadata.sectors
          : ['Clientes', 'Usuários', 'Dashboard', 'Configuração']

        const norm = (s) => {
          try { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() } catch { return String(s || '').toLowerCase() }
        }
        const hasSector = (name) => sectors.some(s => norm(s) === norm(name))

        const pickDefaultRoute = () => {
          if (role === 'admin' || hasSector('Dashboard')) return '/dashboard'
          if (hasSector('Clientes')) return '/'
          if (hasSector('Usuarios') || hasSector('Usuários')) return '/usuarios'
          if (hasSector('Configuracao') || hasSector('Configuração')) return '/configuracao'
          return '/login'
        }

        if (pathname === '/login') {
          const target = pickDefaultRoute()
          if (target !== '/login') router.replace(target)
        } else if (pathname.startsWith('/usuarios')) {
          if (!(role === 'admin' || hasSector('Usuarios') || hasSector('Usuários'))) {
            router.replace(pickDefaultRoute())
          }
        } else if (pathname === '/' || pathname.startsWith('/clientes')) {
          if (!(role === 'admin' || hasSector('Clientes'))) {
            router.replace(pickDefaultRoute())
          }
        } else if (pathname.startsWith('/dashboard')) {
          if (!(role === 'admin' || hasSector('Dashboard'))) {
            router.replace(pickDefaultRoute())
          }
        } else if (pathname.startsWith('/configuracao')) {
          if (!(role === 'admin' || hasSector('Configuracao') || hasSector('Configuração'))) {
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
        const sectors = (Array.isArray(user?.user_metadata?.sectors) && user.user_metadata.sectors.length > 0)
          ? user.user_metadata.sectors
          : ['Clientes', 'Usuários', 'Dashboard', 'Configuração']
        const norm = (s) => {
          try { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() } catch { return String(s || '').toLowerCase() }
        }
        const hasSector = (name) => sectors.some(s => norm(s) === norm(name))
        const pickDefaultRoute = () => {
          if (role === 'admin' || hasSector('Dashboard')) return '/dashboard'
          if (hasSector('Clientes')) return '/'
          if (hasSector('Usuarios') || hasSector('Usuários')) return '/usuarios'
          if (hasSector('Configuracao') || hasSector('Configuração')) return '/configuracao'
          return '/login'
        }
        if (pathname === '/login') {
          const target = pickDefaultRoute()
          if (target !== '/login') router.replace(target)
        } else if (pathname.startsWith('/usuarios')) {
          if (!(role === 'admin' || hasSector('Usuarios') || hasSector('Usuários'))) {
            router.replace(pickDefaultRoute())
          }
        } else if (pathname === '/' || pathname.startsWith('/clientes')) {
          if (!(role === 'admin' || hasSector('Clientes'))) {
            router.replace(pickDefaultRoute())
          }
        } else if (pathname.startsWith('/dashboard')) {
          if (!(role === 'admin' || hasSector('Dashboard'))) {
            router.replace(pickDefaultRoute())
          }
        } else if (pathname.startsWith('/configuracao')) {
          if (!(role === 'admin' || hasSector('Configuracao') || hasSector('Configuração'))) {
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
