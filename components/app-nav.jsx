"use client"

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Database, Users, Gauge, Settings, FileSearch, ShoppingBag, FileDigit, Send, PackagePlus, MessageSquare, Sparkles, Lock, FileSpreadsheet, Calculator } from 'lucide-react'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { supabase } from '@/lib/supabase'
import { sectors as allSectors } from '@/lib/sectors'

// Ícone WhatsApp customizado (usando SVG inline)
const WhatsAppIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

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
      color: '#3b82f6', // blue-500
      isActive: pathname?.startsWith('/dashboard') ?? false,
    },
    can('Clientes') && {
      href: '/clientes',
      label: 'Clientes',
      icon: Database,
      color: '#8b5cf6', // violet-500
      isActive: pathname === '/clientes' || pathname?.startsWith('/clientes'),
    },
    (role === 'admin' || can('Senha de banco')) && {
      href: '/acesso-banco',
      label: 'Senha de banco',
      icon: Lock,
      color: '#f59e0b', // amber-500
      isActive: pathname?.startsWith('/acesso-banco') ?? false,
    },
    (role === 'admin' || can('Consulta em lote')) && {
      href: '/consulta-lote',
      label: 'Consulta em lote',
      icon: FileSpreadsheet,
      color: '#10b981', // emerald-500
      isActive: pathname?.startsWith('/consulta-lote') ?? false,
    },
    (role === 'admin' || can('Simular/Digitar')) && {
      href: '/simular-digitar',
      label: 'Simular/Digitar',
      icon: Calculator,
      color: '#ec4899', // pink-500
      isActive: pathname?.startsWith('/simular-digitar') ?? false,
    },
    (role === 'admin' || can('Disparo Whats API')) && {
      href: '/disparo-api',
      label: 'Disparo Whats API',
      icon: WhatsAppIcon,
      color: '#25D366', // WhatsApp green
      isActive: pathname?.startsWith('/disparo-api') ?? false,
    },
    (role === 'admin' || can('Disparo SMS')) && {
      href: '/disparo-sms',
      label: 'Disparo SMS',
      icon: MessageSquare,
      color: '#14b8a6', // teal-500
      isActive: pathname?.startsWith('/disparo-sms') ?? false,
    },
    (role === 'admin' || can('Higienizar Dados')) && {
      href: '/higienizar-dados',
      label: 'Higienizar Dados',
      icon: Sparkles,
      color: '#a855f7', // purple-500
      isActive: pathname?.startsWith('/higienizar-dados') ?? false,
    },
    // NOVIDADES disponível para todos usuários logados
    {
      href: '/produtos',
      label: 'NOVIDADES',
      icon: ShoppingBag,
      color: '#c97b1a', // laranja customizado
      isActive: pathname?.startsWith('/produtos') ?? false,
    },
    (role === 'admin' || can('Criação de produtos')) && {
      href: '/criacao-produtos',
      label: 'Criação de produtos',
      icon: PackagePlus,
      color: '#6366f1', // indigo-500
      isActive: pathname?.startsWith('/criacao-produtos') ?? false,
    },
    can('Usuários') && {
      href: '/usuarios',
      label: 'Usuários',
      icon: Users,
      color: '#06b6d4', // cyan-500
      isActive: pathname?.startsWith('/usuarios') ?? false,
    },
    (role === 'admin' || can('Configuração')) && {
      href: '/configuracao',
      label: 'Configuração',
      icon: Settings,
      color: '#64748b', // slate-500
      isActive: pathname?.startsWith('/configuracao') ?? false,
    },
  ].filter(Boolean)

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const IconComponent = item.icon
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={item.isActive}>
                  <Link href={item.href} className="group">
                    <IconComponent 
                      className="h-5 w-5 transition-all" 
                      style={{ color: item.color }}
                    />
                    <span 
                      className="font-medium"
                      style={{ 
                        color: item.label === 'NOVIDADES' ? item.color : undefined 
                      }}
                    >
                      {item.label}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
