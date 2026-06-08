'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { CustomerApp } from '@/components/customer/CustomerApp';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { InitialBannerNavigation } from '@/lib/banner-cta-navigation';
import { persistCustomerDatabaseId } from '@/lib/customer-id-storage';
import {
  readProfileCompleted,
  readOnboardingCompleted,
  applyUnifiedProfileToCustomerLocalStorage,
} from '@/lib/customer-flow-guards';
import { getStoredCustomerJwtForSession, needsPasswordSetupAfterOtp } from '@/lib/session-utils';
import { vendorShareParamsToInitialNavigation } from '@/lib/vendor-profile-share';

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

function LoadingShell({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}

function VendorShareDeepLinkInner({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [gateReady, setGateReady] = useState(false);
  const hasRedirected = useRef(false);

  const persona = searchParams.get('persona') ?? undefined;
  const serviceStyle =
    searchParams.get('serviceStyle') ?? searchParams.get('service_style') ?? undefined;
  const vendorName = searchParams.get('name') ?? searchParams.get('vendorName') ?? undefined;
  const serviceSlug = searchParams.get('service') ?? searchParams.get('serviceSlug') ?? undefined;

  const nextPath = (() => {
    const qs = searchParams.toString();
    const base = `/vendor/${encodeURIComponent(vendorId)}`;
    return qs ? `${base}?${qs}` : base;
  })();

  const initialBannerNavigation: InitialBannerNavigation | null = vendorShareParamsToInitialNavigation(
    vendorId,
    { persona, serviceStyle, vendorName, serviceSlug }
  );

  useEffect(() => {
    const { initializeSession } = require('@/lib/session-utils');
    initializeSession();

    const storedPhone = localStorage.getItem('customerPhone');
    const storedToken = getStoredCustomerJwtForSession();
    const storedCustomer = localStorage.getItem('customerData');
    const storedOnboarding = localStorage.getItem('customerOnboardingComplete');
    const stageOnboardingDone = localStorage.getItem('onboarding_completed') === 'true';
    const onboardingFlagsDone = storedOnboarding === 'true' || stageOnboardingDone;
    const customerData = storedCustomer
      ? (() => {
          try {
            return JSON.parse(storedCustomer);
          } catch {
            return null;
          }
        })()
      : null;

    if (storedPhone && storedToken) {
      setSession({
        phone: storedPhone,
        sessionToken: storedToken,
        verified: true,
        customer: customerData ?? undefined,
        hasCompletedOnboarding: onboardingFlagsDone,
        hasPets: !!(customerData?.pets?.length),
        isNewUser: !onboardingFlagsDone,
      });
      setIsLoading(false);

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
              isNewUser:
                !effectiveOnboarded &&
                (onboardingStatus === 'INIT' || onboardingStatus === 'PHONE_VERIFIED'),
            });
          }
        } catch {
          /* keep cached session */
        }
      })();
      return;
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading && !session && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace(`/auth?next=${encodeURIComponent(nextPath)}`);
    }
  }, [isLoading, session, router, nextPath]);

  useEffect(() => {
    if (isLoading || !session) return;
    if (needsPasswordSetupAfterOtp() && getStoredCustomerJwtForSession()) {
      router.replace(`/auth/set-password?next=${encodeURIComponent(nextPath)}`);
      return;
    }
    if (!readProfileCompleted()) {
      router.replace(`/profile?next=${encodeURIComponent(nextPath)}`);
      return;
    }
    if (!readOnboardingCompleted()) {
      router.replace(`/onboarding?next=${encodeURIComponent(nextPath)}`);
      return;
    }
    setGateReady(true);
  }, [isLoading, session, router, nextPath]);

  if (isLoading) {
    return <LoadingShell />;
  }

  if (!session) {
    return null;
  }

  if (!gateReady) {
    return <LoadingShell />;
  }

  if (!initialBannerNavigation) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-gray-600">Invalid vendor link.</p>
      </div>
    );
  }

  return (
    <CustomerApp
      initialSession={session}
      initialBannerNavigation={initialBannerNavigation}
    />
  );
}

function VendorShareDeepLinkGate() {
  const params = useParams();
  const vendorId =
    typeof params?.vendorId === 'string'
      ? params.vendorId
      : Array.isArray(params?.vendorId)
        ? params.vendorId[0]
        : '';

  if (!vendorId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-gray-600">Invalid vendor link.</p>
      </div>
    );
  }

  return <VendorShareDeepLinkInner vendorId={decodeURIComponent(vendorId)} />;
}

export default function VendorShareDeepLinkClient() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingShell />}>
        <VendorShareDeepLinkGate />
      </Suspense>
    </ErrorBoundary>
  );
}
