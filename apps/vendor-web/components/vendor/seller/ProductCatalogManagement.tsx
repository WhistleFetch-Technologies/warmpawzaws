'use client';

import React, { useState, useEffect, useMemo, useDeferredValue, useRef } from 'react';
import {
  Plus, Search, Filter, Edit2, Trash2, Eye, Package,
  Grid, List, ChevronDown, X, Upload, Tag,
  Check, AlertCircle, Image as ImageIcon, MapPin, RefreshCcw,
  FileSpreadsheet, Archive, FileEdit,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import {
  getVendorDisplayStatus,
  getVendorDisplayStatusLabel,
  isRemovedFromCatalog,
} from '@/lib/vendor-product-display-status';
import { TouchFilePicker } from '@/components/shared/TouchFilePicker';
import { BulkProductUpload } from '@/components/vendor/products/BulkProductUpload';
import { ProductFormModal } from '@/components/vendor/seller/ProductFormModal';
import { formatVendorProductSellingDisplay } from '@/lib/product-ecommerce-pricing';
import { formatPriceWithSymbol } from '@/lib/format-utils';
import { useVendorProductList } from '@/hooks/useVendorProductList';
import type { VendorProductServerStatus } from '@/lib/vendor-product-list-query';
import {
  MAX_BULK_PRODUCT_DELETE,
  getSelectableProductIds,
  isAllSelectableSelected,
  toggleProductSelection,
} from '@/lib/vendor-product-bulk-selection';

const DEFAULT_PRODUCT_EMOJI = '\u{1F4E6}';

const DELETE_CONFIRM_BODY =
  'Products with past orders will be archived (hidden from your shop and customers) but kept for order records.\n' +
  'Products with no orders will be permanently deleted.';

/** Persist stable S3 object URLs; list/detail APIs return presigned URLs for display. */
function stripAwsPresignFromProductImageUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.searchParams.has('X-Amz-Algorithm') || u.searchParams.has('X-Amz-Credential')) {
      u.search = '';
      return u.toString();
    }
  } catch {
    /* ignore */
  }
  return url;
}

interface ProductCatalogManagementProps {
  sellerId: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  original_price?: number;
  stock: number;
  sku: string;
  category_id: string;
  /** Legacy / free-text category (API may filter with category_id OR category) */
  category?: string;
  status: string;
  images?: string[];
  emoji?: string;
  is_active: boolean;
  image_ingest_status?: string | null;
}

function toServerStatus(selectedStatus: string): VendorProductServerStatus | undefined {
  if (selectedStatus === 'active') return 'active';
  if (selectedStatus === 'inactive') return 'inactive';
  return undefined;
}

function usesClientOnlyStatusFilter(selectedStatus: string): boolean {
  return (
    selectedStatus === 'all' ||
    selectedStatus === 'pending' ||
    selectedStatus === 'draft' ||
    selectedStatus === 'rejected' ||
    selectedStatus === 'out_of_stock'
  );
}

function productMatchesStatusFilter(product: Product, selectedStatus: string): boolean {
  const displayStatus = getVendorDisplayStatus(product);
  if (selectedStatus === 'all') {
    // Hide archived/removed products from the default catalog view
    return displayStatus !== 'inactive';
  }
  if (selectedStatus === 'out_of_stock') {
    const stock = Number(product.stock);
    return displayStatus === 'out_of_stock' || (!Number.isNaN(stock) && stock <= 0);
  }
  return displayStatus === selectedStatus;
}

