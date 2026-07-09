'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Loader2, Tag, X } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

export type SelectedCartPromotion = {
  code: string;
  discountAmount: number;
  promotionId?: string;
  label: string;
  /** Which table validated this — 'vendor' (vendor_promotions) or 'admin' (ecommerce_admin_promotions / platform). Server re-validates strictly against this source only. */
  source: 'vendor' | 'admin';
};

type PromoOption = {
  id: string;
  name: string;
  code?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_value?: number;
  min_booking_value?: number;
  max_discount_amount?: number;
  source: 'platform' | 'vendor';
};

type CartPromoLineItem = {
  productId: string;
  id?: string;
  quantity: number;
  price: number;
  categoryId?: string;
  category?: string;
};

type CartPromotionSelectProps = {
  orderAmount: number;
  vendorId?: string;
  cartItems?: CartPromoLineItem[];
  customerId?: string;
  selected: SelectedCartPromotion | null;
  onApply: (promo: SelectedCartPromotion) => void;
  onRemove: () => void;
  className?: string;
};

function formatPromoLabel(p: PromoOption): string {
  const off =
    p.discount_type === 'percentage'
      ? `${p.discount_value}% off`
      : `₹${p.discount_value} off`;
  const min = p.min_order_value ?? p.min_booking_value;
  const minHint = min && min > 0 ? ` · min ₹${min}` : '';
  return `${p.name} (${off}${minHint})`;
}

export function CartPromotionSelect({
  orderAmount,
  vendorId,
  cartItems = [],
  customerId,
  selected,
  onApply,
  onRemove,
  className = '',
}: CartPromotionSelectProps) {
  const [options, setOptions] = useState<PromoOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const merged: PromoOption[] = [];

      const platformRes = await apiClient.get<{ promotions?: PromoOption[] }>(
        '/ecommerce/promotions/active?serviceType=product'
      );
      for (const p of platformRes?.promotions ?? []) {
        merged.push({ ...p, source: 'platform' });
      }

      if (vendorId && vendorId !== 'default') {
        const vendorRes = await apiClient.get<{ promotions?: PromoOption[] }>(
          `/vendors/${vendorId}/active-promotions?type=product`
        );
        for (const p of vendorRes?.promotions ?? []) {
          merged.push({ ...p, source: 'vendor' });
        }
      }

      const deduped = merged.filter(
        (p, i, arr) => arr.findIndex((x) => x.id === p.id) === i
      );
      setOptions(deduped);
    } catch {
      setOptions([]);
      setError('Could not load promotions');
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const selectableOptions = useMemo(
    () =>
      options.filter((p) => {
        const min = p.min_order_value ?? p.min_booking_value ?? 0;
        return orderAmount >= min;
      }),
    [options, orderAmount]
  );

  const handleSelect = async (promoId: string) => {
    if (!promoId) {
      onRemove();
      return;
    }
    const promo = options.find((p) => p.id === promoId);
    if (!promo) return;

    const code = (promo.code || promo.name || '').trim();
    if (!code) {
      toast.error('This promotion has no code');
      return;
    }

    setApplying(true);
    setError(null);
    try {
      const res = await apiClient.post<{
        valid?: boolean;
        message?: string;
        discount_amount?: number;
        promotion?: { id?: string };
      }>('/promotions/validate-code', {
        code: code.toUpperCase(),
        vendorId: vendorId && vendorId !== 'default' ? vendorId : undefined,
        orderAmount,
        orderType: 'product',
        customerId,
        items: cartItems.map((item) => ({
          productId: item.productId || item.id,
          quantity: item.quantity,
          price: item.price,
          categoryId: item.categoryId || item.category,
          category: item.categoryId || item.category,
        })),
      });

      if (!res.valid) {
        setError(res.message || 'Promotion not applicable');
        return;
      }

      onApply({
        code: code.toUpperCase(),
        discountAmount: res.discount_amount ?? 0,
        promotionId: res.promotion?.id ?? promo.id,
        label: promo.name,
        source: promo.source === 'platform' ? 'admin' : 'vendor',
      });
      toast.success('Promotion applied');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not apply promotion';
      setError(msg);
    } finally {
      setApplying(false);
    }
  };

  if (selected) {
    return (
      <section
        className={`rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 ${className}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex gap-2 min-w-0">
            <Tag className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-emerald-900">{selected.label}</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                −₹{selected.discountAmount.toFixed(0)} applied
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 text-emerald-700 hover:text-emerald-900 rounded-lg"
            aria-label="Remove promotion"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={`rounded-2xl border border-slate-100 bg-white p-4 shadow-sm ${className}`}>
      <label htmlFor="cart-promo-select" className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-2">
        <Tag className="w-4 h-4 text-[#FF8C42]" />
        Apply promotion
      </label>
      <div className="relative">
        <select
          id="cart-promo-select"
          disabled={loading || applying || selectableOptions.length === 0}
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            if (v) void handleSelect(v);
            e.target.value = '';
          }}
          className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-10 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-200 disabled:opacity-60"
        >
          <option value="">
            {loading
              ? 'Loading promotions…'
              : selectableOptions.length === 0
                ? 'No promotions available'
                : 'Select a promotion'}
          </option>
          {selectableOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {formatPromoLabel(p)}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        {(loading || applying) && (
          <Loader2 className="absolute right-9 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {!loading && options.length > 0 && selectableOptions.length === 0 && (
        <p className="mt-2 text-xs text-slate-500">
          Promotions require a higher order value for your current cart.
        </p>
      )}
    </section>
  );
}
