'use client';

import { ECommercePromoLayout } from '@/components/admin/ecommerce/ECommercePromoLayout';
import { AdminPromotionHub } from '@/components/admin/marketing/AdminPromotionHub';

export default function ECommercePromotionsPage() {
  return (
    <ECommercePromoLayout
      title="Promotions & Coupons"
      subtitle="Seller and product promotions, cart coupons, and marketplace offers"
    >
      <AdminPromotionHub surface="ecommerce" hideLegacyLink />
    </ECommercePromoLayout>
  );
}
