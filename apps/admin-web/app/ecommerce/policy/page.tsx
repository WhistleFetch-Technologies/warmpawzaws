'use client';

import { Suspense } from 'react';
import { ECommercePromoLayout } from '@/components/admin/ecommerce/ECommercePromoLayout';
import { PolicyCenter } from '@/components/admin/marketing/policyCenter/PolicyCenter';

function ECommercePolicyInner() {
  return (
    <ECommercePromoLayout
      title="Discount Policies"
      subtitle="Marketplace discount application, stacking, funding, and limits"
    >
      <PolicyCenter embedded surface="ecommerce" />
    </ECommercePromoLayout>
  );
}

export default function ECommercePolicyPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Loading policies…</div>}>
      <ECommercePolicyInner />
    </Suspense>
  );
}
