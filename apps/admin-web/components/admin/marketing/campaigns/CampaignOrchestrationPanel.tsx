'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@warmpawz/ui';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { loadSmartTargetBaseCatalogWithErrors } from '@/lib/promotion-catalog-loader';
import { createAdminSmartTargetAdapter } from '@/lib/smart-target-catalog-adapter';
import {
  catalogForSurface,
  filterCouponRows,
  filterPromotionRows,
  scopeForSurface,
  type AdminPromoSurface,
} from '@/lib/promotion-domain/surface-config';
import {
  PromotionWizard,
  PromotionCard,
  CouponCard,
  normalizePromotionRow,
  normalizeCouponRow,
  wizardToAdminPromotionPayload,
  wizardToAdminCouponPayload,
  DEFAULT_WIZARD_FORM,
  type PromotionTargetCatalog,
  type PromotionWizardForm,
  type SmartTargetCatalogAdapter,
} from '@warmpawz/promotion-management-ui';

export function CampaignOrchestrationPanel({
  surface = 'marketing',
  pendingPromotions,
  pendingCoupons,
  onPromotionsChange,
  onCouponsChange,
  readOnly = false,
}: {
  surface?: AdminPromoSurface;
  pendingPromotions: Array<Record<string, unknown>>;
  pendingCoupons: Array<Record<string, unknown>>;
  onPromotionsChange: (rows: Array<Record<string, unknown>>) => void;
  onCouponsChange: (rows: Array<Record<string, unknown>>) => void;
  readOnly?: boolean;
}) {
  const scope = scopeForSurface(surface);
  const promoHubHref = surface === 'ecommerce' ? '/ecommerce/promotions' : '/promotions';
  const [catalog, setCatalog] = useState<PromotionTargetCatalog>({});
  const [existingPromotions, setExistingPromotions] = useState<ReturnType<typeof normalizePromotionRow>[]>([]);
  const [existingCoupons, setExistingCoupons] = useState<ReturnType<typeof normalizeCouponRow>[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardKind, setWizardKind] = useState<'promotion' | 'coupon'>('promotion');

  const loadCatalog = useCallback(async () => {
    const [catalogResult, promotionsRes, couponsRes] = await Promise.all([
      loadSmartTargetBaseCatalogWithErrors(apiClient),
      apiClient.get<{ promotions?: unknown[] }>('/admin/promotions'),
      apiClient.get<{ coupons?: unknown[] }>('/admin/coupons?limit=100'),
    ]);
    setCatalog(catalogForSurface(catalogResult.catalog, surface));
    const promoRows = promotionsRes.promotions ?? [];
    const couponRows = couponsRes.coupons ?? [];
    const normalizedPromos = (Array.isArray(promoRows) ? promoRows : []).map((r) =>
      normalizePromotionRow(r as Record<string, unknown>)
    );
    const normalizedCoupons = (Array.isArray(couponRows) ? couponRows : []).map((r) =>
      normalizeCouponRow(r as Record<string, unknown>)
    );
    setExistingPromotions(filterPromotionRows(normalizedPromos, surface));
    setExistingCoupons(filterCouponRows(normalizedCoupons, surface));
  }, [surface]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const existingCodes = useMemo(
    () => [
      ...existingPromotions.map((p) => p.code).filter(Boolean) as string[],
      ...existingCoupons.map((c) => c.code),
    ],
    [existingPromotions, existingCoupons]
  );

  const smartTargetAdapter = useMemo<SmartTargetCatalogAdapter>(
    () => createAdminSmartTargetAdapter(apiClient, surface, catalog.vendors ?? []),
    [surface, catalog.vendors]
  );

  const wizardInitial = useMemo(() => {
    const base = DEFAULT_WIZARD_FORM();
    return { ...base, createKind: wizardKind === 'coupon' ? ('coupon' as const) : ('promotion' as const) };
  }, [wizardKind, wizardOpen]);

  const openWizard = (kind: 'promotion' | 'coupon') => {
    setWizardKind(kind);
    setWizardOpen(true);
  };

  const handleWizardSave = async (form: PromotionWizardForm) => {
    try {
      if (form.createKind === 'coupon') {
        const payload = wizardToAdminCouponPayload(form);
        onCouponsChange([...pendingCoupons, payload as Record<string, unknown>]);
        toast.success('Coupon queued for orchestration');
      } else {
        const payload = wizardToAdminPromotionPayload(form);
        onPromotionsChange([...pendingPromotions, payload as Record<string, unknown>]);
        toast.success('Promotion queued for orchestration');
      }
      setWizardOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to queue');
      throw e;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Promotions & coupons</h3>
          <p className="text-sm text-slate-500">
            Create via Promotion Wizard or manage existing in{' '}
            <Link href={promoHubHref} className="text-orange-600 underline">
              {surface === 'ecommerce' ? 'Seller Promotion Management' : 'Promotion Management'}
            </Link>
            .
          </p>
        </div>
        {!readOnly ? (
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => openWizard('promotion')}>
              <Plus className="mr-1 h-4 w-4" aria-hidden />
              New promotion
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => openWizard('coupon')}>
              <Plus className="mr-1 h-4 w-4" aria-hidden />
              New coupon
            </Button>
          </div>
        ) : null}
      </div>

      {pendingPromotions.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Queued promotions ({pendingPromotions.length})</p>
          <div className="space-y-2">
            {pendingPromotions.map((p, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2 text-sm">
                <span>{String(p.name ?? p.title ?? p.code ?? `Promotion ${i + 1}`)}</span>
                {!readOnly ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onPromotionsChange(pendingPromotions.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {pendingCoupons.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Queued coupons ({pendingCoupons.length})</p>
          <div className="space-y-2">
            {pendingCoupons.map((c, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-2 text-sm">
                <span>{String(c.code ?? `Coupon ${i + 1}`)}</span>
                {!readOnly ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onCouponsChange(pendingCoupons.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-slate-700">Existing promotions (reference)</p>
          <Link href={promoHubHref} className="inline-flex items-center text-xs text-orange-600">
            Open hub <ExternalLink className="ml-1 h-3 w-3" />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {existingPromotions.slice(0, 4).map((p) => (
            <PromotionCard key={p.id} item={p} />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium text-slate-700">Existing coupons (reference)</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {existingCoupons.slice(0, 4).map((c) => (
            <CouponCard key={c.id} item={c} />
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Attaching existing promotion/coupon IDs without re-orchestration requires a future link API. New items are
          created at publish via orchestrate.
        </p>
      </div>

      <PromotionWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        scope={scope}
        catalog={catalog}
        existingCodes={existingCodes}
        onSave={async (form) => handleWizardSave(form)}
        initial={wizardInitial}
        smartTargetAdapter={smartTargetAdapter}
      />
    </div>
  );
}
