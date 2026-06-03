'use client'
import { usePwaInstall } from '@/hooks/usePwaInstall'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

export function PwaInstallBanner() {
  const { canInstall, handleInstall, dismiss } = usePwaInstall()

  if (!canInstall) return null

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-[#1e3a5f] text-white rounded-xl p-4 shadow-2xl z-50 flex items-center justify-between gap-4 border border-white/20">
      <div>
        <p className="font-semibold text-sm">📱 Install PolicyVault</p>
        <p className="text-xs text-blue-200 mt-0.5">Add to home screen for quick access</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white text-xs px-3" onClick={handleInstall}>
          Install
        </Button>
        <Button size="sm" variant="ghost" className="text-white hover:bg-white/10 px-2" onClick={dismiss}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
