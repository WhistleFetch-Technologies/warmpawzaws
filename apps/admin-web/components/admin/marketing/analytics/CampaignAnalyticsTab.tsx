'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import { MetricTable } from './MetricTable';
import { formatInr, formatNumber, formatPercent } from '@/lib/marketing-analytics/format';
import type { AnalyticsReport } from '@/lib/marketing-analytics/types';
import { AnalyticsEmptyState } from './AnalyticsStateViews';
import { ComingSoonPanel } from '../policyCenter/shared/ApiPendingBanner';

export function CampaignAnalyticsTab({ report }: { report: AnalyticsReport }) {
  const [campaignMode, setCampaignMode] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await apiClient.get<{ mode: string }>('/admin/commercial-campaigns/mode');
        setCampaignMode(res.mode);
      } catch {
        setCampaignMode(null);
      }
    })();
  }, []);

  const campaigns = report.campaigns?.campaigns ?? [];

  if (campaignMode === 'OFF') {
    return (
      <ComingSoonPanel
        title="Campaign analytics unavailable"
        description="Commercial Campaign Engine is disabled. Enable DISCOUNT_ENGINE_V2_CAMPAIGN_MODE to link campaigns, then analytics will aggregate via Phase 9 + campaign metadata."
        apiPath="GET /admin/commercial-campaigns/:id/analytics"
      />
    );
  }

  if (!campaigns.length) {
    return (
      <div className="space-y-4">
        <Badge variant="outline">Campaign engine: {campaignMode ?? 'unknown'}</Badge>
        <AnalyticsEmptyState title="No campaign performance rows in Phase 9 report yet" />
        <p className="text-sm text-slate-600">
          Campaign-level metrics appear when commercial campaigns are orchestrated and linked promotions generate usage.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Badge variant="outline">Campaign engine: {campaignMode}</Badge>
      <MetricTable
        rows={campaigns}
        searchKeys={['name', 'id']}
        exportFilename="campaign-analytics.csv"
        columns={[
          { key: 'name', label: 'Campaign' },
          { key: 'usageCount', label: 'Usage', render: (r) => formatNumber(r.usageCount) },
          { key: 'savings', label: 'Savings', render: (r) => formatInr(r.savings) },
          { key: 'conversionRate', label: 'Conversion', render: (r) => formatPercent(r.conversionRate) },
        ]}
      />
    </div>
  );
}
