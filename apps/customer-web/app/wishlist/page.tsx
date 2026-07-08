'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Heart, Loader2, ShoppingBag, Trash2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';
import {
  fetchWishlistProductSummary,
  type WishlistProductRow,
} from '@/lib/wishlist-product-fetch';
import { goBackOrHome, consumeWishlistOpenedFromShop } from '@/lib/go-back-or-replace';
import { isCustomerEcommerceEnabled } from '@/lib/customer-ecommerce-flag';
import { AppReviewDemoRouteGuard } from '@/lib/app-review-demo-route-guard';
import { shopProductDetailPath } from '@/lib/shop-product-path';
import {
  canSyncWishlistToApi,
  readWishlistIds,
  removeWishlistProductIds,
  resolveWishlistIdsForDisplay,
  sameWishlistIdSet,
  setWishlistIds,
  WISHLIST_UPDATED_EVENT,
  type WishlistApiItem,
} from '@/lib/warmpawz-wishlist-local';

type WishlistRow = WishlistProductRow;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function WishlistPage() {
  return (
    <AppReviewDemoRouteGuard>
      <WishlistPageContent />
    </AppReviewDemoRouteGuard>
  );
}

function WishlistPageContent() {
  const router = useRouter();
  const shopEnabled = isCustomerEcommerceEnabled();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<WishlistRow[]>([]);
  const loadGenRef = useRef(0);
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadWishlist = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (!isCustomerEcommerceEnabled()) {
      setRows([]);
      setLoading(false);
      return;
    }

    const gen = ++loadGenRef.current;
    if (mode === 'initial') setLoading(true);

    try {
      const localIds = [...new Set(readWishlistIds())];
      let idsToRender = [...localIds];

      if (mode === 'initial') {
        const customerId = getResolvedCustomerId();
        if (customerId && UUID_RE.test(customerId)) {
          try {
            const res = await apiClient.get<{
              wishlist?: { items?: WishlistApiItem[] };
            }>(`/customer/${encodeURIComponent(customerId)}/wishlist`);
            const items = res?.wishlist?.items ?? [];
            const merged = resolveWishlistIdsForDisplay('initial', localIds, items);
            if (!sameWishlistIdSet(localIds, merged)) {
              setWishlistIds(merged);
            }
            idsToRender = merged;
          } catch {
            /* ignore API merge failure — local ids remain source of truth */
          }
        }
      }

      if (gen !== loadGenRef.current) return;

      const summaries = await Promise.all(
        idsToRender.map((storageKey) => fetchWishlistProductSummary(storageKey))
      );
      if (gen !== loadGenRef.current) return;
      setRows(summaries);
    } catch (err) {
      console.error('[wishlist] loadWishlist failed', err);
      if (gen !== loadGenRef.current) return;
      const fallbackIds = [...new Set(readWishlistIds())];
      if (fallbackIds.length === 0) {
        setRows([]);
        return;
      }
      try {
        const summaries = await Promise.all(
          fallbackIds.map((storageKey) => fetchWishlistProductSummary(storageKey))
        );
        if (gen !== loadGenRef.current) return;
        setRows(summaries);
      } catch {
        if (gen !== loadGenRef.current) return;
        setRows(
          fallbackIds.map((storageKey) => ({
            storageKey,
            id: storageKey,
            name: 'Product unavailable',
            price: 0,
            missing: true,
          }))
        );
      }
    } finally {
      if (mode === 'initial') setLoading(false);
    }
  }, []);

  useEffect(() => {
    consumeWishlistOpenedFromShop();
  }, []);

  useEffect(() => {
    void loadWishlist('initial');
  }, [loadWishlist]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const scheduleRefresh = () => {
      if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
      refreshDebounceRef.current = setTimeout(() => {
        refreshDebounceRef.current = null;
        void loadWishlist('refresh');
      }, 120);
    };

    window.addEventListener(WISHLIST_UPDATED_EVENT, scheduleRefresh as EventListener);
    return () => {
      window.removeEventListener(WISHLIST_UPDATED_EVENT, scheduleRefresh as EventListener);
      if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
    };
  }, [loadWishlist]);

  const removeRow = async (row: WishlistRow) => {
    removeWishlistProductIds(row.storageKey, row.id);
    setRows((r) => r.filter((x) => x.storageKey !== row.storageKey));

    const customerId = getResolvedCustomerId();
    if (canSyncWishlistToApi(customerId, row.id)) {
      try {
        await apiClient.post(`/customer/${encodeURIComponent(customerId!)}/wishlist`, {
          productId: row.id,
          action: 'remove',
        });
      } catch {
        /* ignore — local removal already applied */
      }
    }
  };

  if (!shopEnabled) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50 px-4">
        <button
          type="button"
          onClick={() => goBackOrHome(router)}
          className="absolute left-4 top-4 rounded-lg bg-white/90 p-2 shadow-sm"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-gray-700" />
        </button>
        <div className="max-w-sm rounded-2xl bg-white p-8 text-center shadow-lg">
          <Heart className="mx-auto mb-4 h-16 w-16 text-red-200" />
          <h2 className="mb-2 text-xl font-bold text-gray-800">Coming soon</h2>
          <p className="text-gray-500">
            Saved items and wishlist will be available when the marketplace launches.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50">
        <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
        <p className="mt-3 text-sm text-gray-500">Loading saved items…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-customer bg-gradient-to-br from-orange-50 via-white to-amber-50 pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-orange-100/80 bg-white/95 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => goBackOrHome(router)}
          className="rounded-lg p-2 hover:bg-orange-50"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-gray-800" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Heart className="h-6 w-6 shrink-0 text-red-500" />
          <h1 className="truncate text-lg font-bold text-gray-900">Saved items</h1>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-sm">
            <ShoppingBag className="h-12 w-12 text-orange-300" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">Nothing saved yet</h2>
          <p className="mb-8 max-w-xs text-gray-500">
            Tap the heart on a product in the shop to save it here.
          </p>
          <Link
            href="/shop"
            className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-8 py-3 font-semibold text-white shadow-md"
          >
            Browse shop
          </Link>
        </div>
      ) : (
        <ul className="space-y-3 px-3 pt-4">
          {rows.map((row) => (
            <li
              key={row.storageKey}
              className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm"
            >
              <Link
                href={shopProductDetailPath(row.id)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-2xl">
                  {row.image ? (
                    <img src={row.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span>{row.emoji || '🛍️'}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-900">{row.name}</p>
                  <p className="text-sm text-orange-600">
                    {row.missing ? 'Unavailable' : `₹${Math.round(row.price)}`}
                  </p>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => void removeRow(row)}
                className="shrink-0 rounded-xl p-3 text-red-500 hover:bg-red-50"
                aria-label="Remove from saved"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
