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
  const opts = parts.length > 0 ? parts.join(' · ') : 'Variant';
  const code = sku.sku ? ` · ${sku.sku}` : '';
  return `${opts}${code}`;
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
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Products</p>
              <p className="text-2xl font-bold text-slate-900">{total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-xl">
              <ArrowUp className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Healthy Stock</p>
              <p className="text-2xl font-bold text-emerald-600">{pageStats.healthy}</p>
              <p className="text-xs text-slate-400 mt-0.5">On this page</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-xl">
              <TrendingDown className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Low Stock</p>
              <p className="text-2xl font-bold text-amber-600">{lowStockCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Out of Stock</p>
              <p className="text-2xl font-bold text-red-600">{pageStats.outOfStock}</p>
              <p className="text-xs text-slate-400 mt-0.5">On this page</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters + Save/Discard toolbar */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white min-w-[180px]"
        >
          <option value="all">All Products</option>
          <option value="good">Healthy Stock ({'>'}{LOW_STOCK_THRESHOLD})</option>
          <option value="low">Low Stock (1–{LOW_STOCK_THRESHOLD})</option>
          <option value="out">Out of Stock (0)</option>
        </select>

        {/* Save / Discard — visible only when there are unsaved edits */}
        {isDirty && (
          <div className="flex gap-2 items-center">
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

      {/* Inventory Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left p-4 font-semibold text-slate-600 text-sm">Product</th>
              <th className="text-left p-4 font-semibold text-slate-600 text-sm">SKU</th>
              <th className="text-center p-4 font-semibold text-slate-600 text-sm">Current Stock</th>
              <th className="text-center p-4 font-semibold text-slate-600 text-sm">Status</th>
              <th className="text-center p-4 font-semibold text-slate-600 text-sm">
                {anyHasVariants ? 'Variant & stock' : 'Quick Update'}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-12 text-center text-slate-500">
                  No products found
                </td>
              </tr>
            ) : (
              filteredProducts.map((product) => {
                const hasVariants = productHasVariants(product);
                const selectedSkuId = hasVariants
                  ? resolveSelectedSkuId(product, selectedSkuByProduct)
                  : '';
                const selectedSku = hasVariants
                  ? (product.skus || []).find((s: InventorySku) => String(s.id) === selectedSkuId)
                  : null;

                const simpleKey = makePendingKey(product.id, 'simple');
                const variantKey = makePendingKey(product.id, selectedSkuId);

                const displaySimpleStock = effectiveStock(simpleKey, Number(product.stock ?? 0));
                const displayVariantStock = effectiveStock(variantKey, Number(selectedSku?.stock ?? 0));

                const simpleIsPending = simpleKey in pendingChanges;
                const variantIsPending = variantKey in pendingChanges;

                return (
                <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-amber-100 rounded-xl flex items-center justify-center text-xl">
                        {product.emoji || '📦'}
                      </div>
                      <div>
                        <span className="font-medium text-slate-900">{product.name}</span>
                        {hasVariants && (
                          <p className="text-xs text-slate-500 mt-0.5">Total across variants</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 font-mono text-sm text-slate-500">
                    {hasVariants ? (
                      <div>
                        <span className="text-xs text-slate-400 block">Variant SKU</span>
                        <span>{selectedSku?.sku || '—'}</span>
                        {product.sku && (
                          <>
                            <span className="text-xs text-slate-400 block mt-1">Parent</span>
                            <span className="text-slate-400">{product.sku}</span>
                          </>
                        )}
                      </div>
                    ) : (
                      product.sku
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <span className={`text-2xl font-bold ${
                      (product.stock ?? 0) === 0 ? 'text-red-600' :
                      (product.stock ?? 0) <= LOW_STOCK_THRESHOLD ? 'text-amber-600' :
                      'text-emerald-600'
                    }`}>
                      {product.stock}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                      (product.stock ?? 0) === 0 ? 'bg-red-100 text-red-700' :
                      (product.stock ?? 0) <= LOW_STOCK_THRESHOLD ? 'bg-amber-100 text-amber-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {(product.stock ?? 0) === 0 ? '⚠️ Out of Stock' :
                       (product.stock ?? 0) <= LOW_STOCK_THRESHOLD ? '⚡ Low Stock' :
                       '✓ In Stock'}
                    </span>
                  </td>
                  <td className="p-4">
                    {hasVariants && selectedSkuId ? (
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-xs text-slate-500">Variant</span>
                        <select
                          value={selectedSkuId}
                          onChange={(e) =>
                            setSelectedSkuByProduct((prev) => ({
                              ...prev,
                              [product.id]: e.target.value,
                            }))
                          }
                          className="w-full max-w-[220px] px-2 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                        >
                          {(product.skus || []).map((sku: InventorySku) => (
                            <option key={String(sku.id)} value={String(sku.id)}>
                              {formatSkuOptionLabel(sku)}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => stageChange(variantKey, displayVariantStock - 1)}
                            disabled={saving || displayVariantStock === 0}
                            className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <div className="relative">
                            <IntegerInput
                              value={String(displayVariantStock)}
                              onChange={(v) => stageChange(variantKey, parseInt(v, 10) || 0)}
                              className={`w-16 text-center py-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 ${
                                variantIsPending ? 'border-orange-400 bg-orange-50' : 'border-slate-200'
                              }`}
                            />
                          </div>
                          <button
                            onClick={() => stageChange(variantKey, displayVariantStock + 1)}
                            disabled={saving}
                            className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                        </div>
                        {variantIsPending && (
                          <span className="text-xs text-orange-600 font-medium">Unsaved</span>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => stageChange(simpleKey, displaySimpleStock - 1)}
                            disabled={saving || displaySimpleStock === 0}
                            className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <IntegerInput
                            value={String(displaySimpleStock)}
                            onChange={(v) => stageChange(simpleKey, parseInt(v, 10) || 0)}
                            className={`w-16 text-center py-1 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 ${
                              simpleIsPending ? 'border-orange-400 bg-orange-50' : 'border-slate-200'
                            }`}
                          />
                          <button
                            onClick={() => stageChange(simpleKey, displaySimpleStock + 1)}
                            disabled={saving}
                            className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                        </div>
                        {simpleIsPending && (
                          <span className="text-xs text-orange-600 font-medium">Unsaved</span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>

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
