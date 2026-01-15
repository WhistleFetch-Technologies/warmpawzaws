'use client';

import { useState, useEffect } from 'react';
import { Package, AlertTriangle, TrendingDown, ArrowUp, ArrowDown, Search, Filter, RefreshCcw } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface InventoryManagementProps {
  sellerId: string;
}

export function InventoryManagement({ sellerId }: InventoryManagementProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    loadInventory();
  }, [sellerId]);

  const loadInventory = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<{ products?: any[] }>(`/vendor/${sellerId}/products`);
      setProducts(data?.products || []);
    } catch (error) {
      console.error('Error loading inventory:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const updateStock = async (productId: string, newStock: number) => {
    setUpdating(productId);
    try {
      await apiClient.put(`/vendor/${sellerId}/products/${productId}`, { stock: newStock });
      setProducts(products.map(p => p.id === productId ? { ...p, stock: newStock } : p));
    } catch (error) {
      console.error('Error updating stock:', error);
      alert('Failed to update stock');
    } finally {
      setUpdating(null);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = 
      filter === 'all' ? true :
      filter === 'low' ? product.stock <= 10 && product.stock > 0 :
      filter === 'out' ? product.stock === 0 :
      filter === 'good' ? product.stock > 10 : true;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: products.length,
    lowStock: products.filter(p => p.stock <= 10 && p.stock > 0).length,
    outOfStock: products.filter(p => p.stock === 0).length,
    healthy: products.filter(p => p.stock > 10).length
  };

  if (loading) {
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
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory Management</h1>
          <p className="text-slate-500 mt-1">Track and update your stock levels</p>
        </div>
        <button
          onClick={loadInventory}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
        >
          <RefreshCcw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Products</p>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
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
              <p className="text-2xl font-bold text-emerald-600">{stats.healthy}</p>
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
              <p className="text-2xl font-bold text-amber-600">{stats.lowStock}</p>
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
              <p className="text-2xl font-bold text-red-600">{stats.outOfStock}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
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
          <option value="good">Healthy Stock ({'>'}10)</option>
          <option value="low">Low Stock (1-10)</option>
          <option value="out">Out of Stock (0)</option>
        </select>
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
              <th className="text-center p-4 font-semibold text-slate-600 text-sm">Quick Update</th>
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
              filteredProducts.map(product => (
                <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-amber-100 rounded-xl flex items-center justify-center text-xl">
                        {product.emoji || '📦'}
                      </div>
                      <span className="font-medium text-slate-900">{product.name}</span>
                    </div>
                  </td>
                  <td className="p-4 font-mono text-sm text-slate-500">{product.sku}</td>
                  <td className="p-4 text-center">
                    <span className={`text-2xl font-bold ${
                      product.stock === 0 ? 'text-red-600' :
                      product.stock <= 10 ? 'text-amber-600' :
                      'text-emerald-600'
                    }`}>
                      {product.stock}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                      product.stock === 0 ? 'bg-red-100 text-red-700' :
                      product.stock <= 10 ? 'bg-amber-100 text-amber-700' :
                      'bg-emerald-100 text-emerald-700'
                    }`}>
                      {product.stock === 0 ? '⚠️ Out of Stock' :
                       product.stock <= 10 ? '⚡ Low Stock' :
                       '✓ In Stock'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => updateStock(product.id, Math.max(0, product.stock - 1))}
                        disabled={updating === product.id || product.stock === 0}
                        className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={product.stock}
                        onChange={(e) => updateStock(product.id, parseInt(e.target.value) || 0)}
                        className="w-16 text-center py-1 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      />
                      <button
                        onClick={() => updateStock(product.id, product.stock + 1)}
                        disabled={updating === product.id}
                        className="w-8 h-8 flex items-center justify-center border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                      >
                        <ArrowUp className="w-4 h-4" />
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
  );
}
