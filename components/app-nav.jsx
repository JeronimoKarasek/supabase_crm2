"use client"

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Database, Users } from 'lucide-react'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { supabase } from '@/lib/supabase'
import { sectors as allSectors } from '@/lib/sectors'

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
  const can = (sector) => role === 'admin' || userSectors.includes(sector)

  const items = [
    can('Clientes') && {
      href: '/',
      label: 'Clientes',
      icon: Database,
      isActive: pathname === '/',
    },
    can('Usuários') && {
      href: '/usuarios',
      label: 'Usuários',
      icon: Users,
      isActive: pathname?.startsWith('/usuarios') ?? false,
    },
  ].filter(Boolean)

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Seções</SidebarGroupLabel>
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
