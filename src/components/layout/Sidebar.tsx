'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, FileText, Upload, Calendar,
  Bell, User, LogOut, ShieldCheck
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  // Expiring within 30 days count — badge on "All Policies"
  const [expiringCount, setExpiringCount] = useState(0)
  // Show badge on "Monthly Register" during first 7 days of month (spec requirement)
  const today = new Date()
  const showRegisterBadge = today.getDate() <= 7

  useEffect(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + 30)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const todayStr = new Date().toISOString().slice(0, 10)

    fetch('/api/policies?limit=500&status=active')
      .then(r => r.json())
      .then(d => {
        const policies = d.policies || []
        const count = policies.filter((p: { expiry_date: string | null }) =>
          p.expiry_date && p.expiry_date >= todayStr && p.expiry_date <= cutoffStr
        ).length
        setExpiringCount(count)
      })
      .catch(() => {})
  }, [])

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
    {
      href: '/policies',
      label: 'All Policies',
      icon: FileText,
      badge: expiringCount > 0 ? expiringCount : null,
    },
    { href: '/upload', label: 'Upload Policy', icon: Upload, badge: null },
    {
      href: '/register',
      label: 'Monthly Register',
      icon: Calendar,
      badge: showRegisterBadge ? '!' : null,
    },
    { href: '/alerts', label: 'Alerts', icon: Bell, badge: null },
    { href: '/profile', label: 'Profile', icon: User, badge: null },
  ]

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="hidden md:flex flex-col w-60 min-h-screen bg-[#1e3a5f] text-white flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        <ShieldCheck className="h-7 w-7 text-amber-400 flex-shrink-0" />
        <span className="text-lg font-bold text-white">PolicyVault</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon, badge }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-white/15 text-white'
                  : 'text-blue-200 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {badge !== null && (
                <span className={cn(
                  'text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1',
                  typeof badge === 'number'
                    ? 'bg-amber-400 text-[#1e3a5f]'   // numeric — expiring count
                    : 'bg-red-500 text-white'           // "!" — monthly register reminder
                )}>
                  {badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-blue-200 hover:bg-white/10 hover:text-white transition-colors w-full"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
