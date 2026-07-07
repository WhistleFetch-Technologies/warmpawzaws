'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { CheckCircle, Eye, Package, RefreshCcw, XCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { ProductDetailsModal } from '../shared/ProductDetailsModal';

type PendingProduct = {
  id: string;
  name?: string;
  category?: string;
  price?: number;
  sellerName?: string;
  vendor_name?: string;
  vendor_id?: string;
  listing_ownership?: string;
  brand?: string;
};

type VendorGroup = {
  vendorId: string;
  vendorName: string;
  products: PendingProduct[];
};

function groupProductsByVendor(products: PendingProduct[]): VendorGroup[] {
  const map = new Map<string, VendorGroup>();
  for (const product of products) {
    const vendorId = String(product.vendor_id || product.vendor_name || 'unknown').trim();
    const vendorName = String(product.sellerName || product.vendor_name || 'Unknown seller').trim();
    const existing = map.get(vendorId);
    if (existing) {
      existing.products.push(product);
    } else {
      map.set(vendorId, { vendorId, vendorName, products: [product] });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.vendorName.localeCompare(b.vendorName));
}

export function ProductApproval() {
  const [products, setProducts] = useState<PendingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<PendingProduct | null>(null);
  const [approvingVendorId, setApprovingVendorId] = useState<string | null>(null);

  const vendorGroups = useMemo(() => groupProductsByVendor(products), [products]);

  const loadPendingProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/ecommerce/products?status=pending_approval');
      setProducts((data as any).data?.products || (data as any).products || []);
    } catch (error: any) {
      console.error('Error loading products:', error);
      if (error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
        console.warn('⚠️ API returned 401 - showing empty state (UAT mode)');
        setProducts([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPendingProducts();
  }, [loadPendingProducts]);

  const handleApprove = async (productId: string) => {
    if (!productId) {
      toast.error('Missing product id');
      return;
    }
    try {
      await apiClient.put(`/admin/ecommerce/product/${productId}`, { status: 'active' });
      toast.success('Product approved');
      setSelectedProduct(null);
      loadPendingProducts();
    } catch (error) {
      console.error('Approve product failed:', error);
      toast.error('Failed to approve product');
    }
  };

  const handleReject = async (productId: string) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      await apiClient.put(`/admin/ecommerce/product/${productId}`, {
        status: 'rejected',
        rejectionReason: reason,
      });
      toast.success('Product rejected');
      setSelectedProduct(null);
      loadPendingProducts();
    } catch {
      toast.error('Error rejecting product');
    }
  };

  const handleApproveAllForVendor = async (group: VendorGroup) => {
    if (!group.vendorId || group.vendorId === 'unknown') {
      toast.error('Cannot approve all: vendor id missing');
      return;
    }
    const count = group.products.length;
    if (
      !window.confirm(
        `Approve all ${count} pending product${count === 1 ? '' : 's'} for ${group.vendorName}?`,
      )
    ) {
      return;
    }

    setApprovingVendorId(group.vendorId);
    try {
      const res = await apiClient.post<{
        approved?: number;
        skipped?: number;
        message?: string;
      }>(`/admin/ecommerce/vendors/${encodeURIComponent(group.vendorId)}/products/approve-all`);
      const approved = res?.approved ?? 0;
      const skipped = res?.skipped ?? 0;
      if (approved > 0) {
        toast.success(res?.message || `Approved ${approved} product${approved === 1 ? '' : 's'}`);
      } else {
        toast.warning('No products were approved');
      }
      if (skipped > 0) {
        toast.message(`${skipped} product${skipped === 1 ? '' : 's'} skipped (e.g. missing category)`);
      }
      setSelectedProduct(null);
      await loadPendingProducts();
    } catch (error) {
      console.error('Approve all failed:', error);
      toast.error('Failed to approve all products for this vendor');
    } finally {
      setApprovingVendorId(null);
    }
  };

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading products...</p>
          </div>
        </div>
      )}
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-black text-xl font-semibold">Product Approval</h2>
          <p className="text-gray-500 text-sm mt-1">
            Review and approve pending products by seller
          </p>
        </div>

        <div className="flex justify-end">
          <button
            onClick={loadPendingProducts}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {products.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-12 text-center text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No pending products</p>
          </div>
        ) : (
          vendorGroups.map((group) => (
            <div key={group.vendorId} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-gray-50 border-b border-gray-200">
                <div>
                  <h3 className="font-semibold text-black">{group.vendorName}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {group.products.length} pending product{group.products.length === 1 ? '' : 's'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleApproveAllForVendor(group)}
                  disabled={approvingVendorId === group.vendorId}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  {approvingVendorId === group.vendorId ? 'Approving…' : 'Approve all'}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Product
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Ownership
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {group.products.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-black">{product.name}</p>
                            <p className="text-xs text-gray-500">{product.category}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600">₹{product.price || 0}</td>
                        <td className="px-6 py-4 text-gray-600 text-sm">
                          {product.listing_ownership === 'own_brand'
                            ? 'Own brand'
                            : product.listing_ownership === 'third_party'
                              ? 'Third party'
                              : '—'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setSelectedProduct(product)}
                              className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                              title="View product details"
                              aria-label={`View details for ${product.name || 'product'}`}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleApprove(product.id)}
                              className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                              title="Approve product"
                              aria-label={`Approve ${product.name || 'product'}`}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleReject(product.id)}
                              className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                              title="Reject product"
                              aria-label={`Reject ${product.name || 'product'}`}
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  );
}
