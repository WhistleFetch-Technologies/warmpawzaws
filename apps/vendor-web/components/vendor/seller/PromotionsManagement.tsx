'use client';

import { useState, useEffect } from 'react';
import { 
  Tag, Plus, Edit2, Trash2, Calendar, Percent, 
  Gift, Zap, Clock, CheckCircle, XCircle, Search
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface PromotionsManagementProps {
  sellerId: string;
}

export function PromotionsManagement({ sellerId }: PromotionsManagementProps) {
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState<any>(null);

  useEffect(() => {
    loadPromotions();
  }, [sellerId]);

  const loadPromotions = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<{ promotions?: any[] }>(`/vendor/${sellerId}/promotions`);
      setPromotions(data?.promotions || []);
    } catch (error) {
      console.error('Error loading promotions:', error);
      setPromotions([]);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: promotions.length,
    active: promotions.filter(p => p.is_active).length,
    expired: promotions.filter(p => new Date(p.end_date) < new Date()).length,
    upcoming: promotions.filter(p => new Date(p.start_date) > new Date()).length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-500 mx-auto"></div>
          <p className="mt-4 text-slate-500">Loading promotions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Promotions & Offers</h1>
          <p className="text-slate-500 mt-1">Create and manage discounts to boost sales</p>
        </div>
        <button
          onClick={() => {
            setEditingPromo(null);
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/25 hover:shadow-xl transition-all"
        >
          <Plus className="w-5 h-5" />
          Create Promotion
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Tag className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Promotions</p>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-xl">
              <Zap className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Active</p>
              <p className="text-2xl font-bold text-emerald-600">{stats.active}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 rounded-xl">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Upcoming</p>
              <p className="text-2xl font-bold text-amber-600">{stats.upcoming}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-100 rounded-xl">
              <XCircle className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Expired</p>
              <p className="text-2xl font-bold text-slate-600">{stats.expired}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Promotions Grid */}
      {promotions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Gift className="w-10 h-10 text-orange-500" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900">No promotions yet</h3>
          <p className="text-slate-500 mt-2 max-w-md mx-auto">
            Create your first promotion to attract more customers and boost sales
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-6 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/25 hover:shadow-xl transition-all"
          >
            <Plus className="w-5 h-5 inline mr-2" />
            Create Your First Promotion
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {promotions.map(promo => (
            <div key={promo.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-lg transition-all">
              <div className={`p-4 ${promo.is_active ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-slate-400 to-slate-500'} text-white`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Percent className="w-5 h-5" />
                    <span className="text-2xl font-bold">{promo.discount_value}{promo.discount_type === 'percentage' ? '%' : ''}</span>
                    <span className="text-sm opacity-80">OFF</span>
                  </div>
                  {promo.is_active ? (
                    <span className="px-2 py-1 bg-white/20 rounded-full text-xs font-medium">Active</span>
                  ) : (
                    <span className="px-2 py-1 bg-white/20 rounded-full text-xs font-medium">Inactive</span>
                  )}
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
                
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      setEditingPromo(promo);
                      setShowAddModal(true);
                    }}
                    className="flex-1 py-2 border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" /> Edit
                  </button>
                  <button className="flex-1 py-2 border border-red-200 text-red-600 rounded-lg font-medium hover:bg-red-50 transition-colors flex items-center justify-center gap-2">
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tips */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl p-6 border border-purple-100">
        <h3 className="font-semibold text-purple-900 mb-3">💡 Promotion Tips</h3>
        <ul className="space-y-2 text-sm text-purple-700">
          <li>• Use time-limited offers to create urgency</li>
          <li>• Offer percentage discounts for higher-priced items</li>
          <li>• Create bundle deals to increase average order value</li>
          <li>• Use memorable coupon codes that are easy to share</li>
        </ul>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <PromotionModal
          promo={editingPromo}
          sellerId={sellerId}
          onClose={() => {
            setShowAddModal(false);
            setEditingPromo(null);
          }}
          onSave={() => {
            setShowAddModal(false);
            setEditingPromo(null);
            loadPromotions();
          }}
        />
      )}
    </div>
  );
}

function PromotionModal({ promo, sellerId, onClose, onSave }: any) {
  const [formData, setFormData] = useState({
    name: promo?.name || '',
    description: promo?.description || '',
    code: promo?.code || '',
    discount_type: promo?.discount_type || 'percentage',
    discount_value: promo?.discount_value || '',
    min_order_value: promo?.min_order_value || '',
    start_date: promo?.start_date?.split('T')[0] || new Date().toISOString().split('T')[0],
    end_date: promo?.end_date?.split('T')[0] || '',
    is_active: promo?.is_active ?? true
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
        vendor_id: sellerId
      };

      if (promo) {
        await apiClient.put(`/vendor/${sellerId}/promotions/${promo.id}`, payload);
      } else {
        await apiClient.post(`/vendor/${sellerId}/promotions`, payload);
      }

      onSave();
    } catch (error) {
      console.error('Error saving promotion:', error);
      alert('Failed to save promotion');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl">
        <div className="border-b border-slate-100 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{promo ? 'Edit Promotion' : 'Create Promotion'}</h2>
            <p className="text-sm text-slate-500 mt-1">Set up a discount offer for your products</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl">
            <XCircle className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Promotion Name *</label>
            <input
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Summer Sale"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Coupon Code</label>
            <input
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="e.g., SUMMER20"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-mono uppercase"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Discount Type</label>
              <select
                value={formData.discount_type}
                onChange={(e) => setFormData({ ...formData, discount_type: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
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
                min="0"
                max={formData.discount_type === 'percentage' ? 100 : undefined}
                value={formData.discount_value}
                onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
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
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">End Date *</label>
              <input
                type="date"
                required
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-5 h-5 rounded text-orange-500 focus:ring-orange-500"
            />
            <label htmlFor="is_active" className="font-medium text-slate-700">Active promotion</label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/25 hover:shadow-xl disabled:opacity-50 transition-all"
            >
              {saving ? 'Saving...' : (promo ? 'Update Promotion' : 'Create Promotion')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
