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

export default function AppChrome({ children }) {
  const pathname = usePathname()
  const isLogin = pathname === '/login'

  if (isLogin) {
    return children
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="px-2 py-1">
            <div className="text-lg font-semibold">CRM</div>
            <div className="text-xs text-muted-foreground">Supabase Viewer</div>
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
          <SignOutButton />
        </div>
        <div className="p-4">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

