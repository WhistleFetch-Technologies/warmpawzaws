/**
 * Admin customer list location line.
 * Prefer profile address, then city/state/pin, then saved address, then stored coords.
 */

export type CustomerLocationSource = {
  address?: unknown;
  city?: unknown;
  state?: unknown;
  pincode?: unknown;
  latitude?: unknown;
  longitude?: unknown;
};

export type SavedAddressOverlay = {
  address_line1?: unknown;
  city?: unknown;
  state?: unknown;
  pincode?: unknown;
  latitude?: unknown;
  longitude?: unknown;
};

export function formatStoredCoordinates(lat: unknown, lng: unknown): string {
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return '';
  if (a === 0 && b === 0) return '';
  return `${a.toFixed(5)}, ${b.toFixed(5)}`;
}

export function primaryCustomerAddressText(cust: CustomerLocationSource | null | undefined): string {
  if (!cust) return '';
  const raw = cust.address;
  if (raw == null || raw === '') return '';
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return '';
    if (t.startsWith('{') || t.startsWith('[')) {
      try {
        const o = JSON.parse(t) as Record<string, unknown>;
        return primaryCustomerAddressText({ ...cust, address: o });
      } catch {
        return t;
      }
    }
    return t;
  }
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const formatted = String(o.formatted_address || o.formattedAddress || '').trim();
    if (formatted) return formatted;
    const street = String(o.street || o.addressLine1 || o.line1 || '').trim();
    if (street) return street;
  }
  return '';
}

function cityStatePin(row: { city?: unknown; state?: unknown; pincode?: unknown }): string {
  const city = String(row.city ?? '').trim();
  const state = String(row.state ?? '').trim();
  const pincode = String(row.pincode ?? '').trim();
  return [city, state, pincode].filter(Boolean).join(', ');
}

export function customerAdminDisplayLocation(
  cust: CustomerLocationSource,
  saved?: SavedAddressOverlay | null,
): string {
  const line = primaryCustomerAddressText(cust);
  if (line) return line;
  const profilePlace = cityStatePin(cust);
  if (profilePlace) return profilePlace;
  if (saved) {
    const savedLine = String(saved.address_line1 ?? '').trim();
    if (savedLine) {
      const rest = cityStatePin(saved);
      return rest ? `${savedLine}, ${rest}` : savedLine;
    }
    const savedPlace = cityStatePin(saved);
    if (savedPlace) return savedPlace;
    const savedCoords = formatStoredCoordinates(saved.latitude, saved.longitude);
    if (savedCoords) return savedCoords;
  }
  return formatStoredCoordinates(cust.latitude, cust.longitude);
}
