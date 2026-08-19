-- ============================================================================
-- 1091: GST catalogue cleanup — Walking package category + hide legacy delivery-mode VS
-- ============================================================================
-- 1) Babul Dusad packages currently store free-text category "Dog Walker" with NULL
--    category_id, so GST fails closed. Point them at the existing Walking master
--    (service_categories.category_id = 'walking') so Admin Walking GST cards apply.
--    Does NOT create GST cards, aliases, or rate changes.
--
-- 2) Soft-remove 29 confirmed customer-facing legacy delivery-mode vendor_services
--    (Home Visit Consultation / Home Service / Clinic Visit / Center Service) from
--    discovery by disabling + drafting. Preserves rows for historical booking FKs.
--    Idempotent. No hard DELETE. No financial rewrites.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A) Two walker packages → Walking catalogue category
-- ---------------------------------------------------------------------------
UPDATE vendor_services vs
SET
  category_id = sc.id,
  category = 'walking',
  updated_at = NOW()
FROM service_categories sc
WHERE vs.id IN (
    '06a06f1d-6104-496f-b0fd-946fde3b35b6'::uuid, -- Monthly Dog Walking Package (Babul Dusad)
    '54fbde69-709e-4b4b-9da8-86a461bf1776'::uuid  -- Two Dogs Monthly Package (Babul Dusad)
  )
  AND LOWER(TRIM(sc.category_id)) = 'walking'
  AND (
    vs.category_id IS DISTINCT FROM sc.id
    OR LOWER(TRIM(COALESCE(vs.category, ''))) IS DISTINCT FROM 'walking'
  );

-- ---------------------------------------------------------------------------
-- B) Soft-unpublish 29 legacy delivery-mode customer-facing vendor_services
--    Guarded by exact service_name match so unrelated similarly-named SKUs are safe.
-- ---------------------------------------------------------------------------
UPDATE vendor_services
SET
  is_enabled = false,
  publish_status = 'draft',
  updated_at = NOW()
WHERE id IN (
    -- Center Service (3)
    '476d173c-bf27-41a9-a7a5-181b2d0cfc31'::uuid,
    'fd9d5740-58e4-48d4-8d0a-de6913e13f3f'::uuid,
    '5af604a8-ccdc-46ca-8b9e-c89fb0e4d5e1'::uuid,
    -- Clinic Visit (11)
    '9a723a13-13dc-45d4-8b7e-e253f86f52a1'::uuid,
    '5a7e2fa1-31aa-452a-a1be-ba2ade2dfd14'::uuid,
    '724a57d7-3e9c-4206-9dd2-dd41e26542c9'::uuid,
    '155d69d8-6f3c-4ffd-86eb-0aa5a68719e4'::uuid,
    '70470cc2-e3b3-43e2-ac33-4b7b62146880'::uuid,
    '57baba50-2de5-4ccc-9ea5-51561f9ce84a'::uuid,
    'd12fcc0a-a2ca-4532-9795-8d7e962f3388'::uuid,
    'c6d2ab52-7d1c-46e1-925a-f1b2cf4e2861'::uuid,
    '4e8ef53d-eaad-47f4-abc8-3c35d2e45ac9'::uuid,
    '4ec429a8-4342-4696-8770-55dd3db33316'::uuid,
    '304bbc2b-9ceb-4e20-8029-4ae4513430e4'::uuid,
    -- Home Service (6)
    '3fbc93b8-ee45-40cd-825d-3a44a833282e'::uuid,
    'e26ae1b8-c86f-423d-a204-884a3ec6d577'::uuid,
    'bef06d08-cd52-421d-8d83-2cbd7a070089'::uuid,
    '1f7f726e-fb33-4815-b9dd-5db04a405352'::uuid,
    '84eb2eed-e8c9-434c-a5fb-9a74b4225dc4'::uuid,
    'bad54e83-804c-4f88-bd7f-424dd782314a'::uuid,
    -- Home Visit Consultation (9)
    'fe457690-c37a-4540-b22f-958301414b64'::uuid,
    '6102520b-00c9-45fe-83bc-5757ef37126e'::uuid,
    '25db0729-3005-4bda-9704-9d3e788e34ea'::uuid,
    '334cd769-4f24-4fa4-946e-27714e1e3579'::uuid,
    'c4097b32-e751-4aca-97ba-fa7859bd9b3d'::uuid,
    '36a2829d-5828-4a0b-9376-b27bd95dc1e6'::uuid,
    '2d979ffe-c433-4f13-99b6-34740a884311'::uuid,
    '0731cb46-6994-4cc8-8588-788b31ddfe3b'::uuid,
    '33dcb874-35cd-47e2-a01c-f4895e9e3ff3'::uuid
  )
  AND LOWER(TRIM(COALESCE(service_name, ''))) IN (
    'home visit consultation',
    'home service',
    'clinic visit',
    'center service'
  )
  AND (
    COALESCE(is_enabled, true) = true
    OR publish_status IS NULL
    OR LOWER(TRIM(publish_status)) IN ('published', 'auto_published')
  );
