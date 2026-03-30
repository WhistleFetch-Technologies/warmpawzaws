/**
 * Map GET /customer/profile (and variants) into stable form fields for account UIs.
 * When the API nests house/flat on addresses[0], pass that row via houseNoFloorFromProfilePayload (see below).
 */

/** Strip control / BOM characters that can show as broken glyphs in inputs. */
export function sanitizeProfileDetailText(v: unknown): string {
  if (v == null) return '';
  return String(v)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uFEFF\uFFFE\uFFFF]/g, '')
    .trim();
}

function pickHouseNoFromAddressRow(addressRow: Record<string, any> | null | undefined): string {
  if (!addressRow) return '';
  const list = [
    addressRow.houseNo,
    addressRow.house_no,
    addressRow.flatNo,
    addressRow.flat_no,
    addressRow.flatno,
    (addressRow as any)?.FlatNo,
  ];
  for (const x of list) {
    const s = sanitizeProfileDetailText(x);
    if (s !== '') return s;
  }
  return '';
}

function pickFloorFromAddressRow(addressRow: Record<string, any> | null | undefined): string {
  if (!addressRow) return '';
  const list = [
    addressRow.floor,
    (addressRow as any)?.Floor,
    addressRow.floor_no,
    addressRow.floorNo,
  ];
  for (const x of list) {
    const s = sanitizeProfileDetailText(x);
    if (s !== '') return s;
  }
  return '';
}

/** Ordered list: default address first when flagged, else API order (usually default-first). */
function orderedProfileAddresses(raw: Record<string, any>): Record<string, any>[] {
  const addrs: Record<string, any>[] = Array.isArray(raw.addresses) ? raw.addresses : [];
  if (addrs.length <= 1) return addrs;
  const defIdx = addrs.findIndex(
    (a) => a?.isDefault === true || a?.is_default === true
  );
  if (defIdx <= 0) return addrs;
  return [addrs[defIdx], ...addrs.filter((_, i) => i !== defIdx)];
}

/** First non-empty house / flat value (API may use houseNo, house_no, houseno, flatNo, flat_no; `??` misses empty strings). */
export function pickHouseNoFromProfileApi(
  p: Record<string, any> | null | undefined,
  addressRow?: Record<string, any> | null,
  allAddresses?: Record<string, any>[] | null
): string {
  const list = [
    p?.houseNo,
    p?.house_no,
    p?.houseno,
    (p as any)?.HouseNo,
    p?.flatNo,
    p?.flat_no,
    p?.flatno,
    (p as any)?.FlatNo,
    addressRow?.houseNo,
    addressRow?.house_no,
    addressRow?.flatNo,
    addressRow?.flat_no,
    addressRow?.flatno,
  ];
  for (const x of list) {
    const s = sanitizeProfileDetailText(x);
    if (s !== '') return s;
  }
  const rows = allAddresses ?? (addressRow ? [addressRow] : []);
  for (const addr of rows) {
    const s = pickHouseNoFromAddressRow(addr);
    if (s !== '') return s;
  }
  return '';
}

export function pickFloorFromProfileApi(
  p: Record<string, any> | null | undefined,
  addressRow?: Record<string, any> | null,
  allAddresses?: Record<string, any>[] | null
): string {
  const list = [
    p?.floor,
    (p as any)?.Floor,
    addressRow?.floor,
    addressRow?.Floor,
    addressRow?.floor_no,
    addressRow?.floorNo,
  ];
  for (const x of list) {
    const s = sanitizeProfileDetailText(x);
    if (s !== '') return s;
  }
  const rows = allAddresses ?? (addressRow ? [addressRow] : []);
  for (const addr of rows) {
    const s = pickFloorFromAddressRow(addr);
    if (s !== '') return s;
  }
  return '';
}

/** Map GET/POST profile payload into UI fields: prefer top-level `houseNo` / `floor`, then legacy picks and saved address rows. */
export function houseNoFloorFromProfilePayload(
  data: Record<string, unknown> | null | undefined
): { houseNo: string; floor: string } {
  if (!data) return { houseNo: '', floor: '' };
  const raw = data as Record<string, any>;
  const addrsOrdered = orderedProfileAddresses(raw);
  const defaultAddr = addrsOrdered[0];
  const directHouse = sanitizeProfileDetailText(data.houseNo);
  const directFloor = sanitizeProfileDetailText(data.floor);
  return {
    houseNo: sanitizeProfileDetailText(
      directHouse || pickHouseNoFromProfileApi(raw, defaultAddr, addrsOrdered)
    ),
    floor: sanitizeProfileDetailText(
      directFloor || pickFloorFromProfileApi(raw, defaultAddr, addrsOrdered)
    ),
  };
}

export type NormalizedCustomerProfileFields = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  pincode: string;
  city?: string;
  state?: string;
  photo: string;
};

export function normalizeCustomerProfileFields(
  p: Record<string, any> | null | undefined,
  fallbackPhone: string
): NormalizedCustomerProfileFields {
  if (!p) {
    return {
      firstName: '',
      lastName: '',
      email: '',
      phone: fallbackPhone,
      address: '',
      pincode: '',
      photo: '',
    };
  }

  const displayName = p.name ?? p.full_name ?? '';
  const parts = String(displayName).trim().split(/\s+/).filter(Boolean);
  const firstName = String(p.firstName || parts[0] || '').trim();
  const lastName = String(p.lastName || parts.slice(1).join(' ') || '').trim();

  let address = '';
  if (typeof p.address === 'string') {
    address = p.address;
  } else if (p.address != null && typeof p.address === 'object') {
    address =
      p.address.street ||
      p.address.addressLine1 ||
      p.address.line1 ||
      '';
  }

  const rawPin =
    p.pincode ??
    (typeof p.address === 'object' && p.address != null ? (p.address as { pincode?: unknown }).pincode : undefined);
  const pincode =
    rawPin !== undefined && rawPin !== null && rawPin !== ''
      ? String(rawPin).replace(/\D/g, '').slice(0, 6)
      : '';

  return {
    firstName,
    lastName,
    email: p.email || '',
    phone: p.phone || fallbackPhone,
    address,
    pincode,
    city: p.city || (typeof p.address === 'object' ? p.address?.city : undefined),
    state: p.state || (typeof p.address === 'object' ? p.address?.state : undefined),
    photo: p.photo || p.profile_photo_url || '',
  };
}
