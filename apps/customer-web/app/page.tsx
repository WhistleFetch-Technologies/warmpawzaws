'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { CustomerApp } from '@/components/customer/CustomerApp';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { persistCustomerDatabaseId } from '@/lib/customer-id-storage';
import { readCachedPetsForPhone, stripPetsFromCustomerRecord } from '@/lib/customer-pets-cache';
import { readProfileCompleted, readOnboardingCompleted } from '@/lib/customer-flow-guards';
import { getStoredCustomerJwtForSession } from '@/lib/session-utils';
import {
  ensureCustomerProfileAndPets,
  resetHomeBootstrapForPhone,
} from '@/lib/customer-home-bootstrap';
import { isGuestBrowsingEnabled } from '@/lib/guest-browsing-flag';
import { isGuestApplicationState } from '@/lib/guest-auth-gate';
import { readGuestBookingIntent, shouldDeferHomeOnboarding } from '@/lib/guest-booking-intent';
import { AuthGateLoadingShell } from '@/components/AuthGateLoadingShell';
import { redirectWithHardFallback } from '@/lib/auth-gate-redirect';

interface CustomerSession {
  phone: string;
  customerId?: string;
  customer?: any;
  sessionToken?: string;
  verified: boolean;
  isNewUser?: boolean;
  hasCompletedOnboarding?: boolean;
  hasPets?: boolean;
  /** Unauthenticated browse session (GUEST_BROWSING_ENABLED). */
  isGuest?: boolean;
}

const GUEST_SESSION: CustomerSession = {
  phone: '',
  verified: false,
  isGuest: true,
  hasCompletedOnboarding: true,
  hasPets: false,
};

function HomeLoadingShell() {
  return <AuthGateLoadingShell />;
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

      const sp = new URLSearchParams(window.location.search);
      if (sp.get('service')) {
        setHomeGateReady(true);
      } else if (readProfileCompleted()) {
        setHomeGateReady(true);
      }

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

    if (isGuestApplicationState() || isGuestBrowsingEnabled()) {
      setSession(GUEST_SESSION);
      setHomeGateReady(true);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (isLoading || session || hasRedirected.current) return;
    if (isGuestApplicationState() || isGuestBrowsingEnabled()) {
      setSession(GUEST_SESSION);
      setHomeGateReady(true);
      return;
    }
    hasRedirected.current = true;
    redirectWithHardFallback(router, '/auth');
  }, [isLoading, session, router]);

  useEffect(() => {
    if (isLoading || !session) return;
    if (session.isGuest) {
      setHomeGateReady(true);
      return;
    }
    const sp = new URLSearchParams(window.location.search);
    // Preserve service deep links (e.g. tele) — do not strip query via profile/onboarding redirects
    if (sp.get('service')) {
      setHomeGateReady(true);
      return;
    }
    // Pending guest conversion: restore journey first. Do not dump at profile/onboarding
    // or force pet creation. Transaction-specific pet happens after restore.
    if (shouldDeferHomeOnboarding()) {
      setHomeGateReady(true);
      return;
    }
    if (!readProfileCompleted()) {
      router.replace('/profile');
      return;
    }
    setHomeGateReady(true);
  }, [isLoading, session, router]);

  if (isLoading) {
    return <HomeLoadingShell />;
  }

  if (!session) {
    // Guest flag resolution / auth redirect in flight
    return <HomeLoadingShell />;
  }

  if (!homeGateReady) {
    return <HomeLoadingShell />;
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<HomeLoadingShell />}>
        <CustomerApp initialSession={session} />
      </Suspense>
    </ErrorBoundary>
  );
}
