'use client';

import {
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
  useDeferredValue,
  useMemo,
} from 'react';
import { Package, AlertTriangle, TrendingDown, ArrowUp, ArrowDown, Search, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { IntegerInput } from '@/components/shared/IntegerInput';
import { Button } from '@/components/ui/button';
import { useVendorProductList } from '@/hooks/useVendorProductList';
import { VENDOR_PRODUCT_PAGE_SIZE } from '@/lib/vendor-product-list-query';
import { paginationShowingLabel } from '@/lib/vendor-schedule-bookings';

/** Products below this threshold (but above 0) are flagged as low stock. */
const LOW_STOCK_THRESHOLD = 10;

/**
 * Key format used in pendingChanges map:
 *   Simple product → `${productId}:simple`
 *   Variant SKU   → `${productId}:${skuId}`
 */
function makePendingKey(productId: string, skuIdOrSimple: string): string {
  return `${productId}:${skuIdOrSimple}`;
}

export type InventoryManagementHandle = {
  refresh: () => Promise<void>;
};

interface InventoryManagementProps {
  sellerId: string;
}

type InventorySku = {
  id?: string;
  sku?: string;
  stock?: number;
  option_values?: Record<string, string>;
};

function productHasVariants(product: { has_variants?: boolean; skus?: InventorySku[] }): boolean {
  return Boolean(product.has_variants) || (Array.isArray(product.skus) && product.skus.length > 0);
}

function formatSkuOptionLabel(sku: InventorySku): string {
  const ov = sku.option_values || {};
  const parts: string[] = [];
  if (ov.size) parts.push(`Size: ${ov.size}`);
  if (ov.color) parts.push(`Color: ${ov.color}`);
  if (ov.colour) parts.push(`Color: ${ov.colour}`);
  if (ov.pack) parts.push(`Pack: ${ov.pack}`);
  if (ov.weight) parts.push(`Weight: ${ov.weight}`);
  return parts.length > 0 ? parts.join(' · ') : 'Variant';
}

function stockTone(stock: number): string {
  if (stock === 0) return 'text-red-600';
  if (stock <= LOW_STOCK_THRESHOLD) return 'text-amber-600';
  return 'text-emerald-600';
}

function stockBadge(stock: number): string {
  if (stock === 0) return 'bg-red-50 text-red-700';
  if (stock <= LOW_STOCK_THRESHOLD) return 'bg-amber-50 text-amber-700';
  return 'bg-emerald-50 text-emerald-700';
}

function stockLabel(stock: number): string {
  if (stock === 0) return 'Out';
  if (stock <= LOW_STOCK_THRESHOLD) return 'Low';
  return 'In stock';
}

function InventoryStockStepper({
  value,
  pending,
  saving,
  disableDec,
  onDec,
  onInc,
  onChange,
}: {
  value: number;
  pending: boolean;
  saving: boolean;
  disableDec: boolean;
  onDec: () => void;
  onInc: () => void;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={onDec}
        disabled={saving || disableDec}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
      >
        <ArrowDown className="h-3.5 w-3.5" />
      </button>
      <IntegerInput
        value={String(value)}
        onChange={(v) => onChange(parseInt(v, 10) || 0)}
        className={`w-12 rounded-lg border py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${
          pending ? 'border-orange-400 bg-orange-50' : 'border-slate-200'
        }`}
      />
      <button
        type="button"
        onClick={onInc}
        disabled={saving}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50"
      >
        <ArrowUp className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function resolveSelectedSkuId(product: { id: string; skus?: InventorySku[] }, selectedMap: Record<string, string>): string {
  const skus = product.skus || [];
  const stored = selectedMap[product.id];
  if (stored && skus.some((s) => String(s.id) === stored)) return stored;
  const first = skus.find((s) => s.id != null);
  return first?.id ? String(first.id) : '';
}

export const InventoryManagement = forwardRef<InventoryManagementHandle, InventoryManagementProps>(
  function InventoryManagement({ sellerId }, ref) {
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedSkuByProduct, setSelectedSkuByProduct] = useState<Record<string, string>>({});
  const [lowStockCount, setLowStockCount] = useState(0);

  const deferredSearch = useDeferredValue(searchQuery.trim());

  const {
    products,
    total,
    loading,
    refresh,
    pageSize,
  } = useVendorProductList({
    sellerId,
    mode: 'paged',
    pageIndex,
    search: deferredSearch,
    enabled: Boolean(sellerId),
  });

  const loadLowStockCount = useCallback(async () => {
    if (!sellerId) {
      setLowStockCount(0);
      return;
    }
    try {
      const data = await apiClient.get<{ count?: number }>(
        `/vendor/${sellerId}/products/low-stock?threshold=${LOW_STOCK_THRESHOLD}`,
      );
      setLowStockCount(Number(data?.count ?? 0));
    } catch (error) {
      console.error('Error loading low stock count:', error);
      setLowStockCount(0);
    }
  }, [sellerId]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refresh(), loadLowStockCount()]);
  }, [refresh, loadLowStockCount]);

  useImperativeHandle(ref, () => ({ refresh: refreshAll }), [refreshAll]);

  useEffect(() => {
    void loadLowStockCount();
  }, [loadLowStockCount]);

  useEffect(() => {
    setPageIndex(0);
  }, [deferredSearch, filter, sellerId]);

  useEffect(() => {
    const defaults: Record<string, string> = {};
    for (const p of products) {
      if (productHasVariants(p) && p.skus?.length) {
        const firstId = (p.skus as InventorySku[])[0]?.id;
        if (firstId) defaults[p.id] = String(firstId);
      }
    }
    if (Object.keys(defaults).length > 0) {
      setSelectedSkuByProduct((prev) => ({ ...defaults, ...prev }));
    }
  }, [products]);

  /**
   * Pending unsaved stock changes.
   * Keys: makePendingKey(productId, skuId) or makePendingKey(productId, 'simple').
   * Values: new stock number.
   * Only populated while the vendor is editing; cleared after Save or Discard.
   */
  const [pendingChanges, setPendingChanges] = useState<Record<string, number>>({});
  const isDirty = Object.keys(pendingChanges).length > 0;

  /** Stage a stock change locally — no API call yet. */
  const stageChange = (key: string, newStock: number) => {
    setPendingChanges((prev) => ({ ...prev, [key]: Math.max(0, newStock) }));
  };

  /** Discard all pending changes without saving. */
  const handleDiscard = () => {
    setPendingChanges({});
  };

  /**
   * Commit all pending changes to the API in parallel.
   * Simple products use PUT; variant SKUs use PATCH.
   */
  const handleSaveChanges = async () => {
    if (!isDirty) return;
    setSaving(true);
    try {
      await Promise.all(
        Object.entries(pendingChanges).map(([key, stock]) => {
          const [productId, skuIdOrSimple] = key.split(':');
          if (skuIdOrSimple === 'simple') {
            return apiClient.put(`/vendor/${sellerId}/products/${productId}`, { stock });
          }
          return apiClient.patch(
            `/vendor/${sellerId}/products/${productId}/skus/${skuIdOrSimple}/stock`,
            { stock },
          );
        }),
      );
      setPendingChanges({});
      await refreshAll();
      toast.success('Stock updated successfully');
    } catch (error) {
      console.error('Error saving stock changes:', error);
      toast.error('Failed to save stock changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const effectiveStock = (key: string, fallback: number): number =>
    key in pendingChanges ? pendingChanges[key] : fallback;

  const isLowStock = (p: any) => {
    const threshold = p.min_stock || p.minStock || LOW_STOCK_THRESHOLD;
    return (p.stock ?? p.stock_quantity ?? 0) <= threshold && (p.stock ?? p.stock_quantity ?? 0) > 0;
  };
  const isOutOfStock = (p: any) => (p.stock ?? p.stock_quantity ?? 0) === 0;
  const isHealthy = (p: any) => (p.stock ?? p.stock_quantity ?? 0) > (p.min_stock || p.minStock || LOW_STOCK_THRESHOLD);

  const filteredProducts = products.filter((product) => {
    const matchesFilter =
      filter === 'all' ? true :
      filter === 'low' ? isLowStock(product) :
      filter === 'out' ? isOutOfStock(product) :
      filter === 'good' ? isHealthy(product) : true;
    return matchesFilter;
  });

  const getRowModel = (product: any) => {
    const hasVariants = productHasVariants(product);
    const selectedSkuId = hasVariants
      ? resolveSelectedSkuId(product, selectedSkuByProduct)
      : '';
    const selectedSku = hasVariants
      ? (product.skus || []).find((s: InventorySku) => String(s.id) === selectedSkuId)
      : null;
    const simpleKey = makePendingKey(product.id, 'simple');
    const variantKey = makePendingKey(product.id, selectedSkuId);
    const useVariant = Boolean(hasVariants && selectedSkuId);
    const stockKey = useVariant ? variantKey : simpleKey;
    const displayStock = useVariant
      ? effectiveStock(variantKey, Number(selectedSku?.stock ?? 0))
      : effectiveStock(simpleKey, Number(product.stock ?? 0));
    const pending = stockKey in pendingChanges;
    const catalogStock = Number(product.stock ?? 0);
    return {
      product,
      hasVariants,
      selectedSkuId,
      useVariant,
      stockKey,
      displayStock,
      pending,
      catalogStock,
    };
  };

  const pageStats = useMemo(
    () => ({
      healthy: products.filter(isHealthy).length,
      outOfStock: products.filter(isOutOfStock).length,
    }),
    [products],
  );

  const anyHasVariants = products.some(productHasVariants);
  const hasPagination = total > pageSize || pageIndex > 0;
  const hasMorePages = (pageIndex + 1) * pageSize < total;

  if (loading && products.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-500 mx-auto"></div>
          <p className="mt-4 text-slate-500">Loading inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 sm:gap-3">
        <div className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm sm:rounded-2xl sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="rounded-lg bg-blue-100 p-1.5 sm:rounded-xl sm:p-3">
              <Package className="h-4 w-4 text-blue-600 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 sm:text-sm">Total products</p>
              <p className="text-base font-bold text-slate-900 sm:text-2xl">{total}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm sm:rounded-2xl sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="rounded-lg bg-emerald-100 p-1.5 sm:rounded-xl sm:p-3">
              <ArrowUp className="h-4 w-4 text-emerald-600 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 sm:text-sm">Healthy</p>
              <p className="text-base font-bold text-emerald-600 sm:text-2xl">{pageStats.healthy}</p>
              <p className="hidden text-xs text-slate-400 sm:block">On this page</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm sm:rounded-2xl sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="rounded-lg bg-amber-100 p-1.5 sm:rounded-xl sm:p-3">
              <TrendingDown className="h-4 w-4 text-amber-600 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 sm:text-sm">Low stock</p>
              <p className="text-base font-bold text-amber-600 sm:text-2xl">{lowStockCount}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm sm:rounded-2xl sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="rounded-lg bg-red-100 p-1.5 sm:rounded-xl sm:p-3">
              <AlertTriangle className="h-4 w-4 text-red-600 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 sm:text-sm">Out of stock</p>
              <p className="text-base font-bold text-red-600 sm:text-2xl">{pageStats.outOfStock}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters + Save/Discard toolbar */}
      <div className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-white p-2.5 shadow-sm sm:gap-4 sm:rounded-2xl sm:p-4 md:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 sm:left-4 sm:h-5 sm:w-5" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 sm:rounded-xl sm:py-3 sm:pl-12 sm:pr-4"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 sm:rounded-xl sm:px-4 sm:py-3 md:w-auto md:min-w-[180px]"
        >
          <option value="all">All Products</option>
          <option value="good">Healthy Stock ({'>'}{LOW_STOCK_THRESHOLD})</option>
          <option value="low">Low Stock (1–{LOW_STOCK_THRESHOLD})</option>
          <option value="out">Out of Stock (0)</option>
        </select>

        {/* Save / Discard — visible only when there are unsaved edits */}
        {isDirty && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleDiscard}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              Discard
            </button>
            <button
              type="button"
              onClick={() => void handleSaveChanges()}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-60 font-medium"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving…' : `Save Changes (${Object.keys(pendingChanges).length})`}
            </button>
          </div>
        )}
      </div>

      {/* Inventory list / table */}
      <div className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm sm:rounded-2xl">
        {filteredProducts.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">No products found</p>
        ) : (
          <>
            <div className="space-y-2.5 bg-slate-50/80 p-2 md:hidden">
              {filteredProducts.map((product) => {
                const row = getRowModel(product);
                return (
                  <div
                    key={product.id}
                    className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                  >
                    <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900">
                      {product.name}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={`text-xs font-semibold ${stockTone(row.catalogStock)}`}>
                        {row.catalogStock}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${stockBadge(row.catalogStock)}`}>
                        {stockLabel(row.catalogStock)}
                      </span>
                      {row.hasVariants ? (
                        <span className="text-[11px] text-slate-400">across variants</span>
                      ) : null}
                      {row.pending ? (
                        <span className="text-[11px] font-medium text-orange-600">Unsaved</span>
                      ) : null}
                    </div>
                    {row.useVariant ? (
                      <select
                        value={row.selectedSkuId}
                        onChange={(e) =>
                          setSelectedSkuByProduct((prev) => ({
                            ...prev,
                            [product.id]: e.target.value,
                          }))
                        }
                        className="mt-2.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                      >
                        {(product.skus || []).map((sku: InventorySku) => (
                          <option key={String(sku.id)} value={String(sku.id)}>
                            {formatSkuOptionLabel(sku)}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                      <span className="text-[11px] text-slate-500">
                        {row.useVariant ? 'Variant stock' : 'Stock'}
                      </span>
                      <InventoryStockStepper
                        value={row.displayStock}
                        pending={row.pending}
                        saving={saving}
                        disableDec={row.displayStock === 0}
                        onDec={() => stageChange(row.stockKey, row.displayStock - 1)}
                        onInc={() => stageChange(row.stockKey, row.displayStock + 1)}
                        onChange={(next) => stageChange(row.stockKey, next)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="p-3 text-left text-sm font-semibold text-slate-600">Product</th>
                    <th className="p-3 text-center text-sm font-semibold text-slate-600">Stock</th>
                    <th className="p-3 text-center text-sm font-semibold text-slate-600">Status</th>
                    <th className="p-3 text-center text-sm font-semibold text-slate-600">
                      {anyHasVariants ? 'Variant & stock' : 'Quick Update'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((product) => {
                    const row = getRowModel(product);
                    return (
                      <tr key={product.id} className="hover:bg-slate-50">
                        <td className="p-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-orange-100 to-amber-100 text-lg">
                              {product.emoji || '📦'}
                            </div>
                            <div className="min-w-0">
                              <span className="block truncate font-medium text-slate-900">{product.name}</span>
                              {row.hasVariants ? (
                                <p className="text-xs text-slate-500">Total across variants</p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`text-lg font-bold ${stockTone(row.catalogStock)}`}>
                            {row.catalogStock}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${stockBadge(row.catalogStock)}`}>
                            {stockLabel(row.catalogStock)}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col items-center gap-2">
                            {row.useVariant ? (
                              <select
                                value={row.selectedSkuId}
                                onChange={(e) =>
                                  setSelectedSkuByProduct((prev) => ({
                                    ...prev,
                                    [product.id]: e.target.value,
                                  }))
                                }
                                className="w-full max-w-[220px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                              >
                                {(product.skus || []).map((sku: InventorySku) => (
                                  <option key={String(sku.id)} value={String(sku.id)}>
                                    {formatSkuOptionLabel(sku)}
                                  </option>
                                ))}
                              </select>
                            ) : null}
                            <InventoryStockStepper
                              value={row.displayStock}
                              pending={row.pending}
                              saving={saving}
                              disableDec={row.displayStock === 0}
                              onDec={() => stageChange(row.stockKey, row.displayStock - 1)}
                              onInc={() => stageChange(row.stockKey, row.displayStock + 1)}
                              onChange={(next) => stageChange(row.stockKey, next)}
                            />
                            {row.pending ? (
                              <span className="text-xs font-medium text-orange-600">Unsaved</span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {hasPagination && (
          <div className="px-4 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              {paginationShowingLabel(total, pageIndex * VENDOR_PRODUCT_PAGE_SIZE, products.length)}
            </p>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
                disabled={pageIndex === 0 || loading}
                onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none"
                disabled={!hasMorePages || loading}
                onClick={() => setPageIndex((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
  }
);
