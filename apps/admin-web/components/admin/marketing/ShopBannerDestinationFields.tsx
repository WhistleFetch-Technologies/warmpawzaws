'use client';

import { useCallback, useEffect, useState } from 'react';
import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import {
  BANNER_SELECT_EMPTY,
  formatShopProductOptionLabel,
  type ShopBannerDestinationProduct,
  type ShopBannerTargetLevel,
} from '@/lib/banner-admin';

export type ShopBannerDestinationFieldsProps = {
  targetMode: ShopBannerTargetLevel;
  onTargetModeChange: (mode: ShopBannerTargetLevel) => void;
  productId: string;
  onProductIdChange: (id: string) => void;
  onProductSelect?: (product: ShopBannerDestinationProduct | null) => void;
  /** Prefill label when editing and product not yet in search results */
  selectedProductLabel?: string;
};

export function ShopBannerDestinationFields({
  targetMode,
  onTargetModeChange,
  productId,
  onProductIdChange,
  onProductSelect,
  selectedProductLabel,
}: ShopBannerDestinationFieldsProps) {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<ShopBannerDestinationProduct[]>([]);
  const [loading, setLoading] = useState(false);

  const loadProducts = useCallback(async (term: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (term.trim()) params.set('search', term.trim());
      params.set('limit', '50');
      const query = params.toString();
      const data = await apiClient.get<{ products?: ShopBannerDestinationProduct[] }>(
        `/admin/banners/shop-destination-options${query ? `?${query}` : ''}`
      );
      setProducts(Array.isArray(data?.products) ? data.products : []);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts('');
  }, [loadProducts]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProducts(search);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, loadProducts]);

  const productOptions = [...products];
  if (productId && !productOptions.some((p) => p.id === productId) && selectedProductLabel) {
    productOptions.unshift({
      id: productId,
      name: selectedProductLabel,
      sku: '',
      price: 0,
      status: 'active',
      category: '',
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-gray-900">Banner action</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Informational banners show CTA text only. Product banners open the selected item on the shop page.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Banner action</Label>
        <Select
          value={targetMode}
          onValueChange={(v: string) => onTargetModeChange(v as ShopBannerTargetLevel)}
        >
          <SelectTrigger className="w-full h-10 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" className="z-[200]">
            <SelectItem value="informational">Informational only</SelectItem>
            <SelectItem value="product">Redirect to product</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {targetMode === 'product' ? (
        <div className="space-y-2">
          <Label>Product</Label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or SKU"
            className="mb-2"
          />
          <Select
            value={productId || BANNER_SELECT_EMPTY}
            onValueChange={(v: string) => {
              if (v === BANNER_SELECT_EMPTY) {
                onProductIdChange('');
                onProductSelect?.(null);
                return;
              }
              onProductIdChange(v);
              const picked = productOptions.find((p) => p.id === v) ?? null;
              onProductSelect?.(picked);
            }}
          >
            <SelectTrigger className="w-full h-10 bg-white min-w-0 [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate">
              <SelectValue placeholder={loading ? 'Loading products…' : 'Select product'} />
            </SelectTrigger>
            <SelectContent position="popper" className="z-[200] max-h-60">
              <SelectItem value={BANNER_SELECT_EMPTY}>Select product</SelectItem>
              {productOptions.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {formatShopProductOptionLabel(product)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <p className="text-sm text-gray-600">
          Checkout-style display — the CTA label is shown but does not navigate anywhere.
        </p>
      )}
    </div>
  );
}
