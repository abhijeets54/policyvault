# 🤖 AI BUILD PROMPT — PolicyVault v2
## Insurance Policy Management System

> **How to use this prompt**: Copy everything below this line and paste it into Claude, Cursor, or any AI coding assistant. The AI will build the complete application. You only need to provide API keys and run commands it tells you.

---

## WHAT YOU ARE BUILDING

**PolicyVault** is a multi-client insurance policy management web application. Multiple independent insurance agents/brokers use it — each agent sees ONLY their own policies. The app:

1. Lets agents upload any insurance policy PDF
2. Uses AI (Gemini + Groq dual pipeline) to read the PDF and extract key fields
3. Shows the agent what was extracted and asks them to confirm or correct before saving
4. Stores all policies in a database, organized per agent/user
5. At the start of every month, prominently shows a "Download this month's expiry register" button that downloads an Excel/PDF list of all policies expiring that month
6. Is installable on mobile and desktop like a native app (PWA — Progressive Web App)
7. Has maximum security — insurance data is extremely sensitive

**Key constraints:**
- 100% free to build and run
- No social logins (Google, Facebook etc.) — only email + password
- Users (agents) are created manually by the admin in Supabase, not via public sign-up
- Each client/agent's data is completely isolated from others via Row Level Security
- Must be installable as a PWA from Chrome (works like a phone app)

---

## TECH STACK — DO NOT DEVIATE

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Auth | Supabase Auth — email + password ONLY, no social providers |
| Database | Supabase (PostgreSQL) with Row Level Security |
| Storage | Supabase Storage (private bucket) |
| AI Primary | Google Gemini 2.5 Flash (`@google/generative-ai`) — native PDF understanding |
| AI Fallback | Groq (`groq-sdk`) — Llama 4 Scout with vision, for fallback and text cleanup |
| PDF text extraction | `pdf-parse` npm — for text-native PDF pre-processing |
| Scheduled jobs | Supabase pg_cron (built-in) |
| Email | Resend (free — 3,000/month) |
| WhatsApp | WAHA self-hosted (free, Docker) |
| Excel export | `xlsx` npm (SheetJS) |
| PDF export | `jspdf` + `jspdf-autotable` npm |
| PWA | Next.js built-in manifest + custom service worker |
| Hosting | Vercel (free hobby tier) |

---

## ENVIRONMENT VARIABLES

Create `.env.local` with all of these. Also create `.env.example` with the same keys but empty values:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI — Primary (Gemini)
GEMINI_API_KEY=

# AI — Fallback (Groq)
GROQ_API_KEY=

# Email (Resend)
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# WhatsApp (WAHA — optional)
WAHA_API_URL=
WAHA_API_KEY=
WAHA_SESSION_NAME=default

# App config
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=
```

---

## SUPABASE SCHEMA

### File: `supabase/migrations/001_schema.sql`

Run this ENTIRE file in the Supabase SQL Editor:

```sql
-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================================
-- PROFILES TABLE
-- Links to Supabase auth.users
-- Admin creates users manually in Supabase Auth dashboard
-- ============================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  company_name TEXT,  -- Agent's company / firm name
  phone TEXT,
  role TEXT DEFAULT 'agent' CHECK (role IN ('agent', 'admin')),
  is_active BOOLEAN DEFAULT true
);

-- Auto-create profile when a new Supabase Auth user is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- POLICIES TABLE
-- Each row belongs to one user (agent) via user_id
-- ============================================================
CREATE TABLE policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- OWNERSHIP — every policy belongs to one agent
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- ── POLICYHOLDER PERSONAL DETAILS ──────────────────────
  holder_name TEXT,
  holder_phone TEXT,
  holder_email TEXT,
  holder_dob DATE,
  holder_address TEXT,
  holder_pan TEXT,

  -- ── POLICY CORE INFO ────────────────────────────────────
  policy_number TEXT,
  insurer_name TEXT,
  policy_type TEXT CHECK (
    policy_type IN (
      'health', 'car', 'bike', 'life',
      'home', 'travel', 'commercial', 'fire', 'marine', 'other'
    )
  ),
  plan_name TEXT,

  -- ── FINANCIAL ───────────────────────────────────────────
  sum_insured NUMERIC,
  premium_amount NUMERIC,
  premium_frequency TEXT,
  gst_amount NUMERIC,
  total_premium NUMERIC,

  -- ── CRITICAL DATES ──────────────────────────────────────
  issue_date DATE,
  start_date DATE,
  expiry_date DATE,        -- ← most important field

  -- ── VEHICLE FIELDS (car / bike only) ────────────────────
  vehicle_number TEXT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year INTEGER,
  idv_value NUMERIC,
  engine_number TEXT,
  chassis_number TEXT,

  -- ── HEALTH FIELDS ───────────────────────────────────────
  family_members JSONB DEFAULT '[]'::jsonb,
  -- format: [{"name":"string","dob":"YYYY-MM-DD","relation":"string","age":number}]
  sum_insured_per_member NUMERIC,

  -- ── LIFE FIELDS ─────────────────────────────────────────
  nominee_name TEXT,
  nominee_relation TEXT,
  death_benefit NUMERIC,
  policy_term TEXT,
  premium_paying_term TEXT,

  -- ── METADATA ────────────────────────────────────────────
  raw_pdf_url TEXT,
  raw_pdf_path TEXT,            -- Supabase Storage path (for deletion)
  extracted_fields JSONB DEFAULT '{}'::jsonb, -- full raw AI response
  extraction_confidence TEXT CHECK (extraction_confidence IN ('high', 'medium', 'low')),
  notes TEXT,
  status TEXT DEFAULT 'active' CHECK (
    status IN ('active', 'expired', 'cancelled', 'lapsed', 'pending')
  ),

  -- ── ALERT TRACKING ──────────────────────────────────────
  alert_90_sent BOOLEAN DEFAULT false,
  alert_60_sent BOOLEAN DEFAULT false,
  alert_30_sent BOOLEAN DEFAULT false,
  alert_15_sent BOOLEAN DEFAULT false,
  alert_7_sent BOOLEAN DEFAULT false,
  alert_3_sent BOOLEAN DEFAULT false,
  alert_1_sent BOOLEAN DEFAULT false,
  alert_expired_sent BOOLEAN DEFAULT false
);

