'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { persistCustomerDatabaseId } from '@/lib/customer-id-storage';
import { CustomerUserProfile } from '@/components/customer/CustomerUserProfile';
import { CustomerProfileView } from '@/components/customer/CustomerProfileView';
import {
  markOnboardingCompleteAfterProfile,
  profileIndicatesExistingCustomer,
  readProfileCompleted,
  resolvePostProfileRedirectPath,
} from '@/lib/customer-flow-guards';
import { goBackOrHome } from '@/lib/go-back-or-replace';
import {
  clearCustomerSession,
  getStoredCustomerJwtForSession,
} from '@/lib/session-utils';
import { AuthGateLoadingShell } from '@/components/AuthGateLoadingShell';
import { redirectWithHardFallback } from '@/lib/auth-gate-redirect';
import { readGuestBookingIntent } from '@/lib/guest-booking-intent';

export default function ProfilePage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [flowReady, setFlowReady] = useState(false);
  const [showCreateFlow, setShowCreateFlow] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const storedPhone = localStorage.getItem('customerPhone');
      const token = getStoredCustomerJwtForSession();
      if (!storedPhone || !token) {
        redirectWithHardFallback(router, '/auth', { method: 'push' });
        return;
      }
      setPhone(storedPhone);

      const cached = (() => {
        try {
          const raw = localStorage.getItem('customerData');
          return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
        } catch {
          return null;
        }
      })();

      if (readProfileCompleted() || profileIndicatesExistingCustomer(cached, storedPhone)) {
        markOnboardingCompleteAfterProfile();
        if (!cancelled) {
          setShowCreateFlow(false);
          setFlowReady(true);
        }
        return;
      }

      try {
        const res = await apiClient.getOrUndefinedIfNotFound<{ profile?: Record<string, unknown> }>(
          `/customer/profile/unified/${encodeURIComponent(storedPhone)}`
        );
        if (cancelled) return;
        if (res?.profile && profileIndicatesExistingCustomer(res.profile, storedPhone)) {
          localStorage.setItem('customerData', JSON.stringify(res.profile));
          localStorage.setItem('customerProfile', JSON.stringify(res.profile));
          persistCustomerDatabaseId(res.profile);
          markOnboardingCompleteAfterProfile();
          setShowCreateFlow(false);
          setFlowReady(true);
          return;
        }
      } catch {
        /* fall through to create form for brand-new accounts */
      }

      if (!cancelled) {
        setShowCreateFlow(!readProfileCompleted());
        setFlowReady(true);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleCreateProfileComplete = useCallback(async () => {
    if (typeof window === 'undefined') return;
    markOnboardingCompleteAfterProfile();
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
    const next =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('next')
        : null;
    router.replace(resolvePostProfileRedirectPath(next, readGuestBookingIntent()));
  }, [router]);

  const handleCreateProfileBack = useCallback(() => {
    if (typeof window === 'undefined') return;
    clearCustomerSession();
    router.replace('/auth');
  }, [router]);

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
