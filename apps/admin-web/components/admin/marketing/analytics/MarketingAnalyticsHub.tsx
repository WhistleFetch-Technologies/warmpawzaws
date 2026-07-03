'use client';

import { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger, Badge } from '@warmpawz/ui';
import { BarChart3 } from 'lucide-react';
import { useDiscountAnalytics } from '@/hooks/marketing/useDiscountAnalytics';
import {
  analyticsDomainOptions,
  ECOMMERCE_ANALYTICS_TITLE,
  MARKETING_ANALYTICS_TITLE,
  type AdminPromoSurface,
} from '@/lib/promotion-domain/surface-config';
import { DiscountAnalyticsFilters } from './DiscountAnalyticsFilters';
import {
  AnalyticsErrorState,
  AnalyticsLoadingState,
} from './AnalyticsStateViews';
import { OverviewDashboard } from './OverviewDashboard';
import { PromotionsAnalyticsTab } from './PromotionsAnalyticsTab';
import { CouponsAnalyticsTab } from './CouponsAnalyticsTab';
import { VendorsAnalyticsTab } from './VendorsAnalyticsTab';
import { SavingsAnalyticsTab } from './SavingsAnalyticsTab';
import { SettlementAnalyticsTab } from './SettlementAnalyticsTab';
import { CampaignAnalyticsTab } from './CampaignAnalyticsTab';

const ALL_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'promotions', label: 'Promotions' },
  { id: 'coupons', label: 'Coupons' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'savings', label: 'Savings' },
  { id: 'settlement', label: 'Settlement' },
  { id: 'campaigns', label: 'Campaigns' },
] as const;

export function MarketingAnalyticsHub({ surface = 'marketing' }: { surface?: AdminPromoSurface }) {
  const lockedDomain = surface === 'ecommerce' ? 'PRODUCT' : undefined;
  const [tab, setTab] = useState<string>('overview');
  const {
    preset,
    setPreset,
    domain,
    setDomain,
    vendorId,
    setVendorId,
    report,
    legacyStats,
    mode,
    loading,
    error,
    reload,
    domainLocked,
  } = useDiscountAnalytics({ surface, lockedDomain });

  const title = surface === 'ecommerce' ? ECOMMERCE_ANALYTICS_TITLE : MARKETING_ANALYTICS_TITLE;
  const subtitle =
    surface === 'ecommerce'
      ? 'Product sales, seller promotions, cart coupons & marketplace savings (Phase 9)'
      : 'Service bookings, vendor savings, service promotions & coupons (Phase 9)';

  const tabs = useMemo(() => {
    if (surface === 'ecommerce') {
      return ALL_TABS.filter((t) => t.id !== 'vendors');
    }
    return ALL_TABS;
  }, [surface]);

  const domainOptions = analyticsDomainOptions(surface);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50/50">
      <div className="border-b bg-white sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-100 p-2">
              <BarChart3 className="h-6 w-6 text-orange-600" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
              <p className="text-sm text-slate-500">{subtitle}</p>
            </div>
          </div>
          {mode ? (
            <Badge variant="outline" className="font-mono text-xs">
              {mode.mode}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-6 py-6">
        <DiscountAnalyticsFilters
          preset={preset}
          domain={domain}
          vendorId={vendorId}
          onPresetChange={setPreset}
          onDomainChange={setDomain}
          onVendorIdChange={setVendorId}
          onRefresh={() => void reload()}
          loading={loading}
          domainOptions={domainOptions}
          domainLocked={domainLocked}
        />

        {loading ? <AnalyticsLoadingState /> : null}
        {!loading && error ? <AnalyticsErrorState message={error} onRetry={() => void reload()} /> : null}
        {!loading && !error && report ? (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-white p-1">
              {tabs.map((t) => (
                <TabsTrigger key={t.id} value={t.id} className="text-xs sm:text-sm">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview" className="mt-6">
              <OverviewDashboard report={report} legacyStats={legacyStats} />
            </TabsContent>
            <TabsContent value="promotions" className="mt-6">
              <PromotionsAnalyticsTab report={report} />
            </TabsContent>
            <TabsContent value="coupons" className="mt-6">
              <CouponsAnalyticsTab report={report} />
            </TabsContent>
            {surface === 'marketing' ? (
              <TabsContent value="vendors" className="mt-6">
                <VendorsAnalyticsTab report={report} />
              </TabsContent>
            ) : null}
            <TabsContent value="savings" className="mt-6">
              <SavingsAnalyticsTab report={report} />
            </TabsContent>
            <TabsContent value="settlement" className="mt-6">
              <SettlementAnalyticsTab report={report} />
            </TabsContent>
            <TabsContent value="campaigns" className="mt-6">
              <CampaignAnalyticsTab report={report} />
            </TabsContent>
          </Tabs>
        ) : null}
      </div>
    </div>
  );
}
