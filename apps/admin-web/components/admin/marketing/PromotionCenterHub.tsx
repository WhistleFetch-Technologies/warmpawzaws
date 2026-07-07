'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Megaphone, Scale, Store, Tag } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AdminPromotionHub } from './AdminPromotionHub';
import { VendorPromotionsOverview } from './VendorPromotionsOverview';
import { PolicyCenter } from './policyCenter/PolicyCenter';
import { MarketingAnalyticsHub } from './analytics/MarketingAnalyticsHub';
import { CommercialCampaignHub } from './campaigns/CommercialCampaignHub';

const TABS = [
  { id: 'platform', label: 'Platform Promotions & Coupons', icon: Tag },
  { id: 'vendor', label: 'Vendor Promotions', icon: Store },
  { id: 'policy', label: 'Policy Center', icon: Scale },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
] as const;

type PromotionCenterTabId = (typeof TABS)[number]['id'];

const TAB_IDS = new Set<string>(TABS.map((t) => t.id));

function isPromotionCenterTab(value: string | null): value is PromotionCenterTabId {
  return value != null && TAB_IDS.has(value);
}

export function PromotionCenterHub() {
  const [activeTab, setActiveTab] = useState<PromotionCenterTabId>('platform');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (isPromotionCenterTab(tab)) {
      setActiveTab(tab);
    }
  }, []);

  const selectTab = (id: PromotionCenterTabId) => {
    setActiveTab(id);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', id);
    window.history.replaceState({}, '', url.toString());
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Promotion Center</h1>
              <p className="mt-1 text-sm text-gray-500">
                Platform offers, vendor promotions, policy rules, analytics, and campaigns
              </p>
            </div>
            <div className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
              Live
            </div>
          </div>

          <div className="-mb-px mt-4 flex gap-0 overflow-x-auto border-b border-gray-200">
            {TABS.map((tab) => {
              const Icon = tab.icon as LucideIcon;
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => selectTab(tab.id)}
                  className={`flex items-center gap-2 whitespace-nowrap border-b-[3px] px-4 py-3 text-sm transition-colors ${
                    selected
                      ? 'border-[#FF8C42] bg-orange-50/50 font-medium text-[#FF8C42]'
                      : 'border-transparent text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="pb-12">
        {activeTab === 'platform' ? (
          <AdminPromotionHub surface="marketing" />
        ) : null}
        {activeTab === 'vendor' ? (
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
            <VendorPromotionsOverview
              domain="SERVICE"
              title="Vendor Promotions"
              subtitle="Service vendor-created promotions and coupons"
            />
          </div>
        ) : null}
        {activeTab === 'policy' ? <PolicyCenter embedded /> : null}
        {activeTab === 'analytics' ? (
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
            <MarketingAnalyticsHub surface="marketing" />
          </div>
        ) : null}
        {activeTab === 'campaigns' ? (
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
            <CommercialCampaignHub surface="marketing" />
          </div>
        ) : null}
      </main>
    </div>
  );
}
