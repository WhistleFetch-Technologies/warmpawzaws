'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { WarmpawzAppointmentsVendorProfile } from '@/components/customer/warmpawz-appointments/WarmpawzAppointmentsVendorProfile';
import {
  launchSearchAppointmentsBookingFromProfile,
  readSearchAppointmentsProfileReturnUrl,
  resolveSearchHubAppointmentsServiceStyle,
} from '@/lib/search-booking-launch';
import { resolveWarmpawzBookingCategory } from '@/lib/warmpawz-appointments-customer';
import { normalizeWapptHubCategory } from '@/lib/wappt-hub-registry';

function SearchVendorProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vendorId = (searchParams.get('vendorId') || '').trim();
  const rawCategory = (searchParams.get('category') || 'grooming').trim();
  const category =
    normalizeWapptHubCategory(rawCategory) ||
    resolveWarmpawzBookingCategory(rawCategory) ||
    'grooming';
  const vendorName = (searchParams.get('vendorName') || '').trim() || undefined;
  const serviceStyle =
    (searchParams.get('serviceStyle') || '').trim() ||
    resolveSearchHubAppointmentsServiceStyle(category);
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    setPhone(localStorage.getItem('customerPhone'));
  }, []);

  const returnSearchUrl = readSearchAppointmentsProfileReturnUrl(
    `/search?category=${encodeURIComponent(category)}`
  );

  const handleBack = useCallback(() => {
    router.push(returnSearchUrl);
  }, [router, returnSearchUrl]);

  const handleNavigate = useCallback(
    (screen: string, data?: Record<string, unknown>) => {
      launchSearchAppointmentsBookingFromProfile({
        screen,
        data: { category, ...data },
        router,
        returnSearchUrl,
        fallbackCategory: category,
        fallbackVendorId: vendorId,
      });
    },
    [category, returnSearchUrl, router, vendorId]
  );

  if (phone === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please login to view this profile</p>
          <Link
            href="/auth"
            className="mt-4 inline-block rounded-full bg-orange-500 px-6 py-2 text-white"
          >
            Login
          </Link>
        </div>
      </div>
    );
  }

  if (!vendorId) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center bg-stone-100 px-6 text-center">
        <p className="text-lg font-semibold text-gray-900">No provider selected</p>
        <Link
          href={returnSearchUrl}
          className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-full bg-[#FF8C42] px-8 py-3 font-medium text-white"
        >
          Back to search
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] w-full bg-gray-50">
      <WarmpawzAppointmentsVendorProfile
        phone={phone}
        vendorId={vendorId}
        vendorName={vendorName}
        category={category}
        serviceStyle={serviceStyle}
        profileBackScreen="search"
        onBack={handleBack}
        onNavigate={handleNavigate}
      />
    </div>
  );
}

export function SearchVendorProfilePageClient() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[100dvh] max-w-md items-center justify-center text-sm text-gray-600">
          Loading provider…
        </div>
      }
    >
      <SearchVendorProfileContent />
    </Suspense>
  );
}
