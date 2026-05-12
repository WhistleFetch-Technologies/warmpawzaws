'use client';

import { useState, useEffect } from 'react';
import {
  Image as ImageIcon,
  Plus,
  Edit2,
  Trash2,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  CheckCircle,
  XCircle,
  Upload,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { TouchFilePicker } from '@/components/shared/TouchFilePicker';

interface BannerManagementProps {
  sellerId: string;
}

export function BannerManagement({ sellerId }: BannerManagementProps) {
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState(false);
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

  const moveBanner = async (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= banners.length || reordering) return;

    const reordered = [...banners];
    const tmp = reordered[index];
    reordered[index] = reordered[newIndex];
    reordered[newIndex] = tmp;

    const oldIndexById = new Map(banners.map((b, i) => [b.id, i]));
    const toUpdate = reordered
      .map((b, idx) => ({ id: b.id as string, display_order: idx }))
      .filter((p) => oldIndexById.get(p.id) !== p.display_order);
    if (toUpdate.length === 0) {
      await loadBanners();
      return;
    }

    setReordering(true);
    try {
      await Promise.all(
        toUpdate.map((p) =>
          apiClient.put(`/vendor/${sellerId}/banners/${p.id}`, { display_order: p.display_order }),
        ),
      );
      await loadBanners();
    } catch (e) {
      console.error('Error reordering banners:', e);
      alert('Failed to reorder banners');
    } finally {
      setReordering(false);
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
                    type="button"
                    disabled={index === 0 || reordering}
                    onClick={() => moveBanner(index, 'up')}
                    className="p-1.5 hover:bg-slate-100 rounded disabled:opacity-30 transition-colors"
                    aria-label="Move banner up"
                  >
                    <ArrowUp className="w-4 h-4 text-slate-600" />
                  </button>
                  <button
                    type="button"
                    disabled={index === banners.length - 1 || reordering}
                    onClick={() => moveBanner(index, 'down')}
                    className="p-1.5 hover:bg-slate-100 rounded disabled:opacity-30 transition-colors"
                    aria-label="Move banner down"
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
                  <button
                    type="button"
                    onClick={async () => {
                      if (!confirm(`Delete banner "${banner.title}"?`)) return;
                      try {
                        await apiClient.delete(`/vendor/${sellerId}/banners/${banner.id}`);
                        await loadBanners();
                      } catch (e) {
                        console.error('Error deleting banner:', e);
                        alert('Failed to delete banner');
                      }
                    }}
                    className="p-2 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg transition-colors"
                  >
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

const BANNER_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

function initialUrlInputFromBanner(imageUrl: string | undefined) {
  const u = (imageUrl || '').trim();
  if (!u || u.startsWith('data:')) return '';
  return imageUrl || '';
}

function BannerModal({ banner, sellerId, onClose, onSave }: any) {
  const [formData, setFormData] = useState({
    title: banner?.title || '',
    description: banner?.description || '',
    image_url: banner?.image_url || '',
    link_url: banner?.link_url || '',
    is_active: banner?.is_active ?? true,
  });
  const [urlInput, setUrlInput] = useState(() => initialUrlInputFromBanner(banner?.image_url));
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formError, setFormError] = useState('');

  const rawImageUrl = formData.image_url.trim();

  const clearBannerImage = () => {
    setFormError('');
    setUrlInput('');
    setFormData((prev: typeof formData) => ({ ...prev, image_url: '' }));
  };

  const handleBannerImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setFormError('');
    if (!file.type.startsWith('image/')) {
      setFormError('Choose an image file (JPG, PNG, or WebP).');
      return;
    }
    if (file.size > BANNER_IMAGE_MAX_BYTES) {
      setFormError('Image must be 2MB or smaller.');
      return;
    }

    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const response = await apiClient.post<{ image_url?: string; url?: string }>(
        `/vendor/${sellerId}/products/images`,
        fd,
      );
      const imageUrl = response.image_url || response.url;
      if (imageUrl) {
        setUrlInput(imageUrl.startsWith('data:') ? '' : imageUrl);
        setFormData((prev: typeof formData) => ({ ...prev, image_url: imageUrl }));
      } else {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('Failed to read image'));
          reader.readAsDataURL(file);
        });
        setUrlInput('');
        setFormData((prev: typeof formData) => ({ ...prev, image_url: dataUrl }));
      }
    } catch (error) {
      console.warn('[BannerModal] Image upload failed, using local data URL:', error);
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('Failed to read image'));
          reader.readAsDataURL(file);
        });
        setUrlInput('');
        setFormData((prev: typeof formData) => ({ ...prev, image_url: dataUrl }));
      } catch {
        setFormError('Could not add this image. Try a smaller file or paste an HTTPS image URL.');
      }
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const title = formData.title.trim();
    if (!title) {
      setFormError('Banner title is required.');
      return;
    }

    const image_url = formData.image_url.trim();
    if (!image_url) {
      setFormError('Add a banner image by uploading a file or pasting an image URL.');
      return;
    }

    const link = formData.link_url.trim();
    if (link) {
      try {
        const u = new URL(link);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          setFormError('Link URL must start with http:// or https://');
          return;
        }
      } catch {
        setFormError('Link URL must be a valid web address.');
        return;
      }
    }

    setSaving(true);

    try {
      const payload = {
        ...formData,
        title,
        image_url,
        link_url: link,
        vendor_id: sellerId,
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
    <div
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="banner-modal-title"
    >
      <div className="flex min-h-full items-start justify-center p-4 pb-24 pt-6 sm:items-center sm:p-6 sm:pb-12">
        <div className="flex max-h-[min(90dvh,880px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-5 sm:p-6">
            <div className="min-w-0 pr-2">
              <h2 id="banner-modal-title" className="text-xl font-bold text-slate-900">
                {banner ? 'Edit Banner' : 'Create Banner'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">Add promotional banner for your store</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl p-2 hover:bg-slate-100"
              aria-label="Close"
            >
              <XCircle className="h-5 w-5 text-slate-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Banner Title *</label>
                <input
                  required
                  value={formData.title}
                  onChange={(e) => {
                    setFormError('');
                    setFormData({ ...formData, title: e.target.value });
                  }}
                  placeholder="e.g., Summer Sale - 50% Off"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  placeholder="Brief description of the banner"
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Banner image *</label>
                <p className="mb-3 text-xs text-slate-500">
                  Upload a JPG, PNG, or WebP up to 2MB, or paste an image URL. Embedded (base64) images are kept for save but are not echoed back into the URL box so the field stays usable.
                </p>

                {formData.image_url ? (
                  <div className="mb-3 space-y-2">
                    <div className="aspect-[3/1] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                      <img
                        src={formData.image_url}
                        alt="Banner preview"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {rawImageUrl.startsWith('data:') ? (
                        <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                          Image attached (embedded)
                        </span>
                      ) : rawImageUrl.length > 120 ? (
                        <span className="max-w-full truncate rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                          {rawImageUrl.slice(0, 72)}…
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={clearBannerImage}
                        className="text-sm font-medium text-red-600 hover:text-red-700"
                      >
                        Remove image
                      </button>
                    </div>
                  </div>
                ) : null}

                <TouchFilePicker
                  onFileChange={handleBannerImageUpload}
                  accept="image/jpeg,image/png,image/webp,image/*"
                  disabled={uploadingImage || saving}
                  className="relative flex min-h-[104px] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 transition-colors hover:border-orange-400"
                  innerClassName="flex flex-col items-center justify-center gap-1 px-4 py-5"
                  inputClassName="z-10"
                >
                  <Upload className="h-8 w-8 text-slate-400" />
                  <span className="text-sm font-medium text-slate-600">
                    {uploadingImage ? 'Uploading…' : 'Click or tap to upload'}
                  </span>
                  <span className="text-xs text-slate-400">1200 × 400 px recommended</span>
                </TouchFilePicker>

                <label htmlFor="banner-image-url" className="sr-only">
                  Image URL
                </label>
                <input
                  id="banner-image-url"
                  type="url"
                  inputMode="url"
                  value={urlInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFormError('');
                    setFormData((prev: typeof formData) => ({ ...prev, image_url: v }));
                    if (v.startsWith('data:') && v.length > 200) {
                      setUrlInput('');
                    } else {
                      setUrlInput(v);
                    }
                  }}
                  placeholder="Or paste image URL (https://…)"
                  className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              {formError ? <p className="text-sm text-red-600">{formError}</p> : null}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Link URL (Optional)</label>
                <input
                  value={formData.link_url}
                  onChange={(e) => {
                    setFormError('');
                    setFormData({ ...formData, link_url: e.target.value });
                  }}
                  placeholder="https://yourstore.com/sale"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-5 w-5 rounded text-orange-500 focus:ring-orange-500"
                />
                <label htmlFor="is_active" className="font-medium text-slate-700">
                  Active banner
                </label>
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:px-6">
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 px-6 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || uploadingImage}
                  className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3 font-semibold text-white shadow-lg shadow-orange-500/25 transition-all hover:shadow-xl disabled:opacity-50"
                >
                  {saving ? 'Saving...' : banner ? 'Update Banner' : 'Create Banner'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
