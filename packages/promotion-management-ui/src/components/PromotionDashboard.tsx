'use client';

import { useMemo, useState } from 'react';
import { Plus, Search, RefreshCw, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { DEFAULT_WIZARD_FORM } from '../types';
import type {
  NormalizedCouponItem,
  NormalizedPromotionItem,
  PromotionManagementScope,
  PromotionTargetCatalog,
  PromotionWizardForm,
} from '../types';
import { lifecycleFromPromotion, lifecycleFromCoupon } from '../lifecycle';
import { promotionToWizardForm, couponToWizardForm } from '../normalize';
import { PromotionCard } from './PromotionCard';
import { CouponCard } from './CouponCard';
import { PromotionWizard } from './PromotionWizard';
import { PromotionDetailsPanel } from './PromotionDetailsPanel';
import { DashboardSkeleton } from './DashboardSkeleton';

export type PromotionDashboardProps = {
  scope: PromotionManagementScope;
  promotions: NormalizedPromotionItem[];
  coupons?: NormalizedCouponItem[];
  catalog: PromotionTargetCatalog;
  loading?: boolean;
  error?: string | null;
  existingCodes?: string[];
  onRefresh: () => void;
  onSave: (form: PromotionWizardForm, publish: boolean, editingId?: string) => Promise<void>;
  onDeletePromotion: (id: string) => Promise<void>;
  onTogglePromotion: (id: string, active: boolean) => Promise<void>;
  onDeleteCoupon?: (id: string) => Promise<void>;
  onToggleCoupon?: (id: string, active: boolean) => Promise<void>;
  headerActions?: React.ReactNode;
  /** When set, opens on coupons tab (e.g. E-Commerce coupons route). */
  initialTab?: TabId;
};

type TabId = 'active' | 'scheduled' | 'expired' | 'draft' | 'coupons' | 'recent';
type SortId = 'newest' | 'ending_soon' | 'most_used' | 'alphabetical';
type KindFilter = '' | 'promotion' | 'coupon';

function sortPromotions(list: NormalizedPromotionItem[], sort: SortId): NormalizedPromotionItem[] {
  const copy = [...list];
  switch (sort) {
    case 'ending_soon':
      return copy.sort((a, b) => a.endDate.localeCompare(b.endDate));
    case 'most_used':
      return copy.sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0));
    case 'alphabetical':
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    default:
      return copy.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  }
}

function sortCoupons(list: NormalizedCouponItem[], sort: SortId): NormalizedCouponItem[] {
  const copy = [...list];
  switch (sort) {
    case 'ending_soon':
      return copy.sort((a, b) => a.endDate.localeCompare(b.endDate));
    case 'most_used':
      return copy.sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0));
    case 'alphabetical':
      return copy.sort((a, b) => a.code.localeCompare(b.code));
    default:
      return copy.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  }
}

