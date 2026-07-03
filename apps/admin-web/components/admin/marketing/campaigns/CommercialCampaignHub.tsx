'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button, Badge, Tabs, TabsContent, TabsList, TabsTrigger } from '@warmpawz/ui';
import { Megaphone, Plus, RefreshCw } from 'lucide-react';
import { useCommercialCampaigns } from '@/hooks/marketing/useCommercialCampaigns';
import { transitionCampaignLifecycle } from '@/lib/commercial-campaign/commercial-campaign-api';
import type { CommercialCampaignRecord } from '@/lib/commercial-campaign/types';
import {
  ECOMMERCE_CAMPAIGN_TITLE,
  MARKETING_CAMPAIGN_TITLE,
  filterCampaigns,
  type AdminPromoSurface,
} from '@/lib/promotion-domain/surface-config';
import { CampaignDashboard } from './CampaignDashboard';
import { CampaignList } from './CampaignList';
import { CampaignBuilderDialog } from './CampaignBuilderDialog';
import { CampaignDetailsDrawer } from './CampaignDetailsDrawer';
import { CampaignTemplateGrid } from './CampaignTemplateGrid';
import { ComingSoonPanel } from '../policyCenter/shared/ApiPendingBanner';

export function CommercialCampaignHub({ surface = 'marketing' }: { surface?: AdminPromoSurface }) {
  const { campaigns: allCampaigns, mode, registry, loading, error, reload } = useCommercialCampaigns();
  const campaigns = useMemo(() => filterCampaigns(allCampaigns, surface), [allCampaigns, surface]);
  const [tab, setTab] = useState('dashboard');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [templateSeed, setTemplateSeed] = useState<string | undefined>();
  const [cloneFrom, setCloneFrom] = useState<CommercialCampaignRecord | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openBuilder = (templateId?: string, clone?: CommercialCampaignRecord | null) => {
    setTemplateSeed(templateId);
    setCloneFrom(clone ?? null);
    setBuilderOpen(true);
  };

  const handleBulkArchive = async (ids: string[]) => {
    try {
      await Promise.all(ids.map((id) => transitionCampaignLifecycle(id, 'archived')));
      toast.success(`Archived ${ids.length} campaign(s)`);
      void reload();
    } catch {
      toast.error('Bulk archive failed for one or more campaigns');
    }
  };

  if (!loading && error && mode && !mode.enabled) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-12">
        <ComingSoonPanel
          title="Commercial Campaign Engine disabled"
          description={error}
          apiPath="GET /admin/commercial-campaigns/mode"
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50/50">
      <div className="sticky top-0 z-10 border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-100 p-2">
              <Megaphone className="h-6 w-6 text-orange-600" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {surface === 'ecommerce' ? ECOMMERCE_CAMPAIGN_TITLE : MARKETING_CAMPAIGN_TITLE}
              </h1>
              <p className="text-sm text-slate-500">
                {surface === 'ecommerce'
                  ? 'Marketplace campaign orchestration over seller promotions & coupons — Phase 10'
                  : 'Service campaign orchestration over promotions, coupons, notifications & analytics — Phase 10'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mode ? (
              <Badge variant="outline" className="font-mono text-xs">
                {mode.mode}
              </Badge>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
              <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
              Refresh
            </Button>
            <Button type="button" size="sm" onClick={() => openBuilder()}>
              <Plus className="mr-1.5 h-4 w-4" aria-hidden />
              New campaign
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-6 py-6">
        {error && mode?.enabled ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : null}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex h-auto flex-wrap gap-1 bg-white p-1">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="campaigns">All campaigns</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            {loading ? <p className="text-sm text-slate-500">Loading campaigns…</p> : <CampaignDashboard campaigns={campaigns} />}
          </TabsContent>

          <TabsContent value="campaigns" className="mt-6">
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : (
              <CampaignList
                campaigns={campaigns}
                onSelect={(c) => {
                  setSelectedId(c.id);
                  setDrawerOpen(true);
                }}
                onBulkArchive={handleBulkArchive}
              />
            )}
          </TabsContent>

          <TabsContent value="templates" className="mt-6 space-y-4">
            <p className="text-sm text-slate-600">
              Templates from GET /admin/commercial-campaigns/registry — preview, duplicate, or create.
            </p>
            <CampaignTemplateGrid
              templates={registry?.templates ?? []}
              onPreview={(t) => toast.message(`${t.name}: ${t.campaignType}`)}
              onDuplicate={(t) => openBuilder(t.id)}
              onCreateFrom={(t) => openBuilder(t.id)}
            />
          </TabsContent>
        </Tabs>
      </div>

      <CampaignBuilderDialog
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        registry={registry}
        initialTemplateId={templateSeed}
        cloneFrom={cloneFrom}
        onSuccess={() => void reload()}
        surface={surface}
      />

      <CampaignDetailsDrawer
        campaignId={selectedId}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onUpdated={() => void reload()}
        onClone={(c) => {
          setDrawerOpen(false);
          openBuilder(undefined, c);
        }}
      />
    </div>
  );
}