-- ── ALERT LOGS ───────────────────────────────────────────────
CREATE TABLE alert_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID REFERENCES policies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type TEXT,
  sent_via TEXT[],
  message_preview TEXT,
  sent_at TIMESTAMPTZ DEFAULT now(),
  status TEXT CHECK (status IN ('sent', 'failed', 'skipped'))
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_policies_user_id ON policies(user_id);
CREATE INDEX idx_policies_expiry_date ON policies(expiry_date);
CREATE INDEX idx_policies_status ON policies(status);
CREATE INDEX idx_policies_user_expiry ON policies(user_id, expiry_date);
CREATE INDEX idx_policies_type ON policies(policy_type);

-- ============================================================
-- AUTO-UPDATE updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_policies_updated_at
  BEFORE UPDATE ON policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- AUTO-EXPIRE POLICIES
-- ============================================================
CREATE OR REPLACE FUNCTION mark_expired_policies()
RETURNS void AS $$
BEGIN
  UPDATE policies
  SET status = 'expired'
  WHERE expiry_date < CURRENT_DATE AND status = 'active';
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ROW LEVEL SECURITY — MAXIMUM SECURITY
-- Each user can only see and touch their OWN policies
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update only their own profile
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Policies: users can only CRUD their own policies
CREATE POLICY "policies_select_own"
  ON policies FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "policies_insert_own"
  ON policies FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "policies_update_own"
  ON policies FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "policies_delete_own"
  ON policies FOR DELETE USING (auth.uid() = user_id);

-- Alert logs: users can only see their own
CREATE POLICY "alert_logs_select_own"
  ON alert_logs FOR SELECT USING (auth.uid() = user_id);

-- Service role bypasses RLS (for cron jobs and admin operations)
-- No need to add policies for service_role — it bypasses RLS by default

-- ============================================================
-- SUPABASE AUTH SETTINGS (run separately in Dashboard)
-- ============================================================
-- In Supabase Dashboard → Authentication → Providers:
-- 1. Enable "Email" provider
-- 2. DISABLE "Confirm email" (agents don't check email for confirmation)
-- 3. DISABLE all other providers (Google, GitHub, etc.)
-- In Dashboard → Authentication → URL Configuration:
-- Set Site URL to your Vercel URL
```

### File: `supabase/cron_setup.sql`

Run this AFTER deploying to Vercel:

```sql
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
  'SELECT mark_expired_policies()'
);
```

---

## COMPLETE FILE STRUCTURE

Build EVERY file listed below:

```
policyvault/
│
├── public/
│   ├── manifest.json               ← PWA manifest
│   ├── sw.js                       ← Service worker
│   ├── icon-192x192.png            ← PWA icon (navy blue shield)
│   ├── icon-512x512.png            ← PWA icon large
│   └── icons/
│       └── apple-touch-icon.png    ← iOS icon
│
├── supabase/
│   ├── migrations/001_schema.sql
│   └── cron_setup.sql
│
├── lib/
│   ├── types.ts                    ← All TypeScript interfaces
│   ├── supabase-server.ts          ← Server-side Supabase client (cookies)
│   ├── supabase-client.ts          ← Browser Supabase client
│   ├── supabase-admin.ts           ← Service role client (API routes only)
│   ├── ai-extractor.ts             ← Dual AI pipeline (Gemini + Groq)
│   ├── email.ts                    ← Resend email sender
│   ├── whatsapp.ts                 ← WAHA WhatsApp sender
│   ├── alerts.ts                   ← Alert scheduling logic
│   └── monthly-register.ts         ← Monthly expiry report generator
│
├── app/
│   ├── layout.tsx                  ← Root layout (includes PWA tags)
│   ├── globals.css
│   ├── manifest.ts                 ← Next.js App Router manifest
│   │
│   ├── login/
│   │   └── page.tsx                ← Login page (email + password)
│   │
│   ├── (protected)/                ← Route group — requires auth
│   │   ├── layout.tsx              ← Checks auth, renders sidebar
│   │   │
│   │   ├── dashboard/
│   │   │   └── page.tsx            ← Home dashboard
│   │   │
│   │   ├── upload/
│   │   │   └── page.tsx            ← Upload PDF + verification flow
│   │   │
│   │   ├── policies/
│   │   │   ├── page.tsx            ← All policies table
│   │   │   └── [id]/
│   │   │       └── page.tsx        ← Single policy detail
│   │   │
│   │   ├── register/
│   │   │   └── page.tsx            ← Monthly expiry register page
│   │   │
│   │   ├── alerts/
│   │   │   └── page.tsx            ← Alert history
│   │   │
│   │   └── profile/
│   │       └── page.tsx            ← Agent profile/settings
│   │
│   └── api/
│       ├── auth/
│       │   └── signout/route.ts
│       ├── extract/
│       │   └── route.ts            ← Upload PDF → AI extract
│       ├── policies/
│       │   ├── route.ts            ← GET all, POST create
│       │   └── [id]/
│       │       └── route.ts        ← GET one, PATCH, DELETE
│       ├── export/
│       │   ├── excel/route.ts      ← Download full Excel export
│       │   └── monthly/route.ts    ← Monthly register download
│       └── cron/
│           └── alerts/route.ts     ← Called by Supabase cron
│
├── components/
│   ├── ui/                         ← shadcn/ui (auto-generated)
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── MobileNav.tsx
│   │   └── Header.tsx
│   ├── auth/
│   │   └── LoginForm.tsx
│   ├── policies/
│   │   ├── PolicyTable.tsx
│   │   ├── PolicyCard.tsx
│   │   ├── PolicyTypeBadge.tsx
│   │   └── StatusBadge.tsx
│   ├── upload/
│   │   ├── DropZone.tsx
│   │   ├── ExtractionLoader.tsx    ← Animated AI scanning loader
│   │   └── VerificationForm.tsx    ← Review extracted data before saving
│   ├── dashboard/
│   │   ├── StatsRow.tsx
│   │   ├── ExpiryChart.tsx
│   │   ├── MonthlyRegisterBanner.tsx  ← Shows at start of month
│   │   └── ExpiringTable.tsx
│   └── PwaInstallBanner.tsx        ← "Install this app" prompt
│
├── hooks/
│   ├── useAuth.ts                  ← Auth state hook
│   └── usePwaInstall.ts            ← PWA install prompt hook
│
├── middleware.ts                   ← Auth guard for all protected routes
├── next.config.js                  ← Security headers + config
├── tailwind.config.ts
└── package.json
```

---

## DETAILED IMPLEMENTATION

### 1. `lib/types.ts`

```typescript
export type PolicyType =
  | 'health' | 'car' | 'bike' | 'life'
  | 'home' | 'travel' | 'commercial' | 'fire' | 'marine' | 'other'

