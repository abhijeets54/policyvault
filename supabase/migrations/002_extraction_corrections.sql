-- ============================================================
-- EXTRACTION CORRECTIONS TABLE
-- Tracks when agents correct AI-extracted fields.
-- This data is used to improve extraction prompts over time.
-- Run this in the Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.extraction_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID REFERENCES public.policies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  ai_value TEXT,
  corrected_value TEXT,
  insurer_name TEXT,
  ai_model_used TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_corrections_policy_id ON public.extraction_corrections(policy_id);
CREATE INDEX IF NOT EXISTS idx_corrections_user_id ON public.extraction_corrections(user_id);
CREATE INDEX IF NOT EXISTS idx_corrections_field_name ON public.extraction_corrections(field_name);
CREATE INDEX IF NOT EXISTS idx_corrections_insurer ON public.extraction_corrections(insurer_name);

-- Enable RLS
ALTER TABLE public.extraction_corrections ENABLE ROW LEVEL SECURITY;

-- Users can read their own corrections
DROP POLICY IF EXISTS "corrections_select_own" ON public.extraction_corrections;
CREATE POLICY "corrections_select_own" ON public.extraction_corrections
  FOR SELECT USING (auth.uid() = user_id);

-- Allow inserts from service role (admin client) — no user-facing insert policy needed
-- The server-side POST /api/policies route uses createAdminClient() to insert corrections
