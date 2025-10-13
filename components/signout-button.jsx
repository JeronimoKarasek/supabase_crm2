"use client"

import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SignOutButton() {
  const router = useRouter()
  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }
  return (
    <Button variant="outline" size="sm" onClick={handleSignOut}>
      <LogOut className="h-4 w-4 mr-2" />
      Sair
    </Button>
  )
}

