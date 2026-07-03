'use client';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { CommercialCampaignHub } from '@/components/admin/marketing/campaigns/CommercialCampaignHub';

export default function CommercialCampaignsPage() {
  return (
    <AdminLayout>
      <CommercialCampaignHub />
    </AdminLayout>
  );
}