export type PolicyStatus = 'active' | 'expired' | 'cancelled' | 'lapsed' | 'pending'

export interface FamilyMember {
  name: string
  dob: string | null
  relation: 'self' | 'spouse' | 'son' | 'daughter' | 'father' | 'mother' | 'other'
  age: number | null
}

export interface Policy {
  id: string
  created_at: string
  updated_at: string
  user_id: string
  // Holder
  holder_name: string | null
  holder_phone: string | null
  holder_email: string | null
  holder_dob: string | null
  holder_address: string | null
  holder_pan: string | null
  // Policy
  policy_number: string | null
  insurer_name: string | null
  policy_type: PolicyType | null
  plan_name: string | null
  // Financial
  sum_insured: number | null
  premium_amount: number | null
  premium_frequency: string | null
  gst_amount: number | null
  total_premium: number | null
  // Dates
  issue_date: string | null
  start_date: string | null
  expiry_date: string | null
  // Vehicle
  vehicle_number: string | null
  vehicle_make: string | null
  vehicle_model: string | null
  vehicle_year: number | null
  idv_value: number | null
  engine_number: string | null
  chassis_number: string | null
  // Health
  family_members: FamilyMember[]
  sum_insured_per_member: number | null
  // Life
  nominee_name: string | null
  nominee_relation: string | null
  death_benefit: number | null
  policy_term: string | null
  premium_paying_term: string | null
  // Meta
  raw_pdf_url: string | null
  raw_pdf_path: string | null
  extracted_fields: Record<string, unknown>
  extraction_confidence: 'high' | 'medium' | 'low' | null
  notes: string | null
  status: PolicyStatus
  // Alerts
  alert_90_sent: boolean
  alert_60_sent: boolean
  alert_30_sent: boolean
  alert_15_sent: boolean
  alert_7_sent: boolean
  alert_3_sent: boolean
  alert_1_sent: boolean
  alert_expired_sent: boolean
}

export interface Profile {
  id: string
  created_at: string
  full_name: string
  email: string
  company_name: string | null
  phone: string | null
  role: 'agent' | 'admin'
  is_active: boolean
}

// What the AI returns after extracting from PDF
export interface ExtractedPolicyData {
  holder_name: string | null
  holder_phone: string | null
  holder_email: string | null
  holder_dob: string | null
  holder_address: string | null
  holder_pan: string | null
  policy_number: string | null
  insurer_name: string | null
  policy_type: PolicyType | null
  plan_name: string | null
  sum_insured: number | null
  premium_amount: number | null
  premium_frequency: string | null
  gst_amount: number | null
  total_premium: number | null
  issue_date: string | null
  start_date: string | null
  expiry_date: string | null
  vehicle_number: string | null
  vehicle_make: string | null
  vehicle_model: string | null
  vehicle_year: number | null
  idv_value: number | null
  engine_number: string | null
  chassis_number: string | null
  family_members: FamilyMember[]
  sum_insured_per_member: number | null
  nominee_name: string | null
  nominee_relation: string | null
  death_benefit: number | null
  policy_term: string | null
  premium_paying_term: string | null
  extraction_confidence: 'high' | 'medium' | 'low'
  extraction_notes: string | null  // AI notes any issues
}
```

---

### 2. Supabase Clients

**`lib/supabase-server.ts`** — for Server Components and API routes that need user context:
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createSupabaseServerClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

**`lib/supabase-client.ts`** — for Client Components:
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**`lib/supabase-admin.ts`** — for API routes that need to bypass RLS (cron jobs):
```typescript
import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
```

---

### 3. `middleware.ts` — Auth Guard

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublicPath = pathname.startsWith('/login') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icon') ||
    pathname.startsWith('/sw.js') ||
    pathname === '/manifest.json'

  if (!user && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.png$|.*\\.ico$).*)'],
}
```

---

### 4. `lib/ai-extractor.ts` — THE DUAL AI PIPELINE

This is the core engine. It tries Gemini first (best for PDFs), falls back to Groq:

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'
import Groq from 'groq-sdk'
import type { ExtractedPolicyData } from './types'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

