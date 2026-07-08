'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { HomeServiceProviderProfile } from '@/components/customer/home-services/HomeServiceProviderProfile';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SERVICE_CONFIGS } from '@/lib/home/service-configs';
import {
  SEARCH_SITTING_BOOKING_INTENT_KEY,
  SEARCH_SITTING_CENTER_RETURN_KEY,
  type SearchSittingBookingIntent,
} from '@/lib/search-booking-launch';
import {
  buildWalkerServiceDataForVendorPackagePurchase,
  isVendorServicePackageRow,
} from '@/lib/vendor-package-purchase-nav';

function readReturnSearchUrl(): string {
  if (typeof window === 'undefined') return '/search?category=sitting';
  try {
    const raw = sessionStorage.getItem(SEARCH_SITTING_CENTER_RETURN_KEY);
    if (!raw) return '/search?category=sitting';
    const parsed = JSON.parse(raw) as { returnSearchUrl?: string };
    return parsed.returnSearchUrl || '/search?category=sitting';
  } catch {
    return '/search?category=sitting';
  }
}

function PetSitterVendorProfileContent({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState<string | null>(null);
  const returnSearchUrl = readReturnSearchUrl();

  useEffect(() => {
    setPhone(localStorage.getItem('customerPhone'));
  }, []);

  const handleBack = useCallback(() => {
    router.push(returnSearchUrl);
  }, [router, returnSearchUrl]);

  const launchSittingBooking = useCallback(
    (partial: Partial<SearchSittingBookingIntent>) => {
      const intent: SearchSittingBookingIntent = {
        vendorId,
        serviceType: 'sitting',
        serviceStyle: 'at_home',
        returnSearchUrl,
        ...partial,
      };
      try {
        sessionStorage.setItem(SEARCH_SITTING_BOOKING_INTENT_KEY, JSON.stringify(intent));
      } catch {
        /* ignore */
      }
      router.push('/booking/sitting');
    },
    [router, returnSearchUrl, vendorId]
  );

  if (!phone) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-600">Please login to view this profile</p>
      </div>
    );
  }

  return (
    <HomeServiceProviderProfile
      phone={phone}
      vendorId={vendorId}
      serviceType="sitter"
      config={SERVICE_CONFIGS.sitter}
      onBack={handleBack}
      onSelectService={(service, rawRow) => {
        if (rawRow && isVendorServicePackageRow(rawRow)) {
          const pkgNav = buildWalkerServiceDataForVendorPackagePurchase({
            vendorId,
            serviceRow: rawRow,
            serviceTypeCategory: 'sitting',
            serviceStyle: 'at_home',
          });
          if (pkgNav) {
            launchSittingBooking({
              serviceId: String(pkgNav.serviceId || service.id),
              serviceName: service.name,
              price: service.price,
              duration: service.duration,
              sitter: { id: vendorId, vendorId },
            });
            return;
          }
        }
        launchSittingBooking({
          serviceId: service.id,
          serviceName: service.name,
          price: service.price,
          duration: service.duration,
          sitter: { id: vendorId, vendorId },
        });
      }}
      onNavigate={() => {
        /* search profile — no shell child screens */
      }}
    />
  );
}

function PetSitterVendorProfileGate() {
  const params = useParams();
  const paramVendorId =
    typeof params?.vendorId === 'string'
      ? params.vendorId
      : Array.isArray(params?.vendorId)
        ? params.vendorId[0]
        : '';
  const vendorId =
    paramVendorId && paramVendorId !== 'placeholder' ? decodeURIComponent(paramVendorId) : '';

  if (!vendorId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-gray-600">Invalid pet sitter profile link.</p>
      </div>
    );
  }

  return <PetSitterVendorProfileContent vendorId={vendorId} />;
}

export default function PetSitterVendorProfilePageClient() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="min-h-screen bg-white flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          </div>
        }
      >
        <PetSitterVendorProfileGate />
      </Suspense>
    </ErrorBoundary>
  );
}
