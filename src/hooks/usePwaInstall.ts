'use client'
import { useEffect, useState } from 'react'

// Extend Window type for beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [canInstall, setCanInstall] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Don't show if already dismissed
    const dismissed = typeof window !== 'undefined'
      ? localStorage.getItem('pwa_install_dismissed')
      : null
    if (dismissed) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setCanInstall(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setIsInstalled(true))

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setIsInstalled(true)
    setDeferredPrompt(null)
    setCanInstall(false)
  }

  const dismiss = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pwa_install_dismissed', '1')
    }
    setCanInstall(false)
  }

  return { canInstall: canInstall && !isInstalled, handleInstall, dismiss, isInstalled }
}
