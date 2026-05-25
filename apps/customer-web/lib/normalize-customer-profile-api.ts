/**
 * Map GET /customer/profile (and variants) into stable form fields for account UIs.
 */
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

  const pincode =
    p.pincode ||
    (typeof p.address === 'object' && p.address?.pincode) ||
    '';

  return {
    firstName,
    lastName,
    email: p.email || '',
    phone: p.phone || fallbackPhone,
    address,
    pincode: pincode ? String(pincode) : '',
    city: p.city || (typeof p.address === 'object' ? p.address?.city : undefined),
    state: p.state || (typeof p.address === 'object' ? p.address?.state : undefined),
    photo: p.photo || p.profile_photo_url || '',
  };
}

/**
 * After POST /customer/profile, GET may still return a stale pincode (e.g. default `customer_addresses`
 * row vs `customers` row, or cached API). Merge the payload we just saved so the UI shows the new values.
 */
export function overlayCustomerProfileAfterSave<T extends Record<string, any>>(
  loaded: T | null,
  saved: Partial<T> & { pincode: string; address: string }
): T | null {
  if (!loaded) return loaded;
  return { ...loaded, ...saved };
}

/** Keep localStorage session profile aligned after save (auth/home read these keys). */
export function patchCustomerProfileKeysInLocalStorage(patch: {
  pincode: string;
  address: string;
  city?: string;
  state?: string;
  photo?: string;
  houseNo?: string;
  floor?: string;
}): void {
  if (typeof window === 'undefined') return;
  try {
    for (const key of ['customerData', 'customerProfile'] as const) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const d = JSON.parse(raw) as Record<string, unknown>;
      if (!d || typeof d !== 'object') continue;
      d.pincode = patch.pincode;
      d.address = patch.address;
      if (patch.city !== undefined) d.city = patch.city;
      if (patch.state !== undefined) d.state = patch.state;
      if (patch.photo !== undefined) d.photo = patch.photo;
      if (patch.houseNo !== undefined) { d.houseNo = patch.houseNo; d.house_no = patch.houseNo; }
      if (patch.floor !== undefined) d.floor = patch.floor;
      localStorage.setItem(key, JSON.stringify(d));
    }
  } catch {
    /* ignore */
  }
}
