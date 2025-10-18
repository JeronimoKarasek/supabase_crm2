"use client"

import { usePathname } from 'next/navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar'
import AppNav from '@/components/app-nav'
import SignOutButton from '@/components/signout-button'
import ThemeToggle from '@/components/theme-toggle'
import { useEffect, useState } from 'react'

export default function AppChrome({ children }) {
  const pathname = usePathname()
  const isLogin = pathname === '/login'
  const [branding, setBranding] = useState({ siteName: 'FarolTech', siteSubtitle: 'Iluminando seu caminho', logoUrl: '' })

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/global-settings')
        const json = await res.json()
        if (res.ok) setBranding({
          siteName: json?.settings?.siteName || 'FarolTech',
          siteSubtitle: json?.settings?.siteSubtitle || 'Iluminando seu caminho',
          logoUrl: json?.settings?.logoUrl || '',
        })
      } catch {}
    })()
  }, [])

  if (isLogin) {
    return children
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="px-2 py-1 flex items-center gap-2">
            {branding.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logoUrl} alt="logo" className="h-6 w-6 object-contain" />
            ) : null}
            <div>
              <div className="text-lg font-semibold">{branding.siteName}</div>
              <div className="text-xs text-muted-foreground">{branding.siteSubtitle}</div>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <AppNav />
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="flex items-center justify-between gap-2 p-2 border-b bg-background">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <span className="text-sm text-muted-foreground">Menu</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
        <div className="p-4">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
