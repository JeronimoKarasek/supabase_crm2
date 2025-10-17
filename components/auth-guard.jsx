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
    const norm = (s) => {
      try { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() } catch { return String(s || '').toLowerCase() }
    }
    const hasSector = (sectors, name) => (Array.isArray(sectors) ? sectors : []).some(s => norm(s) === norm(name))

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
          : ['Clientes', 'Usuários', 'Dashboard', 'Configuração', 'Acesso Banco', 'Consulta em lote']

        const pickDefaultRoute = () => {
          if (role === 'admin' || hasSector(sectors, 'Dashboard')) return '/dashboard'
          if (hasSector(sectors, 'Clientes')) return '/clientes'
          if (hasSector(sectors, 'Usuários') || hasSector(sectors, 'Usuarios')) return '/usuarios'
          if (hasSector(sectors, 'Configuração') || hasSector(sectors, 'Configuracao')) return '/configuracao'
          if (hasSector(sectors, 'Acesso Banco')) return '/acesso-banco'
          if (hasSector(sectors, 'Consulta em lote')) return '/consulta-lote'
          return '/login'
        }

        if (pathname === '/login') {
          const target = pickDefaultRoute()
          if (target !== '/login') router.replace(target)
        } else if (pathname.startsWith('/usuarios')) {
          if (!(role === 'admin' || hasSector(sectors, 'Usuários') || hasSector(sectors, 'Usuarios'))) router.replace(pickDefaultRoute())
        } else if (pathname === '/' || pathname.startsWith('/clientes')) {
          if (!(role === 'admin' || hasSector(sectors, 'Clientes'))) router.replace(pickDefaultRoute())
        } else if (pathname.startsWith('/dashboard')) {
          if (!(role === 'admin' || hasSector(sectors, 'Dashboard'))) router.replace(pickDefaultRoute())
        } else if (pathname.startsWith('/configuracao')) {
          if (!(role === 'admin' || hasSector(sectors, 'Configuração') || hasSector(sectors, 'Configuracao'))) router.replace(pickDefaultRoute())
        } else if (pathname.startsWith('/acesso-banco')) {
          if (!(role === 'admin' || hasSector(sectors, 'Acesso Banco'))) router.replace(pickDefaultRoute())
        } else if (pathname.startsWith('/consulta-lote')) {
          if (!(role === 'admin' || hasSector(sectors, 'Consulta em lote'))) router.replace(pickDefaultRoute())
        } else if (pathname.startsWith('/simular-digitar')) {
          if (!(role === 'admin' || hasSector(sectors, 'Simular/Digitar'))) router.replace(pickDefaultRoute())
        } else if (pathname.startsWith('/produtos')) {
          // Produtos acessível a qualquer usuário logado
          // nenhuma restrição adicional
        }
      }
      if (mounted) setChecked(true)
    }
    run()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const hasSession = !!session
      const norm = (s) => {
        try { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() } catch { return String(s || '').toLowerCase() }
      }
      const hasSector = (sectors, name) => (Array.isArray(sectors) ? sectors : []).some(s => norm(s) === norm(name))
      if (!hasSession && pathname !== '/login') {
        router.replace('/login')
        return
      }
      if (hasSession) {
        const user = session.user
        const role = user?.user_metadata?.role || 'viewer'
        const sectors = (Array.isArray(user?.user_metadata?.sectors) && user.user_metadata.sectors.length > 0)
          ? user.user_metadata.sectors
          : ['Clientes', 'Usuários', 'Dashboard', 'Configuração', 'Acesso Banco', 'Consulta em lote']
        const pickDefaultRoute = () => {
          if (role === 'admin' || hasSector(sectors, 'Dashboard')) return '/dashboard'
          if (hasSector(sectors, 'Clientes')) return '/clientes'
          if (hasSector(sectors, 'Usuários') || hasSector(sectors, 'Usuarios')) return '/usuarios'
          if (hasSector(sectors, 'Configuração') || hasSector(sectors, 'Configuracao')) return '/configuracao'
          if (hasSector(sectors, 'Acesso Banco')) return '/acesso-banco'
          if (hasSector(sectors, 'Consulta em lote')) return '/consulta-lote'
          return '/login'
        }
        if (pathname === '/login') {
          const target = pickDefaultRoute()
          if (target !== '/login') router.replace(target)
        } else if (pathname.startsWith('/usuarios')) {
          if (!(role === 'admin' || hasSector(sectors, 'Usuários') || hasSector(sectors, 'Usuarios'))) router.replace(pickDefaultRoute())
        } else if (pathname === '/' || pathname.startsWith('/clientes')) {
          if (!(role === 'admin' || hasSector(sectors, 'Clientes'))) router.replace(pickDefaultRoute())
        } else if (pathname.startsWith('/dashboard')) {
          if (!(role === 'admin' || hasSector(sectors, 'Dashboard'))) router.replace(pickDefaultRoute())
        } else if (pathname.startsWith('/configuracao')) {
          if (!(role === 'admin' || hasSector(sectors, 'Configuração') || hasSector(sectors, 'Configuracao'))) router.replace(pickDefaultRoute())
        } else if (pathname.startsWith('/acesso-banco')) {
          if (!(role === 'admin' || hasSector(sectors, 'Acesso Banco'))) router.replace(pickDefaultRoute())
        } else if (pathname.startsWith('/consulta-lote')) {
          if (!(role === 'admin' || hasSector(sectors, 'Consulta em lote'))) router.replace(pickDefaultRoute())
        } else if (pathname.startsWith('/simular-digitar')) {
          if (!(role === 'admin' || hasSector(sectors, 'Simular/Digitar'))) router.replace(pickDefaultRoute())
        } else if (pathname.startsWith('/produtos')) {
          // Produtos acessível a qualquer usuário logado
        }
      }
    })
    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [pathname, router])

  if (!checked) return null
  return children
}
