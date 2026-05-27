-- CRM partial/full refund: link support tickets to refunds table (optional denormalized columns).
-- Code stores refund details in metadata until this migration is applied everywhere.

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS refund_id UUID REFERENCES refunds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS refund_status TEXT;

CREATE INDEX IF NOT EXISTS idx_support_tickets_refund_id
  ON support_tickets(refund_id)
  WHERE refund_id IS NOT NULL;

COMMENT ON COLUMN support_tickets.refund_id IS 'Latest refund row for this ticket (CRM refund action)';
COMMENT ON COLUMN support_tickets.refund_amount IS 'Amount of latest CRM-initiated refund';
COMMENT ON COLUMN support_tickets.refund_status IS 'processing | completed | failed — mirror of refunds.refund_status';
