-- Migration 1043: Add customer_viewed_at to support_tickets for server-side unread tracking
-- Replaces browser localStorage as the authoritative "customer last viewed" timestamp.
-- Safe: additive only, IF NOT EXISTS.
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS customer_viewed_at TIMESTAMPTZ;
COMMENT ON COLUMN public.support_tickets.customer_viewed_at IS 'Timestamp when customer last opened this ticket thread. Used to compute unread badge server-side (replaces localStorage on iOS).';
