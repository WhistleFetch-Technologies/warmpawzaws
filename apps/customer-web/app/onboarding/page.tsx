'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CustomerOnboarding } from '@/components/customer/CustomerOnboarding';
import { readProfileCompleted } from '@/lib/customer-flow-guards';

export default function OnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    const phone = localStorage.getItem('customerPhone');
    const token = localStorage.getItem('authToken') || localStorage.getItem('cognitoAccessToken');
    if (!phone || !token) {
      router.replace('/auth');
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
