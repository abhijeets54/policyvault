# PolicyVault

A multi-agent insurance policy management web app. Agents upload policy PDFs; AI (Gemini → Groq fallback) extracts the key fields; agents review/confirm and save. Each agent's data is fully isolated via Supabase Row Level Security. At the start of every month, a prominent banner lets agents download an Excel/PDF expiry register for that month, and a scheduled job emails the same register automatically.

- **Stack:** Next.js 14 (App Router, TypeScript) · Tailwind + shadcn/ui · Supabase (Auth, DB, Storage, pg_cron) · Google Gemini 2.5 Flash · Groq Llama 4 Scout · Resend · `xlsx` + `jsPDF` · PWA
- **Auth:** Email + password only. Users are created manually by the admin (no public sign-up).
- **Hosting:** Vercel (free hobby tier).

---

## 1. Prerequisites

- Node.js 20+
- A free [Supabase](https://supabase.com) project
- API keys: [Google AI Studio](https://aistudio.google.com/) (Gemini), [Groq](https://console.groq.com), [Resend](https://resend.com)

## 2. Install

```bash
npm install
cp .env.example .env.local
# fill in .env.local (see below)
```

### Environment variables (`.env.local`)

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...      # keep secret, server-only

GEMINI_API_KEY=...
GROQ_API_KEY=...

RESEND_API_KEY=...
RESEND_FROM="PolicyVault <onboarding@resend.dev>"

CRON_SECRET=any-long-random-string  # shared with pg_cron

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 3. Set up Supabase

1. In **SQL Editor**, run `supabase/schema.sql`. This creates the `policies` table, RLS policies, the private `policies` Storage bucket, and storage policies that scope every upload to the user's own folder.
2. In **Authentication → Providers → Email**, **disable public sign-ups** (uncheck "Enable sign-ups"). Keep email/password enabled. Disable every social provider.
3. (Optional, recommended) In **Authentication → URL configuration**, set the Site URL to your deployed app URL.
4. In **SQL Editor**, open `supabase/cron.sql`, replace `<APP_URL>` with your deployed URL (e.g. `https://policyvault.vercel.app`) and `<CRON_SECRET>` with the same value as in `.env.local`, then run it. This schedules the monthly expiry-register email for 08:00 UTC on the 1st of each month.

## 4. Create your first agent (user)

```bash
npm run create-user -- agent@example.com 'AStrongPassword!'
```

Or in the Supabase dashboard: **Authentication → Users → Add user → "Create new user"** with "Auto Confirm User" checked.

## 5. Run locally

```bash
npm run dev
# open http://localhost:3000 and sign in
```

## 6. Deploy

1. Push the repo to GitHub.
2. Import into Vercel.
3. Add **every** variable from `.env.local` in **Vercel → Project → Settings → Environment Variables** (set `NEXT_PUBLIC_APP_URL` to the deployed URL).
4. Deploy. Then update `supabase/cron.sql` with the deployed URL and re-run if you used a placeholder earlier.

---

## How it works

- **Auth gate:** `middleware.ts` redirects unauthenticated requests to `/login`. The `/api/cron/*` and PWA routes are exceptions.
- **Upload flow:** `(app)/policies/new` uploads the PDF to Storage at `<user_id>/<uuid>.pdf`, then POSTs the file to `/api/extract`. The route runs Gemini (native PDF understanding) first; if it returns too few fields or errors, it falls back to `pdf-parse` + Groq Llama 4 Scout. The extracted JSON is shown in a form for the agent to confirm/correct, then saved via `/api/policies` (inherits `auth.uid()`; RLS enforces ownership).
- **Expiry register:** the dashboard shows a "Download this month's expiry register" banner with Excel and PDF buttons (emphasized during days 1–7). Server route `/api/export?format=xlsx|pdf` builds the file from the current month's `end_date` rows for the signed-in user only.
- **Monthly automation:** pg_cron POSTs to `/api/cron/monthly` with `x-cron-secret`. The route uses the service role key to enumerate agents, build a per-agent register, and email it via Resend.
- **PWA:** `public/manifest.webmanifest` + a custom service worker (`public/sw.js`) registered in `src/app/providers.tsx`. Installable from Chrome / Safari.
- **Security:** RLS on every table; private Storage bucket with `auth.uid()`-scoped policies; service-role key only in server routes; signed URLs (30 min) for PDF viewing; strict CSP, `X-Frame-Options: DENY`, and other security headers in `next.config.mjs`; Zod validation on every API input; per-user/IP in-memory rate-limit on `/api/extract` (swap for Redis/Upstash in production).

## Project layout

```text
src/
  app/
    layout.tsx, providers.tsx, globals.css
    login/page.tsx
    (app)/
      layout.tsx                 authed shell
      page.tsx                   dashboard + ExpiryBanner
      policies/page.tsx          list
      policies/new/page.tsx      upload + extract + confirm
      policies/[id]/page.tsx     detail / edit / delete
    api/
      extract/route.ts           Gemini → Groq pipeline
      policies/route.ts          create
      policies/[id]/route.ts     update / delete
      export/route.ts            xlsx + pdf
      cron/monthly/route.ts      Resend dispatch
  components/                    ExpiryBanner, PolicyForm, etc.
  components/ui/                 shadcn primitives
  lib/
    supabase/{client,server,admin}.ts
    ai/{gemini,groq,extract}.ts
    pdf/parse.ts
    export/{excel,pdf}.ts
    email/resend.ts
    pwa/register.ts
    schemas.ts  types.ts  utils.ts
middleware.ts                    auth gate
public/manifest.webmanifest      PWA manifest
public/sw.js                     service worker
public/icons/icon-{192,512}.png  placeholder icons (replace with your logo)
supabase/schema.sql              tables + RLS + storage policies
supabase/cron.sql                monthly pg_cron job
scripts/create-user.ts           admin helper
```

## Notes & caveats

- WhatsApp/WAHA support is **not** included by request — email-only via Resend.
- Replace the placeholder PNGs in `public/icons/` with your real app icons before publishing.
- The in-memory rate limiter on `/api/extract` resets on every serverless instance. For real traffic, move it to Upstash Redis or Supabase.
- Tested on Node 20 + Next.js 14.2. If you hit issues with `pdf-parse` on serverless, you can disable the fallback by editing `src/lib/ai/extract.ts`.

## License

MIT — do what you want, no warranty.
