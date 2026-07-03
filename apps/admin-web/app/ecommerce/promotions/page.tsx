'use client';

import { ECommercePromoLayout } from '@/components/admin/ecommerce/ECommercePromoLayout';
import { AdminPromotionHub } from '@/components/admin/marketing/AdminPromotionHub';

export default function ECommercePromotionsPage() {
  return (
    <ECommercePromoLayout
      title="Seller Promotions"
      subtitle="Product and seller promotions for the marketplace"
    >
      <AdminPromotionHub surface="ecommerce" hideLegacyLink />
    </ECommercePromoLayout>
  );
}
