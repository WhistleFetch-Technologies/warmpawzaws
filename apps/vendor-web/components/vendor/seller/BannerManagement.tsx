'use client';

import { useState, useEffect } from 'react';
import { 
  Image as ImageIcon, Plus, Edit2, Trash2, Eye, 
  ArrowUp, ArrowDown, ExternalLink, CheckCircle, XCircle
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface BannerManagementProps {
  sellerId: string;
}

export function BannerManagement({ sellerId }: BannerManagementProps) {
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<any>(null);

  useEffect(() => {
    loadBanners();
  }, [sellerId]);

  const loadBanners = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<{ banners?: any[] }>(`/vendor/${sellerId}/banners`);
      setBanners(data?.banners || []);
    } catch (error) {
      console.error('Error loading banners:', error);
      setBanners([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-500 mx-auto"></div>
          <p className="mt-4 text-slate-500">Loading banners...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Banner Management</h1>
          <p className="text-slate-500 mt-1">Create promotional banners for your store</p>
        </div>
        <button
          onClick={() => {
            setEditingBanner(null);
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/25 hover:shadow-xl transition-all"
        >
          <Plus className="w-5 h-5" />
          Create Banner
        </button>
      </div>

      {/* Banner Guidelines */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
        <h3 className="font-semibold text-blue-900 mb-3">📐 Banner Guidelines</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-blue-700">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-blue-600" />
            <span>Recommended size: 1200 x 400 px</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-blue-600" />
            <span>Max file size: 2MB</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-blue-600" />
            <span>Formats: JPG, PNG, WebP</span>
          </div>
        </div>
      </div>

      {/* Banners */}
      {banners.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <ImageIcon className="w-10 h-10 text-orange-500" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900">No banners yet</h3>
          <p className="text-slate-500 mt-2 max-w-md mx-auto">
            Create eye-catching banners to promote your products and special offers
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-6 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/25 hover:shadow-xl transition-all"
          >
            <Plus className="w-5 h-5 inline mr-2" />
            Create Your First Banner
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {banners.map((banner, index) => (
            <div key={banner.id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-lg transition-all">
              <div className="flex items-center gap-4 p-4">
                {/* Preview */}
                <div className="w-48 h-16 bg-gradient-to-r from-slate-200 to-slate-100 rounded-lg flex items-center justify-center overflow-hidden">
                  {banner.image_url ? (
                    <img src={banner.image_url} alt={banner.title} className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-slate-400" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{banner.title}</h3>
                    {banner.is_active ? (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">Active</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">Inactive</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">{banner.description}</p>
                  {banner.link_url && (
                    <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" />
                      {banner.link_url}
                    </p>
                  )}
                </div>

                {/* Order Controls */}
                <div className="flex flex-col gap-1">
                  <button 
                    disabled={index === 0}
                    className="p-1.5 hover:bg-slate-100 rounded disabled:opacity-30 transition-colors"
                  >
                    <ArrowUp className="w-4 h-4 text-slate-600" />
                  </button>
                  <button 
                    disabled={index === banners.length - 1}
                    className="p-1.5 hover:bg-slate-100 rounded disabled:opacity-30 transition-colors"
                  >
                    <ArrowDown className="w-4 h-4 text-slate-600" />
                  </button>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setEditingBanner(banner);
                      setShowAddModal(true);
                    }}
                    className="p-2 hover:bg-orange-50 text-slate-600 hover:text-orange-600 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button className="p-2 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <BannerModal
          banner={editingBanner}
          sellerId={sellerId}
          onClose={() => {
            setShowAddModal(false);
            setEditingBanner(null);
          }}
          onSave={() => {
            setShowAddModal(false);
            setEditingBanner(null);
            loadBanners();
          }}
        />
      )}
    </div>
  );
}

function BannerModal({ banner, sellerId, onClose, onSave }: any) {
  const [formData, setFormData] = useState({
    title: banner?.title || '',
    description: banner?.description || '',
    image_url: banner?.image_url || '',
    link_url: banner?.link_url || '',
    is_active: banner?.is_active ?? true
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        ...formData,
        vendor_id: sellerId
      };

      if (banner) {
        await apiClient.put(`/vendor/${sellerId}/banners/${banner.id}`, payload);
      } else {
        await apiClient.post(`/vendor/${sellerId}/banners`, payload);
      }

      onSave();
    } catch (error) {
      console.error('Error saving banner:', error);
      alert('Failed to save banner');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl">
        <div className="border-b border-slate-100 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{banner ? 'Edit Banner' : 'Create Banner'}</h2>
            <p className="text-sm text-slate-500 mt-1">Add promotional banner for your store</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl">
            <XCircle className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Banner Title *</label>
            <input
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Summer Sale - 50% Off"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              placeholder="Brief description of the banner"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Image URL *</label>
            <input
              required
              value={formData.image_url}
              onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
              placeholder="https://example.com/banner.jpg"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          {formData.image_url && (
            <div className="aspect-[3/1] bg-slate-100 rounded-xl overflow-hidden">
              <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Link URL (Optional)</label>
            <input
              value={formData.link_url}
              onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
              placeholder="https://yourstore.com/sale"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-5 h-5 rounded text-orange-500 focus:ring-orange-500"
            />
            <label htmlFor="is_active" className="font-medium text-slate-700">Active banner</label>
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
              {saving ? 'Saving...' : (banner ? 'Update Banner' : 'Create Banner')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
