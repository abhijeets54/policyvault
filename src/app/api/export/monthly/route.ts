import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateMonthlyExcel, generateMonthlyPdf } from '@/lib/monthly-register'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1))
  const year = parseInt(searchParams.get('year') || String(now.getFullYear()))
  const format = searchParams.get('format') === 'pdf' ? 'pdf' : 'xlsx'

  const startDate = new Date(year, month - 1, 1).toISOString().slice(0, 10)
  const endDate = new Date(year, month, 0).toISOString().slice(0, 10)

  // RLS ensures this only returns the current user's policies
  const { data: policies, error } = await supabase
    .from('policies')
    .select('*')
    .gte('expiry_date', startDate)
    .lte('expiry_date', endDate)
    .order('expiry_date', { ascending: true })

  if (error) return new NextResponse(error.message, { status: 500 })

  const monthName = new Date(year, month - 1).toLocaleString('en-IN', { month: 'long' })

  if (format === 'pdf') {
    const buffer = generateMonthlyPdf(policies || [], monthName, year)
    return new NextResponse(buffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Expiry_Register_${monthName}_${year}.pdf"`,
      },
    })
  }

  const buffer = await generateMonthlyExcel(policies || [], monthName, year)
  return new NextResponse(buffer as any, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Expiry_Register_${monthName}_${year}.xlsx"`,
    },
  })
}
