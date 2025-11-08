"use client"

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Database, Users, Gauge, Settings, FileSearch, ShoppingBag, FileDigit, Send, PackagePlus, MessageSquare } from 'lucide-react'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { supabase } from '@/lib/supabase'
import { sectors as allSectors } from '@/lib/sectors'

function normalizeLabel(s) {
  try { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() } catch { return String(s || '').toLowerCase() }
}

export default function AppNav() {
  const pathname = usePathname()
  const [user, setUser] = useState(null)

  useEffect(() => {
    let mounted = true
    const run = async () => {
      const { data } = await supabase.auth.getUser()
      if (mounted) setUser(data?.user || null)
    }
    run()
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const role = user?.user_metadata?.role || 'viewer'
  const userSectors = Array.isArray(user?.user_metadata?.sectors) ? user.user_metadata.sectors : []
  const can = (sector) => {
    if (role === 'admin') return true
    const target = normalizeLabel(sector)
    return userSectors.some(s => normalizeLabel(s) === target)
  }

  const items = [
    (role === 'admin' || can('Dashboard')) && {
      href: '/dashboard',
      label: 'Dashboard',
      icon: Gauge,
      isActive: pathname?.startsWith('/dashboard') ?? false,
    },
    can('Clientes') && {
      href: '/clientes',
      label: 'Clientes',
      icon: Database,
      isActive: pathname === '/clientes' || pathname?.startsWith('/clientes'),
    },
    (role === 'admin' || can('Configuração')) && {
      href: '/configuracao',
      label: 'Configuração',
      icon: Settings,
      isActive: pathname?.startsWith('/configuracao') ?? false,
    },
    can('Usuários') && {
      href: '/usuarios',
      label: 'Usuários',
      icon: Users,
      isActive: pathname?.startsWith('/usuarios') ?? false,
    },
    (role === 'admin' || can('Acesso Banco')) && {
      href: '/acesso-banco',
      label: 'Acesso Banco',
      icon: Settings,
      isActive: pathname?.startsWith('/acesso-banco') ?? false,
    },
    (role === 'admin' || can('Consulta em lote')) && {
      href: '/consulta-lote',
      label: 'Consulta em lote',
      icon: FileSearch,
      isActive: pathname?.startsWith('/consulta-lote') ?? false,
    },
    (role === 'admin' || can('Simular/Digitar')) && {
      href: '/simular-digitar',
      label: 'Simular/Digitar',
      icon: FileDigit,
      isActive: pathname?.startsWith('/simular-digitar') ?? false,
    },
    (role === 'admin' || can('Disparo API')) && {
      href: '/disparo-api',
      label: 'Disparo API',
      icon: Send,
      isActive: pathname?.startsWith('/disparo-api') ?? false,
    },
    (role === 'admin' || can('Disparo SMS')) && {
      href: '/disparo-sms',
      label: 'Disparo SMS',
      icon: MessageSquare,
      isActive: pathname?.startsWith('/disparo-sms') ?? false,
    },
    // Produtos disponível para todos usuários logados
    {
      href: '/produtos',
      label: 'Produtos',
      icon: ShoppingBag,
      isActive: pathname?.startsWith('/produtos') ?? false,
    },
    (role === 'admin' || can('Criação de produtos')) && {
      href: '/criacao-produtos',
      label: 'Criação de produtos',
      icon: PackagePlus,
      isActive: pathname?.startsWith('/criacao-produtos') ?? false,
    },
  ].filter(Boolean)

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton asChild isActive={item.isActive}>
                <Link href={item.href}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
