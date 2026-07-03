'use client';

import { ECommercePromoLayout } from '@/components/admin/ecommerce/ECommercePromoLayout';
import { CommercialCampaignHub } from '@/components/admin/marketing/campaigns/CommercialCampaignHub';

export default function ECommerceCampaignsPage() {
  return (
    <ECommercePromoLayout
      title="Seller Campaigns"
      subtitle="Marketplace commercial campaigns — same Phase 10 engine, product domain"
    >
      <CommercialCampaignHub surface="ecommerce" />
    </ECommercePromoLayout>
  );
}
