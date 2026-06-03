-- ============================================================
-- PolicyVault Complete Schema
-- Run this ENTIRE file in the Supabase SQL Editor
-- Safe to run multiple times (idempotent)
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================================
-- PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  full_name TEXT NOT NULL DEFAULT 'New User',
  email TEXT NOT NULL DEFAULT '',
  company_name TEXT,
  phone TEXT,
  role TEXT DEFAULT 'agent' CHECK (role IN ('agent', 'admin')),
  is_active BOOLEAN DEFAULT true
);

-- Auto-create profile when a new Supabase Auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- POLICIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- OWNERSHIP
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- POLICYHOLDER PERSONAL DETAILS
  holder_name TEXT,
  holder_phone TEXT,
  holder_email TEXT,
  holder_dob DATE,
  holder_address TEXT,
  holder_pan TEXT,

  -- POLICY CORE INFO
  policy_number TEXT,
  insurer_name TEXT,
  policy_type TEXT CHECK (
    policy_type IN (
      'health', 'car', 'bike', 'life',
      'home', 'travel', 'commercial', 'fire', 'marine', 'other'
    )
  ),
  plan_name TEXT,

  -- FINANCIAL
  sum_insured NUMERIC,
  premium_amount NUMERIC,
  premium_frequency TEXT,
  gst_amount NUMERIC,
  total_premium NUMERIC,

  -- CRITICAL DATES
  issue_date DATE,
  start_date DATE,
  expiry_date DATE,

  -- VEHICLE FIELDS (car / bike only)
  vehicle_number TEXT,
  vehicle_make TEXT,
  vehicle_model TEXT,
  vehicle_year INTEGER,
  idv_value NUMERIC,
  engine_number TEXT,
  chassis_number TEXT,

  -- HEALTH FIELDS
  family_members JSONB DEFAULT '[]'::jsonb,
  sum_insured_per_member NUMERIC,

  -- LIFE FIELDS
  nominee_name TEXT,
  nominee_relation TEXT,
  death_benefit NUMERIC,
  policy_term TEXT,
  premium_paying_term TEXT,

  -- METADATA
  raw_pdf_url TEXT,
  raw_pdf_path TEXT,
  extracted_fields JSONB DEFAULT '{}'::jsonb,
  extraction_confidence TEXT CHECK (extraction_confidence IN ('high', 'medium', 'low')),
  notes TEXT,
  status TEXT DEFAULT 'active' CHECK (
    status IN ('active', 'expired', 'cancelled', 'lapsed', 'pending')
  ),

  -- ALERT TRACKING
  alert_90_sent BOOLEAN DEFAULT false,
  alert_60_sent BOOLEAN DEFAULT false,
  alert_30_sent BOOLEAN DEFAULT false,
  alert_15_sent BOOLEAN DEFAULT false,
  alert_7_sent BOOLEAN DEFAULT false,
  alert_3_sent BOOLEAN DEFAULT false,
  alert_1_sent BOOLEAN DEFAULT false,
  alert_expired_sent BOOLEAN DEFAULT false
);

-- ALERT LOGS
CREATE TABLE IF NOT EXISTS public.alert_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID REFERENCES public.policies(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_policies_user_id ON public.policies(user_id);
CREATE INDEX IF NOT EXISTS idx_policies_expiry_date ON public.policies(expiry_date);
CREATE INDEX IF NOT EXISTS idx_policies_status ON public.policies(status);
CREATE INDEX IF NOT EXISTS idx_policies_user_expiry ON public.policies(user_id, expiry_date);
CREATE INDEX IF NOT EXISTS idx_policies_type ON public.policies(policy_type);
CREATE INDEX IF NOT EXISTS idx_alert_logs_policy_id ON public.alert_logs(policy_id);
CREATE INDEX IF NOT EXISTS idx_alert_logs_user_id ON public.alert_logs(user_id);

-- ============================================================
-- AUTO-UPDATE updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_policies_updated_at ON public.policies;
CREATE TRIGGER trg_policies_updated_at
  BEFORE UPDATE ON public.policies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- AUTO-EXPIRE POLICIES
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_expired_policies()
RETURNS void AS $$
BEGIN
  UPDATE public.policies
  SET status = 'expired'
  WHERE expiry_date < CURRENT_DATE AND status = 'active';
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_logs ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Policies
DROP POLICY IF EXISTS "policies_select_own" ON public.policies;
DROP POLICY IF EXISTS "policies_insert_own" ON public.policies;
DROP POLICY IF EXISTS "policies_update_own" ON public.policies;
DROP POLICY IF EXISTS "policies_delete_own" ON public.policies;
CREATE POLICY "policies_select_own" ON public.policies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "policies_insert_own" ON public.policies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "policies_update_own" ON public.policies FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "policies_delete_own" ON public.policies FOR DELETE USING (auth.uid() = user_id);

-- Alert logs
DROP POLICY IF EXISTS "alert_logs_select_own" ON public.alert_logs;
CREATE POLICY "alert_logs_select_own" ON public.alert_logs FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKET (run after creating bucket 'policies' as PRIVATE)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
  VALUES ('policies', 'policies', false)
  ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "policies_storage_select" ON storage.objects;
CREATE POLICY "policies_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'policies' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "policies_storage_insert" ON storage.objects;
CREATE POLICY "policies_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'policies' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "policies_storage_delete" ON storage.objects;
CREATE POLICY "policies_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'policies' AND (storage.foldername(name))[1] = auth.uid()::text);
