import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateMonthlyExcel } from '@/lib/monthly-register'
import { sendMonthlyRegisterEmail } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/cron/monthly — Send monthly expiry register to ALL active agents
// Called by pg_cron via net.http_post with x-cron-secret header
export async function POST(req: NextRequest) {
  // Step 1: Verify cron secret (replaces the broken auth.getUser() check)
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    console.warn('[cron/monthly] Rejected: invalid or missing x-cron-secret')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Step 2: Use admin client to bypass RLS
  const admin = createAdminClient()

  const body = await req.json().catch(() => ({}))
  const now = new Date()
  const month = body.month ?? (now.getMonth() + 1)
  const year = body.year ?? now.getFullYear()

  const startDate = new Date(year, month - 1, 1).toISOString().slice(0, 10)
  const endDate = new Date(year, month, 0).toISOString().slice(0, 10)

  const monthName = new Date(year, month - 1).toLocaleString('en-IN', { month: 'long' })
  const monthLabel = `${monthName} ${year}`

  // Step 3: Get ALL active agents from profiles
  const { data: agents, error: agentsError } = await admin
    .from('profiles')
    .select('id, email, full_name')
    .eq('is_active', true)

  if (agentsError) {
    console.error('[cron/monthly] Failed to fetch agents:', agentsError.message)
    return NextResponse.json({ error: agentsError.message }, { status: 500 })
  }

  if (!agents || agents.length === 0) {
    return NextResponse.json({ success: true, message: 'No active agents found', sent: 0 })
  }

  // Step 4: For each agent, fetch their expiring policies and send email
  let emailsSent = 0
  let emailsFailed = 0
  const results: { agent: string; email: string; policyCount: number; sent: boolean }[] = []

  for (const agent of agents) {
    if (!agent.email) {
      results.push({ agent: agent.full_name, email: '(none)', policyCount: 0, sent: false })
      emailsFailed++
      continue
    }

    // Fetch policies for THIS agent expiring in the target month
    const { data: policies, error: polError } = await admin
      .from('policies')
      .select('*')
      .eq('user_id', agent.id)
      .gte('expiry_date', startDate)
      .lte('expiry_date', endDate)
      .order('expiry_date', { ascending: true })

    if (polError) {
      console.error(`[cron/monthly] Policy fetch failed for ${agent.email}:`, polError.message)
      results.push({ agent: agent.full_name, email: agent.email, policyCount: 0, sent: false })
      emailsFailed++
      continue
    }

    const policyList = policies || []

    // Skip agents with no expiring policies this month
    if (policyList.length === 0) {
      results.push({ agent: agent.full_name, email: agent.email, policyCount: 0, sent: true })
      continue
    }

    // Generate Excel and send email
    const buffer = await generateMonthlyExcel(policyList, monthName, year)
    const ok = await sendMonthlyRegisterEmail(agent.email, policyList.length, monthLabel, buffer)

    if (ok) {
      emailsSent++
      console.log(`[cron/monthly] ✅ Sent to ${agent.email} (${policyList.length} policies)`)
    } else {
      emailsFailed++
      console.error(`[cron/monthly] ❌ Email failed for ${agent.email}`)
    }

    results.push({ agent: agent.full_name, email: agent.email, policyCount: policyList.length, sent: ok })
  }

  return NextResponse.json({
    success: true,
    month: monthLabel,
    totalAgents: agents.length,
    emailsSent,
    emailsFailed,
    results,
  })
}
