'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import MealSubscriptionDetailClient from './MealSubscriptionDetailClient';

function MealSubscriptionDetailGate() {
  const sp = useSearchParams();
  const id = sp.get('id');
  if (!id) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center p-6 text-slate-600 text-sm">
        Open this page from &quot;My subscriptions&quot; or your subscription confirmation link.
      </div>
    );
  }
  return <MealSubscriptionDetailClient subscriptionId={id} />;
}

export default function MealSubscriptionDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-200 border-t-orange-500" />
        </div>
      }
    >
      <MealSubscriptionDetailGate />
    </Suspense>
  );
}
