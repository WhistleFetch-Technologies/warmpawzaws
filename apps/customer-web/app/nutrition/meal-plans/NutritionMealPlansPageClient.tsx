'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MealPlansList } from '@/components/customer/nutrition/MealPlansList';
import type { NutritionVendorCardModel } from '@/components/customer/nutrition/NutritionVendorDetailsCard';

function NutritionMealPlansContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vendorId = (searchParams.get('vendorId') || '').trim();
  const [phone, setPhone] = useState('');

  useEffect(() => {
    setPhone(localStorage.getItem('customerPhone') || localStorage.getItem('customer_phone') || '');
  }, []);

  const returnSearchUrl = '/search?category=nutritionist';

  const handleBack = useCallback(() => {
    router.push(returnSearchUrl);
  }, [router]);

  let vendorSnapshot: NutritionVendorCardModel | undefined;
  if (typeof window !== 'undefined' && vendorId) {
    try {
      const raw = sessionStorage.getItem('warmpawz_search_nutrition_meal_plan_vendor');
      if (raw) {
        const parsed = JSON.parse(raw) as { vendorId?: string; vendorSnapshot?: NutritionVendorCardModel };
        if (parsed.vendorId === vendorId && parsed.vendorSnapshot) {
          vendorSnapshot = parsed.vendorSnapshot;
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (!phone) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please login to view meal plans</p>
          <Link href="/auth" className="mt-4 inline-block rounded-full bg-orange-500 px-6 py-2 text-white">
            Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <MealPlansList
      phone={phone}
      onBack={handleBack}
      vendorFocus={
        vendorId
          ? { vendorId, vendorSnapshot }
          : null
      }
      onExitVendorFocus={() => router.push(returnSearchUrl)}
      onNavigate={(screen) => {
        if (screen === 'nutritionist-booking') {
          router.push('/booking/nutrition');
        }
      }}
    />
  );
}

export function NutritionMealPlansPageClient() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[100dvh] max-w-md items-center justify-center text-sm text-gray-600">
          Loading meal plans…
        </div>
      }
    >
      <NutritionMealPlansContent />
    </Suspense>
  );
}
