'use client';

import { ECommercePromoLayout } from '@/components/admin/ecommerce/ECommercePromoLayout';
import { VendorPromotionsOverview } from '@/components/admin/marketing/VendorPromotionsOverview';

export default function ECommerceSellerPromotionsPage() {
  return (
    <ECommercePromoLayout
      title="Seller Promotions"
      subtitle="Marketplace seller-created product promotions and coupons"
    >
      <VendorPromotionsOverview domain="ECOMMERCE" />
    </ECommercePromoLayout>
  );
}