export function PromotionDashboard({
  scope,
  promotions,
  coupons = [],
  catalog,
  loading,
  error,
  existingCodes,
  onRefresh,
  onSave,
  onDeletePromotion,
  onTogglePromotion,
  onDeleteCoupon,
  onToggleCoupon,
  headerActions,
  initialTab = 'active',
}: PromotionDashboardProps) {
  const [tab, setTab] = useState<TabId>(initialTab);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('');
  const [sort, setSort] = useState<SortId>('newest');
  const [domainFilter, setDomainFilter] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardSessionKey, setWizardSessionKey] = useState(0);
  const [wizardInitialStep, setWizardInitialStep] = useState(0);
  const [editForm, setEditForm] = useState<PromotionWizardForm | undefined>();
  const [editingId, setEditingId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [detailPromo, setDetailPromo] = useState<NormalizedPromotionItem | null>(null);
  const [detailCoupon, setDetailCoupon] = useState<NormalizedCouponItem | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showBanner = (type: 'success' | 'error', text: string) => {
    setBanner({ type, text });
    window.setTimeout(() => setBanner(null), 4000);
  };

  const buckets = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matchPromo = (p: NormalizedPromotionItem) =>
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.code?.toLowerCase().includes(q) ||
      p.promotionType.toLowerCase().includes(q) ||
      p.targetSummary?.toLowerCase().includes(q);

    const filtered = promotions.filter((p) => {
      if (!matchPromo(p)) return false;
      if (typeFilter && p.promotionType !== typeFilter) return false;
      if (domainFilter && p.domain !== domainFilter) return false;
      if (kindFilter === 'coupon') return false;
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

    const recent = sortPromotions(filtered, 'newest');

    const couponFiltered = coupons.filter(
      (c) =>
        (!q ||
          c.code.toLowerCase().includes(q) ||
          String(c.discountValue).includes(q)) &&
        kindFilter !== 'promotion'
    );

    return {
      active: sortPromotions(active, sort),
      scheduled: sortPromotions(scheduled, sort),
      expired: sortPromotions(expired, sort),
      draft: sortPromotions(draft, sort),
      recent: sortPromotions(recent, sort),
      coupons: sortCoupons(couponFiltered, sort),
    };
  }, [promotions, coupons, search, typeFilter, domainFilter, kindFilter, sort]);

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

  const openCreate = (kind?: 'promotion' | 'coupon') => {
    setEditingId(undefined);
    if (kind) {
      setEditForm({
        ...DEFAULT_WIZARD_FORM(),
        createKind: kind,
        autoApply: kind === 'promotion',
      });
      setWizardInitialStep(1);
    } else {
      setEditForm(undefined);
      setWizardInitialStep(0);
    }
    setWizardSessionKey((k) => k + 1);
    setWizardOpen(true);
  };

  const openEditPromo = (p: NormalizedPromotionItem) => {
    setEditForm(promotionToWizardForm(p, catalog));
    setEditingId(p.id);
    setWizardInitialStep(1);
    setWizardOpen(true);
  };

  const openEditCoupon = (c: NormalizedCouponItem) => {
    setEditForm(couponToWizardForm(c, catalog));
    setEditingId(c.id);
    setWizardInitialStep(1);
    setWizardOpen(true);
  };

  const handleSave = async (form: PromotionWizardForm, publish: boolean) => {
    setSaving(true);
    try {
      await onSave(form, publish, editingId);
      setWizardOpen(false);
      setEditForm(undefined);
      setEditingId(undefined);
      setWizardInitialStep(0);
      setWizardSessionKey((k) => k + 1);
      setDetailPromo(null);
      setDetailCoupon(null);
      await onRefresh();
      showBanner(
        'success',
        editingId
          ? `${form.createKind === 'coupon' ? 'Coupon' : 'Promotion'} updated`
          : `${form.createKind === 'coupon' ? 'Coupon' : 'Promotion'} ${publish ? 'published' : 'saved as draft'}`
      );
    } catch (e) {
      showBanner('error', e instanceof Error ? e.message : 'Save failed — please try again');
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePromo = async (id: string) => {
    if (!window.confirm('Delete this promotion? This cannot be undone.')) return;
    try {
      await onDeletePromotion(id);
      setDetailPromo((prev) => (prev?.id === id ? null : prev));
      await onRefresh();
      showBanner('success', 'Promotion deleted');
    } catch (e) {
      showBanner('error', e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const handleTogglePromo = async (id: string, active: boolean) => {
    try {
      await onTogglePromotion(id, active);
      setDetailPromo((prev) => (prev?.id === id ? null : prev));
      await onRefresh();
      showBanner('success', active ? 'Promotion activated' : 'Promotion paused');
    } catch (e) {
      showBanner('error', e instanceof Error ? e.message : 'Update failed');
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!onDeleteCoupon) return;
    if (!window.confirm('Delete this coupon? This cannot be undone.')) return;
    try {
      await onDeleteCoupon(id);
      setDetailCoupon((prev) => (prev?.id === id ? null : prev));
      await onRefresh();
      showBanner('success', 'Coupon deleted');
    } catch (e) {
      showBanner('error', e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const handleToggleCoupon = async (id: string, active: boolean) => {
    if (!onToggleCoupon) return;
    try {
      await onToggleCoupon(id, active);
      setDetailCoupon((prev) => (prev?.id === id ? null : prev));
      await onRefresh();
      showBanner('success', active ? 'Coupon activated' : 'Coupon deactivated');
    } catch (e) {
      showBanner('error', e instanceof Error ? e.message : 'Update failed');
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

  const hasFilters = Boolean(search || typeFilter || kindFilter || domainFilter);
  const isEmptySearch = hasFilters && list.length === 0 && tab !== 'coupons';

  return (
    <div className="min-h-full bg-slate-50">
      {banner ? (
        <div
          className={`fixed top-4 left-1/2 z-[60] -translate-x-1/2 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg ${
            banner.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {banner.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {banner.text}
          <button type="button" onClick={() => setBanner(null)} className="ml-2 opacity-80">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

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
                disabled={loading}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
              {headerActions}
              {scope.canManageCoupons ? (
                <button
                  type="button"
                  onClick={() => openCreate('coupon')}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900"
                >
                  <Plus className="h-4 w-4" /> Coupon
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => openCreate('promotion')}
                className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
              >
                <Plus className="h-4 w-4" /> Promotion
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
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center justify-between gap-3">
            <p className="text-sm text-red-800">{error}</p>
            <button
              type="button"
              onClick={onRefresh}
              className="text-sm font-medium text-red-700 underline"
            >
              Retry
            </button>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, code, or target…"
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as KindFilter)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All kinds</option>
            <option value="promotion">Promotions only</option>
            {scope.canManageCoupons ? <option value="coupon">Coupons only</option> : null}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">All offer types</option>
            <option value="percentage">Percentage</option>
            <option value="flash_sale">Flash sale</option>
            <option value="first_booking">First booking</option>
            <option value="first_order">First order</option>
            <option value="bundle">Bundle</option>
            <option value="buy_x_get_y">Buy X Get Y</option>
            <option value="loyalty">Loyalty</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortId)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="newest">Newest first</option>
            <option value="ending_soon">Ending soon</option>
            <option value="most_used">Most used</option>
            <option value="alphabetical">Alphabetical</option>
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
          <DashboardSkeleton count={6} />
        ) : tab === 'coupons' ? (
          <div className="grid gap-3 md:grid-cols-2">
            {buckets.coupons.length === 0 ? (
              <EmptyState
                title={hasFilters ? 'No coupons match your filters' : 'No coupons yet'}
                description={
                  hasFilters
                    ? 'Try clearing search or filters'
                    : 'Create a coupon code customers can enter at checkout'
                }
                ctaLabel="Create coupon"
                onCta={() => openCreate('coupon')}
              />
            ) : (
              buckets.coupons.map((c) => (
                <CouponCard
                  key={c.id}
                  item={c}
                  onClick={() => {
                    setDetailCoupon(c);
                    setDetailPromo(null);
                  }}
                  onEdit={() => openEditCoupon(c)}
                  onToggle={
                    onToggleCoupon
                      ? () => handleToggleCoupon(c.id, !c.isActive)
                      : undefined
                  }
                  onDelete={onDeleteCoupon ? () => handleDeleteCoupon(c.id) : undefined}
                />
              ))
            )}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {list.length === 0 ? (
              <EmptyState
                title={
                  isEmptySearch
                    ? 'No results found'
                    : tab === 'active'
                      ? 'No active promotions'
                      : 'No promotions in this view'
                }
                description={
                  isEmptySearch
                    ? 'Adjust search or filters to find promotions'
                    : 'Create a promotion to offer discounts automatically at checkout'
                }
                ctaLabel="Create promotion"
                onCta={() => openCreate('promotion')}
                secondaryCta={
                  scope.canManageCoupons
                    ? { label: 'Create coupon', onClick: () => openCreate('coupon') }
                    : undefined
                }
              />
            ) : (
              list.map((p) => (
                <PromotionCard
                  key={p.id}
                  item={p}
                  onClick={() => {
                    setDetailPromo(p);
                    setDetailCoupon(null);
                  }}
                  onEdit={() => openEditPromo(p)}
                  onToggle={() => handleTogglePromo(p.id, !p.isActive)}
                  onDelete={() => handleDeletePromo(p.id)}
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
          setWizardInitialStep(0);
        }}
        scope={scope}
        catalog={catalog}
        initial={editForm}
        initialStep={wizardInitialStep}
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
          onEdit={
            detailPromo
              ? () => openEditPromo(detailPromo)
              : detailCoupon
                ? () => openEditCoupon(detailCoupon)
                : undefined
          }
        />
      )}
    </div>
  );
}

function EmptyState({
  title,
  description,
  ctaLabel,
  onCta,
  secondaryCta,
}: {
  title: string;
  description: string;
  ctaLabel: string;
  onCta: () => void;
  secondaryCta?: { label: string; onClick: () => void };
}) {
  return (
    <div className="col-span-full rounded-xl border border-dashed border-slate-200 bg-white py-12 px-6 text-center">
      <p className="text-slate-800 font-semibold">{title}</p>
      <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">{description}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onCta}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white"
        >
          {ctaLabel}
        </button>
        {secondaryCta ? (
          <button
            type="button"
            onClick={secondaryCta.onClick}
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900"
          >
            {secondaryCta.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}
