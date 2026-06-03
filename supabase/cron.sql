-- Monthly expiry-register email job.
-- Replace <APP_URL> and <CRON_SECRET> with your real values before running.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Runs at 08:00 on the 1st of every month (UTC).
select cron.schedule(
  'policyvault-monthly-expiry',
  '0 8 1 * *',
  $$
  select net.http_post(
    url := '<APP_URL>/api/cron/monthly',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body := '{}'::jsonb
  );
  $$
);
