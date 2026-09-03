'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Button,
  Badge,
} from '@warmpawz/ui';
import {
  fetchCampaignAnalytics,
  fetchCampaignSettlementAttribution,
  getCommercialCampaign,
  orchestrateCommercialCampaign,
  transitionCampaignLifecycle,
} from '@/lib/commercial-campaign/commercial-campaign-api';
import type { CommercialCampaignRecord, CampaignLifecycleStatus } from '@/lib/commercial-campaign/types';
import { CampaignStatusBadge } from './CampaignStatusBadge';
import { CampaignFundingEditor } from './CampaignFundingEditor';
import { CampaignAudienceEditor } from './CampaignAudienceEditor';
import { CampaignScheduleEditor } from './CampaignScheduleEditor';
import { CampaignNotificationEditor } from './CampaignNotificationEditor';
import { CampaignOrchestrationPanel } from './CampaignOrchestrationPanel';
import { MetricTable } from '../analytics/MetricTable';
import { SavingsByMonthChart } from '../analytics/DiscountAnalyticsCharts';
import { ComingSoonPanel } from '../policyCenter/shared/ApiPendingBanner';
import { formatInr } from '@/lib/marketing-analytics/format';
import { StatCard } from '@/components/admin/shared/StatCard';
import type { AdminPromoSurface } from '@/lib/promotion-domain/surface-config';
import { Megaphone, PiggyBank, TrendingUp, Wallet } from 'lucide-react';

const LIFECYCLE_ACTIONS: Partial<Record<CampaignLifecycleStatus, CampaignLifecycleStatus[]>> = {
  draft: ['review', 'cancelled'],
  review: ['approved', 'draft', 'cancelled'],
  approved: ['scheduled', 'running', 'cancelled'],
  scheduled: ['running', 'paused', 'cancelled'],
  running: ['paused', 'completed', 'cancelled'],
  paused: ['running', 'cancelled'],
  completed: ['archived'],
  cancelled: ['archived'],
  expired: ['archived'],
};

