'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { CustomerApp } from '@/components/customer/CustomerApp';
import { GuestVendorShareProfile } from '@/components/customer/guest/GuestVendorShareProfile';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { persistCustomerDatabaseId } from '@/lib/customer-id-storage';
import { readProfileCompleted, readOnboardingCompleted } from '@/lib/customer-flow-guards';
import { getStoredCustomerJwtForSession } from '@/lib/session-utils';
import {
  buildVendorShareAppPath,
  readVendorIdFromShareLocation,
  vendorShareParamsToInitialNavigation,
  type VendorShareNavigationParams,
} from '@/lib/vendor-profile-share';

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

function readBoardingShareParams(searchParams: URLSearchParams): VendorShareNavigationParams {
  return {
    persona: 'boarding',
    serviceSlug: searchParams.get('service') ?? searchParams.get('serviceSlug') ?? 'overnight',
    vendorName: searchParams.get('name') ?? searchParams.get('vendorName'),
    intent: searchParams.get('intent'),
    serviceId: searchParams.get('serviceId') ?? searchParams.get('service_id'),
  };
}

function PetBoardingVendorProfileInner({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shareParams = readBoardingShareParams(searchParams);
  const serviceSlug = shareParams.serviceSlug || 'overnight';

  const [session, setSession] = useState<CustomerSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [gateReady, setGateReady] = useState(false);

  const nextPath = buildVendorShareAppPath(vendorId, shareParams);
  const initialBannerNavigation = vendorShareParamsToInitialNavigation(vendorId, shareParams);

  useEffect(() => {
    const { initializeSession } = require('@/lib/session-utils');
    initializeSession();

    const storedPhone = localStorage.getItem('customerPhone');
    const storedToken = getStoredCustomerJwtForSession();
    const storedCustomer = localStorage.getItem('customerData');
    const storedOnboarding = localStorage.getItem('customerOnboardingComplete');
    const stageOnboardingDone = localStorage.getItem('onboarding_completed') === 'true';
    const onboardingFlagsDone = storedOnboarding === 'true' || stageOnboardingDone;
    const customerData = storedCustomer ? (() => { try { return JSON.parse(storedCustomer); } catch { return null; } })() : null;

    if (storedPhone && storedToken) {
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

      (async () => {
        try {
          const { apiClient } = require('@/lib/api-client');
          const profileResponse: any = await apiClient.get(`/customer/profile/unified/${storedPhone}`);
          if (profileResponse?.profile) {
            const data = profileResponse.profile;
            const onboardingStatus = data.onboarding_status || data.onboardingStatus;
            const profileCompleted = data.profile_completed || data.onboardingComplete;
            const name = data.name || data.full_name || '';
            const hasRealName = !!name && String(name).trim() !== '' && name !== `Customer ${(storedPhone || '').slice(-4)}`;
            const hasBookings = (data.bookings?.length || 0) > 0;
            const hasProfileId = !!data.id;
            const backendFullyOnboarded =
              onboardingStatus === 'COMPLETED' || profileCompleted === true;
            const hasMeaningfulProfile =
              (hasProfileId && hasRealName) || (hasProfileId && hasBookings);
            if (backendFullyOnboarded) {
              localStorage.setItem('profile_completed', 'true');
              localStorage.setItem('onboarding_completed', 'true');
            } else if (hasMeaningfulProfile) {
              localStorage.setItem('profile_completed', 'true');
            }
            const stageDone = readOnboardingCompleted();
            const effectiveOnboarded = backendFullyOnboarded || stageDone;
            localStorage.setItem('customerData', JSON.stringify(data));
            persistCustomerDatabaseId(data);
            localStorage.setItem('customerOnboardingComplete', effectiveOnboarded ? 'true' : 'false');
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
          if (apiError?.code !== 'CORS_ERROR' && typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
            console.error('Error fetching customer profile (background):', apiError);
          }
        }
      })();
      return;
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (isLoading || !session) return;
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
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <GuestVendorShareProfile vendorId={vendorId} shareParams={shareParams} />;
  }

  if (!gateReady) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (initialBannerNavigation?.screen === 'boarding-booking') {
    return (
      <CustomerApp
        initialSession={session}
        initialBannerNavigation={initialBannerNavigation}
      />
    );
  }

  return (
    <CustomerApp
      initialSession={session}
      initialScreen="pet-boarding-profile"
      petBoardingVendorId={vendorId}
      petBoardingServiceSlug={serviceSlug}
    />
  );
}

function PetBoardingVendorProfileGate() {
  const params = useParams();
  const searchParams = useSearchParams();
  const paramVendorId =
    typeof params?.vendorId === 'string'
      ? params.vendorId
      : Array.isArray(params?.vendorId)
        ? params.vendorId[0]
        : '';

  const vendorId =
    typeof window !== 'undefined'
      ? readVendorIdFromShareLocation() ||
        (paramVendorId && paramVendorId !== 'placeholder' ? decodeURIComponent(paramVendorId) : '')
      : searchParams.get('vendorId') || searchParams.get('vendor_id') ||
        (paramVendorId && paramVendorId !== 'placeholder' ? decodeURIComponent(paramVendorId) : '');

  if (!vendorId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-gray-600">Invalid boarding center link.</p>
      </div>
    );
  }

  return <PetBoardingVendorProfileInner vendorId={vendorId} />;
}

export default function PetBoardingVendorProfilePageClient() {
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
        <PetBoardingVendorProfileGate />
      </Suspense>
    </ErrorBoundary>
  );
}
