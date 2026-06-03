import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateMonthlyExcel } from '@/lib/monthly-register'
import { sendMonthlyRegisterEmail } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/cron/monthly — Send monthly register to the agent's email
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const now = new Date()
  const month = body.month ?? (now.getMonth() + 1)
  const year = body.year ?? now.getFullYear()

  const startDate = new Date(year, month - 1, 1).toISOString().slice(0, 10)
  const endDate = new Date(year, month, 0).toISOString().slice(0, 10)

  // Fetch user email from Supabase Auth
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', user.id)
    .single()

  const agentEmail = profile?.email ?? user.email
  if (!agentEmail) {
    return NextResponse.json({ error: 'No email on file' }, { status: 400 })
  }

  // Fetch policies expiring that month (RLS scoped)
  const { data: policies, error } = await supabase
    .from('policies')
    .select('*')
    .gte('expiry_date', startDate)
    .lte('expiry_date', endDate)
    .order('expiry_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const monthName = new Date(year, month - 1).toLocaleString('en-IN', { month: 'long' })
  const monthLabel = `${monthName} ${year}`
  const buffer = generateMonthlyExcel(policies || [], monthName, year)

  const ok = await sendMonthlyRegisterEmail(agentEmail, (policies || []).length, monthLabel, buffer)

  return NextResponse.json({
    success: ok,
    message: ok
      ? `Register for ${monthLabel} sent to ${agentEmail}`
      : 'Email delivery failed',
    policyCount: (policies || []).length,
  })
}
