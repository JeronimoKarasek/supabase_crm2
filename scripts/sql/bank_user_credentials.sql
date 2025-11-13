-- Migration: bank_user_credentials (multi-user per bank)
-- Execute in Supabase SQL Editor
-- Ensures extension for UUID if not already
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.bank_user_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_key text NOT NULL,
  alias text NOT NULL,
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique alias per user + bank
CREATE UNIQUE INDEX IF NOT EXISTS bank_user_credentials_user_bank_alias_idx
  ON public.bank_user_credentials(user_id, bank_key, alias);

-- Helper index for default resolution
CREATE INDEX IF NOT EXISTS bank_user_credentials_user_bank_default_idx
  ON public.bank_user_credentials(user_id, bank_key, is_default);

-- Automatically keep updated_at current
CREATE OR REPLACE FUNCTION public.bank_user_credentials_touch() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bank_user_credentials_touch ON public.bank_user_credentials;
CREATE TRIGGER trg_bank_user_credentials_touch
  BEFORE UPDATE ON public.bank_user_credentials
  FOR EACH ROW EXECUTE FUNCTION public.bank_user_credentials_touch();

-- Ensure only one default per user+bank (enforced via trigger)
CREATE OR REPLACE FUNCTION public.bank_user_credentials_single_default() RETURNS trigger AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.bank_user_credentials
      SET is_default = false
      WHERE user_id = NEW.user_id AND bank_key = NEW.bank_key AND id <> NEW.id;
  END IF;
  RETURN NEW;
END;$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bank_user_credentials_single_default ON public.bank_user_credentials;
CREATE TRIGGER trg_bank_user_credentials_single_default
  BEFORE INSERT OR UPDATE ON public.bank_user_credentials
  FOR EACH ROW EXECUTE FUNCTION public.bank_user_credentials_single_default();

-- Grant RLS policies if RLS is enabled (adjust if needed)
ALTER TABLE public.bank_user_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bank_user_credentials_select" ON public.bank_user_credentials;
CREATE POLICY "bank_user_credentials_select" ON public.bank_user_credentials
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "bank_user_credentials_modify" ON public.bank_user_credentials;
CREATE POLICY "bank_user_credentials_modify" ON public.bank_user_credentials
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
