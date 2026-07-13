'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { HomeServiceProviderProfile } from '@/components/customer/home-services/HomeServiceProviderProfile';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SERVICE_CONFIGS } from '@/lib/home/service-configs';
import {
  SEARCH_WALKER_BOOKING_INTENT_KEY,
  SEARCH_WALKER_CENTER_RETURN_KEY,
  type SearchWalkerBookingIntent,
} from '@/lib/search-booking-launch';
import {
  buildWalkerServiceDataForVendorPackagePurchase,
  isVendorServicePackageRow,
} from '@/lib/vendor-package-purchase-nav';

function readReturnSearchUrl(): string {
  if (typeof window === 'undefined') return '/search?category=walker';
  try {
    const raw = sessionStorage.getItem(SEARCH_WALKER_CENTER_RETURN_KEY);
    if (!raw) return '/search?category=walker';
    const parsed = JSON.parse(raw) as { returnSearchUrl?: string };
    return parsed.returnSearchUrl || '/search?category=walker';
  } catch {
    return '/search?category=walker';
  }
}

function WalkerVendorProfileContent({ vendorId }: { vendorId: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState<string | null>(null);
  const returnSearchUrl = readReturnSearchUrl();

  useEffect(() => {
    setPhone(localStorage.getItem('customerPhone'));
  }, []);

  const handleBack = useCallback(() => {
    router.push(returnSearchUrl);
  }, [router, returnSearchUrl]);

  const launchWalkerBooking = useCallback(
    (partial: Partial<SearchWalkerBookingIntent>) => {
      const intent: SearchWalkerBookingIntent = {
        vendorId,
        serviceType: 'walking',
        serviceStyle: 'at_home',
        returnSearchUrl,
        ...partial,
      };
      try {
        sessionStorage.setItem(SEARCH_WALKER_BOOKING_INTENT_KEY, JSON.stringify(intent));
      } catch {
        /* ignore */
      }
      router.push('/booking/walker');
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
      serviceType="walker"
      config={SERVICE_CONFIGS.walker}
      onBack={handleBack}
      onOpenWalkServicesAndBundles={() => {
        launchWalkerBooking({
          walker: { id: vendorId, vendorId, name: 'Walker' },
        });
      }}
      onSelectService={(service, rawRow) => {
        if (rawRow && isVendorServicePackageRow(rawRow)) {
          const pkgNav = buildWalkerServiceDataForVendorPackagePurchase({
            vendorId,
            serviceRow: rawRow,
            serviceTypeCategory: 'walking',
            serviceStyle: 'at_home',
          });
          if (pkgNav) {
            launchWalkerBooking({
              serviceId: String(pkgNav.serviceId || service.id),
              serviceName: service.name,
              price: service.price,
              duration: service.duration,
              walker: pkgNav.walker as Record<string, unknown> | undefined,
            });
            return;
          }
        }
        launchWalkerBooking({
          serviceId: service.id,
          serviceName: service.name,
          price: service.price,
          duration: service.duration,
          walker: { id: vendorId, vendorId },
        });
      }}
      onNavigate={() => {
        /* search profile — no shell child screens */
      }}
    />
  );
}

function WalkerVendorProfileGate() {
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
        <p className="text-gray-600">Invalid walker profile link.</p>
      </div>
    );
  }

  return <WalkerVendorProfileContent vendorId={vendorId} />;
}

export default function WalkerVendorProfilePageClient() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="min-h-screen bg-white flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          </div>
        }
      >
        <WalkerVendorProfileGate />
      </Suspense>
    </ErrorBoundary>
  );
}
