'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClientWithMock as apiClient } from '@/lib/api-client-with-mock';
import { AddProductModal } from '@/components/vendor/products/AddProductModal';
import { EditProductModal } from '@/components/vendor/products/EditProductModal';

// ============================================================================
// TYPES
// ============================================================================

interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  category_id?: string;
  price: number;
  stock: number;
  stock_quantity?: number;
  images: string[];
  hsn_code?: string;
  gst_rate?: number;
  is_active: boolean;
  sku?: string;
  created_at: string;
  updated_at: string;
}

interface Category {
  id: string;
  name: string;
  description?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // UI States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    // Set mock vendorId if not exists (for local testing)
    if (typeof window !== 'undefined' && !localStorage.getItem('vendorId')) {
      localStorage.setItem('vendorId', 'mock-vendor-id');
    }
    const vendorId = localStorage.getItem('vendorId');
    if (!vendorId) {
      router.push('/onboarding');
      return;
    }
    loadData();
  }, [router]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) return;

      // Load products and categories in parallel
      const [productsRes, categoriesRes] = await Promise.all([
        apiClient.get<any>(`/vendor/${vendorId}/products`).catch(() => ({ products: [] })),
        apiClient.get<any>('/ecommerce/categories').catch(() => ({ categories: [] })),
      ]);

      setProducts(productsRes.products || productsRes || []);
      setCategories(categoriesRes.categories || categoriesRes || []);
    } catch (err: any) {
      console.error('Error loading products:', err);
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = () => {
    setShowAddModal(true);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setShowEditModal(true);
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      return;
    }

    try {
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) return;

      await apiClient.delete(`/vendor/${vendorId}/products/${productId}`);
      alert('Product deleted successfully!');
      loadData();
    } catch (err: any) {
      console.error('Error deleting product:', err);
      alert(err.message || 'Failed to delete product');
    }
  };

  const handleToggleStatus = async (product: Product) => {
    try {
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) return;

      await apiClient.put(`/vendor/${vendorId}/products/${product.id}`, {
        is_active: !product.is_active,
      });
      
      loadData();
    } catch (err: any) {
      console.error('Error updating product status:', err);
      alert(err.message || 'Failed to update product status');
    }
  };

  const handleSuccess = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setEditingProduct(null);
    loadData();
  };

  // Filter products
  const filteredProducts = products.filter(product => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!product.name.toLowerCase().includes(search) && 
          !product.description?.toLowerCase().includes(search)) {
        return false;
      }
    }
    
    if (filterCategory && product.category_id !== filterCategory && product.category !== filterCategory) {
      return false;
    }
    
    if (filterStatus === 'active' && !product.is_active) return false;
    if (filterStatus === 'inactive' && product.is_active) return false;
    
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Product Catalog</h1>
            <p className="text-gray-500 mt-1">Manage your product inventory</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              ← Back
            </button>
            <button
              onClick={handleAddProduct}
              className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
            >
              + Add Product
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search products..."
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
              >
                <option value="">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <div className="text-5xl mb-4">🛍️</div>
            <p className="text-gray-500 text-lg mb-4">No products found</p>
            <button
              onClick={handleAddProduct}
              className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
            >
              Add Your First Product
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <div key={product.id} className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition">
                {/* Product Image */}
                <div className="aspect-square bg-gray-100 relative">
                  {product.images && product.images.length > 0 ? (
                    <img
                      src={product.images[0]}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-6xl">
                      🛍️
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      product.is_active 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {product.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                {/* Product Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{product.name}</h3>
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">{product.description}</p>
                  
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-lg font-bold text-orange-500">₹{product.price.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">Stock: {product.stock || product.stock_quantity || 0}</p>
                    </div>
                    {product.hsn_code && (
                      <div className="text-xs text-gray-400">
                        HSN: {product.hsn_code}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditProduct(product)}
                      className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleStatus(product)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                        product.is_active
                          ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      {product.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(product.id)}
                      className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        <div className="mt-6 bg-white rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              Showing {filteredProducts.length} of {products.length} products
            </span>
            <span className="text-gray-600">
              Total Value: ₹{products.reduce((sum, p) => sum + (p.price * (p.stock || 0)), 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddProductModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleSuccess}
        categories={categories}
      />

      <EditProductModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingProduct(null);
        }}
        onSuccess={handleSuccess}
        product={editingProduct}
        categories={categories}
      />
    </div>
  );
}

