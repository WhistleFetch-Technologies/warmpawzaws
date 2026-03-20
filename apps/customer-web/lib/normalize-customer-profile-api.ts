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
