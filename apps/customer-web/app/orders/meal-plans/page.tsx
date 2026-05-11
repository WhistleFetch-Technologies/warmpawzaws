'use client';

import React, { Suspense } from 'react';
import { MealPlanOrdersPanel } from '@/components/customer/meal-plans/MealPlanOrdersPanel';

function MealPlanOrdersContent() {
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
