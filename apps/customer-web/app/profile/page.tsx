'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { persistCustomerDatabaseId } from '@/lib/customer-id-storage';
import { CustomerUserProfile } from '@/components/customer/CustomerUserProfile';
import { CustomerProfileView } from '@/components/customer/CustomerProfileView';
import { readProfileCompleted } from '@/lib/customer-flow-guards';
import { goBackOrHome } from '@/lib/go-back-or-replace';
import {
  getPostLogoutHref,
  getStoredCustomerJwtForSession,
  needsPasswordSetupAfterOtp,
  signOutCustomer,
} from '@/lib/session-utils';
import { AuthGateLoadingShell } from '@/components/AuthGateLoadingShell';
import { redirectWithHardFallback } from '@/lib/auth-gate-redirect';
import { readGuestBookingIntent, transactionRequiresPet } from '@/lib/guest-booking-intent';

export default function ProfilePage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [flowReady, setFlowReady] = useState(false);
  const [showCreateFlow, setShowCreateFlow] = useState(false);

  useEffect(() => {
    const storedPhone = localStorage.getItem('customerPhone');
    const token = getStoredCustomerJwtForSession();
    if (!storedPhone || !token) {
      redirectWithHardFallback(router, '/auth', { method: 'push' });
      return;
    }
    setPhone(storedPhone);
    const createFirst = !readProfileCompleted();
    setShowCreateFlow(createFirst);
    setFlowReady(true);
  }, [router]);

  const handleCreateProfileComplete = useCallback(async () => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('profile_completed', 'true');
    try {
      const storedPhone = localStorage.getItem('customerPhone');
      if (storedPhone) {
        const res = await apiClient.getOrUndefinedIfNotFound<{ profile?: Record<string, unknown> }>(
          `/customer/profile/unified/${encodeURIComponent(storedPhone)}`
        );
        if (res?.profile) {
          localStorage.setItem('customerData', JSON.stringify(res.profile));
          localStorage.setItem('customerProfile', JSON.stringify(res.profile));
          persistCustomerDatabaseId(res.profile);
        }
      }
    } catch {
      // Unified fetch is best-effort; gates still use profile_completed
    }
    const intent = readGuestBookingIntent();
    const journeyPath =
      intent?.returnPath && intent.returnPath.startsWith('/') ? intent.returnPath : null;
    if (needsPasswordSetupAfterOtp()) {
      router.replace(
        '/auth/set-password?next=' + encodeURIComponent(journeyPath || '/onboarding')
      );
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
    // Pending guest conversion: resume the snapshot. Pet only if this transaction needs it.
    if (journeyPath) {
      if (transactionRequiresPet(intent) && intent?.kind === 'add_pet') {
        router.replace('/?open=add-pet');
        return;
      }
      router.replace(journeyPath);
      return;
    }
    router.replace('/onboarding');
  }, [router]);

  const handleCreateProfileBack = useCallback(() => {
    if (typeof window === 'undefined') return;
    void signOutCustomer().then(() => {
      if (typeof window !== 'undefined') {
        window.location.href = getPostLogoutHref();
      }
    });
  }, []);

  if (!flowReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  if (showCreateFlow) {
    return (
      <CustomerUserProfile
        session={{ phone }}
        onComplete={handleCreateProfileComplete}
        onBack={handleCreateProfileBack}
      />
    );
  }

  if (!phone) {
    return <AuthGateLoadingShell />;
  }

  return (
    <CustomerProfileView
      phone={phone}
      onBack={() => goBackOrHome(router)}
      onCloseToHome={() => router.push('/')}
    />
  );
}
