'use client';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { AdvancedPromotionsEngine } from '@/components/admin/marketing/AdvancedPromotionsEngine';
import { LegacyPromotionDeprecatedScreen } from '@/components/admin/marketing/LegacyPromotionDeprecatedScreen';
import { isLegacyPromotionUiEnabled } from '@/lib/legacy-promotion-ui';

/** Preserved legacy modal engine route — direct access only. */
export default function MarketingLegacyPromotionsPage() {
  const legacy = isLegacyPromotionUiEnabled();

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto p-6">
        {legacy ? (
          <AdvancedPromotionsEngine />
        ) : (
          <LegacyPromotionDeprecatedScreen
            description="The legacy promotion modal has been replaced by the Promotion Hub."
            promotionHubHref="/promotions"
            promotionHubLabel="Open Promotion Hub"
            marketingHubHref="/marketing"
            marketingHubLabel="Open Marketing Content"
          />
        )}
      </div>
    </AdminLayout>
  );
}
