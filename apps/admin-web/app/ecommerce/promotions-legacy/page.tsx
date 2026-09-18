'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ECommercePromoLayout } from '@/components/admin/ecommerce/ECommercePromoLayout';

export default function ECommercePromotionsLegacyPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/promotion-center?tab=engine');
  }, [router]);

  return (
    <ECommercePromoLayout
      title="Promotion Engine"
      subtitle="Legacy promotions and coupons have been retired"
    >
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Redirecting to Promotion Engine…
      </div>
    </ECommercePromoLayout>
  );
}
