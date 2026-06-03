import Link from 'next/link'
import type { Policy } from '@/lib/types'
import { PolicyTypeBadge } from './PolicyTypeBadge'
import { DaysLeftBadge } from './StatusBadge'
import { formatDate, formatCurrency } from '@/lib/utils'
import { Phone, FileText } from 'lucide-react'

interface Props {
  policy: Policy
}

export function PolicyCard({ policy }: Props) {
  return (
    <Link href={`/policies/${policy.id}`}>
      <div className="bg-white rounded-xl border shadow-sm p-5 hover:shadow-md hover:border-[#1e3a5f]/30 transition-all cursor-pointer group">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 group-hover:text-[#1e3a5f] truncate">
              {policy.holder_name || 'Unknown Client'}
            </h3>
            {policy.holder_phone && (
              <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                <Phone className="h-3 w-3" />
                {policy.holder_phone}
              </p>
            )}
          </div>
          <PolicyTypeBadge type={policy.policy_type} />
        </div>

        {/* Policy details */}
        <div className="space-y-1.5 mb-3">
          {policy.policy_number && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <FileText className="h-3 w-3 text-gray-400" />
              <span className="font-mono">{policy.policy_number}</span>
            </div>
          )}
          {policy.insurer_name && (
            <p className="text-xs text-gray-600">{policy.insurer_name}</p>
          )}
        </div>

        {/* Financial */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <p className="text-xs text-gray-400">Sum Insured</p>
            <p className="text-sm font-medium text-gray-800">{formatCurrency(policy.sum_insured)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Premium</p>
            <p className="text-sm font-medium text-gray-800">{formatCurrency(policy.total_premium ?? policy.premium_amount)}</p>
          </div>
        </div>

        {/* Expiry row */}
        <div className="flex items-center justify-between pt-3 border-t">
          <div>
            <p className="text-xs text-gray-400">Expires</p>
            <p className="text-sm text-gray-700">{formatDate(policy.expiry_date)}</p>
          </div>
          <DaysLeftBadge expiryDate={policy.expiry_date} />
        </div>
      </div>
    </Link>
  )
}
