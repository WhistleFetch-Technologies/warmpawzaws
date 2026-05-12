'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, Eye, Package, RefreshCcw, XCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { ProductDetailsModal } from '../shared/ProductDetailsModal';

export function ProductApproval() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  const loadPendingProducts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/ecommerce/products?status=pending_approval');
      setProducts((data as any).data?.products || (data as any).products || []);
    } catch (error: any) {
      console.error('Error loading products:', error);
      // In UAT mode, show empty state instead of error
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
    } catch (error) {
      toast.error('Error rejecting product');
    }
  };

  return (
    <div className="relative">
      {/* Loading overlay - only show when actively loading */}
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
          Review and approve pending products
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

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Seller
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Price
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No pending products</p>
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-black">{product.name}</p>
                        <p className="text-xs text-gray-500">{product.category}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {product.sellerName || product.vendor_name || '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-600">₹{product.price || 0}</td>
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
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

