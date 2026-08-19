/**
 * Client session refresh after in-app auth modal completes (no full /auth navigation).
 */

import { persistCustomerDatabaseId } from '@/lib/customer-id-storage';
import { readCachedPetsForPhone, stripPetsFromCustomerRecord } from '@/lib/customer-pets-cache';
import { readProfileCompleted, readOnboardingCompleted } from '@/lib/customer-flow-guards';
import { getStoredCustomerJwtForSession } from '@/lib/session-utils';

export const CUSTOMER_AUTH_COMPLETED_EVENT = 'warmpawz-customer-auth-completed';

export type CustomerAuthSessionSnapshot = {
  phone: string;
  sessionToken?: string;
  verified: boolean;
  isGuest?: boolean;
  hasCompletedOnboarding?: boolean;
  hasPets?: boolean;
  isNewUser?: boolean;
  customer?: Record<string, unknown>;
};

export function emitCustomerAuthCompleted(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(CUSTOMER_AUTH_COMPLETED_EVENT));
}

export function readCustomerAuthSessionFromStorage(): CustomerAuthSessionSnapshot | null {
  if (typeof window === 'undefined') return null;

  const storedPhone = localStorage.getItem('customerPhone');
  const storedToken = getStoredCustomerJwtForSession();
  if (!storedPhone || !storedToken) return null;

  const storedCustomer = localStorage.getItem('customerData');
  const customerData = storedCustomer
    ? (() => {
        try {
          return JSON.parse(storedCustomer) as Record<string, unknown>;
        } catch {
          return null;
        }
      })()
    : null;

  const cachedPets = readCachedPetsForPhone(storedPhone);
  const onboardingFlagsDone = readOnboardingCompleted();
  const customerBase =
    customerData && typeof customerData === 'object'
      ? stripPetsFromCustomerRecord(customerData)
      : null;

  return {
    phone: storedPhone,
    sessionToken: storedToken,
    verified: true,
    isGuest: false,
    customer: customerBase ? { ...customerBase, pets: cachedPets } : undefined,
    hasCompletedOnboarding: onboardingFlagsDone,
    hasPets: cachedPets.length > 0,
    isNewUser: !onboardingFlagsDone,
  };
}

export function persistCustomerAuthSessionSideEffects(): void {
  if (typeof window === 'undefined') return;
  const storedCustomer = localStorage.getItem('customerData');
  if (storedCustomer) {
    try {
      const data = JSON.parse(storedCustomer) as Record<string, unknown>;
      persistCustomerDatabaseId(data);
    } catch {
      /* ignore */
    }
  }
}
