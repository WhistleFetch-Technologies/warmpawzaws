'use client';

import { ECommercePromoLayout } from '@/components/admin/ecommerce/ECommercePromoLayout';
import { MarketingAnalyticsHub } from '@/components/admin/marketing/analytics/MarketingAnalyticsHub';

export default function ECommercePromotionAnalyticsPage() {
  return (
    <ECommercePromoLayout
      title="E-Commerce Promotion Analytics"
      subtitle="Product sales, seller promotions, cart coupons & marketplace savings"
    >
      <MarketingAnalyticsHub surface="ecommerce" />
    </ECommercePromoLayout>
  );
}
