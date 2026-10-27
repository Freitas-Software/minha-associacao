'use client'

import Lenis from 'lenis'
import Snap from 'lenis/snap'
import { useEffect } from 'react'
import 'lenis/dist/lenis.css'

export function LandingSmoothScroll() {
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let lenis: Lenis | undefined
    let snap: Snap | undefined
    let removeSnaps: (() => void) | undefined

    const start = () => {
      if (reducedMotion.matches) return

      lenis = new Lenis({
        autoRaf: true,
        anchors: true,
      })
      // Proximity keeps tall sections readable while still snapping when a
      // gesture ends near a section boundary.
      snap = new Snap(lenis, { type: 'proximity' })

      const sections = document.querySelectorAll<HTMLElement>(
        '#conteudo main > section',
      )
      const removers = [snap.add(0)]

      // The hero starts below the header, so the first snap is the page top.
      for (const section of Array.from(sections).slice(1)) {
        removers.push(snap.addElement(section))
      }

      removeSnaps = () => {
        for (const remove of removers) remove()
      }
    }

    const stop = () => {
      removeSnaps?.()
      removeSnaps = undefined
      snap?.destroy()
      snap = undefined
      lenis?.destroy()
      lenis = undefined
    }

    const handlePreferenceChange = () => {
      stop()
      start()
    }

    start()
    reducedMotion.addEventListener('change', handlePreferenceChange)

    return () => {
      reducedMotion.removeEventListener('change', handlePreferenceChange)
      stop()
    }
  }, [])

  return null
}
