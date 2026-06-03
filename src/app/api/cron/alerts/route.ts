import { NextRequest, NextResponse } from 'next/server'
import { runDailyAlerts } from '@/lib/alerts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const result = await runDailyAlerts()
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('Alert cron error:', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json({ error: 'Alert processing failed' }, { status: 500 })
  }
}
