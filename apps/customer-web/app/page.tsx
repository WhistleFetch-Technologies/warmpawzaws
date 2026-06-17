'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { CustomerApp } from '@/components/customer/CustomerApp';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { persistCustomerDatabaseId } from '@/lib/customer-id-storage';
import { readCachedPetsForPhone, stripPetsFromCustomerRecord } from '@/lib/customer-pets-cache';
import { readProfileCompleted, readOnboardingCompleted } from '@/lib/customer-flow-guards';
import { getStoredCustomerJwtForSession, needsPasswordSetupAfterOtp } from '@/lib/session-utils';
import {
  ensureCustomerProfileAndPets,
  resetHomeBootstrapForPhone,
} from '@/lib/customer-home-bootstrap';

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
  const [homeGateReady, setHomeGateReady] = useState(() => {
    if (typeof window === 'undefined') return false;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('service')) return true;
    return readProfileCompleted() && readOnboardingCompleted();
  });
  const hasRedirected = useRef(false);

  useEffect(() => {
    const { initializeSession } = require('@/lib/session-utils');
    initializeSession();

    const storedPhone = localStorage.getItem('customerPhone');
    // Must match password + OTP login: Cognito bundle lives in customerCognitoTokens, not always authToken.
    const storedToken = getStoredCustomerJwtForSession();
    const storedCustomer = localStorage.getItem('customerData');
    const storedOnboarding = localStorage.getItem('customerOnboardingComplete');
    const stageOnboardingDone = localStorage.getItem('onboarding_completed') === 'true';
    const onboardingFlagsDone = storedOnboarding === 'true' || stageOnboardingDone;
    const customerData = storedCustomer ? (() => { try { return JSON.parse(storedCustomer); } catch { return null; } })() : null;

    if (storedPhone && storedToken) {
      const cachedPets = readCachedPetsForPhone(storedPhone);
      const customerBase = customerData && typeof customerData === 'object' ? customerData : null;
      // Optimistic load: show app immediately with cached session so we don't block on API (slow from home / high RTT to ap-south-1).
      const cachedSession: CustomerSession = {
        phone: storedPhone,
        sessionToken: storedToken,
        verified: true,
        customer: customerBase ? { ...customerBase, pets: cachedPets } : undefined,
        hasCompletedOnboarding: onboardingFlagsDone,
        hasPets: cachedPets.length > 0,
        isNewUser: !onboardingFlagsDone,
      };
      setSession(cachedSession);
      setIsLoading(false);
      resetHomeBootstrapForPhone(storedPhone);

      // Single coordinated profile + pets refresh (deduped with home bootstrap).
      void ensureCustomerProfileAndPets(storedPhone).refreshPromise.then((result) => {
        const data = result.profile;
        if (!data) return;
        localStorage.setItem(
          'customerData',
          JSON.stringify({ ...stripPetsFromCustomerRecord(data), phone: storedPhone })
        );
        persistCustomerDatabaseId(data);
        const onboardingStatus = data.onboarding_status || data.onboardingStatus;
        const effectiveOnboarded = readOnboardingCompleted();
        const pets = result.pets;
        setSession({
          phone: storedPhone,
          sessionToken: storedToken,
          verified: true,
          customer: { ...data, pets },
          hasCompletedOnboarding: effectiveOnboarded,
          hasPets: pets.length > 0,
          isNewUser:
            !effectiveOnboarded &&
            (onboardingStatus === 'INIT' || onboardingStatus === 'PHONE_VERIFIED'),
        });
      });
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

  const skipGateSpinner =
    typeof window !== 'undefined' && readProfileCompleted() && readOnboardingCompleted();

  if (!homeGateReady && !skipGateSpinner) {
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
