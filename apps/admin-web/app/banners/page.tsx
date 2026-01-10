'use client';
export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { Button, Card, CardHeader, CardTitle, CardContent, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Input, Label, Badge, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@warmpawz/ui';
import { Image, Plus, Edit, Trash2, Calendar, Link as LinkIcon } from 'lucide-react';
import { useApiData, useCrud, useFormModal, useNotifications } from '@/hooks';
import { validateRequired } from '@/lib/utils';
import { formatDateForInput } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  image_url?: string;
  cta_text?: string;
  cta_link?: string;
  position: 'home_top' | 'home_middle' | 'category' | 'checkout';
  is_active: boolean;
  start_date?: string;
  end_date?: string;
  display_order: number;
  target_role_id?: string;
  target_service_category?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface BannerFormData {
  title: string;
  subtitle: string;
  image_url: string;
  cta_text: string;
  cta_link: string;
  position: Banner['position'];
  is_active: boolean;
  start_date: string;
  end_date: string;
  display_order: number;
  target_role_id: string;
  target_service_category: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function BannersPage() {
  // Filters
  const [filterPosition, setFilterPosition] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Reusable hooks
  const { data: banners, loading, error: dataError, refetch } = useApiData<Banner>({
    endpoint: '/admin/banners',
    dataKey: 'banners',
    params: {
      ...(filterPosition && { position: filterPosition }),
      ...(filterStatus && { isActive: filterStatus }),
    },
  });

  const notifications = useNotifications({ autoClearSuccess: true });
  
  const { saving, deleting, error: crudError, success: crudSuccess, create, update, remove } = useCrud<Banner, BannerFormData, any>({
    endpoint: '/admin/banners',
    transformCreate: (data) => ({
      title: data.title,
      description: data.subtitle,
      imageUrl: data.image_url,
      linkUrl: data.cta_link,
      position: data.position,
      priority: data.display_order,
      startDate: data.start_date,
      endDate: data.end_date || null,
      isActive: data.is_active,
      ctaText: data.cta_text,
    }),
    transformUpdate: (data) => ({
      title: data.title,
      description: data.subtitle,
      imageUrl: data.image_url,
      linkUrl: data.cta_link,
      position: data.position,
      priority: data.display_order,
      startDate: data.start_date,
      endDate: data.end_date || null,
      isActive: data.is_active,
      ctaText: data.cta_text,
    }),
    onSuccess: (message) => {
      notifications.setSuccess(message);
      refetch();
    },
    onError: (err) => {
      notifications.setError(err.message || 'Operation failed');
    },
  });

  const modal = useFormModal<BannerFormData, Banner>({
    initialFormData: {
      title: '',
      subtitle: '',
      image_url: '',
      cta_text: '',
      cta_link: '',
      position: 'home_top',
      is_active: true,
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      display_order: banners.length,
      target_role_id: '',
      target_service_category: '',
    },
    getDefaultFormData: () => ({
      title: '',
      subtitle: '',
      image_url: '',
      cta_text: '',
      cta_link: '',
      position: 'home_top',
      is_active: true,
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      display_order: banners.length,
      target_role_id: '',
      target_service_category: '',
    }),
    mapItemToFormData: (banner) => ({
      title: banner.title,
      subtitle: banner.subtitle || '',
      image_url: banner.image_url || '',
      cta_text: banner.cta_text || '',
      cta_link: banner.cta_link || '',
      position: banner.position,
      is_active: banner.is_active,
      start_date: formatDateForInput(banner.start_date),
      end_date: formatDateForInput(banner.end_date),
      display_order: banner.display_order,
      target_role_id: banner.target_role_id || '',
      target_service_category: banner.target_service_category || '',
    }),
  });

  // Combine errors and success messages
  const error = dataError || crudError || notifications.error;
  const success = crudSuccess || notifications.success;

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleSave = async () => {
    const validation = validateRequired(modal.formData, ['title', 'position']);
    if (!validation.isValid) {
      notifications.setError(Object.values(validation.errors)[0]);
      return;
    }

    if (modal.editingItem) {
      await update(modal.editingItem.id, modal.formData);
    } else {
      await create(modal.formData);
    }

    if (!crudError) {
      modal.closeModal();
    }
  };

  const handleDelete = async (banner: Banner) => {
    await remove(banner);
  };

  const handleToggleStatus = async (banner: Banner) => {
    await update(banner.id, { ...banner, is_active: !banner.is_active } as any);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <AdminLayout>
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading banners...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const getPositionLabel = (position: string) => {
    const labels: Record<string, string> = {
      'home_top': 'Home Top',
      'home_middle': 'Home Middle',
      'category': 'Category Page',
      'checkout': 'Checkout Page',
    };
    return labels[position] || position;
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Banner Management</h1>
              <p className="text-gray-500">Manage marketing banners and promotional displays</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={modal.openCreate}
                variant="default"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Banner
              </Button>
            </div>
          </div>
        </header>

        <main className="p-8">
          {/* Messages */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={notifications.clearError} className="text-red-400 hover:text-red-600">✕</button>
            </div>
          )}
          
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center justify-between">
              <span>{success}</span>
              <button onClick={notifications.clearSuccess} className="text-green-400 hover:text-green-600">✕</button>
            </div>
          )}

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[200px]">
                  <Label htmlFor="position-filter">Position</Label>
                  <Select value={filterPosition} onValueChange={setFilterPosition}>
                    <SelectTrigger id="position-filter">
                      <SelectValue placeholder="All Positions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Positions</SelectItem>
                      <SelectItem value="home_top">Home Top</SelectItem>
                      <SelectItem value="home_middle">Home Middle</SelectItem>
                      <SelectItem value="category">Category Page</SelectItem>
                      <SelectItem value="checkout">Checkout Page</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <Label htmlFor="status-filter">Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger id="status-filter">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Status</SelectItem>
                      <SelectItem value="true">Active</SelectItem>
                      <SelectItem value="false">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={() => refetch()} variant="outline">
                    🔄 Refresh
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Banners Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {banners.length === 0 ? (
              <div className="col-span-full">
                <Card>
                  <CardContent className="p-12 text-center">
                    <div className="text-5xl mb-4">🎨</div>
                    <p className="text-gray-500">No banners found</p>
                    <Button onClick={modal.openCreate} className="mt-4" variant="default">
                      Create Your First Banner
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ) : (
              banners.map(banner => (
                <Card key={banner.id} className="overflow-hidden">
                  <div className="relative h-48 bg-gradient-to-br from-primary/20 to-primary/5">
                    {banner.image_url ? (
                      <img 
                        src={banner.image_url} 
                        alt={banner.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="w-16 h-16 text-gray-300" />
                      </div>
                    )}
                    <Badge 
                      variant={banner.is_active ? "default" : "secondary"}
                      className="absolute top-2 right-2"
                    >
                      {banner.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <CardHeader>
                    <CardTitle className="text-lg">{banner.title}</CardTitle>
                    {banner.subtitle && (
                      <p className="text-sm text-muted-foreground">{banner.subtitle}</p>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Position:</span>
                        <Badge variant="outline">{getPositionLabel(banner.position)}</Badge>
                      </div>
                      {banner.start_date && (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {new Date(banner.start_date).toLocaleDateString()}
                            {banner.end_date && ` - ${new Date(banner.end_date).toLocaleDateString()}`}
                          </span>
                        </div>
                      )}
                      {banner.cta_link && (
                        <div className="flex items-center gap-2 text-sm">
                          <LinkIcon className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground truncate">{banner.cta_link}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => modal.openEdit(banner)}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        onClick={() => handleToggleStatus(banner)}
                        variant={banner.is_active ? "secondary" : "default"}
                        size="sm"
                        className="flex-1"
                        disabled={saving}
                      >
                        {banner.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        onClick={() => handleDelete(banner)}
                        variant="destructive"
                        size="sm"
                        disabled={deleting}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </main>

        {/* Create/Edit Modal */}
        <Dialog open={modal.isOpen} onOpenChange={(open) => !open && modal.closeModal()}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{modal.editingItem ? 'Edit Banner' : 'Create Banner'}</DialogTitle>
              <DialogDescription>Configure banner details and display settings</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={modal.formData.title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData({ ...modal.formData, title: e.target.value })}
                  placeholder="Banner Title"
                />
              </div>

              <div>
                <Label htmlFor="subtitle">Subtitle</Label>
                <Input
                  id="subtitle"
                  value={modal.formData.subtitle}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData({ ...modal.formData, subtitle: e.target.value })}
                  placeholder="Optional subtitle"
                />
              </div>

              <div>
                <Label htmlFor="image_url">Image URL</Label>
                <Input
                  id="image_url"
                  type="url"
                  value={modal.formData.image_url}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData({ ...modal.formData, image_url: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cta_text">CTA Text</Label>
                  <Input
                    id="cta_text"
                    value={modal.formData.cta_text}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData({ ...modal.formData, cta_text: e.target.value })}
                    placeholder="Shop Now"
                  />
                </div>
                <div>
                  <Label htmlFor="cta_link">CTA Link</Label>
                  <Input
                    id="cta_link"
                    type="url"
                    value={modal.formData.cta_link}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData({ ...modal.formData, cta_link: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="position">Position *</Label>
                <Select value={modal.formData.position} onValueChange={(value: any) => modal.setFormData({ ...modal.formData, position: value })}>
                  <SelectTrigger id="position">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="home_top">Home Top</SelectItem>
                    <SelectItem value="home_middle">Home Middle</SelectItem>
                    <SelectItem value="category">Category Page</SelectItem>
                    <SelectItem value="checkout">Checkout Page</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={modal.formData.start_date}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData({ ...modal.formData, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="end_date">End Date (optional)</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={modal.formData.end_date}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData({ ...modal.formData, end_date: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="display_order">Display Order</Label>
                <Input
                  id="display_order"
                  type="number"
                  value={modal.formData.display_order}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData({ ...modal.formData, display_order: Number(e.target.value) })}
                  min="0"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={modal.formData.is_active}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => modal.setFormData({ ...modal.formData, is_active: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="is_active">Banner is active</Label>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={modal.closeModal} variant="outline">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving} variant="default">
                {saving ? 'Saving...' : modal.editingItem ? 'Update Banner' : 'Create Banner'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

