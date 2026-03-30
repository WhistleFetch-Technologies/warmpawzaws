import { apiClient } from '@/lib/api-client';
import {
  extractCustomerUuidFromProfile,
  getResolvedCustomerId,
  isCustomerDatabaseUuid,
  persistCustomerDatabaseId,
  reconcileCustomerIdStorageOnLoad,
} from '@/lib/customer-id-storage';

export function addPetErrorMessage(err: unknown): string {
  if (err && typeof err === 'object') {
    const o = err as { message?: string; responseData?: { error?: unknown; message?: unknown } };
    const rd = o.responseData;
    if (rd && typeof rd === 'object') {
      const e = rd.error;
      if (typeof e === 'string' && e.trim()) return e;
      if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: string }).message === 'string') {
        return (e as { message: string }).message;
      }
      if (typeof rd.message === 'string' && rd.message.trim()) return rd.message;
    }
    if (typeof o.message === 'string' && o.message.trim() && !/^HTTP \d+$/.test(o.message.trim())) {
      return o.message;
    }
  }
  return err instanceof Error ? err.message : 'Could not add pet';
}

export async function resolveCustomerIdForPetMutation(): Promise<string | null> {
  reconcileCustomerIdStorageOnLoad();
  const existing = getResolvedCustomerId();
  if (existing) return existing;
  const phone =
    typeof window !== 'undefined' ? localStorage.getItem('customerPhone')?.trim() || null : null;
  if (!phone) return null;
  try {
    const prof = (await apiClient.get(
      `/customer/profile?phone=${encodeURIComponent(phone)}`
    )) as Record<string, unknown>;
    const nested =
      (prof.customer && typeof prof.customer === 'object'
        ? (prof.customer as Record<string, unknown>)
        : null) ||
      (prof.profile && typeof prof.profile === 'object'
        ? (prof.profile as Record<string, unknown>)
        : null) ||
      (prof.data && typeof prof.data === 'object' && !Array.isArray(prof.data)
        ? (prof.data as Record<string, unknown>)
        : null);
    const fromNested =
      nested && typeof nested === 'object' ? extractCustomerUuidFromProfile(nested) : null;
    const fromTop = extractCustomerUuidFromProfile(prof);
    const uuid = fromNested || fromTop;
    if (uuid) {
      persistCustomerDatabaseId(uuid);
      return uuid;
    }
  } catch {
    /* fall through */
  }
  try {
    const by = (await apiClient.get(
      `/customer/by-phone?phone=${encodeURIComponent(phone)}`
    )) as Record<string, unknown>;
    const cust = by.customer as Record<string, unknown> | undefined;
    const id = (cust?.id ?? by.id) as string | undefined;
    if (id && isCustomerDatabaseUuid(String(id))) {
      persistCustomerDatabaseId(String(id));
      return String(id);
    }
  } catch {
    /* ignore */
  }
  return null;
}
