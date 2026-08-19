'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CustomerOnboarding } from '@/components/customer/CustomerOnboarding';
import { readProfileCompleted } from '@/lib/customer-flow-guards';
import { getStoredCustomerJwtForSession, needsPasswordSetupAfterOtp } from '@/lib/session-utils';
import { clearCachedPetsForPhone } from '@/lib/customer-pets-cache';
import { resetHomeBootstrapForPhone } from '@/lib/customer-home-bootstrap';
import { readGuestBookingIntent, transactionRequiresPet } from '@/lib/guest-booking-intent';

export default function OnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    const phone = localStorage.getItem('customerPhone');
    const token = getStoredCustomerJwtForSession();
    if (!phone || !token) {
      router.replace('/auth');
      return;
    }
    if (needsPasswordSetupAfterOtp()) {
      router.replace('/auth/set-password?next=' + encodeURIComponent('/onboarding'));
      return;
    }
    if (!readProfileCompleted()) {
      router.replace('/profile');
      return;
    }
    const intent = readGuestBookingIntent();
    if (intent?.returnPath?.startsWith('/') && !transactionRequiresPet(intent)) {
      router.replace(intent.returnPath);
    }
  }, [router]);

  return (
    <CustomerOnboarding
      onNoPetComplete={() => {
        clearCachedPetsForPhone();
        const phone = localStorage.getItem('customerPhone');
        resetHomeBootstrapForPhone(phone);
      }}
      onBack={() => router.replace('/profile')}
    />
  );
}
