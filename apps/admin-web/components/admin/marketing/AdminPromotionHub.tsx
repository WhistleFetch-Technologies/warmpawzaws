'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [promotionsRes, couponsRes, vendorsRes] = await Promise.all([
        apiClient.get<any>('/admin/promotions'),
        apiClient.get<any>('/admin/coupons?limit=100'),
        apiClient.get<any>('/admin/vendors?limit=50').catch(() => ({ vendors: [] })),
      ]);
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
      const vendors = vendorsRes.vendors || vendorsRes.data || [];
      setCatalog({
        vendors: (Array.isArray(vendors) ? vendors : []).slice(0, 100).map((v: any) => ({
          id: String(v.id ?? v.vendor_id),
          label: String(v.business_name ?? v.name ?? v.id),
          subtitle: v.city ? String(v.city) : undefined,
        })),
        packages: [],
        mealPlans: [],
        styles: [
          { id: 'at_home', label: 'At home' },
          { id: 'at_center', label: 'At center' },
          { id: 'tele', label: 'Tele consult' },
        ],
      });
    } catch (e) {
      console.error(e);
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
    if (form.createKind === 'coupon') {
      const payload = wizardToAdminCouponPayload(form);
      if (editingId) {
        await apiClient.put(`/admin/coupons/${editingId}`, payload);
      } else {
        await apiClient.post('/admin/coupons/create', payload);
      }
      return;
    }
    const payload = wizardToAdminPromotionPayload(form);
    if (editingId) {
      await apiClient.put(`/admin/promotions/${editingId}`, payload);
    } else {
      await apiClient.post('/admin/promotions', payload);
    }
  };

  return (
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
        await apiClient.delete(`/admin/promotions/${id}`);
        load();
      }}
      onTogglePromotion={async (id, active) => {
        await apiClient.put(`/admin/promotions/${id}`, { is_active: active });
        load();
      }}
      onDeleteCoupon={async (id) => {
        await apiClient.delete(`/admin/coupons/${id}`).catch(() =>
          apiClient.put(`/admin/coupons/${id}`, { isActive: false })
        );
        load();
      }}
    />
  );
}
