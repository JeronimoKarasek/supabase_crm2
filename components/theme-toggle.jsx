"use client"

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  const isDark = theme === 'dark'
  return (
    <Button variant="outline" size="sm" onClick={() => setTheme(isDark ? 'light' : 'dark')}>
      {isDark ? 'Claro' : 'Escuro'}
    </Button>
  )
}

