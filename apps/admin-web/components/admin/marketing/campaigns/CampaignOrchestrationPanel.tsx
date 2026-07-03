'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@warmpawz/ui';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { loadPromotionTargetCatalogWithErrors } from '@/lib/promotion-catalog-loader';
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
} from '@warmpawz/promotion-management-ui';

const PLATFORM_SCOPE = {
  mode: 'platform' as const,
  title: 'Campaign promotion',
  subtitle: 'Queued for orchestration — not saved to Promotion Hub until publish',
  canManageCoupons: true,
  canManagePlatformTargets: true,
  domains: ['platform', 'service', 'product', 'package', 'meal', 'booking'] as const,
};

export function CampaignOrchestrationPanel({
  pendingPromotions,
  pendingCoupons,
  onPromotionsChange,
  onCouponsChange,
  readOnly = false,
}: {
  pendingPromotions: Array<Record<string, unknown>>;
  pendingCoupons: Array<Record<string, unknown>>;
  onPromotionsChange: (rows: Array<Record<string, unknown>>) => void;
  onCouponsChange: (rows: Array<Record<string, unknown>>) => void;
  readOnly?: boolean;
}) {
  const [catalog, setCatalog] = useState<PromotionTargetCatalog>({});
  const [existingPromotions, setExistingPromotions] = useState<ReturnType<typeof normalizePromotionRow>[]>([]);
  const [existingCoupons, setExistingCoupons] = useState<ReturnType<typeof normalizeCouponRow>[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardKind, setWizardKind] = useState<'promotion' | 'coupon'>('promotion');

  const loadCatalog = useCallback(async () => {
    const [catalogResult, promotionsRes, couponsRes] = await Promise.all([
      loadPromotionTargetCatalogWithErrors(apiClient),
      apiClient.get<{ promotions?: unknown[] }>('/admin/promotions'),
      apiClient.get<{ coupons?: unknown[] }>('/admin/coupons?limit=100'),
    ]);
    setCatalog(catalogResult.catalog);
    const promoRows = promotionsRes.promotions ?? [];
    const couponRows = couponsRes.coupons ?? [];
    setExistingPromotions(
      (Array.isArray(promoRows) ? promoRows : []).map((r) => normalizePromotionRow(r as Record<string, unknown>))
    );
    setExistingCoupons(
      (Array.isArray(couponRows) ? couponRows : []).map((r) => normalizeCouponRow(r as Record<string, unknown>))
    );
  }, []);

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
            <Link href="/promotions" className="text-orange-600 underline">
              Promotion Management
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
          <Link href="/promotions" className="inline-flex items-center text-xs text-orange-600">
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
        scope={PLATFORM_SCOPE}
        catalog={catalog}
        existingCodes={existingCodes}
        onSave={async (form) => handleWizardSave(form)}
        initial={wizardInitial}
      />
    </div>
  );
}
