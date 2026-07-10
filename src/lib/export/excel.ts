import ExcelJS from 'exceljs'
import type { Policy } from '@/lib/types'

export async function policiesToExcel(policies: Policy[], sheetName = 'Expiry Register'): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'PolicyVault'
  wb.created = new Date()

  const ws = wb.addWorksheet(sheetName)

  const headers = [
    'Sr.', 'Referred By', 'Client Name', 'Phone', 'Policy Number', 'Insurer', 'Type',
    'Plan', 'Sum Insured (₹)', 'Premium (₹)', 'Start Date', 'Expiry Date',
    'Vehicle No.', 'Members', 'Status', 'Notes',
  ]

  // Header row with styling
  const headerRow = ws.addRow(headers)
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
    }
  })

  // Data rows
  for (let i = 0; i < policies.length; i++) {
    const p = policies[i]
    ws.addRow([
      i + 1,
      p.referred_by || '—',
      p.holder_name || 'N/A',
      p.holder_phone || 'N/A',
      p.policy_number || 'N/A',
      p.insurer_name || 'N/A',
      (p.policy_type || 'N/A').toUpperCase(),
      p.plan_name || 'N/A',
      p.sum_insured ? p.sum_insured.toLocaleString('en-IN') : 'N/A',
      (p.total_premium || p.premium_amount)
        ? (p.total_premium || p.premium_amount)!.toLocaleString('en-IN') : 'N/A',
      p.start_date || 'N/A',
      p.expiry_date
        ? new Date(p.expiry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'N/A',
      p.vehicle_number || '—',
      p.family_members?.length
        ? p.family_members.map(m => m.name).join(', ')
        : '—',
      (p.status || 'active').toUpperCase(),
      p.notes || '',
    ])
  }

  // Auto-size columns
  ws.columns.forEach((col) => {
    let maxLen = 14
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0
      if (len > maxLen) maxLen = len
    })
    col.width = Math.min(maxLen + 2, 40)
  })

  return Buffer.from(await wb.xlsx.writeBuffer())
}
