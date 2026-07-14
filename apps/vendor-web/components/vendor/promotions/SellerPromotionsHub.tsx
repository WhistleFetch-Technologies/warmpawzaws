'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { parseJsonbArray } from '@/lib/promotion-form-utils';
import {
  PromotionDashboard,
  type PromotionDomain,
  enrichPromotionRow,
  splitVendorPromotionRows,
  wizardToVendorSellerPayload,
  type NormalizedCouponItem,
  type NormalizedPromotionItem,
  type PromotionTargetCatalog,
  type PromotionWizardForm,
} from '@warmpawz/promotion-management-ui';
import { VendorCommercialCampaigns } from '@/components/vendor/campaigns/VendorCommercialCampaigns';

const SELLER_PROMOTION_DOMAINS: PromotionDomain[] = ['product'];

export function SellerPromotionsHub({ sellerId }: { sellerId: string }) {
  const [view, setView] = useState<'promotions' | 'campaigns'>('promotions');
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
        products: products.map((p: any) => {
          const price = p.price != null ? Number(p.price) : undefined;
          const listingOwnership =
            p.listing_ownership === 'own_brand' || p.listing_ownership === 'third_party'
              ? p.listing_ownership
              : null;
          const ownershipLabel =
            listingOwnership === 'own_brand'
              ? 'Owned'
              : listingOwnership === 'third_party'
                ? 'Third party'
                : null;
          const priceLabel =
            price != null && Number.isFinite(price) ? `₹${price}` : undefined;
          return {
            id: String(p.id),
            label: String(p.name),
            subtitle: [priceLabel, ownershipLabel].filter(Boolean).join(' · ') || undefined,
            price: price != null && Number.isFinite(price) ? price : undefined,
            group: p.category,
            listingOwnership,
          };
        }),
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
      subtitle:
        'Shop offers & coupons via Discount Engine V2 (vendor-funded campaigns; applied at checkout)',
      canManageCoupons: true,
      canManagePlatformTargets: false,
      domains: SELLER_PROMOTION_DOMAINS,
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
    <div className="min-h-screen bg-slate-50">
      <div className="border-b bg-white px-4 py-2">
        <div className="mx-auto flex max-w-6xl gap-2">
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm ${
              view === 'promotions' ? 'bg-orange-50 font-semibold text-orange-800' : 'text-slate-600'
            }`}
            onClick={() => setView('promotions')}
          >
            Promotions
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm ${
              view === 'campaigns' ? 'bg-orange-50 font-semibold text-orange-800' : 'text-slate-600'
            }`}
            onClick={() => setView('campaigns')}
          >
            Campaigns
          </button>
        </div>
      </div>

      {view === 'campaigns' ? (
        <VendorCommercialCampaigns vendorId={sellerId} surface="ecommerce" />
      ) : (
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
      )}
    </div>
  );
}

/** Map legacy promotion row for edit flows that still read raw fields */
export function sellerPromotionTargets(raw: Record<string, unknown>) {
  return {
    products: parseJsonbArray(raw.applicable_products),
    categories: parseJsonbArray(raw.applicable_categories),
  };
}
