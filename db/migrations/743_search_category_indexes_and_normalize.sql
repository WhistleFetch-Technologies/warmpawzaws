-- ============================================================================
-- MIGRATION 743: SEARCH CATEGORY INDEXES + NORMALIZE CATEGORY VALUES
-- ============================================================================
-- Purpose:
--   1. Add GIN/BTREE indexes on vendor_services.category and vendors.category
--      so ILIKE and = ANY(...) category filter queries are fast.
--   2. Normalize common free-text category values to canonical role-id strings
--      so both exact-match (= ANY) and ILIKE filters hit real rows.
-- Safe to run multiple times (IF NOT EXISTS / DO $$ guards throughout).
-- ============================================================================

-- ============================================================================
-- PART 1: PERFORMANCE INDEXES
-- ============================================================================

-- vendor_services: composite index for the category search hot-path
-- Covers: publish_status IN (...) AND is_enabled = true AND category filter
CREATE INDEX IF NOT EXISTS idx_vendor_services_category_search
  ON vendor_services (publish_status, is_enabled, vendor_id)
  WHERE publish_status IN ('published', 'auto_published') AND is_enabled = true;

-- vendor_services: separate category index for = ANY / ILIKE scans
CREATE INDEX IF NOT EXISTS idx_vendor_services_category_lower
  ON vendor_services (LOWER(TRIM(COALESCE(category, ''))));

-- vendor_services: index on service_name for keyword + category ILIKE scans
CREATE INDEX IF NOT EXISTS idx_vendor_services_service_name_lower
  ON vendor_services (LOWER(service_name));

-- vendors: category index for = ANY / ILIKE scans
CREATE INDEX IF NOT EXISTS idx_vendors_category_lower
  ON vendors (LOWER(TRIM(COALESCE(category, ''))))
  WHERE is_active = true AND status = 'approved';

-- vendors: composite index for browse-all (active + approved)
CREATE INDEX IF NOT EXISTS idx_vendors_active_approved
  ON vendors (is_active, status)
  WHERE is_active = true AND status = 'approved';

-- ============================================================================
-- PART 2: NORMALIZE FREE-TEXT CATEGORY VALUES TO CANONICAL ROLE IDs
-- ============================================================================
-- These UPDATE statements map common variations to the role-id strings that
-- the search alias list covers.  Each is wrapped in a safe DO block.
-- Only updates rows where the current value clearly maps to one canonical slug.
-- ============================================================================

DO $$
BEGIN
  -- ── VET ──────────────────────────────────────────────────────────────────
  UPDATE vendor_services
  SET category = 'veterinarian'
  WHERE LOWER(TRIM(COALESCE(category, ''))) IN (
    'vet', 'veterinary', 'veterinary consultation', 'vet consultation',
    'animal clinic', 'pet clinic', 'vet care', 'animal hospital',
    'pet hospital', 'veterinary care', 'vet services'
  );

  UPDATE vendor_services
  SET category = 'vet_clinic'
  WHERE LOWER(TRIM(COALESCE(category, ''))) IN (
    'clinic', 'pet health clinic', 'animal health clinic', 'veterinary clinic'
  );

  -- ── GROOMING ─────────────────────────────────────────────────────────────
  UPDATE vendor_services
  SET category = 'grooming'
  WHERE LOWER(TRIM(COALESCE(category, ''))) IN (
    'pet grooming', 'grooming service', 'grooming services', 'groom',
    'pet salon', 'salon', 'dog grooming', 'cat grooming',
    'pet spa', 'spa', 'pet bath', 'bath', 'nail trimming',
    'haircut', 'trim', 'dog grooming service'
  );

  -- ── TRAINING ─────────────────────────────────────────────────────────────
  UPDATE vendor_services
  SET category = 'training'
  WHERE LOWER(TRIM(COALESCE(category, ''))) IN (
    'pet training', 'dog training', 'obedience training', 'puppy training',
    'behavior training', 'behavioural training', 'behaviour training',
    'agility training', 'agility', 'obedience', 'dog obedience',
    'pet obedience', 'training service', 'dog coach', 'pet coach'
  );

  -- ── BOARDING ─────────────────────────────────────────────────────────────
  UPDATE vendor_services
  SET category = 'boarding'
  WHERE LOWER(TRIM(COALESCE(category, ''))) IN (
    'pet boarding', 'dog boarding', 'cat boarding', 'pet hostel',
    'kennel', 'pet kennel', 'dog kennel', 'pet daycare', 'day care',
    'daycare', 'pet day care', 'boarding service'
  );

  -- ── WALKER ───────────────────────────────────────────────────────────────
  UPDATE vendor_services
  SET category = 'walker'
  WHERE LOWER(TRIM(COALESCE(category, ''))) IN (
    'dog walking', 'pet walking', 'dog walk', 'pet walk',
    'walking service', 'dog walker service', 'pet walker service',
    'walk', 'walking'
  );

  -- ── PHARMACY ─────────────────────────────────────────────────────────────
  UPDATE vendor_services
  SET category = 'pharmacy'
  WHERE LOWER(TRIM(COALESCE(category, ''))) IN (
    'pet pharmacy', 'medicine', 'medicines', 'pet medicine',
    'veterinary medicine', 'drugs', 'medical store', 'chemist',
    'dispensary', 'pet drugs'
  );

  RAISE NOTICE '✅ vendor_services category normalization complete';
