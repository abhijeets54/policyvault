import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { currentMonthRange } from '@/lib/utils'
import { policiesToExcel } from '@/lib/export/excel'
import { policiesToPdf } from '@/lib/export/pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const format = url.searchParams.get('format') === 'pdf' ? 'pdf' : 'xlsx'

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { start, end, label } = currentMonthRange()
  const { data: policies, error } = await supabase
    .from('policies')
    .select('*')
    .gte('expiry_date', start)
    .lte('expiry_date', end)
    .order('expiry_date', { ascending: true })

  if (error) return new NextResponse(error.message, { status: 500 })

  const slug = label.replace(/\s+/g, '-').toLowerCase()

  if (format === 'pdf') {
    const buf = policiesToPdf(policies || [], `Expiry Register — ${label}`)
    return new NextResponse(buf as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="expiry-register-${slug}.pdf"`,
      },
    })
  }

  const buf = await policiesToExcel(policies || [])
  return new NextResponse(buf as any, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="expiry-register-${slug}.xlsx"`,
    },
  })
}
