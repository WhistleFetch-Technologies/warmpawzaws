'use client';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { MarketingAnalyticsHub } from '@/components/admin/marketing/analytics/MarketingAnalyticsHub';

export default function MarketingAnalyticsPage() {
  return (
    <AdminLayout>
      <MarketingAnalyticsHub />
    </AdminLayout>
  );
}
