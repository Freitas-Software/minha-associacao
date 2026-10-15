'use client'

import { type ReactNode, useEffect, useRef } from 'react'

export function FooterReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element || !('IntersectionObserver' in window)) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let observer: IntersectionObserver | undefined
    const configure = () => {
      observer?.disconnect()
      element.dataset.revealed = 'true'
      if (motion.matches) return
      // Keep server-rendered content available without JavaScript.
      if (element.getBoundingClientRect().top >= window.innerHeight) {
        element.dataset.revealed = 'false'
      }
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            element.dataset.revealed = 'true'
            observer?.disconnect()
          }
        },
        { threshold: 0, rootMargin: '0px 0px -24px 0px' },
      )
      observer.observe(element)
    }
    configure()
    motion.addEventListener('change', configure)
    return () => {
      observer?.disconnect()
      motion.removeEventListener('change', configure)
    }
  }, [])

  return (
    <div
      ref={ref}
      className="translate-y-0 opacity-100 transition-[opacity,transform] duration-700 ease-out data-[revealed=false]:translate-y-6 data-[revealed=false]:opacity-0 focus-within:translate-y-0 focus-within:opacity-100 motion-reduce:transform-none motion-reduce:opacity-100 motion-reduce:transition-none"
    >
      {children}
    </div>
  )
}
