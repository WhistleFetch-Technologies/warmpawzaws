-- Idempotent log for pet vaccination reminder pushes (dedupe per pet/vaccine/due date).

CREATE TABLE IF NOT EXISTS pet_vaccination_reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  vaccine_key TEXT NOT NULL,
  due_date DATE NOT NULL,
  reminder_kind TEXT NOT NULL DEFAULT '1_day_before',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pet_vaccination_reminder_log_dedupe
  ON pet_vaccination_reminder_log (pet_id, vaccine_key, due_date, reminder_kind);

CREATE INDEX IF NOT EXISTS idx_pet_vaccination_reminder_log_customer
  ON pet_vaccination_reminder_log (customer_id, sent_at DESC);

COMMENT ON TABLE pet_vaccination_reminder_log IS 'Sent vaccination reminder notifications (FCM/in-app) for dedupe and audit';
