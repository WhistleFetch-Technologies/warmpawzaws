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
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
        </div>
      }
    >
      <MealPlanOrdersContent />
    </Suspense>
  );
}
