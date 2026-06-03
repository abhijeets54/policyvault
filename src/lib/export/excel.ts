import * as XLSX from 'xlsx'
import type { Policy } from '@/lib/types'

export function policiesToExcel(policies: Policy[], sheetName = 'Expiry Register'): Buffer {
  const rows = policies.map((p, i) => ({
    'Sr.': i + 1,
    'Client Name': p.holder_name || 'N/A',
    'Phone': p.holder_phone || 'N/A',
    'Policy Number': p.policy_number || 'N/A',
    'Insurer': p.insurer_name || 'N/A',
    'Type': (p.policy_type || 'N/A').toUpperCase(),
    'Plan': p.plan_name || 'N/A',
    'Sum Insured (₹)': p.sum_insured ? p.sum_insured.toLocaleString('en-IN') : 'N/A',
    'Premium (₹)': (p.total_premium || p.premium_amount)
      ? (p.total_premium || p.premium_amount)!.toLocaleString('en-IN') : 'N/A',
    'Start Date': p.start_date || 'N/A',
    'Expiry Date': p.expiry_date
      ? new Date(p.expiry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'N/A',
    'Vehicle No.': p.vehicle_number || '—',
    'Members': p.family_members?.length
      ? p.family_members.map(m => m.name).join(', ')
      : '—',
    'Status': (p.status || 'active').toUpperCase(),
    'Notes': p.notes || '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(k.length + 2, 14) }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