// ──────────────────────────────────────────────
// THE EXTRACTION PROMPT — used for BOTH AI models
// ──────────────────────────────────────────────
const EXTRACTION_PROMPT = `
You are an expert insurance document parser for Indian insurance policies.
Analyze this insurance policy document carefully and extract all available information.

STRICT RULES:
1. Return ONLY valid JSON — no explanation, no markdown fences, no preamble.
2. If a field is not found in the document, return null for that field.
3. ALL dates must be in "YYYY-MM-DD" format. Convert from any Indian format (DD/MM/YYYY, DD-MMM-YYYY, etc.).
4. ALL monetary amounts must be plain numbers (no ₹ sign, no commas). Example: 500000 not ₹5,00,000.
5. policy_type must be exactly one of: health, car, bike, life, home, travel, commercial, fire, marine, other.
6. For health policies: list ALL insured family members in family_members array.
7. For motor (car/bike) policies: extract vehicle_number carefully — it's usually a registration number like MH12AB1234.
8. insurer_name = full official name of the insurance company.
9. extraction_confidence: "high" if you can read everything clearly, "medium" if some parts were unclear, "low" if you struggled.
10. extraction_notes: note anything unusual, fields that looked ambiguous, or data you are unsure about.

RETURN THIS EXACT JSON STRUCTURE:
{
  "holder_name": "Full name of primary insured person",
  "holder_phone": "10-digit mobile number or null",
  "holder_email": "email or null",
  "holder_dob": "YYYY-MM-DD or null",
  "holder_address": "full address or null",
  "holder_pan": "PAN number or null",
  "policy_number": "policy number string",
  "insurer_name": "full insurance company name",
  "policy_type": "health|car|bike|life|home|travel|commercial|fire|marine|other",
  "plan_name": "product/plan name",
  "sum_insured": number or null,
  "premium_amount": number or null,
  "premium_frequency": "annual|half-yearly|quarterly|monthly|single or null",
  "gst_amount": number or null,
  "total_premium": number or null,
  "issue_date": "YYYY-MM-DD or null",
  "start_date": "YYYY-MM-DD or null",
  "expiry_date": "YYYY-MM-DD or null",
  "vehicle_number": "registration number or null",
  "vehicle_make": "brand/manufacturer or null",
  "vehicle_model": "model name or null",
  "vehicle_year": integer or null,
  "idv_value": number or null,
  "engine_number": "or null",
  "chassis_number": "or null",
  "family_members": [
    {"name":"string","dob":"YYYY-MM-DD or null","relation":"self|spouse|son|daughter|father|mother|other","age":number or null}
  ],
  "sum_insured_per_member": number or null,
  "nominee_name": "for life policies or null",
  "nominee_relation": "or null",
  "death_benefit": number or null,
  "policy_term": "e.g. 20 years or null",
  "premium_paying_term": "e.g. 15 years or null",
  "extraction_confidence": "high|medium|low",
  "extraction_notes": "any notes about ambiguous data, or null"
}
`

// Clean JSON from AI response (remove markdown fences if AI adds them)
function cleanJSON(text: string): string {
  return text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

// Parse and validate JSON from AI
function parseExtractionResult(text: string): ExtractedPolicyData {
  const clean = cleanJSON(text)
  try {
    return JSON.parse(clean) as ExtractedPolicyData
  } catch {
    // Try to find JSON object in the response
    const match = clean.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0]) as ExtractedPolicyData
    throw new Error('AI returned malformed JSON')
  }
}

// ──────────────────────────────────────────────
// PRIMARY: Gemini 2.5 Flash — handles PDFs natively
// ──────────────────────────────────────────────
async function extractWithGemini(pdfBase64: string): Promise<ExtractedPolicyData> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const result = await model.generateContent([
    {
      inlineData: { data: pdfBase64, mimeType: 'application/pdf' },
    },
    EXTRACTION_PROMPT,
  ])

  return parseExtractionResult(result.response.text())
}

