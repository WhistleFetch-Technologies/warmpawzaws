'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { parseJsonbArray } from '@/lib/promotion-form-utils';
import {
  PromotionDashboard,
  normalizePromotionRow,
  wizardToVendorSellerPayload,
  type PromotionTargetCatalog,
  type PromotionWizardForm,
} from '@warmpawz/promotion-management-ui';

export function SellerPromotionsHub({ sellerId }: { sellerId: string }) {
  const [promotions, setPromotions] = useState<ReturnType<typeof normalizePromotionRow>[]>([]);
  const [catalog, setCatalog] = useState<PromotionTargetCatalog>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [promosRes, productsRes] = await Promise.all([
        apiClient.get<any>(`/vendor/${sellerId}/promotions`),
        apiClient.get<any>(`/vendor/${sellerId}/products`).catch(() => ({ products: [] })),
      ]);
      const rows = promosRes?.promotions || [];
      setPromotions(rows.map((r: Record<string, unknown>) => normalizePromotionRow(r)));
      const products = (productsRes as any)?.products || [];
      const categories = [
        ...new Set(products.map((p: any) => p.category).filter(Boolean)),
      ] as string[];
      setCatalog({
        products: products.map((p: any) => ({
          id: String(p.id),
          label: String(p.name),
          subtitle: p.price != null ? `₹${p.price}` : undefined,
          group: p.category,
        })),
        categories: categories.map((c) => ({ id: c, label: c })),
        mealPlans: [],
        packages: [],
      });
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
      subtitle: 'Shop offers and product targeting',
      canManageCoupons: true,
      canManagePlatformTargets: false,
      domains: ['product'] as const,
    }),
    []
  );

  const existingCodes = useMemo(
    () => promotions.map((p) => p.code).filter(Boolean) as string[],
    [promotions]
  );

  return (
    <PromotionDashboard
      scope={scope}
      promotions={promotions}
      catalog={catalog}
      loading={loading}
      existingCodes={existingCodes}
      onRefresh={load}
      onSave={async (form, _publish, editingId) => {
        const payload = wizardToVendorSellerPayload(form, sellerId);
        if (editingId) {
          await apiClient.put(`/vendor/${sellerId}/promotions/${editingId}`, payload);
        } else {
          await apiClient.post(`/vendor/${sellerId}/promotions`, payload);
        }
      }}
      onDeletePromotion={async (id) => {
        await apiClient.delete(`/vendor/${sellerId}/promotions/${id}`);
        load();
      }}
      onTogglePromotion={async (id, active) => {
        await apiClient.put(`/vendor/${sellerId}/promotions/${id}`, { is_active: active });
        load();
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
