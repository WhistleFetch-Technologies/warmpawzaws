'use client';

import { ECommercePromoLayout } from '@/components/admin/ecommerce/ECommercePromoLayout';
import { LegacyPromotionDeprecatedScreen } from '@/components/admin/marketing/LegacyPromotionDeprecatedScreen';
import { isLegacyPromotionUiEnabled } from '@/lib/legacy-promotion-ui';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy route — coupons live on /ecommerce/promotions (Coupons tab). */
export default function ECommerceCouponsPage() {
  const router = useRouter();
  const legacy = isLegacyPromotionUiEnabled();

  useEffect(() => {
    if (legacy) {
      router.replace('/ecommerce/promotions?tab=coupons');
    }
  }, [legacy, router]);

  if (legacy) {
    return null;
  }

  return (
    <ECommercePromoLayout title="Coupons" subtitle="Legacy route">
      <LegacyPromotionDeprecatedScreen
        description="Coupons are managed in Marketplace Promotions. Use the Coupons tab in the unified hub."
        promotionHubHref="/ecommerce/promotions"
        promotionHubLabel="Open Marketplace Promotions"
        marketingHubHref="/ecommerce"
        marketingHubLabel="Open E-Commerce Dashboard"
      />
    </ECommercePromoLayout>
  );
}
