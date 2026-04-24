/**
 * Single definitions for package session visibility and bookability.
 * Call `seedFinitePackagesMissingSessionsForScope` / `seedFinitePackagesMissingSessionsForVendor`
 * (or `seedPackageScheduledSessionsIfMissing` per purchase) before queries that use these fragments
 * so finite packages always have `package_scheduled_sessions` rows when `total_sessions > 0`.
 *
 * "Bookable" = unlimited OR at least one pending slot.
 * "Active in lists" = bookable OR any unfinished slot (scheduled / in_progress / …).
 */

/** `package_scheduled_sessions.status` values that still represent unfinished package work. */
export const PSS_UNFINISHED_SQL = `('pending', 'scheduled', 'in_progress', 'rescheduled')`;

/**
 * Customer can start another booking on this purchase (matches `pickNextPendingSessionNumber`).
 * Use after seed helpers for the purchase when finite.
 */
export function sqlPackagePurchaseHasBookableSlot(ppAlias = 'pp'): string {
  return `(
    COALESCE(${ppAlias}.unlimited_usage, false) = true
    OR EXISTS (
      SELECT 1 FROM package_scheduled_sessions pss_book
      WHERE pss_book.package_purchase_id = ${ppAlias}.id
        AND pss_book.status = 'pending'
    )
  )`;
}

/**
 * Purchase should appear in "my packages" / vendor customer lists / discovery.
 */
export function sqlPackagePurchaseActiveForListing(ppAlias = 'pp'): string {
  return `(
    ${sqlPackagePurchaseHasBookableSlot(ppAlias)}
    OR EXISTS (
      SELECT 1 FROM package_scheduled_sessions pss_list
      WHERE pss_list.package_purchase_id = ${ppAlias}.id
        AND pss_list.status IN ${PSS_UNFINISHED_SQL}
    )
  )`;
}

/**
 * UI `computed_status`: aligns with `sqlPackagePurchaseActiveForListing` after seed (no legacy branch).
 */
export function sqlPackagePurchaseComputedStatus(ppAlias = 'pp'): string {
  return `(
    CASE
      WHEN ${ppAlias}.expires_at IS NOT NULL AND ${ppAlias}.expires_at < NOW() THEN 'expired'
      WHEN COALESCE(${ppAlias}.unlimited_usage, false) = false
           AND NOT EXISTS (
             SELECT 1 FROM package_scheduled_sessions pss_cs
             WHERE pss_cs.package_purchase_id = ${ppAlias}.id
               AND pss_cs.status IN ${PSS_UNFINISHED_SQL}
           ) THEN 'exhausted'
      ELSE ${ppAlias}.status
    END
  )`;
}
