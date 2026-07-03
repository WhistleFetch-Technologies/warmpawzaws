'use client';

import { useMemo, useState } from 'react';
import { Plus, Search, RefreshCw } from 'lucide-react';
import type {
  NormalizedCouponItem,
  NormalizedPromotionItem,
  PromotionManagementScope,
  PromotionTargetCatalog,
  PromotionWizardForm,
} from '../types';
import { lifecycleFromPromotion, lifecycleFromCoupon } from '../lifecycle';
import { promotionToWizardForm } from '../normalize';
import { PromotionCard } from './PromotionCard';
import { CouponCard } from './CouponCard';
import { PromotionWizard } from './PromotionWizard';
import { PromotionDetailsPanel } from './PromotionDetailsPanel';

export type PromotionDashboardProps = {
  scope: PromotionManagementScope;
  promotions: NormalizedPromotionItem[];
  coupons?: NormalizedCouponItem[];
  catalog: PromotionTargetCatalog;
  loading?: boolean;
  existingCodes?: string[];
  onRefresh: () => void;
  onSave: (form: PromotionWizardForm, publish: boolean, editingId?: string) => Promise<void>;
  onDeletePromotion: (id: string) => Promise<void>;
  onTogglePromotion: (id: string, active: boolean) => Promise<void>;
  onDeleteCoupon?: (id: string) => Promise<void>;
  headerActions?: React.ReactNode;
};

type TabId =
  | 'active'
  | 'scheduled'
  | 'expired'
  | 'draft'
  | 'coupons'
  | 'recent';

