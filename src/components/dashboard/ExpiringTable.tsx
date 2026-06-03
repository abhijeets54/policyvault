import Link from 'next/link'
import type { Policy } from '@/lib/types'
import { DaysLeftBadge } from '@/components/policies/StatusBadge'
import { PolicyTypeBadge } from '@/components/policies/PolicyTypeBadge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'

interface Props {
  policies: Policy[]
}

export function ExpiringTable({ policies }: Props) {
  if (policies.length === 0) {
    return (
      <div className="bg-white rounded-xl border shadow-sm p-8 text-center text-gray-400">
        No policies expiring soon.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b">
        <h3 className="text-sm font-semibold text-gray-700">Expiring Soon — Next 10 Policies</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3 font-medium text-gray-600">Client</th>
              <th className="text-left p-3 font-medium text-gray-600">Phone</th>
              <th className="text-left p-3 font-medium text-gray-600">Insurer</th>
              <th className="text-left p-3 font-medium text-gray-600">Type</th>
              <th className="text-left p-3 font-medium text-gray-600">Expiry</th>
              <th className="text-left p-3 font-medium text-gray-600">Days Left</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {policies.map(p => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="p-3 font-medium">{p.holder_name || '—'}</td>
                <td className="p-3 text-gray-600">{p.holder_phone || '—'}</td>
                <td className="p-3">{p.insurer_name || '—'}</td>
                <td className="p-3"><PolicyTypeBadge type={p.policy_type} /></td>
                <td className="p-3">{formatDate(p.expiry_date)}</td>
                <td className="p-3"><DaysLeftBadge expiryDate={p.expiry_date} /></td>
                <td className="p-3">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/policies/${p.id}`}>Open</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
