'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CustomerOnboarding } from '@/components/customer/CustomerOnboarding';
import { readProfileCompleted } from '@/lib/customer-flow-guards';
import { getStoredCustomerJwtForSession, needsPasswordSetupAfterOtp } from '@/lib/session-utils';

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
    }
  }, [router]);

  return (
    <CustomerOnboarding
      onNoPetComplete={() => {}}
      onBack={() => router.replace('/profile')}
    />
  );
}
