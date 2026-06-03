'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { PolicyTable } from '@/components/policies/PolicyTable'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import type { Policy } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const fetchPolicies = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '200' })
    if (search) params.set('search', search)
    if (typeFilter !== 'all') params.set('type', typeFilter)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    const res = await fetch(`/api/policies?${params}`)
    const data = await res.json()
    setPolicies(data.policies || [])
    setLoading(false)
  }, [search, typeFilter, statusFilter])

  useEffect(() => { fetchPolicies() }, [fetchPolicies])

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Policies</h1>
          <p className="text-gray-500 text-sm mt-1">{policies.length} policies in your vault</p>
        </div>
        <Button asChild>
          <Link href="/upload">
            <Plus className="h-4 w-4 mr-2" />
            Upload New
          </Link>
        </Button>
      </div>

      <PolicyTable
        policies={policies}
        loading={loading}
        onSearch={setSearch}
        onTypeFilter={setTypeFilter}
        onStatusFilter={setStatusFilter}
        showExport
      />
    </div>
  )
}
