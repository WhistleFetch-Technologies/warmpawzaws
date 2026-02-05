'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  Package, Search, Filter, Check, X, AlertCircle, Eye,
  Store, Tag, IndianRupee, Clock, Star, ChevronDown, Image
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  category_name: string;
  price: number;
  original_price?: number;
  stock: number;
  sku: string;
  emoji?: string;
  images: string[];
  vendor_id: string;
  vendor_name: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  is_active: boolean;
  created_at: string;
}

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: 'text-amber-700', bg: 'bg-amber-100', label: 'Pending Review' },
  approved: { color: 'text-emerald-700', bg: 'bg-emerald-100', label: 'Approved' },
  rejected: { color: 'text-red-700', bg: 'bg-red-100', label: 'Rejected' },
};

export default function ProductApproval() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    loadProducts();
  }, [filterStatus, filterCategory]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterCategory) params.append('category', filterCategory);
      params.append('forApproval', 'true');
      
      const result = await apiClient.get<any>(`/admin/products?${params.toString()}`);
      setProducts((result as any)?.products || []);
    } catch (err: any) {
      console.error('Error loading products:', err);
      setError(err.message || 'Failed to load products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const approveProduct = async (productId: string) => {
    try {
      setProcessing(true);
      await apiClient.post<any>(`/admin/products/${productId}/approve`, {});
      await loadProducts();
      if (selectedProduct?.id === productId) {
        setShowDetails(false);
        setSelectedProduct(null);
      }
    } catch (err: any) {
      console.error('Error approving product:', err);
      alert('Failed to approve product: ' + (err.message || 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  };

  const rejectProduct = async (productId: string, reason: string) => {
    if (!reason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }
    try {
      setProcessing(true);
      await apiClient.post<any>(`/admin/products/${productId}/reject`, { reason });
      await loadProducts();
      setRejectionReason('');
      if (selectedProduct?.id === productId) {
        setShowDetails(false);
        setSelectedProduct(null);
      }
    } catch (err: any) {
      console.error('Error rejecting product:', err);
      alert('Failed to reject product: ' + (err.message || 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  };

  const filteredProducts = products.filter(product => 
    product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: products.length,
    pending: products.filter(p => p.status === 'pending').length,
    approved: products.filter(p => p.status === 'approved').length,
    rejected: products.filter(p => p.status === 'rejected').length,
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Product Approval</h1>
        <p className="text-slate-500">Review and approve vendor product listings</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-sm text-slate-500">Total Products</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
              <p className="text-sm text-slate-500">Pending Review</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-lg">
              <Check className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{stats.approved}</p>
              <p className="text-sm text-slate-500">Approved</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <X className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
              <p className="text-sm text-slate-500">Rejected</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search products by name, SKU, vendor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 bg-white"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-3 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20"
        >
          <option value="">All Status</option>
          <option value="pending">Pending Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-500" />
        </div>
      ) : error ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-300" />
          <p className="text-slate-600">{error}</p>
          <button onClick={loadProducts} className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-lg">
            Retry
          </button>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100">
          <Package className="w-16 h-16 mx-auto mb-4 text-slate-200" />
          <p className="text-slate-500">No products found for review</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map(product => {
            const status = statusConfig[product.status] || statusConfig.pending;
            return (
              <div key={product.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
                {/* Image */}
                <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center text-6xl relative">
                  {product.emoji || '📦'}
                  <span className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.color}`}>
                    {status.label}
                  </span>
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Store className="w-3 h-3 text-orange-500" />
                    <span className="text-xs text-orange-600 font-medium">{product.vendor_name}</span>
                  </div>
                  <h3 className="font-semibold text-slate-900 line-clamp-2 h-12">{product.name}</h3>
                  <p className="text-sm text-slate-500 mt-1">{product.category_name || product.category}</p>
                  
                  <div className="flex items-center justify-between mt-3">
                    <div>
                      <span className="text-xl font-bold text-slate-900">₹{product.price}</span>
                      {product.original_price && product.original_price > product.price && (
                        <span className="text-sm text-slate-400 line-through ml-2">₹{product.original_price}</span>
                      )}
                    </div>
                    <span className="text-sm text-slate-500">Stock: {product.stock}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => { setSelectedProduct(product); setShowDetails(true); }}
                      className="flex-1 py-2 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 flex items-center justify-center gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      Review
                    </button>
                    {product.status === 'pending' && (
                      <>
                        <button
                          onClick={() => approveProduct(product.id)}
                          disabled={processing}
                          className="p-2 bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-200"
                          title="Approve"
                        >
                          <Check className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => { setSelectedProduct(product); setShowDetails(true); }}
                          disabled={processing}
                          className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200"
                          title="Reject"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Product Details Modal */}
      {showDetails && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDetails(false)} />
          <div className="relative bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-slate-100 p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Product Review</h2>
              <button onClick={() => setShowDetails(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Image */}
                <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-50 rounded-2xl flex items-center justify-center text-8xl">
                  {selectedProduct.emoji || '📦'}
                </div>

                {/* Details */}
                <div className="space-y-4">
                  <div>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusConfig[selectedProduct.status].bg} ${statusConfig[selectedProduct.status].color}`}>
                      {statusConfig[selectedProduct.status].label}
                    </span>
                  </div>
                  
                  <h3 className="text-2xl font-bold text-slate-900">{selectedProduct.name}</h3>
                  
                  <div className="flex items-center gap-2 text-orange-600">
                    <Store className="w-4 h-4" />
                    <span className="font-medium">{selectedProduct.vendor_name}</span>
                  </div>

                  <p className="text-slate-600">{selectedProduct.description}</p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <p className="text-sm text-slate-500">Price</p>
                      <p className="text-xl font-bold text-slate-900">₹{selectedProduct.price}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <p className="text-sm text-slate-500">Stock</p>
                      <p className="text-xl font-bold text-slate-900">{selectedProduct.stock}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <p className="text-sm text-slate-500">Category</p>
                      <p className="font-medium text-slate-900">{selectedProduct.category_name}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <p className="text-sm text-slate-500">SKU</p>
                      <p className="font-mono font-medium text-slate-900">{selectedProduct.sku}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rejection Reason */}
              {selectedProduct.status === 'rejected' && selectedProduct.rejection_reason && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                  <p className="font-semibold text-red-800 mb-1">Rejection Reason:</p>
                  <p className="text-red-700">{selectedProduct.rejection_reason}</p>
                </div>
              )}

              {/* Actions */}
              {selectedProduct.status === 'pending' && (
                <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Rejection Reason (if rejecting)</label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={3}
                      placeholder="Enter reason for rejection..."
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => approveProduct(selectedProduct.id)}
                      disabled={processing}
                      className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                    >
                      <Check className="w-5 h-5" />
                      Approve Product
                    </button>
                    <button
                      onClick={() => rejectProduct(selectedProduct.id, rejectionReason)}
                      disabled={processing || !rejectionReason.trim()}
                      className="flex-1 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <X className="w-5 h-5" />
                      Reject Product
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
