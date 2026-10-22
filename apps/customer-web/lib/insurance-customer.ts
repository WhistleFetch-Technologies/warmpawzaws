import { apiClient } from '@/lib/api-client';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asUuid(value: unknown): string {
  const id = String(value || '').trim();
  return UUID.test(id) ? id : '';
}

export function readStoredCustomerId(): string {
  if (typeof window === 'undefined') return '';
  for (const key of ['customerId', 'customer_id', 'warmpawz_customer_id']) {
    const id = asUuid(window.localStorage.getItem(key));
    if (id) return id;
  }
  try {
    const data = JSON.parse(window.localStorage.getItem('customerData') || '{}') as Record<string, unknown>;
    return asUuid(data.id || data.customerId || data.customer_id);
  } catch {
    return '';
  }
}

function readCustomerPhone(): string {
  const stored = ['customerPhone', 'customer_phone', 'phone']
    .map((key) => window.localStorage.getItem(key)?.trim() || '')
    .find(Boolean);
  if (stored) return stored;
  try {
    const data = JSON.parse(window.localStorage.getItem('customerData') || '{}') as { phone?: string; mobile?: string };
    return String(data.phone || data.mobile || '').trim();
  } catch {
    return '';
  }
}

/** Login often stores the phone before the profile UUID. Insurance APIs require the UUID. */
export async function resolveCustomerId(): Promise<string> {
  const stored = readStoredCustomerId();
  if (stored) return stored;
  const phone = readCustomerPhone();
  if (!phone) return '';
  try {
    const profile = await apiClient.get<{ id?: string; profile?: { id?: string } }>(
      `/customer/profile?phone=${encodeURIComponent(phone)}`,
    );
    const id = asUuid(profile.profile?.id || profile.id);
    if (id) window.localStorage.setItem('customerId', id);
    return id;
  } catch {
    return '';
  }
}
