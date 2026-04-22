'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { CustomerApp } from '@/components/customer/CustomerApp';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { persistCustomerDatabaseId } from '@/lib/customer-id-storage';
import {
  readProfileCompleted,
  readOnboardingCompleted,
  applyUnifiedProfileToCustomerLocalStorage,
} from '@/lib/customer-flow-guards';
import { getStoredCustomerJwtForSession, needsPasswordSetupAfterOtp } from '@/lib/session-utils';

interface CustomerSession {
  phone: string;
  customerId?: string;
  customer?: any;
  sessionToken?: string;
  verified: boolean;
  isNewUser?: boolean;
  hasCompletedOnboarding?: boolean;
  hasPets?: boolean;
}

export default function HomePage() {
  const router = useRouter();
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [homeGateReady, setHomeGateReady] = useState(false);
  const hasRedirected = useRef(false);

  useEffect(() => {
    const { initializeSession } = require('@/lib/session-utils');
    initializeSession();

    const storedPhone = localStorage.getItem('customerPhone');
    const storedToken = localStorage.getItem('authToken');
    const storedCustomer = localStorage.getItem('customerData');
    const storedOnboarding = localStorage.getItem('customerOnboardingComplete');
    const stageOnboardingDone = localStorage.getItem('onboarding_completed') === 'true';
    const onboardingFlagsDone = storedOnboarding === 'true' || stageOnboardingDone;
    const customerData = storedCustomer ? (() => { try { return JSON.parse(storedCustomer); } catch { return null; } })() : null;

    if (storedPhone && storedToken) {
      // Optimistic load: show app immediately with cached session so we don't block on API (slow from home / high RTT to ap-south-1).
      const cachedSession: CustomerSession = {
        phone: storedPhone,
        sessionToken: storedToken,
        verified: true,
        customer: customerData ?? undefined,
        hasCompletedOnboarding: onboardingFlagsDone,
        hasPets: !!(customerData?.pets?.length),
        isNewUser: !onboardingFlagsDone,
      };
      setSession(cachedSession);
      setIsLoading(false);

      // Refresh profile in background; update session when done.
      (async () => {
        try {
          const { apiClient } = require('@/lib/api-client');
          const profileResponse: any = await apiClient.getOrUndefinedIfNotFound(
            `/customer/profile/unified/${storedPhone}`
          );
          if (profileResponse?.profile) {
            const data = profileResponse.profile;
            localStorage.setItem('customerData', JSON.stringify(data));
            persistCustomerDatabaseId(data);
            applyUnifiedProfileToCustomerLocalStorage(data, storedPhone);
            const onboardingStatus = data.onboarding_status || data.onboardingStatus;
            const effectiveOnboarded = readOnboardingCompleted();
            setSession({
              phone: storedPhone,
              sessionToken: storedToken,
              verified: true,
              customer: data,
              hasCompletedOnboarding: effectiveOnboarded,
              hasPets: !!(data.pets?.length),
              isNewUser: !effectiveOnboarded && (onboardingStatus === 'INIT' || onboardingStatus === 'PHONE_VERIFIED'),
            });
          }
        } catch (apiError: any) {
          if (
            apiError?.code !== 'CORS_ERROR' &&
            apiError?.statusCode !== 404 &&
            typeof window !== 'undefined' &&
            process.env.NODE_ENV === 'development'
          ) {
            console.error('Error fetching customer profile (background):', apiError);
          }
        }
      })();
      return;
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading && !session && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace('/auth');
    }
  }, [isLoading, session, router]);

  useEffect(() => {
    if (isLoading || !session) return;
    if (needsPasswordSetupAfterOtp() && getStoredCustomerJwtForSession()) {
      router.replace('/auth/set-password?next=/');
      return;
    }
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      // Preserve service deep links (e.g. tele) — do not strip query via profile/onboarding redirects
      if (sp.get('service')) {
        setHomeGateReady(true);
        return;
      }
    }
    if (!readProfileCompleted()) {
      router.replace('/profile');
      return;
    }
    if (!readOnboardingCompleted()) {
      router.replace('/onboarding');
      return;
    }
    setHomeGateReady(true);
  }, [isLoading, session, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null; 
  }

  if (!homeGateReady) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="min-h-screen bg-white flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-gray-600">Loading...</p>
            </div>
          </div>
        }
      >
        <CustomerApp initialSession={session} />
      </Suspense>
    </ErrorBoundary>
  );
}
