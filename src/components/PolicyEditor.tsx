"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import type { Policy } from "@/lib/types"

/**
 * PolicyEditor — inline edit mode for the policy detail page.
 * Renders an edit button that, when clicked, makes all fields editable.
 */
export function PolicyEditor({ policy, pdfUrl }: { policy: Policy; pdfUrl: string | null }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    referred_by: policy.referred_by ?? '',
    holder_name: policy.holder_name ?? '',
    holder_phone: policy.holder_phone ?? '',
    holder_email: policy.holder_email ?? '',
    policy_number: policy.policy_number ?? '',
    insurer_name: policy.insurer_name ?? '',
    plan_name: policy.plan_name ?? '',
    policy_type: policy.policy_type ?? '',
    sum_insured: policy.sum_insured ?? '',
    premium_amount: policy.premium_amount ?? '',
    total_premium: policy.total_premium ?? '',
    issue_date: policy.issue_date ?? '',
    start_date: policy.start_date ?? '',
    expiry_date: policy.expiry_date ?? '',
    vehicle_number: policy.vehicle_number ?? '',
    notes: policy.notes ?? '',
    status: policy.status ?? 'active',
  })

  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }))

  async function onSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/policies/${policy.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error(await res.text())
      setEditing(false)
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!confirm("Delete this policy permanently? This cannot be undone.")) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/policies/${policy.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(await res.text())
      router.push("/policies")
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
      setDeleting(false)
    }
  }

  const field = (label: string, key: keyof typeof form, type = 'text') => (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {editing ? (
        <input
          type={type}
          value={String(form[key])}
          onChange={e => set(key, e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1e3a5f] focus:border-transparent outline-none"
        />
      ) : (
        <p className="text-sm text-gray-900 py-1">{String(form[key]) || '—'}</p>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      {pdfUrl && (
        <a
          href={pdfUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-[#1e3a5f] underline hover:text-[#162e4d]"
        >
          📄 Open original PDF (link valid 30 min)
        </a>
      )}

      {/* Edit/Save actions */}
      <div className="flex gap-2">
        {editing ? (
          <>
            <Button onClick={onSave} disabled={saving} className="bg-[#1e3a5f] hover:bg-[#162e4d] text-white">
              {saving ? "Saving…" : "✓ Save Changes"}
            </Button>
            <Button variant="outline" onClick={() => { setEditing(false); setError(null) }}>
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={() => setEditing(true)}>
            ✏️ Edit
          </Button>
        )}
        <Button
          variant="outline"
          className="ml-auto border-red-300 text-red-600 hover:bg-red-50"
          onClick={onDelete}
          disabled={deleting}
        >
          {deleting ? "Deleting…" : "🗑 Delete Policy"}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Form fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field("Referred By", "referred_by")}
        {field("Client Name", "holder_name")}
        {field("Phone", "holder_phone")}
        {field("Email", "holder_email", "email")}
        {field("Policy Number", "policy_number")}
        {field("Insurer", "insurer_name")}
        {field("Plan Name", "plan_name")}
        {field("Sum Insured", "sum_insured", "number")}
        {field("Premium Amount", "premium_amount", "number")}
        {field("Total Premium", "total_premium", "number")}
        {field("Issue Date", "issue_date", "date")}
        {field("Start Date", "start_date", "date")}
        {field("Expiry Date", "expiry_date", "date")}
        {field("Vehicle Number", "vehicle_number")}
        {field("Notes", "notes")}
      </div>

      {/* Status (select) */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
        {editing ? (
          <select
            value={form.status}
            onChange={e => set('status', e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm w-full sm:w-auto focus:ring-2 focus:ring-[#1e3a5f] outline-none bg-white"
          >
            {['active', 'expired', 'cancelled', 'lapsed', 'pending'].map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-gray-900 py-1">{form.status}</p>
        )}
      </div>
    </div>
  )
}
