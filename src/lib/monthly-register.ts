import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Policy } from '@/lib/types'

export async function generateMonthlyExcel(policies: Policy[], monthName: string, year: number): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'PolicyVault'
  wb.created = new Date()

  const ws = wb.addWorksheet(`${monthName} ${year}`)

  const headers = [
    'Sr.', 'Referred By', 'Client Name', 'Phone', 'Policy Number', 'Insurer', 'Type',
    'Plan', 'Sum Insured (₹)', 'Premium (₹)', 'Expiry Date',
    'Vehicle No.', 'Members', 'Status', 'Notes',
  ]

  // Row 1: Title (merged across all columns)
  const titleRow = ws.addRow([`POLICY EXPIRY REGISTER — ${monthName.toUpperCase()} ${year}`])
  ws.mergeCells(1, 1, 1, headers.length)
  titleRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FF1E3A5F' } }
  titleRow.getCell(1).alignment = { horizontal: 'center' }

  // Row 2: Total count
  const countRow = ws.addRow([`Total Policies: ${policies.length}`])
  ws.mergeCells(2, 1, 2, headers.length)
  countRow.getCell(1).font = { bold: true, size: 11, color: { argb: 'FF6B7280' } }
  countRow.getCell(1).alignment = { horizontal: 'center' }

  // Row 3: Generated date
  const dateRow = ws.addRow([`Generated: ${new Date().toLocaleString('en-IN')}`])
  ws.mergeCells(3, 1, 3, headers.length)
  dateRow.getCell(1).font = { size: 10, color: { argb: 'FF9CA3AF' } }
  dateRow.getCell(1).alignment = { horizontal: 'center' }

  // Row 4: Blank separator
  ws.addRow([])

  // Row 5: Header row with styling
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
      p.expiry_date
        ? new Date(p.expiry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'N/A',
      p.vehicle_number || '—',
      p.family_members?.length ? p.family_members.map(m => m.name).join(', ') : '—',
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
    head: [['Sr.', 'Referred By', 'Client', 'Phone', 'Policy #', 'Insurer', 'Type', 'Sum Insured', 'Premium', 'Expiry', 'Vehicle']],
    body: policies.map((p, i) => [
      i + 1,
      p.referred_by ?? '',
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
