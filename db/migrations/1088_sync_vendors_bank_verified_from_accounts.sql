-- Backfill vendors.bank_verified from verified bank account rows (idempotent).

DO $$
BEGIN
  UPDATE vendor_bank_accounts vba
  SET verification_status = 'verified'
  WHERE vba.is_verified = true
    AND COALESCE(vba.is_deleted, false) = false
    AND LOWER(COALESCE(vba.verification_status::text, '')) NOT IN ('verified', 'failed');

  UPDATE vendors v
  SET bank_verified = true,
      updated_at = NOW()
  WHERE COALESCE(v.bank_verified, false) = false
    AND (
      EXISTS (
        SELECT 1
        FROM vendor_bank_accounts vba
        WHERE vba.vendor_id = v.id
          AND COALESCE(vba.is_deleted, false) = false
          AND vba.is_verified = true
      )
      OR EXISTS (
        SELECT 1
        FROM vendor_bank_details vbd
        WHERE vbd.vendor_id = v.id
          AND vbd.is_verified = true
      )
    );
END $$;
