'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { vendorNavigate } from '@/lib/vendor-route-nav';

export function useVendorNavigate() {
  const router = useRouter();
  const navigate = useCallback((href: string) => vendorNavigate(href, router), [router]);
  return { navigate, router };
}