END $$;

-- Same normalization on the vendors table (vendors.category column)
DO $$
BEGIN
  -- VET
  UPDATE vendors SET category = 'veterinarian'
  WHERE LOWER(TRIM(COALESCE(category, ''))) IN (
    'vet', 'veterinary', 'animal clinic', 'pet clinic', 'vet care',
    'animal hospital', 'veterinary care', 'veterinary consultation'
  );

  UPDATE vendors SET category = 'vet_clinic'
  WHERE LOWER(TRIM(COALESCE(category, ''))) IN (
    'clinic', 'pet health clinic', 'veterinary clinic', 'animal health clinic'
  );

  -- GROOMING
  UPDATE vendors SET category = 'grooming'
  WHERE LOWER(TRIM(COALESCE(category, ''))) IN (
    'pet grooming', 'grooming service', 'groom', 'salon', 'pet salon',
    'dog grooming', 'cat grooming', 'pet spa', 'spa', 'bath', 'trim'
  );

  -- TRAINING
  UPDATE vendors SET category = 'training'
  WHERE LOWER(TRIM(COALESCE(category, ''))) IN (
    'pet training', 'dog training', 'obedience training', 'puppy training',
    'behavior training', 'agility', 'obedience', 'training service'
  );

  -- BOARDING
  UPDATE vendors SET category = 'boarding'
  WHERE LOWER(TRIM(COALESCE(category, ''))) IN (
    'pet boarding', 'dog boarding', 'kennel', 'pet kennel',
    'pet daycare', 'daycare', 'day care', 'pet hostel'
  );

  -- WALKER
  UPDATE vendors SET category = 'walker'
  WHERE LOWER(TRIM(COALESCE(category, ''))) IN (
    'dog walking', 'pet walking', 'dog walk', 'pet walk',
    'walking service', 'walk', 'walking'
  );

  -- PHARMACY
  UPDATE vendors SET category = 'pharmacy'
  WHERE LOWER(TRIM(COALESCE(category, ''))) IN (
    'pet pharmacy', 'medicine', 'medical store', 'chemist', 'dispensary'
  );

  RAISE NOTICE '✅ vendors category normalization complete';
END $$;

-- ============================================================================
-- VERIFICATION QUERY (output counts after normalization)
-- ============================================================================
SELECT
  LOWER(TRIM(COALESCE(category, '(null)'))) AS category_value,
  COUNT(*) AS service_count
FROM vendor_services
WHERE publish_status IN ('published', 'auto_published')
  AND is_enabled = true
GROUP BY 1
ORDER BY 2 DESC
LIMIT 40;
