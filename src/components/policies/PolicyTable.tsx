'use client'
import Link from 'next/link'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Policy } from '@/lib/types'
import { PolicyTypeBadge } from './PolicyTypeBadge'
import { StatusBadge, DaysLeftBadge } from './StatusBadge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Download, ChevronUp, ChevronDown } from 'lucide-react'

type SortField = 'holder_name' | 'expiry_date' | 'insurer_name' | 'policy_type' | 'status'
type SortDir = 'asc' | 'desc'

interface Props {
  policies: Policy[]
  onSearch?: (q: string) => void
  onTypeFilter?: (t: string) => void
  onStatusFilter?: (s: string) => void
  showExport?: boolean
  loading?: boolean
}

const POLICY_TYPES = ['all', 'health', 'car', 'bike', 'life', 'home', 'travel', 'commercial', 'fire', 'marine', 'other']
const STATUSES = ['all', 'active', 'expired', 'lapsed', 'cancelled', 'pending']

export function PolicyTable({ policies, onSearch, onTypeFilter, onStatusFilter, showExport = true, loading }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortField, setSortField] = useState<SortField>('expiry_date')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSearch = useCallback((q: string) => {
    setSearch(q)
    onSearch?.(q)
  }, [onSearch])

  const handleTypeFilter = useCallback((t: string) => {
    setTypeFilter(t)
    onTypeFilter?.(t)
  }, [onTypeFilter])

  const handleStatusFilter = useCallback((s: string) => {
    setStatusFilter(s)
    onStatusFilter?.(s)
  }, [onStatusFilter])

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const SortIcon = ({ field }: { field: SortField }) =>
    sortField === field
      ? sortDir === 'asc' ? <ChevronUp className="h-3 w-3 ml-1 inline" /> : <ChevronDown className="h-3 w-3 ml-1 inline" />
      : null

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search name, phone, policy no., vehicle..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => handleTypeFilter(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm bg-white"
        >
          {POLICY_TYPES.map(t => (
            <option key={t} value={t}>{t === 'all' ? 'All Types' : t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => handleStatusFilter(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm bg-white"
        >
          {STATUSES.map(s => (
            <option key={s} value={s}>{s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        {showExport && (
          <Button variant="outline" size="sm" onClick={() => window.open('/api/export?format=xlsx', '_blank')}>
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3 font-medium text-gray-600">Referred By</th>
              <th className="text-left p-3 font-medium text-gray-600 cursor-pointer select-none" onClick={() => handleSort('holder_name')}>
                Client Name <SortIcon field="holder_name" />
              </th>
              <th className="text-left p-3 font-medium text-gray-600">Phone</th>
              <th className="text-left p-3 font-medium text-gray-600">Policy #</th>
              <th className="text-left p-3 font-medium text-gray-600 cursor-pointer select-none" onClick={() => handleSort('insurer_name')}>
                Insurer <SortIcon field="insurer_name" />
              </th>
              <th className="text-left p-3 font-medium text-gray-600 cursor-pointer select-none" onClick={() => handleSort('policy_type')}>
                Type <SortIcon field="policy_type" />
              </th>
              <th className="text-left p-3 font-medium text-gray-600">Sum Insured</th>
              <th className="text-left p-3 font-medium text-gray-600">Premium</th>
              <th className="text-left p-3 font-medium text-gray-600 cursor-pointer select-none" onClick={() => handleSort('expiry_date')}>
                Expiry <SortIcon field="expiry_date" />
              </th>
              <th className="text-left p-3 font-medium text-gray-600">Days Left</th>
              <th className="text-left p-3 font-medium text-gray-600 cursor-pointer select-none" onClick={() => handleSort('status')}>
                Status <SortIcon field="status" />
              </th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} className="text-center py-12 text-gray-400">Loading...</td></tr>
            ) : policies.length === 0 ? (
              <tr><td colSpan={11} className="text-center py-12 text-gray-400">
                No policies found. <Link href="/upload" className="text-blue-600 underline">Upload your first one →</Link>
              </td></tr>
            ) : (
              policies.map(p => (
                <tr
                  key={p.id}
                  className="border-t hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => router.push(`/policies/${p.id}`)}
                >
                  <td className="p-3 text-gray-500">{p.referred_by || '—'}</td>
                  <td className="p-3 font-medium">{p.holder_name || '—'}</td>
                  <td className="p-3 text-gray-600">{p.holder_phone || '—'}</td>
                  <td className="p-3 font-mono text-xs text-gray-600">{p.policy_number || '—'}</td>
                  <td className="p-3">{p.insurer_name || '—'}</td>
                  <td className="p-3"><PolicyTypeBadge type={p.policy_type} /></td>
                  <td className="p-3">{formatCurrency(p.sum_insured)}</td>
                  <td className="p-3">{formatCurrency(p.total_premium ?? p.premium_amount)}</td>
                  <td className="p-3">{formatDate(p.expiry_date)}</td>
                  <td className="p-3"><DaysLeftBadge expiryDate={p.expiry_date} /></td>
                  <td className="p-3"><StatusBadge status={p.status} /></td>
                  <td className="p-3">
                    <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); router.push(`/policies/${p.id}`) }}>
                      Open
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
