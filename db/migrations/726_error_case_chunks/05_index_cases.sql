CREATE INDEX IF NOT EXISTS idx_product_error_cases_status_last_seen
  ON product_error_cases (status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_error_cases_assigned
  ON product_error_cases (assigned_admin_id)
  WHERE assigned_admin_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_error_case_occurrences_case
  ON error_case_occurrences (case_id, created_at DESC);
