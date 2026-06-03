import type { Policy } from '@/lib/types'

/**
 * Send a WhatsApp alert via WAHA (self-hosted).
 * Returns true if sent, false if skipped or failed.
 * Graceful no-op when WAHA_API_URL is not configured.
 */
export async function sendWhatsAppAlert(policy: Policy, daysLeft: number): Promise<boolean> {
  const wahaUrl = process.env.WAHA_API_URL
  const wahaKey = process.env.WAHA_API_KEY
  const sessionName = process.env.WAHA_SESSION_NAME || 'default'

  if (!wahaUrl || !policy.holder_phone) return false

  const phone = policy.holder_phone.replace(/\D/g, '')
  if (phone.length < 10) return false

  const chatId = phone.length === 10 ? `91${phone}@c.us` : `${phone}@c.us`

  const daysLabel = daysLeft <= 0
    ? '⚠️ EXPIRED'
    : daysLeft === 1
    ? '⚠️ EXPIRES TOMORROW'
    : `⏰ ${daysLeft} days remaining`

  const message = [
    `*PolicyVault Alert* 📋`,
    ``,
    `Hello ${policy.holder_name ?? 'there'},`,
    ``,
    `Your ${(policy.policy_type ?? 'insurance').toUpperCase()} policy is expiring soon:`,
    ``,
    `• *Policy #:* ${policy.policy_number ?? 'N/A'}`,
    `• *Insurer:* ${policy.insurer_name ?? 'N/A'}`,
    `• *Expiry:* ${policy.expiry_date ?? 'N/A'}`,
    `• *Status:* ${daysLabel}`,
    ``,
    `Please renew at the earliest to avoid a coverage gap.`,
  ].join('\n')

  try {
    const res = await fetch(`${wahaUrl}/api/sendText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(wahaKey ? { 'X-Api-Key': wahaKey } : {}),
      },
      body: JSON.stringify({
        session: sessionName,
        chatId,
        text: message,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}
