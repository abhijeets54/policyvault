'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { notFound } from 'next/navigation'
import type { Policy } from '@/lib/types'
import { PolicyTypeBadge } from '@/components/policies/PolicyTypeBadge'
import { StatusBadge, DaysLeftBadge } from '@/components/policies/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowLeft, Edit2, Save, X, Trash2, ExternalLink } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

function maskPAN(pan: string | null) {
  if (!pan) return '—'
  return pan.slice(0, 2) + 'XXXXX' + pan.slice(-3)
}

export default function PolicyDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<Policy>>({})

  useEffect(() => {
    fetch(`/api/policies/${params.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) { setLoading(false); return }
        setPolicy(d.policy)
        setForm(d.policy)
        if (d.policy.raw_pdf_path) {
          // Fetch signed URL
          fetch(`/api/policies/${params.id}/pdf-url`)
            .then(r => r.json())
            .then(d => setPdfUrl(d.url))
            .catch(() => null)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [params.id])

  async function handleSave() {
    if (!policy) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/policies/${policy.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPolicy(data.policy)
      setForm(data.policy)
      setEditing(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!policy) return
    if (!confirm(`Delete policy for ${policy.holder_name ?? 'this client'}? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/policies/${policy.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      router.push('/policies')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
      setDeleting(false)
    }
  }

  const field = (key: keyof Policy, label: string, type: 'text' | 'date' | 'number' = 'text') => (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {editing ? (
        <Input
          type={type}
          value={(form[key] as string) ?? ''}
          onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? parseFloat(e.target.value) || null : e.target.value || null }))}
          className="h-8 text-sm"
        />
      ) : (
        <p className="text-sm font-medium">
          {type === 'number' ? formatCurrency(policy?.[key] as number) : (policy?.[key] as string) || '—'}
        </p>
      )}
    </div>
  )

  if (loading) return <div className="max-w-5xl mx-auto py-12 text-center text-gray-400">Loading...</div>
  if (!policy) return <div className="max-w-5xl mx-auto py-12 text-center text-gray-400">Policy not found.</div>

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 text-gray-500">
            <Link href="/policies"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link>
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">{policy.holder_name ?? 'Policy Detail'}</h1>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="font-mono text-sm text-gray-600">{policy.policy_number || 'No Policy #'}</span>
            <PolicyTypeBadge type={policy.policy_type} />
            <StatusBadge status={policy.status} />
            <DaysLeftBadge expiryDate={policy.expiry_date} />
          </div>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-1" />{saving ? 'Saving…' : 'Save Changes'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setEditing(false); setForm(policy) }}>
                <X className="h-4 w-4 mr-1" />Cancel
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Edit2 className="h-4 w-4 mr-1" />Edit
              </Button>
              <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
                <Trash2 className="h-4 w-4 mr-1" />{deleting ? 'Deleting…' : 'Delete'}
              </Button>
            </>
          )}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}

      {/* Two-column layout: PDF + Details */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* PDF Viewer */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Original Document</h3>
            {pdfUrl && (
              <a href={pdfUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                <ExternalLink className="h-3 w-3" />Open
              </a>
            )}
          </div>
          {pdfUrl ? (
            <iframe src={pdfUrl} className="w-full h-96" title="Policy PDF" />
          ) : (
            <div className="h-96 flex items-center justify-center text-gray-400 text-sm">
              {policy.raw_pdf_path ? 'PDF link expired — refresh to regenerate' : 'No PDF attached'}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-4">
          {/* Personal */}
          <div className="bg-white rounded-xl border shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Policyholder</h3>
            <div className="grid grid-cols-2 gap-4">
              {field('referred_by', 'Referred By')}
              {field('holder_name', 'Full Name')}
              {field('holder_phone', 'Phone')}
              {field('holder_email', 'Email')}
              {field('holder_dob', 'Date of Birth', 'date')}
              <div>
                <p className="text-xs text-gray-500 mb-1">PAN</p>
                <p className="text-sm font-medium font-mono">{editing ? (
                  <Input value={(form.holder_pan as string) ?? ''} onChange={e => setForm(f => ({ ...f, holder_pan: e.target.value || null }))} className="h-8 text-sm" />
                ) : maskPAN(policy.holder_pan)}</p>
              </div>
              {field('holder_address', 'Address')}
            </div>
          </div>

          {/* Policy Info */}
          <div className="bg-white rounded-xl border shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Policy Details</h3>
            <div className="grid grid-cols-2 gap-4">
              {field('insurer_name', 'Insurer')}
              {field('plan_name', 'Plan Name')}
              {field('issue_date', 'Issue Date', 'date')}
              {field('start_date', 'Start Date', 'date')}
              {field('expiry_date', 'Expiry Date', 'date')}
              {field('premium_amount', 'Premium', 'number')}
              {field('gst_amount', 'GST', 'number')}
              {field('total_premium', 'Total Premium', 'number')}
              {field('sum_insured', 'Sum Insured', 'number')}
            </div>
          </div>

          {/* Vehicle (if applicable) */}
          {['car', 'bike'].includes(policy.policy_type ?? '') && (
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Vehicle Details</h3>
              <div className="grid grid-cols-2 gap-4">
                {field('vehicle_number', 'Registration No.')}
                {field('vehicle_make', 'Make')}
                {field('vehicle_model', 'Model')}
                {field('vehicle_year', 'Year', 'number')}
                {field('idv_value', 'IDV', 'number')}
                {field('engine_number', 'Engine No.')}
                {field('chassis_number', 'Chassis No.')}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="bg-white rounded-xl border shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Notes</h3>
            {editing ? (
              <textarea
                value={(form.notes as string) ?? ''}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value || null }))}
                className="w-full border rounded-md p-2 text-sm min-h-16"
                placeholder="Add notes..."
              />
            ) : (
              <p className="text-sm text-gray-600">{policy.notes || 'No notes.'}</p>
            )}
          </div>
        </div>
      </div>

      {/* Alert history */}
      <AlertHistory policyId={policy.id} />
    </div>
  )
}

function AlertHistory({ policyId }: { policyId: string }) {
  const [logs, setLogs] = useState<any[]>([])
  useEffect(() => {
    fetch(`/api/policies/${policyId}`)
      .then(r => r.json())
      .catch(() => null)
  }, [policyId])

  return null // Alert history shown via alert_logs table if needed
}
