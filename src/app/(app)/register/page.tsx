'use client'
import { useState, useEffect } from 'react'
import type { Policy } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { FileSpreadsheet, FileText, Mail, Loader2 } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import { PolicyTypeBadge } from '@/components/policies/PolicyTypeBadge'
import { DaysLeftBadge } from '@/components/policies/StatusBadge'

export default function RegisterPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)
  const [emailSending, setEmailSending] = useState(false)
  const [emailStatus, setEmailStatus] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    setLoading(true)
    setEmailStatus(null)
    fetch(`/api/policies?limit=500`)
      .then(r => r.json())
      .then(d => {
        const startDate = new Date(year, month - 1, 1).toISOString().slice(0, 10)
        const endDate = new Date(year, month, 0).toISOString().slice(0, 10)
        const all: Policy[] = d.policies || []
        const filtered = all.filter(p =>
          p.expiry_date && p.expiry_date >= startDate && p.expiry_date <= endDate
        ).sort((a, b) => (a.expiry_date ?? '').localeCompare(b.expiry_date ?? ''))
        setPolicies(filtered)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [month, year])

  const monthName = new Date(year, month - 1).toLocaleString('en-IN', { month: 'long' })
  const MONTHS = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: new Date(2000, i).toLocaleString('en-IN', { month: 'long' })
  }))
  const YEARS = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 1 + i)

  const downloadExcel = () => window.open(`/api/export/monthly?month=${month}&year=${year}`, '_blank')
  const downloadPDF = () => window.open(`/api/export/monthly?month=${month}&year=${year}&format=pdf`, '_blank')

  const handleSendEmail = async () => {
    setEmailSending(true)
    setEmailStatus(null)
    try {
      const res = await fetch('/api/cron/monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year }),
      })
      const data = await res.json()
      setEmailStatus({ ok: data.success, msg: data.message || (data.success ? 'Email sent!' : 'Failed to send email') })
    } catch {
      setEmailStatus({ ok: false, msg: 'Failed to send email' })
    } finally {
      setEmailSending(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Monthly Expiry Register</h1>
        <p className="text-gray-500 text-sm mt-1">View and download your expiry register by month</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end justify-between">
          <div className="flex gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Month</label>
              <select value={month} onChange={e => setMonth(Number(e.target.value))} className="border rounded-md px-3 py-2 text-sm bg-white">
                {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Year</label>
              <select value={year} onChange={e => setYear(Number(e.target.value))} className="border rounded-md px-3 py-2 text-sm bg-white">
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={downloadExcel} className="bg-amber-600 hover:bg-amber-700 text-white">
              <FileSpreadsheet className="h-4 w-4 mr-2" />Download Excel
            </Button>
            <Button onClick={downloadPDF} variant="outline" className="border-amber-600 text-amber-700">
              <FileText className="h-4 w-4 mr-2" />Download PDF
            </Button>
            <div className="relative inline-block">
              <Button
                onClick={(e) => e.preventDefault()}
                variant="outline"
                className="border-[#1e3a5f] text-[#1e3a5f]"
                disabled={true}
              >
                <Mail className="h-4 w-4 mr-2" />
                Send via Email
              </Button>
              <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full z-10 pointer-events-none shadow-sm">
                Coming Soon
              </span>
            </div>
          </div>
        </div>

        {/* Email status feedback */}
        {emailStatus && (
          <div className={`mt-3 text-sm px-4 py-2 rounded-lg ${emailStatus.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {emailStatus.ok ? '✅ ' : '❌ '}{emailStatus.msg}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">
          {monthName} {year} — {loading ? '...' : `${policies.length} policies expiring`}
        </h2>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3 font-medium text-gray-600">Sr.</th>
              <th className="text-left p-3 font-medium text-gray-600">Referred By</th>
              <th className="text-left p-3 font-medium text-gray-600">Client</th>
              <th className="text-left p-3 font-medium text-gray-600">Phone</th>
              <th className="text-left p-3 font-medium text-gray-600">Policy #</th>
              <th className="text-left p-3 font-medium text-gray-600">Insurer</th>
              <th className="text-left p-3 font-medium text-gray-600">Type</th>
              <th className="text-left p-3 font-medium text-gray-600">Sum Insured</th>
              <th className="text-left p-3 font-medium text-gray-600">Premium</th>
              <th className="text-left p-3 font-medium text-gray-600">Expiry</th>
              <th className="text-left p-3 font-medium text-gray-600">Days Left</th>
              <th className="text-left p-3 font-medium text-gray-600">Vehicle</th>
              <th className="text-left p-3 font-medium text-gray-600">Members</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={12} className="text-center py-12 text-gray-400">Loading...</td></tr>
            ) : policies.length === 0 ? (
              <tr><td colSpan={12} className="text-center py-12 text-gray-400">
                No policies expiring in {monthName} {year}.
              </td></tr>
            ) : (
              policies.map((p, i) => (
                <tr key={p.id} className="border-t hover:bg-gray-50">
                  <td className="p-3 text-gray-500">{i + 1}</td>
                  <td className="p-3 text-gray-500">{p.referred_by || '—'}</td>
                  <td className="p-3 font-medium">{p.holder_name || '—'}</td>
                  <td className="p-3 text-gray-600">{p.holder_phone || '—'}</td>
                  <td className="p-3 font-mono text-xs">{p.policy_number || '—'}</td>
                  <td className="p-3">{p.insurer_name || '—'}</td>
                  <td className="p-3"><PolicyTypeBadge type={p.policy_type} /></td>
                  <td className="p-3">{formatCurrency(p.sum_insured)}</td>
                  <td className="p-3">{formatCurrency(p.total_premium ?? p.premium_amount)}</td>
                  <td className="p-3">{formatDate(p.expiry_date)}</td>
                  <td className="p-3"><DaysLeftBadge expiryDate={p.expiry_date} /></td>
                  <td className="p-3 text-xs text-gray-600">{p.vehicle_number || '—'}</td>
                  <td className="p-3 text-xs text-gray-600">
                    {p.family_members?.length
                      ? p.family_members.map(m => m.name).join(', ')
                      : '—'}
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
