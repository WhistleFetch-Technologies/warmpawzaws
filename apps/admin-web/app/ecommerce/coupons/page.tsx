'use client';

import { ECommercePromoLayout } from '@/components/admin/ecommerce/ECommercePromoLayout';
import { AdminPromotionHub } from '@/components/admin/marketing/AdminPromotionHub';

export default function ECommerceCouponsPage() {
  return (
    <ECommercePromoLayout
      title="Seller Coupons"
      subtitle="Product and cart coupons for marketplace sellers"
    >
      <AdminPromotionHub surface="ecommerce" initialTab="coupons" hideLegacyLink />
    </ECommercePromoLayout>
  );
}
