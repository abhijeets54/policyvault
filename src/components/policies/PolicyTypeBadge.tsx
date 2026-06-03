import type { PolicyType } from '@/lib/types'
import { cn } from '@/lib/utils'

const TYPE_CONFIG: Record<PolicyType, { label: string; color: string }> = {
  health:     { label: 'Health',      color: 'bg-emerald-100 text-emerald-800' },
  car:        { label: 'Car',         color: 'bg-blue-100 text-blue-800' },
  bike:       { label: 'Bike',        color: 'bg-cyan-100 text-cyan-800' },
  life:       { label: 'Life',        color: 'bg-purple-100 text-purple-800' },
  home:       { label: 'Home',        color: 'bg-orange-100 text-orange-800' },
  travel:     { label: 'Travel',      color: 'bg-sky-100 text-sky-800' },
  commercial: { label: 'Commercial',  color: 'bg-yellow-100 text-yellow-800' },
  fire:       { label: 'Fire',        color: 'bg-red-100 text-red-800' },
  marine:     { label: 'Marine',      color: 'bg-teal-100 text-teal-800' },
  other:      { label: 'Other',       color: 'bg-gray-100 text-gray-700' },
}

export function PolicyTypeBadge({ type }: { type: PolicyType | null }) {
  if (!type) return <span className="text-gray-400 text-xs">—</span>
  const config = TYPE_CONFIG[type] ?? TYPE_CONFIG.other
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', config.color)}>
      {config.label}
    </span>
  )
}
