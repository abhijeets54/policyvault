import { FileText, ShieldCheck, AlertTriangle, XCircle } from 'lucide-react'

interface Props {
  total: number
  active: number
  expiringThisMonth: number
  expired: number
}

export function StatsRow({ total, active, expiringThisMonth, expired }: Props) {
  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-600">Total Policies</p>
          <FileText className="h-5 w-5 text-gray-400" />
        </div>
        <p className="text-3xl font-bold text-gray-900">{total}</p>
        <p className="text-xs text-gray-500 mt-1">All time</p>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-600">Active</p>
          <ShieldCheck className="h-5 w-5 text-green-500" />
        </div>
        <p className="text-3xl font-bold text-green-600">{active}</p>
        <p className="text-xs text-gray-500 mt-1">Currently active</p>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-600">Expiring This Month</p>
          <AlertTriangle className="h-5 w-5 text-amber-500" />
        </div>
        <p className="text-3xl font-bold text-amber-600">{expiringThisMonth}</p>
        <p className="text-xs text-gray-500 mt-1">Need attention</p>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-gray-600">Expired</p>
          <XCircle className="h-5 w-5 text-red-500" />
        </div>
        <p className="text-3xl font-bold text-red-600">{expired}</p>
        <p className="text-xs text-gray-500 mt-1">Past expiry</p>
      </div>
    </div>
  )
}
