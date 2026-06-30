'use client';

import React, { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { MealPlanOrdersPanel } from '@/components/customer/meal-plans/MealPlanOrdersPanel';
import { MealPlansComingSoon } from '@/components/customer/nutrition/MealPlansComingSoon';
import { isCustomerMealPlansEnabled } from '@/lib/customer-meal-plans-flag';

function MealPlanOrdersContent() {
  const router = useRouter();
  if (!isCustomerMealPlansEnabled()) {
    return (
      <MealPlansComingSoon
        onBack={() => router.push('/')}
        title="Meal plan orders"
        subtitle="Track deliveries when we launch"
      />
    );
  }
  return <MealPlanOrdersPanel />;
}

export default function MealPlanOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[100dvh] max-w-customer items-center justify-center bg-[var(--color-primary-50,#FFF5EE)]">
          <div className="h-11 w-11 animate-spin rounded-full border-2 border-orange-200 border-t-orange-500" />
        </div>
      }
    >
      <MealPlanOrdersContent />
    </Suspense>
  );
}
