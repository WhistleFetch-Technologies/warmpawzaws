'use client';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { VendorPromotionsOverview } from '@/components/admin/marketing/VendorPromotionsOverview';

export default function MarketingVendorPromotionsPage() {
  return (
    <AdminLayout>
      <VendorPromotionsOverview
        domain="SERVICE"
        title="Vendor Promotions"
        subtitle="Service vendor-created promotions and coupons"
      />
    </AdminLayout>
  );
}