// ──────────────────────────────────────────────
// FALLBACK: Groq with Llama 4 Scout vision
// Converts PDF pages to images and sends to Groq
// ──────────────────────────────────────────────
async function extractWithGroq(pdfBase64: string): Promise<ExtractedPolicyData> {
  // For Groq, we send the base64 PDF as an image (first page)
  // Groq's Llama 4 Scout supports image input
  const response = await groq.chat.completions.create({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:application/pdf;base64,${pdfBase64}`,
            },
          },
          {
            type: 'text',
            text: EXTRACTION_PROMPT,
          },
        ] as Parameters<typeof groq.chat.completions.create>[0]['messages'][0]['content'],
      },
    ],
    max_tokens: 2000,
    temperature: 0.1,
  })

  const text = response.choices[0]?.message?.content || ''
  return parseExtractionResult(text)
}

// ──────────────────────────────────────────────
// MAIN EXPORT — tries Gemini, falls back to Groq
// ──────────────────────────────────────────────
export async function extractPolicyFromPDF(
  pdfBuffer: Buffer
): Promise<ExtractedPolicyData & { ai_model_used: string }> {
  const pdfBase64 = pdfBuffer.toString('base64')

  // Try Gemini first
  try {
    const result = await extractWithGemini(pdfBase64)
    return { ...result, ai_model_used: 'gemini-2.5-flash' }
  } catch (geminiError) {
    console.warn('Gemini extraction failed, trying Groq:', geminiError)
  }

  // Fall back to Groq
  try {
    const result = await extractWithGroq(pdfBase64)
    return { ...result, ai_model_used: 'groq-llama-4-scout' }
  } catch (groqError) {
    console.error('Both AI extractors failed:', groqError)
    // Return empty extraction so user can fill manually
    return {
      holder_name: null, holder_phone: null, holder_email: null,
      holder_dob: null, holder_address: null, holder_pan: null,
      policy_number: null, insurer_name: null, policy_type: null,
      plan_name: null, sum_insured: null, premium_amount: null,
      premium_frequency: null, gst_amount: null, total_premium: null,
      issue_date: null, start_date: null, expiry_date: null,
      vehicle_number: null, vehicle_make: null, vehicle_model: null,
      vehicle_year: null, idv_value: null, engine_number: null,
      chassis_number: null, family_members: [], sum_insured_per_member: null,
      nominee_name: null, nominee_relation: null, death_benefit: null,
      policy_term: null, premium_paying_term: null,
      extraction_confidence: 'low',
      extraction_notes: 'Automatic extraction failed. Please fill in the details manually.',
      ai_model_used: 'none',
    }
  }
}
```

---

### 5. `app/api/extract/route.ts` — Upload + Extract

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { extractPolicyFromPDF } from '@/lib/ai-extractor'

export async function POST(req: NextRequest) {
  // 1. Verify auth
  const supabase = createSupabaseServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
    if (file.type !== 'application/pdf')
      return NextResponse.json({ error: 'File must be PDF' }, { status: 400 })
    if (file.size > 25 * 1024 * 1024)
      return NextResponse.json({ error: 'File too large (max 25MB)' }, { status: 400 })

    // 2. Upload PDF to Supabase Storage (in user's own folder for isolation)
    const buffer = Buffer.from(await file.arrayBuffer())
    const fileName = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
      .from('policies')
      .upload(fileName, buffer, { contentType: 'application/pdf', upsert: false })

    const pdfPath = uploadData?.path || null
    let pdfUrl: string | null = null
    if (pdfPath) {
      const { data: urlData } = supabaseAdmin.storage
        .from('policies')
        .getPublicUrl(pdfPath)
      pdfUrl = urlData?.publicUrl || null
    }

    // 3. Run AI extraction
    const extracted = await extractPolicyFromPDF(buffer)

    // 4. Return extraction result for user to review — DO NOT SAVE YET
    return NextResponse.json({
      success: true,
      extracted,
      pdfUrl,
      pdfPath,
      requiresConfirmation: true,  // Always true — user must review before saving
    })
  } catch (err) {
    console.error('Extract error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Extraction failed' },
      { status: 500 }
    )
  }
}
```

---

### 6. `app/api/policies/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')
  const type = searchParams.get('type')
  const status = searchParams.get('status')
  const month = searchParams.get('month')  // "YYYY-MM" for monthly register
  const year = searchParams.get('year')

  // RLS ensures user only gets their own policies
  let query = supabase
    .from('policies')
    .select('*')
    .order('expiry_date', { ascending: true })

  if (search) {
    query = query.or(
      `holder_name.ilike.%${search}%,policy_number.ilike.%${search}%,` +
      `holder_phone.ilike.%${search}%,vehicle_number.ilike.%${search}%`
    )
  }
  if (type && type !== 'all') query = query.eq('policy_type', type)
  if (status && status !== 'all') query = query.eq('status', status)

  // Monthly register filter: policies expiring in the given month
  if (month && year) {
    const startDate = `${year}-${month.padStart(2, '0')}-01`
    const endDate = new Date(parseInt(year), parseInt(month), 0)
      .toISOString().split('T')[0]
    query = query.gte('expiry_date', startDate).lte('expiry_date', endDate)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ policies: data, count: data?.length || 0 })
}

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  // Force user_id to the authenticated user — never trust client
  const { data, error } = await supabase
    .from('policies')
    .insert({ ...body, user_id: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ policy: data }, { status: 201 })
}
```

---

### 7. `app/api/policies/[id]/route.ts`

GET, PATCH, DELETE — RLS automatically ensures users can only access their own policies:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // RLS ensures they can only get their own policy
  const { data, error } = await supabase
    .from('policies').select('*').eq('id', params.id).single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ policy: data })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  // Remove user_id from body so user cannot change ownership
  delete body.user_id
  delete body.id

  const { data, error } = await supabase
    .from('policies').update(body).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ policy: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get policy to delete PDF from storage
  const { data: policy } = await supabase
    .from('policies').select('raw_pdf_path').eq('id', params.id).single()

  if (policy?.raw_pdf_path) {
    await supabaseAdmin.storage.from('policies').remove([policy.raw_pdf_path])
  }

  const { error } = await supabase.from('policies').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

---

### 8. `lib/email.ts` — Resend Email with HTML Template

Build a clean HTML email with:
- Navy/amber color scheme matching the app
- Policy holder name, phone prominently displayed
- Policy number, insurer, plan name
- Expiry date in large red text
- Days remaining in bold
- Vehicle number (if motor policy)
- Family members table (if health policy)
- Link to view the policy in PolicyVault

Use `resend.emails.send()` from the `resend` package. FROM: `process.env.RESEND_FROM_EMAIL`. TO: the agent's registered email (`user.email` from Supabase auth, fetched via the admin client using `user_id`).

---

### 9. `lib/monthly-register.ts` — Monthly Report Generator

```typescript
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Policy } from './types'

export function generateMonthlyExcel(policies: Policy[], monthName: string, year: number): Buffer {
  const rows = policies.map((p, i) => ({
    'Sr.': i + 1,
    'Client Name': p.holder_name || 'N/A',
    'Phone': p.holder_phone || 'N/A',
    'Policy Number': p.policy_number || 'N/A',
    'Insurer': p.insurer_name || 'N/A',
    'Type': (p.policy_type || 'N/A').toUpperCase(),
    'Plan': p.plan_name || 'N/A',
    'Sum Insured (₹)': p.sum_insured ? p.sum_insured.toLocaleString('en-IN') : 'N/A',
    'Premium (₹)': (p.total_premium || p.premium_amount)
      ? (p.total_premium || p.premium_amount)!.toLocaleString('en-IN') : 'N/A',
    'Expiry Date': p.expiry_date
      ? new Date(p.expiry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'N/A',
    'Vehicle No.': p.vehicle_number || '—',
    'Members': p.family_members?.length
      ? p.family_members.map(m => m.name).join(', ')
      : '—',
    'Status': p.status.toUpperCase(),
    'Notes': p.notes || '',
  }))

  const ws = XLSX.utils.json_to_sheet(rows)

  // Header row styling
  ws['!cols'] = Object.keys(rows[0] || {}).map(k => ({ wch: Math.max(k.length + 2, 14) }))

  // Add title row above data
  XLSX.utils.sheet_add_aoa(ws, [
    [`POLICY EXPIRY REGISTER — ${monthName.toUpperCase()} ${year}`],
    [`Total Policies: ${policies.length}`],
    [],
  ], { origin: 'A1' })

  // Shift data down by 3 rows
  const ws2 = XLSX.utils.json_to_sheet(rows)
  ws2['!cols'] = ws['!cols']

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb2 ?? wb, ws2, `${monthName} ${year}`)
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
```

---

### 10. `app/api/export/monthly/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { generateMonthlyExcel } from '@/lib/monthly-register'

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1))
  const year = parseInt(searchParams.get('year') || String(now.getFullYear()))

  const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0]
  const endDate = new Date(year, month, 0).toISOString().split('T')[0]

  // RLS ensures this only returns the current user's policies
  const { data: policies, error } = await supabase
    .from('policies')
    .select('*')
    .gte('expiry_date', startDate)
    .lte('expiry_date', endDate)
    .order('expiry_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const monthName = new Date(year, month - 1).toLocaleString('en-IN', { month: 'long' })
  const buffer = generateMonthlyExcel(policies || [], monthName, year)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Expiry_Register_${monthName}_${year}.xlsx"`,
    },
  })
}
```

---

### 11. `app/api/cron/alerts/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { runDailyAlerts } from '@/lib/alerts'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await runDailyAlerts()
  return NextResponse.json({ success: true, ...result })
}
```

---

### 12. `lib/alerts.ts`

```typescript
import { supabaseAdmin } from './supabase-admin'
import { sendPolicyAlertEmail } from './email'
import { sendWhatsAppAlert } from './whatsapp'
import type { Policy } from './types'

