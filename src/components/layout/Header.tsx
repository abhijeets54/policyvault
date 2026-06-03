import { ShieldCheck } from 'lucide-react'
import Link from 'next/link'

interface HeaderProps {
  title?: string
  subtitle?: string
  action?: React.ReactNode
}

export function Header({ title, subtitle, action }: HeaderProps) {
  return (
    <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
      <div className="md:hidden flex items-center gap-2">
        <Link href="/dashboard" className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-amber-500" />
          <span className="font-bold text-[#1e3a5f] text-sm">PolicyVault</span>
        </Link>
      </div>
      {title && (
        <div className="hidden md:block">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
      )}
      {action && <div>{action}</div>}
    </header>
  )
}
