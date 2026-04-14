/**
 * Customer-facing list for `/service-catalog/categories` (tile **candidates**).
 *
 * Which tiles actually appear on the customer home is determined by
 * **Marketing → Dashboard UI → Service Launch Status** (geography + status), applied on the
 * client via `GET /config/service-launch/customer`. Per-category `customer_visibility_*` and
 * `customer_dashboard_card_active` are no longer used to filter this list.
 */

export type CustomerLocationContext = {
  state: string;
  city: string;
};

/** @deprecated Kept for callers; location is ignored — launch config drives visibility. */
export function normalizeLocationToken(s: string | null | undefined): string {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * @param _row — service_categories row (unused for gating; `is_active` is enforced in SQL)
 * @param _loc — customer location (unused; launch API uses the same location)
 */
export function serviceCategoryVisibleOnCustomerDashboard(
  _row: Record<string, unknown>,
  _loc: CustomerLocationContext
): boolean {
  return true;
}
