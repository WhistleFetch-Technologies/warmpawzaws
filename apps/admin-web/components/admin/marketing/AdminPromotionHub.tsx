'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { loadPromotionTargetCatalogWithErrors } from '@/lib/promotion-catalog-loader';
import {
  PromotionDashboard,
  normalizeCouponRow,
  normalizePromotionRow,
  wizardToAdminCouponPayload,
  wizardToAdminPromotionPayload,
  type PromotionTargetCatalog,
  type PromotionWizardForm,
} from '@warmpawz/promotion-management-ui';

const PLATFORM_SCOPE = {
  mode: 'platform' as const,
  title: 'Promotion Management',
  subtitle: 'Platform promotions and coupons — unified dashboard',
  canManageCoupons: true,
  canManagePlatformTargets: true,
  domains: ['platform', 'service', 'product', 'package', 'meal', 'booking'] as const,
};

export function AdminPromotionHub() {
  const [promotions, setPromotions] = useState<ReturnType<typeof normalizePromotionRow>[]>([]);
  const [coupons, setCoupons] = useState<ReturnType<typeof normalizeCouponRow>[]>([]);
  const [catalog, setCatalog] = useState<PromotionTargetCatalog>({});
  const [loading, setLoading] = useState(true);
  const [catalogWarnings, setCatalogWarnings] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [catalogResult, promotionsRes, couponsRes] = await Promise.all([
        loadPromotionTargetCatalogWithErrors(apiClient),
        apiClient.get<any>('/admin/promotions'),
        apiClient.get<any>('/admin/coupons?limit=100'),
      ]);

      setCatalog(catalogResult.catalog);
      setCatalogWarnings(catalogResult.errors);

      const promoRows = promotionsRes.promotions || promotionsRes || [];
      const couponRows = couponsRes.coupons || couponsRes || [];
      setPromotions(
        (Array.isArray(promoRows) ? promoRows : []).map((r: Record<string, unknown>) =>
          normalizePromotionRow(r)
        )
      );
      setCoupons(
        (Array.isArray(couponRows) ? couponRows : []).map((r: Record<string, unknown>) =>
          normalizeCouponRow(r)
        )
      );
    } catch (e) {
      console.error(e);
      setLoadError('Failed to load promotions. Check your connection and try again.');
      setPromotions([]);
      setCoupons([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const existingCodes = useMemo(
    () => [
      ...promotions.map((p) => p.code).filter(Boolean) as string[],
      ...coupons.map((c) => c.code),
    ],
    [promotions, coupons]
  );

  const handleSave = async (form: PromotionWizardForm, _publish: boolean, editingId?: string) => {
    try {
      if (form.createKind === 'coupon') {
        const payload = wizardToAdminCouponPayload(form);
        if (editingId) {
          await apiClient.put(`/admin/coupons/${editingId}`, payload);
          toast.success('Coupon updated');
        } else {
          await apiClient.post('/admin/coupons/create', payload);
          toast.success('Coupon created');
        }
        return;
      }
      const payload = wizardToAdminPromotionPayload(form);
      if (editingId) {
        await apiClient.put(`/admin/promotions/${editingId}`, payload);
        toast.success('Promotion updated');
      } else {
        await apiClient.post('/admin/promotions', payload);
        toast.success('Promotion created');
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Save failed';
      toast.error(message);
      throw e;
    }
  };

  return (
    <div className="space-y-3">
      {loadError ? (
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {loadError}
          </div>
        </div>
      ) : null}

      {catalogWarnings.length > 0 && !loading ? (
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Some catalog sources could not be loaded ({catalogWarnings.join(', ')}). Target
            selection may be incomplete until those services are available.
          </div>
        </div>
      ) : null}

      <PromotionDashboard
        scope={PLATFORM_SCOPE}
        promotions={promotions}
        coupons={coupons}
        catalog={catalog}
        loading={loading}
        existingCodes={existingCodes}
        onRefresh={load}
        onSave={handleSave}
        onDeletePromotion={async (id) => {
          try {
            await apiClient.delete(`/admin/promotions/${id}`);
            toast.success('Promotion deactivated');
            load();
          } catch {
            toast.error('Failed to delete promotion');
          }
        }}
        onTogglePromotion={async (id, active) => {
          try {
            await apiClient.put(`/admin/promotions/${id}`, { is_active: active });
            toast.success(active ? 'Promotion activated' : 'Promotion paused');
            load();
          } catch {
            toast.error('Failed to update promotion status');
          }
        }}
        onDeleteCoupon={async (id) => {
          try {
            await apiClient.delete(`/admin/coupons/${id}`).catch(() =>
              apiClient.put(`/admin/coupons/${id}`, { isActive: false })
            );
            toast.success('Coupon removed');
            load();
          } catch {
            toast.error('Failed to delete coupon');
          }
        }}
        headerActions={
          <Link
            href="/marketing"
            className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Legacy Marketing Hub
          </Link>
        }
      />
    </div>
  );
}
