'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ensureDeepLinkBackStack } from './deep-link-stack';

/** Seed browser history on cold deep links so Back has a sensible parent route. */
export function useDeepLinkBackStack(): void {
  const pathname = usePathname() || '/';

  useEffect(() => {
    ensureDeepLinkBackStack(pathname);
  }, [pathname]);
}
