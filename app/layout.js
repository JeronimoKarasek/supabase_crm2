import './globals.css'
import Link from 'next/link'
import { Database, Users, LogOut } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar'
import AppNav from '@/components/app-nav'
import AuthGuard from '@/components/auth-guard'
import AppChrome from '@/components/app-chrome'
import { ThemeProvider } from 'next-themes'
import FarolChatWidget from '@/components/farolchat-widget'

export const metadata = {
  title: 'CRM - Supabase Viewer',
  description: 'Visualize e gerencie dados e usuários',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-br">
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <AuthGuard>
            <AppChrome>
              {children}
            </AppChrome>
            <FarolChatWidget />
          </AuthGuard>
        </ThemeProvider>
      </body>
    </html>
  )
}
