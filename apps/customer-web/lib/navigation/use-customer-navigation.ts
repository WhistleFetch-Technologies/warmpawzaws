'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createCustomerNavigation } from './navigation-service';

/** React hook — NavigationService bound to Next.js App Router. */
export function useCustomerNavigation() {
  const router = useRouter();
  return useMemo(() => createCustomerNavigation(router), [router]);
}
