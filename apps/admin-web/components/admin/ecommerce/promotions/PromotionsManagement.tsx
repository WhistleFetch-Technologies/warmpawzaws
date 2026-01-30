'use client';

import { useState, useEffect } from 'react';
import {
  Tag, Plus, Search, Edit2, Trash2, Calendar, Percent,
  Gift, Zap, Clock, CheckCircle, XCircle, Eye, ToggleLeft, ToggleRight,
  DollarSign, Users, Package
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export function PromotionsManagement() {
  const [promotions, setPromotions] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'promotions' | 'coupons'>('promotions');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [promosData, couponsData] = await Promise.all([
        apiClient.get<any>('/admin/promotions').catch(() => ({ promotions: [] })),
        apiClient.get<any>('/admin/coupons').catch(() => ({ coupons: [] }))
      ]);
      
      setPromotions((promosData as any)?.promotions || []);
      setCoupons((couponsData as any)?.coupons || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePromotion = async (id: string, isActive: boolean) => {
    try {
      await apiClient.put(`/admin/promotions/${id}`, { is_active: !isActive });
      loadData();
    } catch (error) {
      console.error('Error toggling promotion:', error);
    }
  };

  const deletePromotion = async (id: string) => {
    if (!confirm('Are you sure you want to delete this promotion?')) return;
    try {
      await apiClient.delete(`/admin/promotions/${id}`);
      loadData();
    } catch (error) {
      console.error('Error deleting promotion:', error);
    }
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm('Are you sure you want to delete this coupon?')) return;
    try {
      await apiClient.delete(`/admin/coupons/${id}`);
      loadData();
    } catch (error) {
      console.error('Error deleting coupon:', error);
    }
  };

  const filteredPromotions = promotions.filter(p => 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCoupons = coupons.filter(c => 
    c.code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    activePromotions: promotions.filter(p => p.is_active).length,
    totalCoupons: coupons.length,
    totalRedemptions: promotions.reduce((sum, p) => sum + (p.redemption_count || 0), 0),
    totalDiscount: promotions.reduce((sum, p) => sum + (p.total_discount_given || 0), 0)
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Promotions & Coupons</h1>
          <p className="text-slate-500 mt-1">Manage platform-wide discounts and offers</p>
        </div>
        <button
          onClick={() => {
            setEditingItem(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/25 hover:shadow-xl transition-all"
        >
          <Plus className="w-5 h-5" />
          Create {activeTab === 'promotions' ? 'Promotion' : 'Coupon'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-xl">
              <Zap className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Active Promotions</p>
              <p className="text-2xl font-bold text-slate-900">{stats.activePromotions}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Tag className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Coupons</p>
              <p className="text-2xl font-bold text-slate-900">{stats.totalCoupons}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-xl">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Redemptions</p>
              <p className="text-2xl font-bold text-slate-900">{stats.totalRedemptions}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-xl">
              <DollarSign className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Discount Given</p>
              <p className="text-2xl font-bold text-orange-600">₹{stats.totalDiscount.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('promotions')}
          className={`px-6 py-3 rounded-xl font-medium transition-all ${
            activeTab === 'promotions'
              ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Gift className="w-4 h-4 inline mr-2" />
          Promotions
        </button>
        <button
          onClick={() => setActiveTab('coupons')}
          className={`px-6 py-3 rounded-xl font-medium transition-all ${
            activeTab === 'coupons'
              ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Tag className="w-4 h-4 inline mr-2" />
          Coupons
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search promotions or coupons..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-200 border-t-orange-500 mx-auto"></div>
          <p className="mt-4 text-slate-500">Loading...</p>
        </div>
      ) : activeTab === 'promotions' ? (
        // Promotions Grid
        filteredPromotions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
            <Gift className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-600 font-medium">No promotions found</p>
            <p className="text-sm text-slate-400 mt-1">Create your first platform-wide promotion</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPromotions.map(promo => (
              <div key={promo.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-lg transition-all">
                <div className={`p-4 ${promo.is_active ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-slate-400 to-slate-500'} text-white`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Percent className="w-5 h-5" />
                      <span className="text-2xl font-bold">
                        {promo.discount_value}{promo.discount_type === 'percentage' ? '%' : ''}
                      </span>
                      <span className="text-sm opacity-80">OFF</span>
                    </div>
                    <button
                      onClick={() => togglePromotion(promo.id, promo.is_active)}
                      className="p-1 hover:bg-white/20 rounded"
                    >
                      {promo.is_active ? (
                        <ToggleRight className="w-6 h-6" />
                      ) : (
                        <ToggleLeft className="w-6 h-6" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="p-5 space-y-3">
                  <h3 className="font-semibold text-slate-900">{promo.name}</h3>
                  <p className="text-sm text-slate-500">{promo.description}</p>
                  
                  {promo.code && (
                    <div className="flex items-center gap-2 p-2 bg-slate-100 rounded-lg">
                      <Tag className="w-4 h-4 text-slate-500" />
                      <code className="font-mono font-medium text-slate-900">{promo.code}</code>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(promo.start_date).toLocaleDateString()} - {new Date(promo.end_date).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-sm text-slate-500">
                      <Users className="w-4 h-4 inline mr-1" />
                      {promo.redemption_count || 0} used
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingItem(promo);
                          setShowModal(true);
                        }}
                        className="p-2 hover:bg-orange-50 text-slate-600 hover:text-orange-600 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deletePromotion(promo.id)}
                        className="p-2 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        // Coupons Table
        filteredCoupons.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
            <Tag className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-600 font-medium">No coupons found</p>
            <p className="text-sm text-slate-400 mt-1">Create your first coupon code</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left p-4 font-semibold text-slate-600 text-sm">Code</th>
                  <th className="text-left p-4 font-semibold text-slate-600 text-sm">Description</th>
                  <th className="text-center p-4 font-semibold text-slate-600 text-sm">Discount</th>
                  <th className="text-center p-4 font-semibold text-slate-600 text-sm">Usage</th>
                  <th className="text-center p-4 font-semibold text-slate-600 text-sm">Status</th>
                  <th className="text-right p-4 font-semibold text-slate-600 text-sm">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCoupons.map(coupon => (
                  <tr key={coupon.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <code className="px-2 py-1 bg-slate-100 rounded font-mono font-medium text-slate-900">
                        {coupon.code}
                      </code>
                    </td>
                    <td className="p-4 text-slate-600">{coupon.description}</td>
                    <td className="p-4 text-center">
                      <span className="font-bold text-orange-600">
                        {coupon.discount_value}{coupon.discount_type === 'percentage' ? '%' : '₹'}
                      </span>
                    </td>
                    <td className="p-4 text-center text-slate-600">
                      {coupon.used_count || 0} / {coupon.max_uses || '∞'}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        coupon.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {coupon.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => {
                            setEditingItem(coupon);
                            setShowModal(true);
                          }}
                          className="p-2 hover:bg-orange-50 text-slate-600 hover:text-orange-600 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => deleteCoupon(coupon.id)}
                          className="p-2 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <PromotionModal
          item={editingItem}
          type={activeTab}
          onClose={() => {
            setShowModal(false);
            setEditingItem(null);
          }}
          onSave={() => {
            setShowModal(false);
            setEditingItem(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}

function PromotionModal({ item, type, onClose, onSave }: any) {
  const [formData, setFormData] = useState({
    name: item?.name || '',
    description: item?.description || '',
    code: item?.code || '',
    discount_type: item?.discount_type || 'percentage',
    discount_value: item?.discount_value || '',
    min_order_value: item?.min_order_value || '',
    max_discount: item?.max_discount || '',
    start_date: item?.start_date?.split('T')[0] || new Date().toISOString().split('T')[0],
    end_date: item?.end_date?.split('T')[0] || '',
    max_uses: item?.max_uses || '',
    is_active: item?.is_active ?? true
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        ...formData,
        discount_value: parseFloat(formData.discount_value),
        min_order_value: formData.min_order_value ? parseFloat(formData.min_order_value) : null,
        max_discount: formData.max_discount ? parseFloat(formData.max_discount) : null,
        max_uses: formData.max_uses ? parseInt(formData.max_uses) : null
      };

      if (item) {
        await apiClient.put(`/admin/${type}/${item.id}`, payload);
      } else {
        await apiClient.post(`/admin/${type}`, payload);
      }

      onSave();
    } catch (error) {
      console.error('Error saving:', error);
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="border-b border-slate-100 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {item ? 'Edit' : 'Create'} {type === 'promotions' ? 'Promotion' : 'Coupon'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl">
            <XCircle className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Name *</label>
            <input
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Code (Optional)</label>
            <input
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-mono uppercase"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Discount Type</label>
              <select
                value={formData.discount_type}
                onChange={(e) => setFormData({ ...formData, discount_type: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (₹)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Discount Value *</label>
              <input
                type="number"
                required
                value={formData.discount_value}
                onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Start Date *</label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">End Date *</label>
              <input
                type="date"
                required
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-5 h-5 rounded text-orange-500"
            />
            <label htmlFor="is_active" className="font-medium text-slate-700">Active</label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
