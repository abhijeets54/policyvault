import { createAdminClient } from '@/lib/supabase/admin'
import { sendPolicyAlertEmail } from '@/lib/email'
import { sendWhatsAppAlert } from '@/lib/whatsapp'
import type { Policy } from '@/lib/types'

const THRESHOLDS = [90, 60, 30, 15, 7, 3, 1] as const

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

export async function runDailyAlerts(): Promise<{ processed: number; alertsSent: number }> {
  let alertsSent = 0

  // Create admin client inside the function — never at module level
  const db = createAdminClient()

  // Get all active policies across ALL users (service role bypasses RLS)
  const { data: policies, error } = await db
    .from('policies')
    .select('*, profiles!policies_user_id_fkey(email, full_name)')
    .eq('status', 'active')
    .not('expiry_date', 'is', null)

  if (error || !policies) return { processed: 0, alertsSent: 0 }

  type PolicyWithProfile = Policy & { profiles: { email: string; full_name: string } | null }

  for (const policy of policies as PolicyWithProfile[]) {
    if (!policy.expiry_date) continue
    const days = daysUntil(policy.expiry_date)
    const agentEmail = policy.profiles?.email

    // Check expired
    if (days <= 0 && !policy.alert_expired_sent) {
      await sendAlert(db, policy, days, 'expired', 'alert_expired_sent', agentEmail)
      alertsSent++
      continue
    }

    // Check thresholds
    for (const threshold of THRESHOLDS) {
      const field = `alert_${threshold}_sent` as keyof Policy
      if (days === threshold && !policy[field]) {
        await sendAlert(db, policy, days, `${threshold}_day`, `alert_${threshold}_sent`, agentEmail)
        alertsSent++
        break
      }
    }
  }

  return { processed: policies.length, alertsSent }
}

async function sendAlert(
  db: ReturnType<typeof createAdminClient>,
  policy: Policy,
  daysLeft: number,
  alertType: string,
  dbField: string,
  agentEmail?: string
) {
  const sentVia: string[] = []

  if (agentEmail) {
    try {
      const ok = await sendPolicyAlertEmail(policy, daysLeft, agentEmail)
      if (ok) sentVia.push('email')
    } catch {
      // Silently continue — log is stored below
    }
  }

  try {
    const waOk = await sendWhatsAppAlert(policy, daysLeft)
    if (waOk) sentVia.push('whatsapp')
  } catch {
    // WhatsApp is optional — continue
  }

  // Mark alert sent on the policy
  await db
    .from('policies')
    .update({ [dbField]: true })
    .eq('id', policy.id)

  // Log the alert
  await db.from('alert_logs').insert({
    policy_id: policy.id,
    user_id: policy.user_id,
    alert_type: alertType,
    sent_via: sentVia,
    message_preview: `${policy.holder_name ?? 'Unknown'} — ${policy.insurer_name ?? 'Unknown'} — ${daysLeft <= 0 ? 'EXPIRED' : `${daysLeft}d left`}`,
    status: sentVia.length > 0 ? 'sent' : 'failed',
  })
}

