-- Approve vendor Dr_Shivang_98765 42310_SOLO
-- This will make the vendor appear in customer-facing service discovery

UPDATE vendors 
SET 
  status = 'approved',
  approved_at = NOW(),
  is_active = true,
  updated_at = NOW()
WHERE id = 'e69af225-e732-4eae-81db-7af2bcc757bf'
  AND status = 'pending';

-- Verify the update
SELECT 
  id,
  business_name,
  phone,
  status,
  is_active,
  approved_at
FROM vendors
WHERE id = 'e69af225-e732-4eae-81db-7af2bcc757bf';
