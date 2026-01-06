'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { AdminLayout } from '@/components/AdminLayout';

// ============================================================================
// TYPES
// ============================================================================

interface Promotion {
  id: string;
  code: string;
  name: string;
  description: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_value: number;
  max_discount?: number;
  valid_from: string;
  valid_until: string;
  usage_limit?: number;
  usage_limit_per_user?: number;
  used_count: number;
  applicable_to: 'all' | 'services' | 'products' | 'bookings';
  applicable_service_ids?: string[];
  applicable_category_ids?: string[];
  is_active: boolean;
  created_at: string;
}

interface Coupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_value: number;
  max_discount?: number;
  valid_from: string;
  valid_until: string;
  usage_limit?: number;
  used_count: number;
  is_active: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Modal states
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Filters
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Form states
  const [promotionForm, setPromotionForm] = useState({
    code: '',
    name: '',
    description: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: 0,
    min_order_value: 0,
    max_discount: undefined as number | undefined,
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    usage_limit: undefined as number | undefined,
    usage_limit_per_user: undefined as number | undefined,
    applicable_to: 'all' as 'all' | 'services' | 'products' | 'bookings',
    is_active: true,
  });

  const [couponForm, setCouponForm] = useState({
    code: '',
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: 0,
    min_order_value: 0,
    max_discount: undefined as number | undefined,
    valid_from: new Date().toISOString().split('T')[0],
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    usage_limit: undefined as number | undefined,
    is_active: true,
  });

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadData();
  }, [filterType, filterStatus]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (filterType) params.append('type', filterType);
      if (filterStatus) params.append('status', filterStatus);
      
      const [promotionsRes, couponsRes] = await Promise.all([
        apiClient.get<any>(`/admin/promotions?${params.toString()}`),
        apiClient.get<any>(`/admin/coupons?${params.toString()}`),
      ]);
      
      setPromotions(promotionsRes.promotions || promotionsRes || []);
      setCoupons(couponsRes.coupons || couponsRes || []);
    } catch (err: any) {
      console.error('Error loading promotions:', err);
      setError(err.message || 'Failed to load promotions');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleCreatePromotion = () => {
    setEditingPromotion(null);
    setPromotionForm({
      code: '',
      name: '',
      description: '',
      discount_type: 'percentage',
      discount_value: 0,
      min_order_value: 0,
      max_discount: undefined,
      valid_from: new Date().toISOString().split('T')[0],
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      usage_limit: undefined,
      usage_limit_per_user: undefined,
      applicable_to: 'all',
      is_active: true,
    });
    setShowPromotionModal(true);
  };

  const handleEditPromotion = (promo: Promotion) => {
    setEditingPromotion(promo);
    setPromotionForm({
      code: promo.code,
      name: promo.name,
      description: promo.description,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      min_order_value: promo.min_order_value,
      max_discount: promo.max_discount,
      valid_from: promo.valid_from.split('T')[0],
      valid_until: promo.valid_until.split('T')[0],
      usage_limit: promo.usage_limit,
      usage_limit_per_user: promo.usage_limit_per_user,
      applicable_to: promo.applicable_to,
      is_active: promo.is_active,
    });
    setShowPromotionModal(true);
  };

  const handleSavePromotion = async () => {
    if (!promotionForm.code || !promotionForm.name) {
      setError('Please fill all required fields');
      return;
    }
    
    try {
      setSaving(true);
      setError(null);
      
      if (editingPromotion) {
        await apiClient.put(`/admin/promotions/${editingPromotion.id}`, promotionForm);
        setSuccess('Promotion updated successfully');
      } else {
        await apiClient.post('/admin/promotions', promotionForm);
        setSuccess('Promotion created successfully');
      }
      
      setShowPromotionModal(false);
      setEditingPromotion(null);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save promotion');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePromotion = async (promoId: string) => {
    if (!confirm('Are you sure you want to delete this promotion?')) return;
    
    try {
      await apiClient.delete(`/admin/promotions/${promoId}`);
      setSuccess('Promotion deleted');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete promotion');
    }
  };

  const handleTogglePromotionStatus = async (promoId: string, currentStatus: boolean) => {
    try {
      await apiClient.put(`/admin/promotions/${promoId}`, { is_active: !currentStatus });
      setSuccess(`Promotion ${!currentStatus ? 'activated' : 'deactivated'}`);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update promotion status');
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <AdminLayout>
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading promotions...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Promotions & Coupons</h1>
              <p className="text-gray-500">Manage discounts and promotional offers</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleCreatePromotion}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
              >
                + Create Promotion
              </button>
            </div>
          </div>
        </header>

        <main className="p-8">
          {/* Messages */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
            </div>
          )}
          
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center justify-between">
              <span>{success}</span>
              <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-600">✕</button>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-2xl shadow-sm p-4 mb-6">
            <div className="flex flex-wrap gap-4 items-center">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
              >
                <option value="">All Types</option>
                <option value="percentage">Percentage Discount</option>
                <option value="fixed">Fixed Discount</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="expired">Expired</option>
              </select>
              <button
                onClick={loadData}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
              >
                🔄 Refresh
              </button>
            </div>
          </div>

          {/* Promotions Table */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Promotions</h2>
            </div>
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Discount</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Valid Until</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Usage</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {promotions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <div className="text-4xl mb-2">🎁</div>
                      <p>No promotions found</p>
                    </td>
                  </tr>
                ) : (
                  promotions.map(promo => (
                    <tr key={promo.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="font-mono font-medium text-orange-600">{promo.code}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900">{promo.name}</p>
                          <p className="text-sm text-gray-500">{promo.description}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium">
                          {promo.discount_type === 'percentage' 
                            ? `${promo.discount_value}%` 
                            : `₹${promo.discount_value}`}
                        </span>
                        {promo.max_discount && (
                          <p className="text-xs text-gray-400">(max ₹{promo.max_discount})</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(promo.valid_until).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {promo.used_count}{promo.usage_limit ? `/${promo.usage_limit}` : ''}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleTogglePromotionStatus(promo.id, promo.is_active)}
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            promo.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {promo.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditPromotion(promo)}
                            className="text-orange-500 hover:text-orange-600 text-sm font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeletePromotion(promo.id)}
                            className="text-red-500 hover:text-red-600 text-sm font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {/* Promotion Modal */}
      {showPromotionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingPromotion ? 'Edit Promotion' : 'Create Promotion'}
                </h3>
                <button onClick={() => setShowPromotionModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Promo Code *</label>
                  <input
                    type="text"
                    value={promotionForm.code}
                    onChange={(e) => setPromotionForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none font-mono"
                    placeholder="WELCOME20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={promotionForm.name}
                    onChange={(e) => setPromotionForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                    placeholder="Welcome Offer"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={promotionForm.description}
                  onChange={(e) => setPromotionForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none resize-none"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type *</label>
                  <select
                    value={promotionForm.discount_type}
                    onChange={(e) => setPromotionForm(prev => ({ ...prev, discount_type: e.target.value as any }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount Value *</label>
                  <input
                    type="number"
                    value={promotionForm.discount_value}
                    onChange={(e) => setPromotionForm(prev => ({ ...prev, discount_value: Number(e.target.value) }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Order Value</label>
                  <input
                    type="number"
                    value={promotionForm.min_order_value}
                    onChange={(e) => setPromotionForm(prev => ({ ...prev, min_order_value: Number(e.target.value) }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                    min="0"
                  />
                </div>
              </div>
              
              {promotionForm.discount_type === 'percentage' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Discount (₹)</label>
                  <input
                    type="number"
                    value={promotionForm.max_discount || ''}
                    onChange={(e) => setPromotionForm(prev => ({ ...prev, max_discount: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                    min="0"
                  />
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid From *</label>
                  <input
                    type="date"
                    value={promotionForm.valid_from}
                    onChange={(e) => setPromotionForm(prev => ({ ...prev, valid_from: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until *</label>
                  <input
                    type="date"
                    value={promotionForm.valid_until}
                    onChange={(e) => setPromotionForm(prev => ({ ...prev, valid_until: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Usage Limit (optional)</label>
                  <input
                    type="number"
                    value={promotionForm.usage_limit || ''}
                    onChange={(e) => setPromotionForm(prev => ({ ...prev, usage_limit: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                    min="1"
                    placeholder="Unlimited"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Per User Limit (optional)</label>
                  <input
                    type="number"
                    value={promotionForm.usage_limit_per_user || ''}
                    onChange={(e) => setPromotionForm(prev => ({ ...prev, usage_limit_per_user: e.target.value ? Number(e.target.value) : undefined }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                    min="1"
                    placeholder="Unlimited"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Applicable To</label>
                <select
                  value={promotionForm.applicable_to}
                  onChange={(e) => setPromotionForm(prev => ({ ...prev, applicable_to: e.target.value as any }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                >
                  <option value="all">All Services & Products</option>
                  <option value="services">Services Only</option>
                  <option value="products">Products Only</option>
                  <option value="bookings">Bookings Only</option>
                </select>
              </div>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={promotionForm.is_active}
                  onChange={(e) => setPromotionForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded text-orange-500"
                />
                <span className="text-sm text-gray-700">Promotion is active</span>
              </label>
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => setShowPromotionModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePromotion}
                disabled={saving}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingPromotion ? 'Update Promotion' : 'Create Promotion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