export function CampaignDetailsDrawer({
  campaignId,
  open,
  onClose,
  onUpdated,
  onClone,
  surface = 'marketing',
}: {
  campaignId: string | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onClone: (c: CommercialCampaignRecord) => void;
  surface?: AdminPromoSurface;
}) {
  const [campaign, setCampaign] = useState<CommercialCampaignRecord | null>(null);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [settlement, setSettlement] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    if (!open || !campaignId) return;
    setLoading(true);
    void (async () => {
      try {
        const c = await getCommercialCampaign(campaignId);
        setCampaign(c);
        if (c) {
          const [a, s] = await Promise.all([
            fetchCampaignAnalytics(campaignId).catch(() => null),
            fetchCampaignSettlementAttribution(campaignId).catch(() => null),
          ]);
          setAnalytics(a as Record<string, unknown> | null);
          setSettlement(s as Record<string, unknown> | null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [open, campaignId]);

  const transition = async (status: CampaignLifecycleStatus) => {
    if (!campaignId) return;
    try {
      await transitionCampaignLifecycle(campaignId, status);
      toast.success(`Campaign moved to ${status}`);
      onUpdated();
      const c = await getCommercialCampaign(campaignId);
      setCampaign(c);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lifecycle transition failed');
    }
  };

  const actions = campaign ? LIFECYCLE_ACTIONS[campaign.status] ?? [] : [];

  const analyticsReport = analytics?.report as Record<string, unknown> | undefined;
  const promoRows = (analyticsReport?.promotions as Array<Record<string, unknown>>) ?? [];
  const couponRows = (analyticsReport?.coupons as Array<Record<string, unknown>>) ?? [];
  const kpis = analytics?.kpis as
    | {
        redemptions?: number;
        discountSpend?: number;
        platformSpend?: number;
        vendorSpend?: number;
        budgetRemaining?: number | null;
        roi?: number | null;
      }
    | undefined;

  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{campaign?.name ?? 'Campaign details'}</DialogTitle>
          {campaign ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <CampaignStatusBadge status={campaign.status} />
              <Badge variant="outline">{campaign.campaignType}</Badge>
            </div>
          ) : null}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
        {loading ? <p className="py-8 text-sm text-slate-500">Loading…</p> : null}

        {!loading && campaign ? (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {actions.map((a) => (
                <Button key={a} type="button" size="sm" variant="outline" onClick={() => void transition(a)}>
                  → {a}
                </Button>
              ))}
              <Button type="button" size="sm" variant="ghost" onClick={() => onClone(campaign)}>
                Clone
              </Button>
            </div>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="flex h-auto flex-wrap gap-1">
                {['overview', 'funding', 'promotions', 'notifications', 'analytics', 'settlement', 'audit'].map(
                  (t) => (
                    <TabsTrigger key={t} value={t} className="text-xs capitalize">
                      {t}
                    </TabsTrigger>
                  )
                )}
              </TabsList>

              <TabsContent value="overview" className="space-y-4 pt-4">
                <CampaignAudienceEditor audience={campaign.audience} onChange={() => {}} readOnly />
                <CampaignScheduleEditor
                  scheduleType={campaign.scheduleType}
                  startAt={campaign.startAt ?? undefined}
                  endAt={campaign.endAt ?? undefined}
                  recurringRule={campaign.recurringRule}
                  onChange={() => {}}
                  readOnly
                />
                <p className="text-xs text-slate-500">
                  Created {new Date(campaign.createdAt).toLocaleString()} · Updated{' '}
                  {new Date(campaign.updatedAt).toLocaleString()}
                </p>
              </TabsContent>

              <TabsContent value="funding" className="pt-4">
                <CampaignFundingEditor funding={campaign.funding} onChange={() => {}} readOnly />
              </TabsContent>

              <TabsContent value="promotions" className="pt-4">
                <CampaignOrchestrationPanel
                  surface={surface}
                  pendingPromotions={[]}
                  pendingCoupons={[]}
                  onPromotionsChange={() => {}}
                  onCouponsChange={() => {}}
                  readOnly
                />
                <Button
                  type="button"
                  size="sm"
                  className="mt-3"
                  variant="outline"
                  onClick={() =>
                    void orchestrateCommercialCampaign(campaign.id, {}).then(() => {
                      toast.success('Orchestration refreshed');
                      onUpdated();
                    })
                  }
                >
                  Re-run orchestrate (empty payload)
                </Button>
              </TabsContent>

              <TabsContent value="notifications" className="pt-4">
                <CampaignNotificationEditor
                  mode={campaign.notificationMode}
                  notificationCampaignId={campaign.notificationCampaignId}
                  onChange={() => {}}
                  readOnly
                />
              </TabsContent>

              <TabsContent value="analytics" className="space-y-4 pt-4">
                {analytics && analytics.available === false ? (
                  <ComingSoonPanel
                    title="Campaign analytics unavailable"
                    description="Enable DISCOUNT_ENGINE_V2_ANALYTICS_MODE=AUTHORITATIVE for Phase 9 bridge."
                    apiPath="GET /admin/commercial-campaigns/:id/analytics"
                  />
                ) : (
                  <>
                    {kpis ? (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <StatCard title="Redemptions" value={Number(kpis.redemptions ?? 0)} icon={Megaphone} iconColor="orange" />
                        <StatCard
                          title="Discount spend"
                          value={formatInr(Number(kpis.discountSpend ?? 0))}
                          icon={PiggyBank}
                          iconColor="purple"
                        />
                        <StatCard
                          title="Platform spend"
                          value={formatInr(Number(kpis.platformSpend ?? 0))}
                          icon={Wallet}
                          iconColor="blue"
                        />
                        <StatCard
                          title="Vendor spend"
                          value={formatInr(Number(kpis.vendorSpend ?? 0))}
                          icon={Wallet}
                          iconColor="orange"
                        />
                        <StatCard
                          title="Budget remaining"
                          value={
                            kpis.budgetRemaining == null
                              ? '—'
                              : formatInr(Number(kpis.budgetRemaining))
                          }
                          icon={Wallet}
                          iconColor="green"
                        />
                        <StatCard
                          title="ROI"
                          value={kpis.roi == null ? '—' : Number(kpis.roi).toFixed(2)}
                          icon={TrendingUp}
                          iconColor="green"
                        />
                      </div>
                    ) : null}
                    <MetricTable
                      rows={promoRows}
                      searchKeys={['promotionId', 'name']}
                      exportFilename={`campaign-${campaign.id}-promotions.csv`}
                      columns={[
                        { key: 'promotionId', label: 'Promotion' },
                        { key: 'usageCount', label: 'Usage' },
                        { key: 'savings', label: 'Savings', render: (r) => formatInr(Number(r.savings ?? 0)) },
                      ]}
                      emptyLabel="No linked promotion usage yet"
                    />
                    <MetricTable
                      rows={couponRows}
                      searchKeys={['couponId', 'code']}
                      exportFilename={`campaign-${campaign.id}-coupons.csv`}
                      columns={[
                        { key: 'couponId', label: 'Coupon' },
                        { key: 'usageCount', label: 'Usage' },
                        { key: 'savings', label: 'Savings', render: (r) => formatInr(Number(r.savings ?? 0)) },
                      ]}
                      emptyLabel="No linked coupon usage yet"
                    />
                    <SavingsByMonthChart
                      data={[]}
                      title="Campaign timeline (aggregate from Phase 9 when available)"
                    />
                  </>
                )}
              </TabsContent>

              <TabsContent value="settlement" className="pt-4">
                {settlement ? (
                  <pre className="overflow-x-auto rounded-lg border bg-slate-50 p-3 text-xs">
                    {JSON.stringify(settlement, null, 2)}
                  </pre>
                ) : (
                  <ComingSoonPanel
                    title="Settlement attribution"
                    description="Read-only funding split from Phase 7 bridge."
                    apiPath="GET /admin/commercial-campaigns/:id/settlement-attribution"
                  />
                )}
              </TabsContent>

              <TabsContent value="audit" className="pt-4">
                <ComingSoonPanel
                  title="Campaign audit timeline"
                  description="Dedicated audit endpoint pending. Lifecycle transitions are recorded server-side."
                  apiPath="GET /admin/commercial-campaigns/:id/audit (planned)"
                />
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
