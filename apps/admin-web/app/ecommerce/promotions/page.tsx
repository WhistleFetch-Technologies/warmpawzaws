'use client';

import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ECommercePromoLayout } from '@/components/admin/ecommerce/ECommercePromoLayout';

function ECommercePromotionsRedirectInner() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/promotion-center?tab=engine');
  }, [router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
      Redirecting to Promotion Engine…
    </div>
  );
}

export default function ECommercePromotionsPage() {
  return (
    <ECommercePromoLayout
      title="Promotion Engine"
      subtitle="Shop and service offers are managed in the Promotion Engine"
    >
      <Suspense fallback={<div className="p-8 text-slate-500">Loading…</div>}>
        <ECommercePromotionsRedirectInner />
      </Suspense>
    </ECommercePromoLayout>
  );
}
