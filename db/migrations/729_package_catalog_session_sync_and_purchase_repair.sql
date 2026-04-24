-- ============================================================================
-- MIGRATION 729: Catalog session counts + repair package_purchases / PSS rows
-- ============================================================================
-- Purpose:
--   1) Normalize service_packages so session_count / sessions_included / total_sessions agree.
--   2) Heuristic: active walking-style packages named like "week" / "7 day" with <=1 session → 7.
--   3) Repair finite package_purchases where stored total_sessions is below catalog canonical count,
--      insert missing package_scheduled_sessions slots, then recompute remaining_sessions.
--
-- Safe to re-run: uses ON CONFLICT DO NOTHING for PSS; purchase UPDATE only increases total_sessions
-- when catalog > purchase and purchase is finite (not unlimited).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) service_packages: ensure columns used by API / Lambda exist
-- ---------------------------------------------------------------------------
ALTER TABLE service_packages ADD COLUMN IF NOT EXISTS session_count INTEGER;
ALTER TABLE service_packages ADD COLUMN IF NOT EXISTS total_sessions INTEGER;
ALTER TABLE service_packages ADD COLUMN IF NOT EXISTS name TEXT;

-- Keep name in sync when only legacy package_name exists
UPDATE service_packages sp
SET name = sp.package_name
WHERE sp.name IS NULL
  AND sp.package_name IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2) Align finite session counts across legacy columns (skip unlimited: session_count = -1)
--    When columns disagree, take the greatest positive value (fixes 1 vs 7 drift).
-- ---------------------------------------------------------------------------
UPDATE service_packages sp
SET
  session_count = v.canonical,
  sessions_included = v.canonical,
  total_sessions = v.canonical
FROM (
  SELECT
    id,
    GREATEST(
      COALESCE(NULLIF(session_count, 0), 0),
      COALESCE(NULLIF(sessions_included, 0), 0),
      COALESCE(NULLIF(total_sessions, 0), 0)
    )::integer AS canonical
  FROM service_packages
  WHERE COALESCE(session_count, 0) >= 0
    AND GREATEST(
      COALESCE(NULLIF(session_count, 0), 0),
      COALESCE(NULLIF(sessions_included, 0), 0),
      COALESCE(NULLIF(total_sessions, 0), 0)
    ) > 0
) v
WHERE sp.id = v.id
  AND COALESCE(sp.session_count, 0) >= 0;

-- ---------------------------------------------------------------------------
-- 3) Heuristic: one-week walking bundles wrongly stored as 1 session → 7
--    (narrow: name must suggest week AND walking AND finite low session count)
-- ---------------------------------------------------------------------------
UPDATE service_packages sp
SET
  session_count = 7,
  sessions_included = GREATEST(COALESCE(sp.sessions_included, 0), 7),
  total_sessions = GREATEST(COALESCE(sp.total_sessions, 0), 7),
  updated_at = NOW()
WHERE COALESCE(sp.is_active, true) = true
  AND COALESCE(sp.session_count, 0) >= 0
  AND COALESCE(NULLIF(sp.session_count, 0), NULLIF(sp.sessions_included, 0), NULLIF(sp.total_sessions, 0), 0) <= 1
  AND (
    COALESCE(sp.service_type, '') ILIKE '%walk%'
    OR COALESCE(sp.package_name, '') ILIKE '%walk%'
    OR COALESCE(sp.name, '') ILIKE '%walk%'
  )
  AND (
    COALESCE(sp.package_name, sp.name, '') ILIKE '%week%'
    OR COALESCE(sp.package_name, sp.name, '') ILIKE '%7 day%'
    OR COALESCE(sp.package_name, sp.name, '') ILIKE '%seven day%'
    OR COALESCE(sp.package_name, sp.name, '') ILIKE '%one week%'
  );

-- ---------------------------------------------------------------------------
-- 4–6) Repair purchases + PSS + remaining_sessions (single DO block so RDS Data API
--      can run one execute-statement; temp tables do not persist across separate Data API calls)
-- ---------------------------------------------------------------------------
DO $repair$
BEGIN
  DROP TABLE IF EXISTS _pkg_purchase_session_repair;
  CREATE TEMP TABLE _pkg_purchase_session_repair (
    purchase_id UUID PRIMARY KEY,
    target_total INTEGER NOT NULL
  );

  INSERT INTO _pkg_purchase_session_repair (purchase_id, target_total)
  SELECT pp.id,
         GREATEST(
           1,
           COALESCE(
             NULLIF(sp.session_count, 0),
             NULLIF(sp.total_sessions, 0),
             NULLIF(sp.sessions_included, 0),
             1
           )
         )::integer
  FROM package_purchases pp
  INNER JOIN service_packages sp ON sp.id = pp.package_id
  WHERE COALESCE(pp.unlimited_usage, false) = false
    AND COALESCE(sp.session_count, 0) >= 0
    AND pp.package_id IS NOT NULL
    AND GREATEST(
          1,
          COALESCE(
            NULLIF(sp.session_count, 0),
            NULLIF(sp.total_sessions, 0),
            NULLIF(sp.sessions_included, 0),
            1
          )
        ) > COALESCE(pp.total_sessions, 0);

  UPDATE package_purchases pp
  SET
    total_sessions = r.target_total,
    updated_at = NOW()
  FROM _pkg_purchase_session_repair r
  WHERE pp.id = r.purchase_id;

  INSERT INTO package_scheduled_sessions (package_purchase_id, session_number, status)
  SELECT pp.id, gs.n, 'pending'
  FROM package_purchases pp
  INNER JOIN _pkg_purchase_session_repair r ON r.purchase_id = pp.id
  CROSS JOIN LATERAL generate_series(1, GREATEST(r.target_total, 0)) AS gs(n)
  WHERE COALESCE(pp.unlimited_usage, false) = false
  ON CONFLICT (package_purchase_id, session_number) DO NOTHING;

  UPDATE package_purchases pp
  SET
    remaining_sessions = COALESCE(sub.cnt, 0),
    updated_at = NOW()
  FROM (
    SELECT
      pss.package_purchase_id,
      COUNT(*)::integer AS cnt
    FROM package_scheduled_sessions pss
    WHERE pss.status NOT IN ('completed', 'cancelled', 'no_show')
    GROUP BY pss.package_purchase_id
  ) sub
  WHERE pp.id = sub.package_purchase_id
    AND pp.id IN (SELECT purchase_id FROM _pkg_purchase_session_repair);

  DROP TABLE IF EXISTS _pkg_purchase_session_repair;
END
$repair$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
