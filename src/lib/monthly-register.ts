import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Policy } from '@/lib/types'

export function generateMonthlyExcel(policies: Policy[], monthName: string, year: number): Buffer {
  const headers = [
    'Sr.', 'Client Name', 'Phone', 'Policy Number', 'Insurer', 'Type',
    'Plan', 'Sum Insured (₹)', 'Premium (₹)', 'Expiry Date',
    'Vehicle No.', 'Members', 'Status', 'Notes',
  ]

  const dataRows = policies.map((p, i) => [
    i + 1,
    p.holder_name || 'N/A',
    p.holder_phone || 'N/A',
    p.policy_number || 'N/A',
    p.insurer_name || 'N/A',
    (p.policy_type || 'N/A').toUpperCase(),
    p.plan_name || 'N/A',
    p.sum_insured ? p.sum_insured.toLocaleString('en-IN') : 'N/A',
    (p.total_premium || p.premium_amount)
      ? (p.total_premium || p.premium_amount)!.toLocaleString('en-IN') : 'N/A',
    p.expiry_date
      ? new Date(p.expiry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'N/A',
    p.vehicle_number || '—',
    p.family_members?.length ? p.family_members.map(m => m.name).join(', ') : '—',
    (p.status || 'active').toUpperCase(),
    p.notes || '',
  ])

  // Title rows required by spec — prominent header before data table
  const allRows = [
    [`POLICY EXPIRY REGISTER — ${monthName.toUpperCase()} ${year}`],
    [`Total Policies: ${policies.length}`],
    [`Generated: ${new Date().toLocaleString('en-IN')}`],
    [],           // blank separator row
    headers,
    ...dataRows,
  ]

  const ws = XLSX.utils.aoa_to_sheet(allRows)

  // Column widths based on header row (row index 4)
  ws['!cols'] = headers.map(k => ({ wch: Math.max(k.length + 2, 14) }))

  // Merge title cells across all columns for visual prominence
  if (headers.length > 1) {
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: headers.length - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: headers.length - 1 } },
    ]
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, `${monthName} ${year}`)
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

export function generateMonthlyPdf(policies: Policy[], monthName: string, year: number): Buffer {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const title = `POLICY EXPIRY REGISTER — ${monthName.toUpperCase()} ${year}`

  doc.setFontSize(16)
  doc.setTextColor(30, 58, 95)
  doc.text(title, 40, 40)
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(`Total: ${policies.length} policies  |  Generated: ${new Date().toLocaleString('en-IN')}`, 40, 58)

  autoTable(doc, {
    startY: 75,
    head: [['Sr.', 'Client', 'Phone', 'Policy #', 'Insurer', 'Type', 'Sum Insured', 'Premium', 'Expiry', 'Vehicle']],
    body: policies.map((p, i) => [
      i + 1,
      p.holder_name ?? '',
      p.holder_phone ?? '',
      p.policy_number ?? '',
      p.insurer_name ?? '',
      (p.policy_type ?? '').toUpperCase(),
      p.sum_insured?.toLocaleString('en-IN') ?? '',
      (p.total_premium || p.premium_amount)?.toLocaleString('en-IN') ?? '',
      p.expiry_date ?? '',
      p.vehicle_number ?? '',
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [30, 58, 95], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })

  return Buffer.from(doc.output('arraybuffer'))
}
