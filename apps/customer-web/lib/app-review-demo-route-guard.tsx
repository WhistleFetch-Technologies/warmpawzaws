'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isReviewBlockedUrlPath, readStoredCustomerPhone } from '@/lib/app-review-demo-account';

/**
 * Redirects the App Store review demo account away from blocked URL routes.
 * Renders nothing while redirecting; children when allowed.
 */
export function AppReviewDemoRouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const phone = readStoredCustomerPhone();
    if (isReviewBlockedUrlPath(window.location.pathname, phone)) {
      router.replace('/');
    }
  }, [router]);

  if (typeof window !== 'undefined') {
    const phone = readStoredCustomerPhone();
    if (isReviewBlockedUrlPath(window.location.pathname, phone)) {
      return null;
    }
  }

  return <>{children}</>;
}

/** Redirect shell screens blocked for the review demo account (e.g. shop, rewards). */
export function ReviewDemoShellRedirect({ onHome }: { onHome: () => void }) {
  useEffect(() => {
    onHome();
  }, [onHome]);
  return null;
}