const THRESHOLDS = [90, 60, 30, 15, 7, 3, 1] as const

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0,0,0,0)
  const target = new Date(dateStr); target.setHours(0,0,0,0)
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

export async function runDailyAlerts() {
  let alertsSent = 0

  // Get all active policies across ALL users (service role bypasses RLS)
  const { data: policies } = await supabaseAdmin
    .from('policies')
    .select('*, profiles!policies_user_id_fkey(email, full_name)')
    .eq('status', 'active')
    .not('expiry_date', 'is', null)

  if (!policies) return { processed: 0, alertsSent: 0 }

  for (const policy of policies as (Policy & { profiles: { email: string; full_name: string } })[]) {
    if (!policy.expiry_date) continue
    const days = daysUntil(policy.expiry_date)
    const agentEmail = policy.profiles?.email

    // Check expired
    if (days <= 0 && !policy.alert_expired_sent) {
      await sendAlert(policy, days, 'expired', 'alert_expired_sent', agentEmail)
      alertsSent++
      continue
    }

    // Check thresholds
    for (const threshold of THRESHOLDS) {
      const field = `alert_${threshold}_sent` as keyof Policy
      if (days === threshold && !policy[field]) {
        await sendAlert(policy, days, `${threshold}_day`, field as string, agentEmail)
        alertsSent++
        break
      }
    }
  }

  return { processed: policies.length, alertsSent }
}

