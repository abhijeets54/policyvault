import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Policy } from '@/lib/types'

export function policiesToPdf(policies: Policy[], title: string): Buffer {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  doc.setFontSize(16)
  doc.text(title, 40, 40)
  doc.setFontSize(10)
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 40, 58)

  autoTable(doc, {
    startY: 80,
    head: [['Sr.', 'Referred By', 'Client', 'Phone', 'Policy #', 'Insurer', 'Type', 'Sum Insured', 'Premium', 'Expiry']],
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
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [30, 58, 95] },
  })

  return Buffer.from(doc.output('arraybuffer'))
}
