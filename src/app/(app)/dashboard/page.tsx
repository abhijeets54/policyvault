'use client'
import { useEffect, useState } from 'react'
import { StatsRow } from '@/components/dashboard/StatsRow'
import { ExpiryChart, buildChartData } from '@/components/dashboard/ExpiryChart'
import { ExpiringTable } from '@/components/dashboard/ExpiringTable'
import { MonthlyRegisterBanner } from '@/components/MonthlyRegisterBanner'
import type { Policy } from '@/lib/types'

import Link from 'next/link'
import { Upload } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/policies?limit=200')
      .then(r => r.json())
      .then(d => { setPolicies(d.policies || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

  const total = policies.length
  const active = policies.filter(p => p.status === 'active').length
  const expired = policies.filter(p => p.status === 'expired').length
  const expiringThisMonth = policies.filter(p =>
    p.expiry_date && p.expiry_date >= monthStart && p.expiry_date <= monthEnd
  ).length

  const expiringExact = policies
    .filter(p => p.expiry_date)
    .sort((a, b) => (a.expiry_date ?? '').localeCompare(b.expiry_date ?? ''))
    .slice(0, 10)

  const chartData = buildChartData(policies.map(p => p.expiry_date))

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Welcome back — here's your policy overview</p>
        </div>
        <Link
          href="/upload"
          className="inline-flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#162e4d] text-white px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap"
        >
          <Upload className="w-4 h-4" />
          <span>Upload Policy</span>
        </Link>
      </div>

      {/* Monthly Register Banner — MOST PROMINENT FEATURE */}
      <MonthlyRegisterBanner />

      {/* Stats Row */}
      <StatsRow
        total={total}
        active={active}
        expiringThisMonth={expiringThisMonth}
        expired={expired}
      />

      {/* Chart + Table */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ExpiryChart data={chartData} />
        <ExpiringTable policies={expiringExact} />
      </div>
    </div>
  )
}
