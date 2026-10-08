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
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE public.ops;
COMMIT;