export function PromotionDashboard({
  scope,
  promotions,
  coupons = [],
  catalog,
  loading,
  existingCodes,
  onRefresh,
  onSave,
  onDeletePromotion,
  onTogglePromotion,
  onDeleteCoupon,
  headerActions,
}: PromotionDashboardProps) {
  const [tab, setTab] = useState<TabId>('active');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardSessionKey, setWizardSessionKey] = useState(0);
  const [editForm, setEditForm] = useState<PromotionWizardForm | undefined>();
  const [editingId, setEditingId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [detailPromo, setDetailPromo] = useState<NormalizedPromotionItem | null>(null);
  const [detailCoupon, setDetailCoupon] = useState<NormalizedCouponItem | null>(null);

  const buckets = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = (p: NormalizedPromotionItem) =>
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.code?.toLowerCase().includes(q) ||
      p.promotionType.toLowerCase().includes(q);

    const filtered = promotions.filter((p) => {
      if (!match(p)) return false;
      if (typeFilter && p.promotionType !== typeFilter) return false;
      if (domainFilter && p.domain !== domainFilter) return false;
      return true;
    });

    const active: NormalizedPromotionItem[] = [];
    const scheduled: NormalizedPromotionItem[] = [];
    const expired: NormalizedPromotionItem[] = [];
    const draft: NormalizedPromotionItem[] = [];

    for (const p of filtered) {
      const lc = lifecycleFromPromotion(p);
      if (lc === 'active') active.push(p);
      else if (lc === 'scheduled') scheduled.push(p);
      else if (lc === 'expired' || lc === 'archived') expired.push(p);
      else if (lc === 'draft' || lc === 'paused') draft.push(p);
      else active.push(p);
    }

    const recent = [...filtered].sort((a, b) =>
      (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
    );

    const couponFiltered = coupons.filter(
      (c) => !q || c.code.toLowerCase().includes(q)
    );

    return { active, scheduled, expired, draft, recent, coupons: couponFiltered };
  }, [promotions, coupons, search, typeFilter, domainFilter]);

  const list =
    tab === 'active'
      ? buckets.active
      : tab === 'scheduled'
        ? buckets.scheduled
        : tab === 'expired'
          ? buckets.expired
          : tab === 'draft'
            ? buckets.draft
            : tab === 'recent'
              ? buckets.recent
              : [];

  const openCreate = () => {
    setEditForm(undefined);
    setEditingId(undefined);
    setWizardSessionKey((k) => k + 1);
    setWizardOpen(true);
  };

  const openEdit = (p: NormalizedPromotionItem) => {
    setEditForm(promotionToWizardForm(p, catalog));
    setEditingId(p.id);
    setWizardOpen(true);
  };

  const handleSave = async (form: PromotionWizardForm, publish: boolean) => {
    setSaving(true);
    try {
      await onSave(form, publish, editingId);
      setWizardOpen(false);
      setEditForm(undefined);
      setEditingId(undefined);
      setWizardSessionKey((k) => k + 1);
      setDetailPromo(null);
      await onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: 'active', label: 'Active', count: buckets.active.length },
    { id: 'scheduled', label: 'Scheduled', count: buckets.scheduled.length },
    { id: 'expired', label: 'Expired', count: buckets.expired.length },
    { id: 'draft', label: 'Draft / Paused', count: buckets.draft.length },
    ...(scope.canManageCoupons
      ? [{ id: 'coupons' as TabId, label: 'Coupons', count: buckets.coupons.length }]
      : []),
    { id: 'recent', label: 'Recently created', count: buckets.recent.length },
  ];

  return (
    <div className="min-h-full bg-slate-50">
      <div className="border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{scope.title}</h1>
              {scope.subtitle ? (
                <p className="text-sm text-slate-500 mt-1">{scope.subtitle}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
              {headerActions}
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
              >
                <Plus className="h-4 w-4" /> Create
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  tab === t.id
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t.label} ({t.count})
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-4">
        <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search promotions…"
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All types</option>
            <option value="percentage">Percentage</option>
            <option value="flash_sale">Flash sale</option>
            <option value="first_booking">First booking</option>
            <option value="bundle">Bundle</option>
          </select>
          {scope.mode === 'platform' && (
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">All domains</option>
              <option value="service">Services</option>
              <option value="product">Products</option>
            </select>
          )}
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
            <p className="text-slate-600 font-medium">Loading promotions and catalog…</p>
            <p className="text-sm text-slate-400 mt-1">Fetching platform data from admin APIs</p>
          </div>
        ) : tab === 'coupons' ? (
          <div className="grid gap-3 md:grid-cols-2">
            {buckets.coupons.length === 0 ? (
              <div className="col-span-full rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center">
                <p className="text-slate-600 font-medium">No coupons yet</p>
                <p className="text-sm text-slate-400 mt-1">Create a coupon from the Create button above</p>
              </div>
            ) : (
              buckets.coupons.map((c) => (
                <CouponCard
                  key={c.id}
                  item={c}
                  onClick={() => {
                    setDetailCoupon(c);
                    setDetailPromo(null);
                  }}
                  onDelete={
                    onDeleteCoupon
                      ? () => {
                          if (confirm('Delete coupon?')) onDeleteCoupon(c.id);
                        }
                      : undefined
                  }
                />
              ))
            )}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {list.length === 0 ? (
              <div className="col-span-full rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center">
                <p className="text-slate-600 font-medium">No promotions in this view</p>
                <p className="text-sm text-slate-400 mt-1">
                  Try another lifecycle tab or create a new promotion
                </p>
              </div>
            ) : (
              list.map((p) => (
                <PromotionCard
                  key={p.id}
                  item={p}
                  onClick={() => {
                    setDetailPromo(p);
                    setDetailCoupon(null);
                  }}
                  onEdit={() => openEdit(p)}
                  onToggle={async () => {
                    await onTogglePromotion(p.id, !p.isActive);
                    setDetailPromo((prev) => (prev?.id === p.id ? null : prev));
                    await onRefresh();
                  }}
                  onDelete={async () => {
                    if (!confirm('Delete promotion?')) return;
                    await onDeletePromotion(p.id);
                    setDetailPromo((prev) => (prev?.id === p.id ? null : prev));
                    await onRefresh();
                  }}
                />
              ))
            )}
          </div>
        )}
      </div>

      <PromotionWizard
        key={editingId ?? `create-${wizardSessionKey}`}
        open={wizardOpen}
        onClose={() => {
          setWizardOpen(false);
          setEditForm(undefined);
          setEditingId(undefined);
        }}
        scope={scope}
        catalog={catalog}
        initial={editForm}
        existingCodes={existingCodes}
        onSave={handleSave}
        saving={saving}
      />

      {(detailPromo || detailCoupon) && (
        <PromotionDetailsPanel
          item={detailPromo}
          coupon={detailCoupon}
          onClose={() => {
            setDetailPromo(null);
            setDetailCoupon(null);
          }}
        />
      )}
    </div>
  );
}
