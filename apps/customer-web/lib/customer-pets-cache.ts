/**
 * Phone-scoped pet cache for customer home.
 * Prevents showing a previous account's pets after signup/login on the same browser.
 */

import type { Pet } from '@/components/customer/homepage/constants/interface';

const PETS_KEY = 'customerPets';
const PETS_OWNER_PHONE_KEY = 'customerPetsOwnerPhone';

function normalizePhone10(phone: string | null | undefined): string {
  return String(phone ?? '')
    .replace(/\D/g, '')
    .slice(-10);
}

function readCustomerDataRecord(): Record<string, unknown> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('customerData');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function writeCustomerDataPets(pets: Pet[]): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = readCustomerDataRecord() ?? {};
    localStorage.setItem('customerData', JSON.stringify({ ...existing, pets }));
  } catch {
    /* ignore */
  }
}

/** Remove pet cache keys and strip pets from customerData. */
export function clearCachedPetsForPhone(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PETS_KEY);
    localStorage.removeItem(PETS_OWNER_PHONE_KEY);
    const existing = readCustomerDataRecord();
    if (existing) {
      const { pets: _pets, ...rest } = existing;
      localStorage.setItem('customerData', JSON.stringify(rest));
    }
  } catch {
    /* ignore */
  }
}

/** Read pets only when cache owner phone matches the active customer. */
export function readCachedPetsForPhone(phone: string | null | undefined): Pet[] {
  if (typeof window === 'undefined') return [];
  const normalized = normalizePhone10(phone);
  if (!normalized) return [];

  try {
    const owner = normalizePhone10(localStorage.getItem(PETS_OWNER_PHONE_KEY));
    if (owner && owner !== normalized) return [];

    const rawPets = localStorage.getItem(PETS_KEY);
    if (rawPets) {
      const parsed = JSON.parse(rawPets);
      if (Array.isArray(parsed)) return parsed as Pet[];
    }
  } catch {
    /* ignore */
  }

  try {
    const data = readCustomerDataRecord();
    if (Array.isArray(data?.pets)) return data.pets as Pet[];
  } catch {
    /* ignore */
  }

  return [];
}

/** Persist pets for the given phone (including empty list to clear stale data). */
export function writeCachedPetsForPhone(phone: string | null | undefined, pets: Pet[]): void {
  if (typeof window === 'undefined') return;
  const normalized = normalizePhone10(phone);
  if (!normalized) return;

  try {
    localStorage.setItem(PETS_OWNER_PHONE_KEY, normalized);
    localStorage.setItem(PETS_KEY, JSON.stringify(pets));
    writeCustomerDataPets(pets);
  } catch {
    /* ignore */
  }
}

/** Profile records should not carry pets; use writeCachedPetsForPhone instead. */
export function stripPetsFromCustomerRecord<T extends Record<string, unknown>>(record: T): Omit<T, 'pets'> {
  const { pets: _pets, ...rest } = record;
  return rest;
}
  if (typeof window === 'undefined') return [];
  const phone =
    localStorage.getItem('customerPhone') ||
    localStorage.getItem('customer_phone') ||
    localStorage.getItem('phone');
  return readCachedPetsForPhone(phone);
}

/** Backward-compatible write using customerPhone from localStorage. */
export function persistPetsToLocalStorage(pets: Pet[]): void {
  if (typeof window === 'undefined') return;
  const phone =
    localStorage.getItem('customerPhone') ||
    localStorage.getItem('customer_phone') ||
    localStorage.getItem('phone');
  writeCachedPetsForPhone(phone, pets);
}
