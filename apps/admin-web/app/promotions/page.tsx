'use client';

import { Suspense, useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { AdminPromotionHub } from '@/components/admin/marketing/AdminPromotionHub';
import type { KindFilter } from '@warmpawz/promotion-management-ui';

function PromotionsPageInner() {
  const [initialKindFilter, setInitialKindFilter] = useState<KindFilter | undefined>(undefined);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    if (type === 'coupons' || type === 'coupon') {
      setInitialKindFilter('coupon');
    } else if (type === 'promotions' || type === 'promotion') {
      setInitialKindFilter('promotion');
    }
  }, []);

  return <AdminPromotionHub surface="marketing" initialKindFilter={initialKindFilter} />;
}

export default function PromotionsPage() {
  return (
    <AdminLayout>
      <Suspense fallback={<div className="p-8 text-slate-500">Loading promotions…</div>}>
        <PromotionsPageInner />
      </Suspense>
    </AdminLayout>
  );
}
