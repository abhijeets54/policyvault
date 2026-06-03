import type { PolicyStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const STATUS_CONFIG: Record<PolicyStatus, { label: string; color: string }> = {
  active:    { label: 'Active',    color: 'bg-green-100 text-green-800' },
  expired:   { label: 'Expired',   color: 'bg-red-100 text-red-800' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-700' },
  lapsed:    { label: 'Lapsed',    color: 'bg-orange-100 text-orange-800' },
  pending:   { label: 'Pending',   color: 'bg-yellow-100 text-yellow-800' },
}

export function StatusBadge({ status }: { status: PolicyStatus | null }) {
  if (!status) return <span className="text-gray-400 text-xs">—</span>
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.active
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', config.color)}>
      {config.label}
    </span>
  )
}

export function DaysLeftBadge({ expiryDate }: { expiryDate: string | null }) {
  if (!expiryDate) return <span className="text-gray-400 text-xs">—</span>

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate)
  expiry.setHours(0, 0, 0, 0)
  const days = Math.ceil((expiry.getTime() - today.getTime()) / 86400000)

  const color = days < 0
    ? 'bg-gray-100 text-gray-600'
    : days <= 7
    ? 'bg-red-100 text-red-800'
    : days <= 30
    ? 'bg-amber-100 text-amber-800'
    : 'bg-green-100 text-green-800'

  const label = days < 0
    ? `Expired ${Math.abs(days)}d ago`
    : days === 0
    ? 'Today'
    : `${days}d left`

  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', color)}>
      {label}
    </span>
  )
}
