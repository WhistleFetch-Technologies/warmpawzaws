'use client';

import { Suspense, useEffect, useState } from 'react';
import { ECommercePromoLayout } from '@/components/admin/ecommerce/ECommercePromoLayout';
import { AdminPromotionHub } from '@/components/admin/marketing/AdminPromotionHub';
import type { KindFilter } from '@warmpawz/promotion-management-ui';

function ECommercePromotionsInner() {
  const [initialKindFilter, setInitialKindFilter] = useState<KindFilter | undefined>(undefined);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type') ?? params.get('tab');
    if (type === 'coupons' || type === 'coupon') {
      setInitialKindFilter('coupon');
    } else if (type === 'promotions' || type === 'promotion') {
      setInitialKindFilter('promotion');
    }
  }, []);

  return (
    <ECommercePromoLayout
      title="Promotions"
      subtitle="Seller and product promotions, cart coupons, and marketplace offers"
    >
      <AdminPromotionHub surface="ecommerce" initialKindFilter={initialKindFilter} />
    </ECommercePromoLayout>
  );
}

export default function ECommercePromotionsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Loading promotions…</div>}>
      <ECommercePromotionsInner />
    </Suspense>
  );
}
