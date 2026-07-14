'use client';

import { ECommercePromoLayout } from '@/components/admin/ecommerce/ECommercePromoLayout';
import { PromotionsManagement } from '@/components/admin/ecommerce/promotions/PromotionsManagement';
import { LegacyPromotionDeprecatedScreen } from '@/components/admin/marketing/LegacyPromotionDeprecatedScreen';
import { isLegacyPromotionUiEnabled } from '@/lib/legacy-promotion-ui';

/** Preserved legacy ecommerce promotion grid — hidden from navigation by default. */
export default function ECommercePromotionsLegacyPage() {
  const legacy = isLegacyPromotionUiEnabled();

  return (
    <ECommercePromoLayout
      title="Promotions (legacy)"
      subtitle="Preserved for rollback — not used in normal QA"
    >
      {legacy ? (
        <PromotionsManagement />
      ) : (
        <LegacyPromotionDeprecatedScreen
          description="This legacy ecommerce promotion screen has been replaced by Marketplace Promotions."
          promotionHubHref="/ecommerce/promotions"
          promotionHubLabel="Open Marketplace Promotions"
        />
      )}
    </ECommercePromoLayout>
  );
}
