'use client'

import { useTheme } from 'next-themes'
import { useEffect } from 'react'

const COLORS = {
  light: '#ffffff',
  dark: '#171717',
}

export function ThemeColorSync() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    if (resolvedTheme !== 'light' && resolvedTheme !== 'dark') return

    for (const element of document.querySelectorAll(
      'meta[name="theme-color"]',
    )) {
      element.remove()
    }

    const meta = document.createElement('meta')
    meta.name = 'theme-color'
    meta.content = COLORS[resolvedTheme]

    document.head.appendChild(meta)

    return () => {
      meta.remove()
    }
  }, [resolvedTheme])

  return null
}
