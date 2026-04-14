/**
 * Customer-facing visibility for service_categories (home dashboard tiles).
 */

export type CustomerLocationContext = {
  state: string;
  city: string;
};

export function normalizeLocationToken(s: string | null | undefined): string {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Loose match for Indian state names vs codes (e.g. Karnataka vs KA). */
function stateMatches(userState: string, configured: string): boolean {
  const u = normalizeLocationToken(userState);
  const c = normalizeLocationToken(configured);
  if (!u || !c) return false;
  if (u === c) return true;
  return u.includes(c) || c.includes(u);
}

function cityMatches(userCity: string, configured: string): boolean {
  const u = normalizeLocationToken(userCity);
  const c = normalizeLocationToken(configured);
  if (!u || !c) return false;
  if (u === c) return true;
  return u.includes(c) || c.includes(u);
}

/**
 * @param row — service_categories row (snake_case from DB)
 */
export function serviceCategoryVisibleOnCustomerDashboard(
  row: Record<string, unknown>,
  loc: CustomerLocationContext
): boolean {
  if (row.customer_dashboard_card_active === false) return false;

  const vt = String(row.customer_visibility_type || 'GLOBAL')
    .trim()
    .toUpperCase();
  if (!vt || vt === 'GLOBAL') return true;

  const userState = loc.state || '';
  const userCity = loc.city || '';

  if (vt === 'STATE') {
    const configured = String(row.customer_visibility_state || '').trim();
    if (!configured) return true;
    if (!userState) return false;
    return stateMatches(userState, configured);
  }

  if (vt === 'CITY') {
    const configuredState = String(row.customer_visibility_state || '').trim();
    const configuredCity = String(row.customer_visibility_city || '').trim();
    if (!configuredState || !configuredCity) return true;
    if (!userState || !userCity) return false;
    return stateMatches(userState, configuredState) && cityMatches(userCity, configuredCity);
  }

  return true;
}
