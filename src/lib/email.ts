import { Resend } from 'resend'
import type { Policy } from '@/lib/types'

function getResendClient() {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY is not set')
  return new Resend(key)
}

const FROM = () => process.env.RESEND_FROM_EMAIL ?? 'PolicyVault <onboarding@resend.dev>'

function maskPAN(pan: string | null): string {
  if (!pan) return '—'
  return pan.slice(0, 2) + 'XXXXX' + pan.slice(-3)
}

function formatINR(n: number | null): string {
  if (n === null || n === undefined) return '—'
  return `₹${n.toLocaleString('en-IN')}`
}

function buildAlertEmail(policy: Policy, daysLeft: number): string {
  const urgencyColor = daysLeft <= 0 ? '#dc2626' : daysLeft <= 7 ? '#d97706' : '#1e3a5f'
  const urgencyText = daysLeft <= 0
    ? '🚨 POLICY HAS EXPIRED'
    : daysLeft === 1
    ? '⚠️ EXPIRES TOMORROW'
    : `⏰ ${daysLeft} days remaining`

  const vehicleSection = ['car', 'bike'].includes(policy.policy_type ?? '')
    ? `<tr><td style="padding:6px 0;color:#6b7280">Vehicle No.</td><td style="padding:6px 0;font-weight:600">${policy.vehicle_number ?? '—'}</td></tr>
       <tr><td style="padding:6px 0;color:#6b7280">Vehicle</td><td style="padding:6px 0">${[policy.vehicle_make, policy.vehicle_model, policy.vehicle_year].filter(Boolean).join(' ') || '—'}</td></tr>
       <tr><td style="padding:6px 0;color:#6b7280">IDV</td><td style="padding:6px 0">${formatINR(policy.idv_value)}</td></tr>`
    : ''

  const healthSection = policy.policy_type === 'health' && policy.family_members?.length
    ? `<tr><td colspan="2" style="padding:12px 0 4px 0;font-weight:600;color:#1e3a5f">Family Members</td></tr>
       ${policy.family_members.map(m => `<tr><td style="padding:2px 0;color:#6b7280">${m.relation}</td><td style="padding:2px 0">${m.name}${m.age ? ` (${m.age})` : ''}</td></tr>`).join('')}`
    : ''

  return `<!DOCTYPE html><html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,sans-serif">
  <div style="max-width:600px;margin:0 auto;padding:20px">
    <div style="background:#1e3a5f;padding:24px;border-radius:12px 12px 0 0;text-align:center">
      <h1 style="color:#f59e0b;margin:0;font-size:24px">🔐 PolicyVault</h1>
      <p style="color:#93c5fd;margin:8px 0 0">Policy Expiry Alert</p>
    </div>
    <div style="background:white;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0">
      <div style="background:${urgencyColor};color:white;padding:16px;border-radius:8px;text-align:center;margin-bottom:24px">
        <p style="margin:0;font-size:18px;font-weight:700">${urgencyText}</p>
        <p style="margin:8px 0 0;font-size:14px;opacity:0.9">Expiry Date: ${policy.expiry_date ?? 'Unknown'}</p>
      </div>

      <h2 style="color:#1e3a5f;font-size:18px;margin:0 0 16px">${policy.holder_name ?? 'Policy Holder'}</h2>
      <p style="color:#6b7280;margin:0 0 20px">📞 ${policy.holder_phone ?? '—'}</p>

      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#6b7280">Policy Number</td><td style="padding:6px 0;font-weight:600;font-family:monospace">${policy.policy_number ?? '—'}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Insurer</td><td style="padding:6px 0">${policy.insurer_name ?? '—'}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Plan</td><td style="padding:6px 0">${policy.plan_name ?? '—'}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Type</td><td style="padding:6px 0">${(policy.policy_type ?? '').toUpperCase()}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Sum Insured</td><td style="padding:6px 0">${formatINR(policy.sum_insured)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Premium</td><td style="padding:6px 0">${formatINR(policy.total_premium ?? policy.premium_amount)}</td></tr>
        ${vehicleSection}
        ${healthSection}
        <tr><td style="padding:6px 0;color:#6b7280">PAN</td><td style="padding:6px 0">${maskPAN(policy.holder_pan)}</td></tr>
      </table>

      <div style="margin-top:24px;text-align:center">
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://policyvault.vercel.app'}/policies/${policy.id}"
           style="background:#1e3a5f;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">
          View Policy in PolicyVault
        </a>
      </div>

      <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:24px">
        You are receiving this because you manage this policy in PolicyVault.
      </p>
    </div>
  </div>
</body></html>`
}

/**
 * Send an expiry alert email for a policy.
 * Returns true on success, false on failure.
 */
export async function sendPolicyAlertEmail(
  policy: Policy,
  daysLeft: number,
  toEmail: string
): Promise<boolean> {
  try {
    const resend = getResendClient()
    const subject = daysLeft <= 0
      ? `⚠️ EXPIRED: ${policy.holder_name ?? ''} — ${policy.policy_number ?? ''} | PolicyVault`
      : `⏰ ${daysLeft}d to expiry: ${policy.holder_name ?? ''} — ${policy.insurer_name ?? ''} | PolicyVault`

    const { error } = await resend.emails.send({
      from: FROM(),
      to: toEmail,
      subject,
      html: buildAlertEmail(policy, daysLeft),
    })

    if (error) {
      console.error('Email send error:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.error('Email error:', err instanceof Error ? err.message : 'unknown')
    return false
  }
}

/**
 * Send the monthly expiry register to the agent's email.
 */
export async function sendMonthlyRegisterEmail(
  toEmail: string,
  policyCount: number,
  monthLabel: string,
  xlsxBuffer: Buffer
): Promise<boolean> {
  try {
    const resend = getResendClient()
    await resend.emails.send({
      from: FROM(),
      to: toEmail,
      subject: `PolicyVault — Expiry Register (${monthLabel})`,
      html: `<p>Hello,</p><p>Attached is your expiry register for <b>${monthLabel}</b>. ${policyCount} ${policyCount === 1 ? 'policy expires' : 'policies expire'} this month.</p><p>— PolicyVault</p>`,
      attachments: [{
        filename: `Expiry_Register_${monthLabel.replace(/\s+/g, '_')}.xlsx`,
        content: xlsxBuffer.toString('base64'),
      }],
    })
    return true
  } catch {
    return false
  }
}
