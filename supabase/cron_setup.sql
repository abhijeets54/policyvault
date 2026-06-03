-- ============================================================
-- PolicyVault Cron Jobs
-- Run this AFTER deploying to Vercel
-- Replace YOUR_VERCEL_URL and YOUR_CRON_SECRET with real values
-- ============================================================

-- Daily alert check at 8:00 AM IST = 2:30 AM UTC
SELECT cron.schedule(
  'daily-policy-alerts',
  '30 2 * * *',
  format(
    $$SELECT net.http_post(
      url := %L,
      headers := %L::jsonb,
      body := %L::jsonb
    )$$,
    'https://YOUR_VERCEL_URL/api/cron/alerts',
    json_build_object('Content-Type', 'application/json', 'x-cron-secret', 'YOUR_CRON_SECRET'),
    '{}'::json
  )
);

-- Mark expired policies daily at 1 AM UTC
SELECT cron.schedule(
  'mark-expired-policies',
  '0 1 * * *',
  'SELECT public.mark_expired_policies()'
);

-- Monthly expiry register email on 1st of each month at 8:00 AM IST = 2:30 AM UTC
SELECT cron.schedule(
  'monthly-expiry-register',
  '30 2 1 * *',
  format(
    $$SELECT net.http_post(
      url := %L,
      headers := %L::jsonb,
      body := %L::jsonb
    )$$,
    'https://YOUR_VERCEL_URL/api/cron/monthly',
    json_build_object('Content-Type', 'application/json', 'x-cron-secret', 'YOUR_CRON_SECRET'),
    '{}'::json
  )
);