export function ProductCatalogManagement({ sellerId }: ProductCatalogManagementProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const trimmedSearch = searchQuery.trim();
  const deferredSearch = useDeferredValue(trimmedSearch);
  const deferredSearchLower = deferredSearch.toLowerCase();
  const serverStatus = toServerStatus(selectedStatus);

  const {
    products,
    total,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    refresh,
    loadedCount,
  } = useVendorProductList({
    sellerId,
    mode: 'infinite',
    search: deferredSearch,
    category: selectedCategory,
    serverStatus,
    enabled: Boolean(sellerId),
  });

  const topLevelCategories = useMemo(
    () => categories.filter((c) => !c.parent_category_id),
    [categories],
  );

  useEffect(() => {
    loadCategories();
  }, [sellerId]);

  useEffect(() => {
    if (selectedCategory === 'all') return;
    const stillValid = topLevelCategories.some((c) => String(c.id) === selectedCategory);
    if (!stillValid) {
      setSelectedCategory('all');
    }
  }, [selectedCategory, topLevelCategories]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [deferredSearch, selectedCategory, selectedStatus]);

  const loadCategories = async () => {
    try {
      const data = await apiClient.get<{ categories?: any[] }>('/ecommerce/categories');
      setCategories(data?.categories || []);
    } catch (error) {
      console.error('Error loading categories:', error);
      setCategories([]);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setSelectedIds(new Set());
      await Promise.all([refresh(), loadCategories()]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const el = loadMoreSentinelRef.current;
    if (!el || !hasMore || loading || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          loadMore();
        }
      },
      { root: null, rootMargin: '200px', threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, loadMore, loadedCount]);

  const openProductEdit = async (product: Product) => {
    try {
      const data = await apiClient.get<{ product?: Record<string, unknown> }>(
        `/vendor/${sellerId}/products/${product.id}`,
      );
      setEditingProduct((data?.product as Product) || product);
    } catch (error) {
      console.error('Error loading product for edit:', error);
      toast.error('Could not load full product details');
      setEditingProduct(product);
    }
    setShowAddModal(true);
  };

  const handleDeleteProduct = async (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product && isRemovedFromCatalog(product)) {
      toast.info('This product is already removed from your catalog.');
      return;
    }

    const confirmed = window.confirm(
      'Remove this product from your catalog?\n\n' + DELETE_CONFIRM_BODY,
    );
    if (!confirmed) return;

    try {
      const res = await apiClient.delete<{
        message?: string;
        action?: 'deactivated' | 'deleted';
        deactivated?: boolean;
      }>(`/vendor/${sellerId}/products/${productId}`);

      if (res?.action === 'deactivated' || res?.deactivated) {
        toast.success(
          res.message ||
            'Product removed from your catalog. Past orders are preserved in order history.',
          { duration: 6000 },
        );
      } else {
        toast.success(res?.message || 'Product deleted successfully.');
      }
      await refresh();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Failed to remove product. Please try again.');
    }
  };

  const filteredProducts = useMemo(() => {
    return (products as Product[]).filter((product) => {
      if (!productMatchesStatusFilter(product, selectedStatus)) return false;
      if (!deferredSearchLower) return true;
      const sku = product.sku?.toLowerCase() ?? '';
      if (sku.includes(deferredSearchLower)) return true;
      const name = product.name?.toLowerCase() ?? '';
      const desc = product.description?.toLowerCase() ?? '';
      return name.includes(deferredSearchLower) || desc.includes(deferredSearchLower);
    });
  }, [products, deferredSearchLower, selectedStatus]);

  const selectableIds = useMemo(
    () => getSelectableProductIds(filteredProducts, isRemovedFromCatalog),
    [filteredProducts],
  );

  const selectedCount = selectedIds.size;
  const allSelectableSelected = isAllSelectableSelected(selectableIds, selectedIds);
  const someSelectableSelected = selectableIds.some((id) => selectedIds.has(id));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelectableSelected && !allSelectableSelected;
    }
  }, [someSelectableSelected, allSelectableSelected]);

  const toggleProductSelect = (productId: string) => {
    setSelectedIds((prev) => toggleProductSelection(prev, productId));
  };

  const toggleSelectAll = () => {
    if (allSelectableSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(selectableIds));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    if (ids.length > MAX_BULK_PRODUCT_DELETE) {
      toast.error(`Select at most ${MAX_BULK_PRODUCT_DELETE} products at a time.`);
      return;
    }

    const confirmed = window.confirm(
      `Remove ${ids.length} selected product${ids.length === 1 ? '' : 's'} from your catalog?\n\n${DELETE_CONFIRM_BODY}`,
    );
    if (!confirmed) return;

    try {
      setBulkDeleting(true);
      const res = await apiClient.post<{
        message?: string;
        deleted?: number;
        deactivated?: number;
        failed?: number;
      }>(`/vendor/${sellerId}/products/bulk/delete`, { productIds: ids });

      const deleted = res?.deleted ?? 0;
      const deactivated = res?.deactivated ?? 0;
      const failed = res?.failed ?? 0;
      const succeeded = deleted + deactivated;

      if (failed > 0 && succeeded === 0) {
        toast.error(res?.message || 'Failed to remove selected products.');
      } else if (failed > 0) {
        toast.warning(res?.message || `Removed ${succeeded} products. ${failed} failed.`, {
          duration: 6000,
        });
      } else if (deactivated > 0) {
        toast.success(
          res?.message ||
            `Removed ${succeeded} product${succeeded === 1 ? '' : 's'} (${deactivated} archived for order history).`,
          { duration: 6000 },
        );
      } else {
        toast.success(res?.message || `Deleted ${deleted} product${deleted === 1 ? '' : 's'} successfully.`);
      }

      setSelectedIds(new Set());
      await refresh();
    } catch (error) {
      console.error('Error bulk deleting products:', error);
      toast.error('Failed to remove selected products. Please try again.');
    } finally {
      setBulkDeleting(false);
    }
  };

  const clientStatusFilterActive = usesClientOnlyStatusFilter(selectedStatus);
  const catalogFooterLabel = useMemo(() => {
    if (total === 0) return null;
    if (clientStatusFilterActive && filteredProducts.length !== loadedCount) {
      return `Showing ${filteredProducts.length} visible · ${loadedCount} loaded of ${total} products`;
    }
    if (!hasMore && loadedCount >= total) {
      return `All ${total} products loaded`;
    }
    return `Showing ${loadedCount} of ${total} products`;
  }, [total, loadedCount, filteredProducts.length, clientStatusFilterActive, hasMore]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      pending: 'bg-amber-100 text-amber-700 border-amber-200',
      pending_approval: 'bg-amber-100 text-amber-700 border-amber-200',
      draft: 'bg-slate-100 text-slate-700 border-slate-200',
      rejected: 'bg-red-100 text-red-700 border-red-200',
      inactive: 'bg-slate-200 text-slate-600 border-slate-300',
      out_of_stock: 'bg-orange-100 text-orange-700 border-orange-200',
    };

    const label = getVendorDisplayStatusLabel(status);

    const tooltip =
      status === 'draft'
        ? 'This product is in draft because it has 0 stock. Add stock to publish.'
        : undefined;

    return (
      <span
        title={tooltip}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] || 'bg-slate-100 text-slate-700'}`}
      >
        {status === 'active' && <Check className="w-3 h-3" />}
        {(status === 'pending' || status === 'pending_approval') && (
          <AlertCircle className="w-3 h-3" />
        )}
        {status === 'draft' && <FileEdit className="w-3 h-3" />}
        {status === 'inactive' && <Archive className="w-3 h-3" />}
        {label}
      </span>
    );
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-wrap justify-end items-center gap-3">
        <div className="flex flex-wrap items-center justify-end gap-3 mr-1 sm:mr-3">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="flex items-center gap-2 px-5 py-3 border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCcw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingProduct(null);
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30 transition-all"
          >
            <Plus className="w-5 h-5" />
            Add Product
          </button>
        </div>
        <span
          className="hidden sm:block h-9 w-px shrink-0 bg-slate-200 self-center"
          aria-hidden
        />
        <button
          type="button"
          onClick={() => setShowBulkUpload(true)}
          className="flex items-center gap-2 px-5 py-3 border border-orange-500 text-orange-600 rounded-xl font-semibold hover:bg-orange-50 transition-all"
        >
          <FileSpreadsheet className="w-5 h-5" />
          Bulk Upload
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-lg shadow-slate-100/50 space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search products by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 min-w-[180px] bg-white"
          >
            <option value="all">All Categories</option>
            {topLevelCategories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 min-w-[160px] bg-white"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending Approval</option>
            <option value="draft">Draft (0 stock)</option>
            <option value="inactive">Removed</option>
            <option value="rejected">Rejected</option>
            <option value="draft">Draft</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>

          {/* View Toggle */}
          <div className="flex gap-1 bg-slate-100 p-1.5 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow text-orange-600' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <Grid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow text-orange-600' : 'text-slate-500 hover:text-slate-900'}`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>

        {selectableIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-100">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer select-none">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allSelectableSelected}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500/30"
              />
              Select all loaded ({selectableIds.length})
            </label>
            {selectedCount > 0 && (
              <>
                <span className="text-sm text-slate-500">
                  {selectedCount} selected
                </span>
                <button
                  type="button"
                  onClick={clearSelection}
                  disabled={bulkDeleting}
                  className="text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-60"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  {bulkDeleting ? 'Removing…' : 'Delete selected'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Products */}
      {loading && products.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-500 mx-auto"></div>
            <p className="mt-4 text-slate-500">Loading products...</p>
          </div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-lg shadow-slate-100/50">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Package className="w-10 h-10 text-orange-500" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900">No products found</h3>
          <p className="text-slate-500 mt-2 max-w-md mx-auto">
            {total === 0
              ? 'Start building your catalog by adding your first product.'
              : selectedStatus === 'inactive'
                ? 'No removed products. Items with past orders are archived here after you delete them.'
                : 'Try adjusting your filters to find what you\'re looking for.'}
          </p>
          {total === 0 && !loading && (
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-6 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/25 hover:shadow-xl transition-all"
            >
              <Plus className="w-5 h-5 inline mr-2" />
              Add Your First Product
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              categories={categories}
              onEdit={() => openProductEdit(product)}
              onDelete={() => handleDeleteProduct(product.id)}
              getStatusBadge={getStatusBadge}
              selectable={!isRemovedFromCatalog(product)}
              selected={selectedIds.has(product.id)}
              onToggleSelect={() => toggleProductSelect(product.id)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-lg shadow-slate-100/50 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="w-12 p-4" aria-label="Select" />
                <th className="text-left p-4 font-semibold text-slate-600 text-sm">Product</th>
                <th className="text-left p-4 font-semibold text-slate-600 text-sm">SKU</th>
                <th className="text-left p-4 font-semibold text-slate-600 text-sm">Category</th>
                <th className="text-right p-4 font-semibold text-slate-600 text-sm">Price</th>
                <th className="text-center p-4 font-semibold text-slate-600 text-sm">Stock</th>
                <th className="text-center p-4 font-semibold text-slate-600 text-sm">Status</th>
                <th className="text-right p-4 font-semibold text-slate-600 text-sm">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map(product => {
                const removed = isRemovedFromCatalog(product);
                const displayStatus = getVendorDisplayStatus(product);
                return (
                <tr key={product.id} className={`hover:bg-slate-50 transition-colors ${removed ? 'opacity-75' : ''}`}>
                  <td className="p-4">
                    {!removed ? (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(product.id)}
                        onChange={() => toggleProductSelect(product.id)}
                        aria-label={`Select ${product.name}`}
                        className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500/30"
                      />
                    ) : null}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-orange-100 to-amber-100 rounded-xl flex items-center justify-center text-2xl">
                        {product.emoji || DEFAULT_PRODUCT_EMOJI}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{product.name}</p>
                        <p className="text-sm text-slate-500 line-clamp-1">{product.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 font-mono text-sm text-slate-500">{product.sku}</td>
                  <td className="p-4 text-slate-600">
                    {categories.find(c => c.id === product.category_id)?.name || 'Uncategorized'}
                  </td>
                  <td className="p-4 text-right">
                    {(() => {
                      const p = formatVendorProductSellingDisplay(product.price, product.original_price);
                      return (
                        <>
                          <span className="font-bold text-slate-900">{formatPriceWithSymbol(p.selling)}</span>
                          {p.discountPercent > 0 && p.mrp && (
                            <span className="text-sm text-slate-400 line-through ml-2">{formatPriceWithSymbol(p.mrp)}</span>
                          )}
                        </>
                      );
                    })()}
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex items-center justify-center w-10 h-8 rounded-lg font-medium ${
                      product.stock > 10 ? 'bg-emerald-100 text-emerald-700' : 
                      product.stock > 0 ? 'bg-amber-100 text-amber-700' : 
                      'bg-red-100 text-red-700'
                    }`}>
                      {product.stock}
                    </span>
                  </td>
                  <td className="p-4 text-center">{getStatusBadge(displayStatus)}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      {!removed && (
                      <button 
                        onClick={() => openProductEdit(product)}
                        className="p-2 hover:bg-orange-50 text-slate-600 hover:text-orange-600 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      )}
                      {!removed ? (
                      <button 
                        onClick={() => handleDeleteProduct(product.id)}
                        className="p-2 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg transition-colors"
                        title="Remove from catalog"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      ) : (
                        <span className="text-xs text-slate-500 px-2 py-1">Archived</span>
                      )}
                    </div>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      )}

      {filteredProducts.length > 0 && (
        <div className="flex flex-col items-center gap-3 py-4">
          {catalogFooterLabel && (
            <p className="text-sm text-slate-500">{catalogFooterLabel}</p>
          )}
          {loadingMore && (
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-orange-200 border-t-orange-500" />
              Loading more products…
            </div>
          )}
          {hasMore && (
            <button
              type="button"
              onClick={() => loadMore()}
              disabled={loadingMore || loading}
              className="px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 disabled:opacity-60 transition-colors"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
          <div ref={loadMoreSentinelRef} className="h-1 w-full" aria-hidden />
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <ProductFormModal
          product={editingProduct as Record<string, unknown> | null}
          sellerId={sellerId}
          categories={categories}
          onClose={() => {
            setShowAddModal(false);
            setEditingProduct(null);
          }}
          onSave={() => {
            setShowAddModal(false);
            setEditingProduct(null);
            void refresh();
          }}
        />
      )}

      <BulkProductUpload
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        vendorId={sellerId}
        onSuccess={() => {
          setShowBulkUpload(false);
          void refresh();
        }}
      />
    </div>
  );
}

function ProductCard({
  product,
  categories,
  onEdit,
  onDelete,
  getStatusBadge,
  selectable = false,
  selected = false,
  onToggleSelect,
}: {
  product: Product;
  categories: any[];
  onEdit: () => void;
  onDelete: () => void;
  getStatusBadge: (status: string) => React.ReactNode;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const removed = isRemovedFromCatalog(product);
  const displayStatus = getVendorDisplayStatus(product);
  const pricing = formatVendorProductSellingDisplay(product.price, product.original_price);

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden hover:shadow-xl transition-all duration-300 group ${removed ? 'border-slate-200 opacity-75' : 'border-slate-100'} ${selected ? 'ring-2 ring-orange-500/40' : ''}`}>
      <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center text-7xl relative">
        {selectable && onToggleSelect && (
          <div className="absolute top-3 left-3 z-10">
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelect();
              }}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Select ${product.name}`}
              className="h-5 w-5 rounded border-slate-300 bg-white text-orange-600 focus:ring-orange-500/30 shadow-sm"
            />
          </div>
        )}
        {product.images?.[0] ? (
          <img
            src={product.images[0]}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <span>{product.emoji || DEFAULT_PRODUCT_EMOJI}</span>
        )}
        <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
          {product.image_ingest_status === 'processing' && (
            <span className="px-2 py-0.5 rounded-md bg-slate-700 text-white text-[10px] font-bold">
              Photos processing
            </span>
          )}
          {pricing.discountPercent > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-emerald-500 text-white text-[10px] font-bold">
              Save {pricing.discountPercent}%
            </span>
          )}
          {getStatusBadge(displayStatus)}
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
      </div>
      <div className="p-5">
        <h3 className="font-semibold text-slate-900 line-clamp-2 h-12">{product.name}</h3>
        <p className="text-slate-500 text-sm line-clamp-2 mt-2 h-10">{product.description}</p>
        
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
          <div>
            <p className="text-xl font-bold text-slate-900">{formatPriceWithSymbol(pricing.selling)}</p>
            {pricing.discountPercent > 0 && pricing.mrp && (
              <p className="text-sm text-slate-400 line-through">{formatPriceWithSymbol(pricing.mrp)}</p>
            )}
          </div>
          <div className={`text-sm font-medium px-3 py-1 rounded-lg ${
            product.stock > 10 ? 'bg-emerald-50 text-emerald-700' : 
            product.stock > 0 ? 'bg-amber-50 text-amber-700' : 
            'bg-red-50 text-red-700'
          }`}>
            Stock: {product.stock}
          </div>
        </div>
        
        <div className="flex gap-2 mt-4">
          {!removed && (
            <button
              onClick={onEdit}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
            >
              <Edit2 className="w-4 h-4" /> Edit
            </button>
          )}
          {!removed ? (
            <button
              onClick={onDelete}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-red-200 text-red-600 rounded-xl font-medium hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Remove
            </button>
          ) : (
            <p className="flex-1 text-center text-xs text-slate-500 py-2.5 px-2">
              Archived - kept for order history
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
