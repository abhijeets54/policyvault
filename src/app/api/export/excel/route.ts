import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateMonthlyExcel, generateMonthlyPdf } from '@/lib/monthly-register'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/export/excel?format=xlsx|pdf
// Downloads the FULL policy list (not filtered by month)
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format') === 'pdf' ? 'pdf' : 'xlsx'

  // Fetch all active policies for this user (RLS enforces ownership)
  const { data: policies, error } = await supabase
    .from('policies')
    .select('*')
    .order('expiry_date', { ascending: true })

  if (error) return new NextResponse(error.message, { status: 500 })

  const now = new Date()
  const label = `All Policies — ${now.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}`

  if (format === 'pdf') {
    const buffer = generateMonthlyPdf(policies || [], 'All Policies', now.getFullYear())
    return new NextResponse(buffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="PolicyVault_Export.pdf"`,
      },
    })
  }

  const buffer = generateMonthlyExcel(policies || [], 'All Policies', now.getFullYear())
  return new NextResponse(buffer as any, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="PolicyVault_Export.xlsx"`,
    },
  })
}
