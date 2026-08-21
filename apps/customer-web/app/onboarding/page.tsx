'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { markOnboardingCompleteAfterProfile, readProfileCompleted } from '@/lib/customer-flow-guards';
import { getStoredCustomerJwtForSession } from '@/lib/session-utils';
import { readGuestBookingIntent, transactionRequiresPet } from '@/lib/guest-booking-intent';
import { AuthGateLoadingShell } from '@/components/AuthGateLoadingShell';

/** Stage selection is retired. Pets can be added later from home. */
export default function OnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    const phone = localStorage.getItem('customerPhone');
    const token = getStoredCustomerJwtForSession();
    if (!phone || !token) {
      router.replace('/auth');
      return;
    }
    if (!readProfileCompleted()) {
      router.replace('/profile');
      return;
    }

    markOnboardingCompleteAfterProfile();

    const intent = readGuestBookingIntent();
    if (intent?.returnPath?.startsWith('/') && !transactionRequiresPet(intent)) {
      router.replace(intent.returnPath);
      return;
    }
    const next =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('next')
        : null;
    if (next && next.startsWith('/')) {
      router.replace(next);
      return;
    }
    router.replace('/');
  }, [router]);

  return <AuthGateLoadingShell />;
}
