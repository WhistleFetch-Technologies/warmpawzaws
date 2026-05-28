'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { CustomerApp } from '@/components/customer/CustomerApp';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  buildBannerCtaPathFromSegments,
  isBannerDeepLinkPersona,
  type BannerDeepLinkPersona,
} from '@/lib/banner-cta-parse';
import {
  resolveBannerDeepLinkNavigation,
  type InitialBannerNavigation,
} from '@/lib/banner-cta-navigation';
import { persistCustomerDatabaseId } from '@/lib/customer-id-storage';
import {
  readProfileCompleted,
  readOnboardingCompleted,
  applyUnifiedProfileToCustomerLocalStorage,
} from '@/lib/customer-flow-guards';
import { getStoredCustomerJwtForSession, needsPasswordSetupAfterOtp } from '@/lib/session-utils';
import { customerPathToScreen } from '@/lib/promotion-navigation';

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

type BannerVendorDeepLinkInnerProps = {
  persona: BannerDeepLinkPersona;
  vendorSlug?: string[];
};

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

function BannerVendorDeepLinkInner({ persona, vendorSlug }: BannerVendorDeepLinkInnerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [gateReady, setGateReady] = useState(false);
  const [initialBannerNavigation, setInitialBannerNavigation] =
    useState<InitialBannerNavigation | null>(null);
  const [resolveFailed, setResolveFailed] = useState(false);
  const hasRedirected = useRef(false);
  const resolveStarted = useRef(false);

  const ctaLink = buildBannerCtaPathFromSegments(persona, vendorSlug) ?? `/${persona}`;

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
      const next = encodeURIComponent(ctaLink);
      router.replace(`/auth?next=${next}`);
    }
  }, [isLoading, session, router, ctaLink]);

  useEffect(() => {
    if (isLoading || !session) return;
    if (needsPasswordSetupAfterOtp() && getStoredCustomerJwtForSession()) {
      router.replace(`/auth/set-password?next=${encodeURIComponent(ctaLink)}`);
      return;
    }
    if (!readProfileCompleted()) {
      router.replace(`/profile?next=${encodeURIComponent(ctaLink)}`);
      return;
    }
    if (!readOnboardingCompleted()) {
      router.replace(`/onboarding?next=${encodeURIComponent(ctaLink)}`);
      return;
    }
    setGateReady(true);
  }, [isLoading, session, router, ctaLink]);

  useEffect(() => {
    if (!gateReady || resolveStarted.current) return;
    resolveStarted.current = true;

    (async () => {
      const vendorSlugParts = vendorSlug ?? [];
      const hasVendorName = vendorSlugParts.some((s) => String(s).trim().length > 0);

      if (!hasVendorName) {
        const hubScreen = customerPathToScreen(`/${persona}`);
        if (hubScreen) {
          setInitialBannerNavigation({
            screen: hubScreen,
            data: { fromBanner: true, returnScreen: 'home' },
          });
          return;
        }
      }

      let metadata: unknown;
      const metadataRaw = searchParams.get('metadata');
      if (metadataRaw) {
        try {
          metadata = JSON.parse(metadataRaw);
        } catch {
          metadata = undefined;
        }
      }

      const resolved = await resolveBannerDeepLinkNavigation({
        ctaLink,
        title: searchParams.get('title') ?? searchParams.get('serviceName') ?? undefined,
        subtitle: searchParams.get('subtitle') ?? undefined,
        metadata,
        vendorId: searchParams.get('vendorId') ?? searchParams.get('vendor_id') ?? undefined,
        vendorServiceId:
          searchParams.get('vendorServiceId') ??
          searchParams.get('vendor_service_id') ??
          undefined,
        serviceStyle:
          searchParams.get('serviceStyle') ?? searchParams.get('service_style') ?? undefined,
      });

      if (resolved) {
        setInitialBannerNavigation(resolved);
        return;
      }

      setResolveFailed(true);
      toast.error('This offer is unavailable right now', {
        description: 'The vendor or service could not be found. Redirecting to home.',
      });
      window.setTimeout(() => router.replace('/'), 2200);
    })();
  }, [gateReady, ctaLink, persona, vendorSlug, searchParams, router]);

  if (isLoading) {
    return <LoadingShell />;
  }

  if (!session) {
    return null;
  }

  if (!gateReady) {
    return <LoadingShell />;
  }

  if (resolveFailed) {
    return <LoadingShell message="Offer unavailable — returning home..." />;
  }

  if (!initialBannerNavigation) {
    return <LoadingShell message="Opening offer..." />;
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingShell />}>
        <CustomerApp
          initialSession={session}
          initialBannerNavigation={initialBannerNavigation}
        />
      </Suspense>
    </ErrorBoundary>
  );
}

export type BannerVendorDeepLinkPageProps = {
  persona: string;
  vendorSlug?: string[];
};

export default function BannerVendorDeepLinkClient({
  persona,
  vendorSlug,
}: BannerVendorDeepLinkPageProps) {
  if (!isBannerDeepLinkPersona(persona)) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-xl font-semibold text-gray-900">Page not found</h1>
        <p className="text-gray-600 mt-2 text-sm">This service link is not supported.</p>
      </div>
    );
  }

  return (
    <Suspense fallback={<LoadingShell />}>
      <BannerVendorDeepLinkInner persona={persona} vendorSlug={vendorSlug} />
    </Suspense>
  );
}