async function sendAlert(
  policy: Policy,
  daysLeft: number,
  alertType: string,
  dbField: string,
  agentEmail?: string
) {
  const sentVia: string[] = []

  if (agentEmail) {
    const ok = await sendPolicyAlertEmail(policy, daysLeft, agentEmail)
    if (ok) sentVia.push('email')
  }

  const waOk = await sendWhatsAppAlert(policy, daysLeft)
  if (waOk) sentVia.push('whatsapp')

  await supabaseAdmin.from('policies').update({ [dbField]: true }).eq('id', policy.id)
  await supabaseAdmin.from('alert_logs').insert({
    policy_id: policy.id,
    user_id: policy.user_id,
    alert_type: alertType,
    sent_via: sentVia,
    message_preview: `${policy.holder_name} — ${policy.insurer_name} — ${daysLeft <= 0 ? 'EXPIRED' : `${daysLeft}d left`}`,
    status: sentVia.length > 0 ? 'sent' : 'failed',
  })
}
```

---

### 13. PWA Files

#### `public/manifest.json`
```json
{
  "name": "PolicyVault",
  "short_name": "PolicyVault",
  "description": "Insurance Policy Management System",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#1e3a5f",
  "theme_color": "#1e3a5f",
  "orientation": "natural",
  "icons": [
    { "src": "/icon-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ],
  "screenshots": [
    { "src": "/screenshot-mobile.png", "sizes": "390x844", "type": "image/png", "form_factor": "narrow" }
  ]
}
```

#### `public/sw.js` — Service Worker (cache-first for static, network-first for API)
```javascript
const CACHE_NAME = 'policyvault-v1'
const STATIC_ASSETS = ['/', '/dashboard', '/manifest.json', '/icon-192x192.png']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Network-first for API routes
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => new Response('{"error":"offline"}', {
        headers: { 'Content-Type': 'application/json' }
      }))
    )
    return
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  )
})
```

#### `app/manifest.ts` — Next.js App Router manifest
```typescript
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PolicyVault',
    short_name: 'PolicyVault',
    description: 'Insurance Policy Management',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#1e3a5f',
    theme_color: '#1e3a5f',
    icons: [
      { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
```

#### `app/layout.tsx` — Register service worker + PWA meta tags
In the root layout, include in `<head>`:
```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#1e3a5f" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="PolicyVault" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
```

In the root layout, add a `<Script>` tag (next/script, strategy="afterInteractive") to register the service worker:
```javascript
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
}
```

---

### 14. `next.config.js` — Security Headers + Config

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'jspdf'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL} https://generativelanguage.googleapis.com https://api.groq.com`,
              "img-src 'self' data: blob:",
              "frame-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
```

---

### 15. UI PAGES — Detailed Spec

#### Design System:
- **Primary**: `#1e3a5f` (deep navy)
- **Accent**: `#f59e0b` (amber)
- **Background**: `#f8fafc`
- **Success**: `#16a34a` | **Danger**: `#dc2626` | **Warning**: `#d97706`
- **Font**: Use `Instrument Serif` for headings (import from Google Fonts) and `Inter` for body
- **Cards**: white, rounded-xl, subtle shadow
- **Sidebar**: `#1e3a5f` dark navy, white text

#### `app/login/page.tsx`
- Centered card on a navy background with a subtle geometric pattern
- Logo: shield icon + "PolicyVault" in amber
- Tagline: "Secure Policy Management"
- Fields: Email, Password
- "Sign In" button in amber
- NO sign up link — users are created by admin only
- Show error message on invalid credentials
- On success: redirect to `/dashboard`
- On mobile: full-screen, no scroll

#### `(protected)/layout.tsx`
Sidebar layout with:
- **Sidebar** (left, fixed width `w-60`, navy background):
  - Logo at top
  - Nav items: Dashboard, All Policies, Upload Policy, Monthly Register, Alerts, Profile, Sign Out
  - Show badge on "Monthly Register" at the start of each month
  - Show expiring soon count on "All Policies"
- **Main area** (right, scrollable, `bg-[#f8fafc]`)
- **Mobile**: Bottom navigation bar with 5 key icons (no sidebar on mobile)

#### `(protected)/dashboard/page.tsx`
**Top section — Monthly Register Banner (MOST PROMINENT FEATURE):**
Show a prominent amber/navy banner at the TOP of the dashboard:
```
📋 Expiry Register — June 2026
   Policies expiring this month: 12
   [📥 Download Excel]   [📄 Download PDF]
```
This banner shows EVERY MONTH and is the first thing the agent sees. Make it visually prominent with an amber background.

**Stats row (4 cards):**
1. Total Policies (all)
2. Active Policies (green badge count)
3. Expiring This Month (amber, clickable → Monthly Register)
4. Expired (red)

**Charts:**
- Bar chart: "Policies expiring — next 6 months" (Recharts BarChart, amber bars)

**Tables:**
- "Expiring Soon" table: Next 10 policies to expire, sorted by date. Show: Name, Phone, Insurer, Type, Expiry Date, Days Left (color-coded pill)
- Days Left pills: Green (>30d), Amber (8-30d), Red (≤7d), Gray (expired)

#### `(protected)/upload/page.tsx` — TWO STEP FLOW

**STEP 1: Upload**
- Full-width drop zone: dashed border, navy, "Drop PDF here or click to browse"
- Only accepts PDF, max 25MB
- Shows file preview (file name, size, PDF icon)
- "Scan with AI" button
- Loading state: animated progress bar with messages:
  - "Uploading document..."
  - "AI is reading your policy..."
  - "Extracting details..."
  - Done
- Error: "AI extraction failed. You can still upload and fill details manually."

**STEP 2: Verification Screen (CRITICAL)**

After extraction, show a clear verification UI with TWO columns:
- **Left column**: The uploaded PDF in an `<iframe>` so user can see the original
- **Right column**: The extracted data in an editable form

At the TOP of the form, show a colored banner:
- 🟢 "High Confidence — Please verify the extracted details below"
- 🟡 "Medium Confidence — Some fields may need correction"
- 🔴 "Low Confidence — Please review all fields carefully"

Also show: "AI used: Gemini 2.5 Flash" or "AI used: Groq Llama 4 Scout"

If `extraction_notes` is not null, show it as a warning box.

The form shows ALL extracted fields, grouped by section. Fields with `null` values are shown as empty inputs so the user can fill them. Fields with values are pre-filled but editable.

At the bottom, TWO buttons:
- **"Scan Again"** — re-uploads and re-runs extraction
- **"✓ Confirm & Save"** — saves the (possibly edited) data to the database

**On Save:**
- `POST /api/policies` with the form data
- Show success toast: "Policy saved! 12 policies in your vault."
- Redirect to the saved policy's detail page

#### `(protected)/policies/page.tsx`
- Search bar (searches name, phone, policy number, vehicle number)
- Filter tabs: All | Health | Motor (Car+Bike) | Life | Other
- Status filter: All | Active | Expiring Soon | Expired
- Sortable table with columns: Client Name, Phone, Policy No., Insurer, Type, Sum Insured, Premium, Expiry Date, Days Left, Actions
- "Export All to Excel" button (top right)
- Row click → detail page
- Pagination: 20 per page
- Empty state: "No policies yet. Upload your first one →"

#### `(protected)/policies/[id]/page.tsx`
- Header: Client name, policy number, status badge, expiry countdown
- PDF viewer (`<iframe>`, fallback: download link)
- All policy details in organized sections
- Inline edit mode (click "Edit" button → fields become editable, "Save Changes" appears)
- Delete button with confirmation modal
- Alert history section at bottom

#### `(protected)/register/page.tsx` — Monthly Expiry Register
- Month/year selector (default: current month)
- Preview table of all policies expiring that month:
  - Columns: Sr, Client Name, Phone, Policy No., Insurer, Type, Sum Insured, Premium, Expiry Date, Vehicle No., Family Members
- "Download Excel" and "Download PDF" buttons
- "Send via Email" button (sends the register to the agent's own email)
- Count: "X policies expiring in June 2026"

#### `(protected)/profile/page.tsx`
- Show and edit: Full Name, Company Name, Phone
- Change Password section
- Subscription info (free plan)
- "Sign Out" button

---

### 16. `components/upload/VerificationForm.tsx`

This is the most important component. Build it with:
- All fields organized in `<Accordion>` sections: Personal Info, Policy Info, Financial, Dates, Vehicle Details (hidden if not motor), Health Members (hidden if not health), Life Details (hidden if not life)
- Each field has a label and an editable `<input>` or `<select>`
- Date inputs use `<input type="date">`
- Currency inputs format with Indian number system on blur
- Family members section: Add/Remove rows dynamically
- Real-time validation: expiry_date cannot be in the past for a "new" policy, policy_number should not be empty
- Any field that was `null` from AI extraction is highlighted with a yellow border as "needs review"
- A "required fields" check before saving: holder_name, policy_number, insurer_name, expiry_date — these four MUST be filled

---

### 17. `components/dashboard/MonthlyRegisterBanner.tsx`

This is shown on EVERY page load on the dashboard:

```tsx
// Shows prominently at top of dashboard
// Amber background banner with:
// - Month name
// - Count of expiring policies
// - Two download buttons: Excel and PDF
// - Optional: "Send to email" link

export function MonthlyRegisterBanner() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const monthName = now.toLocaleString('en-IN', { month: 'long' })

  // Fetch count of policies expiring this month
  // Show the banner even if count is 0 (agent needs to know)

  const handleExcelDownload = () => {
    window.open(`/api/export/monthly?month=${month}&year=${year}`, '_blank')
  }

  return (
    <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-amber-900">
            📋 Expiry Register — {monthName} {year}
          </h2>
          <p className="text-amber-700 text-sm mt-1">
            {count} policies expiring this month
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={handleExcelDownload} variant="default" className="bg-amber-600 hover:bg-amber-700">
            📥 Download Excel
          </Button>
          <Button onClick={handlePDFDownload} variant="outline" className="border-amber-600 text-amber-700">
            📄 Download PDF
          </Button>
        </div>
      </div>
    </div>
  )
}
```

---

### 18. `components/PwaInstallBanner.tsx`

```tsx
// Shows at the top of the app when the PWA can be installed
// Uses the beforeinstallprompt event
// Shows once, dismissable, stores dismissal in localStorage
export function PwaInstallBanner() {
  const { canInstall, handleInstall } = usePwaInstall()
  if (!canInstall) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-navy-800 text-white rounded-xl p-4 shadow-xl z-50 flex items-center justify-between">
      <div>
        <p className="font-semibold text-sm">📱 Install PolicyVault</p>
        <p className="text-xs text-gray-300">Add to home screen for quick access</p>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleInstall}>Install</Button>
        <Button size="sm" variant="ghost" onClick={dismiss}>✕</Button>
      </div>
    </div>
  )
}
```

---

### 19. `hooks/usePwaInstall.ts`

```typescript
'use client'
import { useEffect, useState } from 'react'

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [canInstall, setCanInstall] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    const dismissed = localStorage.getItem('pwa_install_dismissed')
    if (dismissed) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setCanInstall(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setIsInstalled(true))

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setIsInstalled(true)
    setCanInstall(false)
  }

  const dismiss = () => {
    localStorage.setItem('pwa_install_dismissed', '1')
    setCanInstall(false)
  }

  return { canInstall: canInstall && !isInstalled, handleInstall, dismiss }
}
```

---

### 20. `package.json` — Required Dependencies

```json
{
  "dependencies": {
    "@google/generative-ai": "^0.24.0",
    "@supabase/supabase-js": "^2.49.0",
    "@supabase/ssr": "^0.5.0",
    "groq-sdk": "^0.9.0",
    "next": "14.2.0",
    "react": "^18",
    "react-dom": "^18",
    "typescript": "^5",
    "tailwindcss": "^3.4.1",
    "resend": "^4.0.0",
    "xlsx": "^0.18.5",
    "jspdf": "^2.5.1",
    "jspdf-autotable": "^3.8.2",
    "pdf-parse": "^1.1.1",
    "recharts": "^2.12.0",
    "lucide-react": "^0.383.0",
    "react-dropzone": "^14.3.5",
    "date-fns": "^3.6.0",
    "@tanstack/react-table": "^8.17.0",
    "@radix-ui/react-accordion": "^1.2.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "@types/pdf-parse": "^1.1.4",
    "eslint": "^8",
    "eslint-config-next": "14.2.0"
  }
}
```

---

### 21. Admin Notes — How to Create Users Manually

In the Supabase dashboard → Authentication → Users → "Invite User":
- Enter the agent's email and a temporary password
- The `handle_new_user` trigger will auto-create their profile row
- Then update the profile with their full name and company:

```sql
UPDATE profiles
SET full_name = 'Rajesh Kumar', company_name = 'Kumar Insurance Agency'
WHERE email = 'rajesh@example.com';
```

Users cannot sign up themselves. There is no public registration page. The middleware will redirect anyone without a valid session to `/login`.

---

### 22. Security Checklist for the App

Build with ALL of these:
1. ✅ Supabase RLS on ALL tables — users see only their own data
2. ✅ Service role key NEVER sent to browser — only in API routes
3. ✅ `user_id` always set server-side from `auth.getUser()`, never from request body
4. ✅ PDF stored in private Supabase Storage bucket — no public URLs
5. ✅ All API routes check auth before doing anything
6. ✅ Security headers in `next.config.js` (XSS, clickjacking, HSTS)
7. ✅ Middleware guards all protected routes
8. ✅ PAN/Aadhaar data: display as partially masked (e.g. XXXX1234) in the UI
9. ✅ HTTPS enforced (Vercel handles this)
10. ✅ Cron endpoint protected by `CRON_SECRET` header
11. ✅ No logging of sensitive fields (PAN, Aadhaar) in console/server logs
12. ✅ Row deletion in storage when policy is deleted from DB

---

### 23. Closing Notes for the AI Builder

1. This is a **multi-user app** — every database query for user data MUST scope to `user_id`. The RLS handles this automatically if you use the server client (not admin client) for policy CRUD.
2. The monthly register banner is the **primary feature** — it should be the biggest UI element on the dashboard, not a small link.
3. The verification step after upload is **MANDATORY** — never save to DB without user confirming.
4. PWA requires HTTPS to work — it will work on Vercel (HTTPS by default), not on `localhost` (use Chrome's "Allow PWA on localhost" setting for testing).
5. Generate placeholder PNG icon files (navy blue shield on amber background) using a Canvas API snippet in a setup script — the user cannot run design tools.
6. Install shadcn/ui and add these components: Button, Card, Input, Select, Badge, Table, Dialog, Toast, Accordion, Separator, Dropdown Menu, Avatar.
7. Use `@supabase/ssr` package for cookie-based auth in Next.js App Router — NOT the older `auth-helpers-nextjs`.
8. Test the full flow: Create a user in Supabase → log in → upload a sample PDF → verify extraction → save → view in dashboard → download monthly register → delete policy.

The reference for PWA implementation is: https://github.com/abhijeets54/employee-salary-manager — follow the same installable pattern used there.
