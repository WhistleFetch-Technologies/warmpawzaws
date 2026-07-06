'use client';

import { Suspense, useEffect, useState } from 'react';
import { ECommercePromoLayout } from '@/components/admin/ecommerce/ECommercePromoLayout';
import { AdminPromotionHub } from '@/components/admin/marketing/AdminPromotionHub';

function ECommercePromotionsInner() {
  const [initialTab, setInitialTab] = useState<
    'active' | 'scheduled' | 'expired' | 'draft' | 'coupons' | 'recent' | undefined
  >(undefined);

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab === 'coupons') setInitialTab('coupons');
  }, []);

  return (
    <ECommercePromoLayout
      title="Promotions"
      subtitle="Seller and product promotions, cart coupons, and marketplace offers"
    >
      <AdminPromotionHub surface="ecommerce" initialTab={initialTab} />
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
