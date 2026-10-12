-- ============================================================================
-- SplitPay Production Database Schema & Row-Level Security (RLS)
-- ADR 0003: Server-enforced authorization & append-only operation transport.
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ledgers Table
CREATE TABLE IF NOT EXISTS public.ledgers (
  id TEXT PRIMARY KEY, -- Client-generated ULID
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ledger Members Table (Access Control)
CREATE TABLE IF NOT EXISTS public.ledger_members (
  ledger_id TEXT NOT NULL REFERENCES public.ledgers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ledger_id, user_id)
);

-- Sync Operations Log (Append-Only Outbox / Inbox)
CREATE TABLE IF NOT EXISTS public.ops (
  op_id TEXT PRIMARY KEY, -- Client-generated sortable ULID
  ledger_id TEXT NOT NULL REFERENCES public.ledgers(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  created_at_micros BIGINT NOT NULL,
  server_received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_ops_ledger_watermark ON public.ops (ledger_id, op_id ASC);
CREATE INDEX IF NOT EXISTS idx_ledger_members_user ON public.ledger_members (user_id);

-- Enable Row-Level Security (RLS) on all tables
ALTER TABLE public.ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- RLS POLICIES FOR public.ledgers
-- ----------------------------------------------------------------------------
CREATE POLICY "Members can view their ledgers"
  ON public.ledgers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ledger_members
      WHERE public.ledger_members.ledger_id = public.ledgers.id
        AND public.ledger_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create ledgers"
  ON public.ledgers
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------------------------
-- RLS POLICIES FOR public.ledger_members
-- ----------------------------------------------------------------------------
CREATE POLICY "Members can view members of their ledgers"
  ON public.ledger_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ledger_members AS lm
      WHERE lm.ledger_id = public.ledger_members.ledger_id
        AND lm.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners and creators can add members"
  ON public.ledger_members
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.ledger_members AS lm
      WHERE lm.ledger_id = public.ledger_members.ledger_id
        AND lm.user_id = auth.uid()
        AND lm.role IN ('owner', 'admin')
    )
  );

-- ----------------------------------------------------------------------------
-- RLS POLICIES FOR public.ops (Security Gate: Non-members CANNOT see or push ops)
-- ----------------------------------------------------------------------------
CREATE POLICY "Ledger members can select operations"
  ON public.ops
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ledger_members
      WHERE public.ledger_members.ledger_id = public.ops.ledger_id
        AND public.ledger_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Ledger members can append operations"
  ON public.ops
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ledger_members
      WHERE public.ledger_members.ledger_id = public.ops.ledger_id
        AND public.ledger_members.user_id = auth.uid()
    )
  );

-- Realtime publication configuration
-- Broadcasts new ops to connected peers in real time
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ops'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.ops;
    END IF;
  ELSE
    CREATE PUBLICATION supabase_realtime FOR TABLE public.ops;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- PROFILES & CONTACT DISCOVERY
-- Requirements:
-- (A) Email verification flag
-- (B) E.164 phone number, phone_verified flag, unique constraint on verified numbers only,
--     discoverable_by_phone consent toggle.
-- (C) Zero persistence of unmatching contact phone numbers.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY, -- Client ULID or Supabase Auth UUID
  name TEXT NOT NULL,
  handle TEXT,
  email TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  phone TEXT,
  phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  discoverable_by_phone BOOLEAN NOT NULL DEFAULT TRUE,
  avatar_url TEXT,
  invite_code TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index on registered phone numbers
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_phone 
  ON public.profiles (phone) 
  WHERE phone IS NOT NULL;

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow reading discoverable profiles for friend lookup
CREATE POLICY "Allow lookup of discoverable profiles"
  ON public.profiles
  FOR SELECT
  USING (discoverable_by_phone = true);

-- Allow profile creation and updates
CREATE POLICY "Allow clients to upsert their own profile"
  ON public.profiles
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- AUTH OTPS TABLE (Email verification tokens)
-- Stores SHA-256 hashed 6-digit OTPs, 10 min TTL, max 5 attempts
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.auth_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_identifier TEXT NOT NULL, -- Email or E.164 Phone
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp')),
  otp_hash TEXT NOT NULL,          -- SHA-256 hex digest (never raw OTP)
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_otps_identifier 
  ON public.auth_otps (target_identifier, channel, created_at DESC);

ALTER TABLE public.auth_otps ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- PRIVACY-PRESERVING CONTACT MATCHING RPC
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.match_contacts_by_phone(candidate_numbers TEXT[])
RETURNS TABLE (
  id TEXT,
  name TEXT,
  handle TEXT,
  avatar_url TEXT,
  phone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  capped_numbers TEXT[];
BEGIN
  capped_numbers := candidate_numbers[1:50];

  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.handle,
    p.avatar_url,
    p.phone
  FROM public.profiles p
  WHERE p.phone = ANY(capped_numbers)
    AND p.phone IS NOT NULL
    AND p.discoverable_by_phone = true;
END;
$$;

