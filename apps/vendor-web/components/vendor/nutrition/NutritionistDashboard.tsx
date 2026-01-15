'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

// 2D Sketch-style SVG Icons
const Icons = {
  utensils: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2M7 2v20M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
    </svg>
  ),
  package: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  edit: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  ),
  truck: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  user: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a4 4 0 014-4h8a4 4 0 014 4v2" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
    </svg>
  ),
  mapPin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M12 21s-8-7.5-8-12a8 8 0 1116 0c0 4.5-8 12-8 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  ),
  dollarSign: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" />
    </svg>
  ),
  refresh: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  ),
  leaf: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M11 20A7 7 0 019.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  ),
  clipboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  ),
  fire: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />
    </svg>
  ),
};

interface MealProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  metadata?: any;
  is_active?: boolean;
}

interface MealOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  total_amount: number;
  created_at: string;
  items: any[];
  delivery_address?: any;
}

interface NutritionistDashboardProps {
  vendorId: string;
  vendorName?: string;
}

export default function NutritionistDashboard({ vendorId, vendorName }: NutritionistDashboardProps) {
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'analytics'>('products');
  const [products, setProducts] = useState<MealProduct[]>([]);
  const [orders, setOrders] = useState<MealOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MealProduct | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    ingredients: '',
    calories: '',
    protein: '',
    dietType: 'Non-Veg',
    suitableFor: [] as string[],
    petTypes: ['Dog'] as string[],
    preparationTime: '60',
  });

  const fetchProducts = useCallback(async () => {
    try {
      const response = await apiClient.get(`/vendor/${vendorId}/meal-products`);
      if (response && (response as any).success) {
        setProducts((response as any).products || []);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  }, [vendorId]);

  const fetchOrders = useCallback(async () => {
    try {
      const response = await apiClient.get(`/vendor/${vendorId}/meal-orders`);
      if (response && (response as any).success) {
        setOrders((response as any).orders || []);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  }, [vendorId]);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchProducts(), fetchOrders()]);
      setLoading(false);
    };
    loadAll();
  }, [fetchProducts, fetchOrders]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchProducts(), fetchOrders()]);
    setRefreshing(false);
  };

  const handleSaveProduct = async () => {
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        price: parseFloat(formData.price),
        ingredients: formData.ingredients.split(',').map(i => i.trim()),
        nutritionalValue: {
          calories: formData.calories,
          protein: formData.protein,
        },
        dietType: formData.dietType,
        suitableFor: formData.suitableFor,
        petTypes: formData.petTypes,
        preparationLeadTime: parseInt(formData.preparationTime),
      };

      if (editingProduct) {
        await apiClient.put(`/vendor/${vendorId}/meal-products/${editingProduct.id}`, payload);
      } else {
        await apiClient.post(`/vendor/${vendorId}/meal-products`, payload);
      }

      setShowAddProduct(false);
      setEditingProduct(null);
      resetForm();
      await fetchProducts();
    } catch (error) {
      console.error('Error saving product:', error);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await apiClient.delete(`/vendor/${vendorId}/meal-products/${productId}`);
      await fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      await apiClient.put(`/vendor/${vendorId}/meal-orders/${orderId}/status`, { status });
      await fetchOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      ingredients: '',
      calories: '',
      protein: '',
      dietType: 'Non-Veg',
      suitableFor: [],
      petTypes: ['Dog'],
      preparationTime: '60',
    });
  };

  const openEditModal = (product: MealProduct) => {
    const metadata = product.metadata ? (typeof product.metadata === 'string' ? JSON.parse(product.metadata) : product.metadata) : {};
    setFormData({
      name: product.name || '',
      description: product.description || '',
      price: product.price?.toString() || '',
      ingredients: (metadata.ingredients || []).join(', '),
      calories: metadata.nutritionalValue?.calories || '',
      protein: metadata.nutritionalValue?.protein || '',
      dietType: metadata.dietType || 'Non-Veg',
      suitableFor: metadata.suitableFor || [],
      petTypes: metadata.petTypes || ['Dog'],
      preparationTime: metadata.preparationLeadTime?.toString() || '60',
    });
    setEditingProduct(product);
    setShowAddProduct(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'confirmed': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'preparing': return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'ready': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'dispatched': return 'bg-violet-50 text-violet-700 border-violet-200';
      case 'delivered': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'cancelled': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Loading your kitchen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center text-white">
                {Icons.leaf}
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-800">{vendorName || 'Nutritionist Kitchen'}</h1>
                <p className="text-sm text-slate-500">Fresh Pet Meals</p>
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
            >
              <span className={refreshing ? 'animate-spin' : ''}>{Icons.refresh}</span>
              <span className="text-sm font-medium">Refresh</span>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            {[
              { id: 'products', label: 'Meal Products', icon: Icons.utensils, count: products.length },
              { id: 'orders', label: 'Orders', icon: Icons.package, count: orders.filter(o => o.status !== 'delivered').length },
              { id: 'analytics', label: 'Insights', icon: Icons.fire, count: 0 },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                    activeTab === tab.id ? 'bg-white/20' : 'bg-slate-200'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Products Tab */}
        {activeTab === 'products' && (
          <div className="space-y-4">
            {/* Add Product Button */}
            <button
              onClick={() => { resetForm(); setShowAddProduct(true); }}
              className="w-full py-4 border-2 border-dashed border-emerald-300 rounded-2xl text-emerald-600 font-medium hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2"
            >
              {Icons.plus}
              <span>Add New Meal Product</span>
            </button>

            {products.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                  {Icons.utensils}
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">No Meal Products Yet</h3>
                <p className="text-slate-500">Start adding your delicious pet meal recipes!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((product) => {
                  const metadata = product.metadata ? (typeof product.metadata === 'string' ? JSON.parse(product.metadata) : product.metadata) : {};
                  return (
                    <div key={product.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
                      <div className="h-32 bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center">
                        <div className="w-16 h-16 bg-white/80 rounded-xl flex items-center justify-center text-emerald-600">
                          {Icons.utensils}
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-slate-800">{product.name}</h3>
                          <span className="text-lg font-bold text-emerald-600">₹{product.price}</span>
                        </div>
                        <p className="text-sm text-slate-500 mb-3 line-clamp-2">{product.description}</p>
                        
                        <div className="flex flex-wrap gap-1 mb-3">
                          {metadata.dietType && (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs">
                              {metadata.dietType}
                            </span>
                          )}
                          {(metadata.petTypes || []).map((pt: string) => (
                            <span key={pt} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                              {pt}
                            </span>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditModal(product)}
                            className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors flex items-center justify-center gap-1"
                          >
                            {Icons.edit}
                            <span className="text-sm">Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product.id)}
                            className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                          >
                            {Icons.trash}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                  {Icons.package}
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">No Orders Yet</h3>
                <p className="text-slate-500">Orders will appear here when customers place them</p>
              </div>
            ) : (
              orders.map((order) => (
                <div key={order.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="p-4 border-b border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                          {Icons.package}
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-800">{order.order_number || `Order #${order.id.slice(0, 8)}`}</h3>
                          <p className="text-sm text-slate-500 flex items-center gap-1">
                            {Icons.user}
                            {order.customer_name || 'Customer'}
                          </p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1">{Icons.phone} {order.customer_phone || 'N/A'}</span>
                        <span className="flex items-center gap-1">{Icons.clock} {new Date(order.created_at).toLocaleDateString()}</span>
                      </div>
                      <span className="text-lg font-semibold text-slate-800">₹{order.total_amount || 0}</span>
                    </div>

                    {/* Order Actions */}
                    <div className="flex gap-2">
                      {order.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleUpdateOrderStatus(order.id, 'confirmed')}
                            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1"
                          >
                            {Icons.check}
                            <span className="text-sm">Accept</span>
                          </button>
                          <button
                            onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')}
                            className="py-2 px-4 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                          >
                            {Icons.x}
                          </button>
                        </>
                      )}
                      {order.status === 'confirmed' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'preparing')}
                          className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1"
                        >
                          {Icons.utensils}
                          <span className="text-sm">Start Preparing</span>
                        </button>
                      )}
                      {order.status === 'preparing' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'ready')}
                          className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1"
                        >
                          {Icons.package}
                          <span className="text-sm">Ready for Pickup</span>
                        </button>
                      )}
                      {order.status === 'ready' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'dispatched')}
                          className="flex-1 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1"
                        >
                          {Icons.truck}
                          <span className="text-sm">Dispatch</span>
                        </button>
                      )}
                      {order.status === 'dispatched' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'delivered')}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center justify-center gap-1"
                        >
                          {Icons.check}
                          <span className="text-sm">Mark Delivered</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                  {Icons.package}
                </div>
                <span className="text-slate-600">Total Orders</span>
              </div>
              <p className="text-3xl font-bold text-slate-800">{orders.length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                  {Icons.utensils}
                </div>
                <span className="text-slate-600">Menu Items</span>
              </div>
              <p className="text-3xl font-bold text-slate-800">{products.length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                  {Icons.dollarSign}
                </div>
                <span className="text-slate-600">Revenue</span>
              </div>
              <p className="text-3xl font-bold text-slate-800">
                ₹{orders.reduce((sum, o) => sum + (o.total_amount || 0), 0)}
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Add/Edit Product Modal */}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="p-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                {Icons.utensils}
                {editingProduct ? 'Edit Meal Product' : 'Add New Meal Product'}
              </h2>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Meal Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g., Chicken & Rice Bowl"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  rows={2}
                  placeholder="Describe your meal..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="299"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Prep Time (min)</label>
                  <input
                    type="number"
                    value={formData.preparationTime}
                    onChange={(e) => setFormData({ ...formData, preparationTime: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ingredients (comma separated)</label>
                <input
                  type="text"
                  value={formData.ingredients}
                  onChange={(e) => setFormData({ ...formData, ingredients: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Chicken, Rice, Carrots, Peas"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Calories</label>
                  <input
                    type="text"
                    value={formData.calories}
                    onChange={(e) => setFormData({ ...formData, calories: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="350 kcal"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Protein</label>
                  <input
                    type="text"
                    value={formData.protein}
                    onChange={(e) => setFormData({ ...formData, protein: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="25g"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Diet Type</label>
                <div className="flex gap-2">
                  {['Non-Veg', 'Veg', 'Egg'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormData({ ...formData, dietType: type })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        formData.dietType === type
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pet Types</label>
                <div className="flex gap-2">
                  {['Dog', 'Cat'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        const current = formData.petTypes;
                        if (current.includes(type)) {
                          setFormData({ ...formData, petTypes: current.filter(t => t !== type) });
                        } else {
                          setFormData({ ...formData, petTypes: [...current, type] });
                        }
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        formData.petTypes.includes(type)
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => { setShowAddProduct(false); setEditingProduct(null); resetForm(); }}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProduct}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
              >
                {editingProduct ? 'Update' : 'Create'} Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
