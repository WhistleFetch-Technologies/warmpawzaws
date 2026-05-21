/**
 * Load delivery addresses for marketplace checkout.
 * Prefer GET /customer/addresses?phone=… (includes profile synthetic address when DB list is empty).
 */
import { apiClient } from '@/lib/api-client';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';

export type DeliveryAddress = {
  id?: string;
  name?: string;
  fullName?: string;
  phone?: string;
  street?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  isDefault?: boolean;
};

function resolvePhoneCandidates(explicit?: string): string[] {
  const out = new Set<string>();
  const raw =
    (explicit || '').trim() ||
    (typeof window !== 'undefined'
      ? localStorage.getItem('customerPhone') || localStorage.getItem('customer_phone') || ''
      : ''
    ).trim();

  if (!raw) return [];

  out.add(raw);
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    out.add(last10);
    out.add(`+91${last10}`);
  }
  return [...out];
}

export function pickDefaultDeliveryAddress(list: DeliveryAddress[]): DeliveryAddress | null {
  if (!list.length) return null;
  return list.find((a) => a.isDefault) ?? list[0];
}

function profileRecordToAddress(profile: Record<string, unknown>): DeliveryAddress | null {
  const line1 = String(
    profile.address ?? profile.addressLine1 ?? profile.address_line1 ?? ''
  ).trim();
  const pincode = String(profile.pincode ?? '').trim();
  if (!line1 && !pincode) return null;

  return {
    id: 'profile',
    fullName: String(
      profile.full_name ?? profile.fullName ?? profile.name ?? ''
    ).trim(),
    name: String(profile.full_name ?? profile.name ?? '').trim(),
    phone: String(profile.phone ?? '').trim(),
    addressLine1: line1,
    street: line1,
    city: String(profile.city ?? '').trim(),
    state: String(profile.state ?? '').trim(),
    pincode,
    isDefault: true,
  };
}

async function fetchAddressesByPhone(phone: string): Promise<DeliveryAddress[]> {
  const data = await apiClient.get<{ addresses?: DeliveryAddress[] }>(
    `/customer/addresses?phone=${encodeURIComponent(phone)}`
  );
  return Array.isArray(data.addresses) ? data.addresses : [];
}

async function fetchAddressesByCustomerId(customerId: string): Promise<DeliveryAddress[]> {
  const data = await apiClient.get<{ addresses?: DeliveryAddress[] }>(
    `/customer/${customerId}/addresses`
  );
  return Array.isArray(data.addresses) ? data.addresses : [];
}

async function fetchProfileAddress(phone: string): Promise<DeliveryAddress | null> {
  const profile = await apiClient.get<Record<string, unknown>>(
    `/customer/profile?phone=${encodeURIComponent(phone)}`
  );
  const direct = profileRecordToAddress(profile);
  if (direct) return direct;

  const nested = profile.customer;
  if (nested && typeof nested === 'object') {
    return profileRecordToAddress(nested as Record<string, unknown>);
  }
  return null;
}

function readProfileAddressFromLocalStorage(): DeliveryAddress | null {
  if (typeof window === 'undefined') return null;
  for (const key of ['customerData', 'customerProfile']) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw?.trim()) continue;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const addr = profileRecordToAddress(parsed);
      if (addr) return addr;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/**
 * Loads saved addresses for checkout. Tries phone-based API first (server adds profile row when needed).
 */
export async function loadCustomerDeliveryAddresses(
  phoneInput?: string
): Promise<DeliveryAddress[]> {
  const phones = resolvePhoneCandidates(phoneInput);

  for (const phone of phones) {
    try {
      const list = await fetchAddressesByPhone(phone);
      if (list.length > 0) return list;
    } catch {
      /* try next phone variant */
    }
  }

  const customerId = getResolvedCustomerId();
  if (customerId) {
    try {
      const list = await fetchAddressesByCustomerId(customerId);
      if (list.length > 0) return list;
    } catch {
      /* fall through */
    }
  }

  for (const phone of phones) {
    try {
      const profileAddr = await fetchProfileAddress(phone);
      if (profileAddr) return [profileAddr];
    } catch {
      /* try next */
    }
  }

  const local = readProfileAddressFromLocalStorage();
  if (local) return [local];

  return [];
}
