'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { parseJsonbArray } from '@/lib/promotion-form-utils';
import {
  PromotionDashboard,
  enrichPromotionRow,
  splitVendorPromotionRows,
  wizardToVendorSellerPayload,
  type NormalizedCouponItem,
  type NormalizedPromotionItem,
  type PromotionTargetCatalog,
  type PromotionWizardForm,
} from '@warmpawz/promotion-management-ui';

export function SellerPromotionsHub({ sellerId }: { sellerId: string }) {
  const [promotions, setPromotions] = useState<NormalizedPromotionItem[]>([]);
  const [coupons, setCoupons] = useState<NormalizedCouponItem[]>([]);
  const [catalog, setCatalog] = useState<PromotionTargetCatalog>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [promosRes, productsRes] = await Promise.all([
        apiClient.get<any>(`/vendor/${sellerId}/promotions`),
        apiClient.get<any>(`/vendor/${sellerId}/products`).catch(() => ({ products: [] })),
      ]);
      const rows = promosRes?.promotions || [];
      const products = (productsRes as any)?.products || [];
      const categories = [
        ...new Set(products.map((p: any) => p.category).filter(Boolean)),
      ] as string[];

      const nextCatalog: PromotionTargetCatalog = {
        products: products.map((p: any) => ({
          id: String(p.id),
          label: String(p.name),
          subtitle: p.price != null ? `₹${p.price}` : undefined,
          group: p.category,
        })),
        categories: categories.map((c) => ({ id: c, label: c })),
        mealPlans: [],
        packages: [],
      };

      setCatalog(nextCatalog);

      const enriched = rows.map((r: Record<string, unknown>) =>
        enrichPromotionRow(r, nextCatalog, { vendorMode: true })
      );
      const split = splitVendorPromotionRows(enriched);
      setPromotions(split.promotions);
      setCoupons(split.coupons);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load promotions');
    } finally {
      setLoading(false);
    }
  }, [sellerId]);

  useEffect(() => {
    load();
  }, [load]);

  const scope = useMemo(
    () => ({
      mode: 'vendor_seller' as const,
      title: 'Seller Promotions',
      subtitle: 'Shop offers, coupon codes, and product targeting',
      canManageCoupons: true,
      canManagePlatformTargets: false,
      domains: ['product'] as const,
    }),
    []
  );

  const existingCodes = useMemo(
    () => [...promotions, ...coupons.map((c) => ({ code: c.code }))].map((p) => p.code).filter(Boolean) as string[],
    [promotions, coupons]
  );

  const savePromotion = async (form: PromotionWizardForm, _publish: boolean, editingId?: string) => {
    const payload = wizardToVendorSellerPayload(form, sellerId);
    if (editingId) {
      await apiClient.put(`/vendor/${sellerId}/promotions/${editingId}`, payload);
    } else {
      await apiClient.post(`/vendor/${sellerId}/promotions`, payload);
    }
  };

  return (
    <PromotionDashboard
      scope={scope}
      promotions={promotions}
      coupons={coupons}
      catalog={catalog}
      loading={loading}
      error={error}
      existingCodes={existingCodes}
      onRefresh={load}
      onSave={savePromotion}
      onDeletePromotion={async (id) => {
        await apiClient.delete(`/vendor/${sellerId}/promotions/${id}`);
      }}
      onTogglePromotion={async (id, active) => {
        await apiClient.put(`/vendor/${sellerId}/promotions/${id}`, { is_active: active });
      }}
      onDeleteCoupon={async (id) => {
        await apiClient.delete(`/vendor/${sellerId}/promotions/${id}`);
      }}
      onToggleCoupon={async (id, active) => {
        await apiClient.put(`/vendor/${sellerId}/promotions/${id}`, { is_active: active });
      }}
    />
  );
}

/** Map legacy promotion row for edit flows that still read raw fields */
export function sellerPromotionTargets(raw: Record<string, unknown>) {
  return {
    products: parseJsonbArray(raw.applicable_products),
    categories: parseJsonbArray(raw.applicable_categories),
  };
}
