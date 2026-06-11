'use client';
export const dynamic = 'force-dynamic';

import React, { useMemo, useState } from 'react';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { Button, Card, CardHeader, CardTitle, CardContent, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Input, Label, Badge, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@warmpawz/ui';
import { Image, Plus, Edit, Trash2, Calendar, Link as LinkIcon } from 'lucide-react';
import { useApiData, useCrud, useFormModal, useNotifications } from '@/hooks';
import { validateRequired } from '@/lib/utils';
import { formatDateForInput } from '@/lib/utils';
import {
  normalizeAdminBannersList,
  adminBannerPositionFromRow,
  normalizeLocationValue,
  formatAdminBannerLocationLabel,
  getStoredBannerImageUrl,
  getBannerDisplayImageUrl,
  isShopBannerPosition,
  isCheckoutBannerPosition,
  buildShopBannerTarget,
  buildShopBannerCtaLink,
  mergeShopBannerIntoMetadata,
  parseShopBannerTargetFromAdminRow,
  validateBannerSaveTarget,
  formatShopProductOptionLabel,
  type ShopBannerTargetLevel,
} from '@/lib/banner-admin';
import { ShopBannerDestinationFields } from '@/components/admin/marketing/ShopBannerDestinationFields';
import { getCustomerWebBaseUrl } from '@/lib/api-client';

// ============================================================================
// TYPES
// ============================================================================

interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  image_url?: string;
  imageUrl?: string;
  cta_text?: string;
  cta_link?: string;
  /** DB column */
  type?: string;
  position: 'home_top' | 'home_middle' | 'home_lower' | 'category' | 'shop' | 'checkout';
  is_active: boolean;
  start_date?: string;
  end_date?: string;
  display_order: number;
  target_role_id?: string;
  target_service_category?: string;
  target_state?: string | null;
  target_city?: string | null;
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
  target_state: string;
  target_city: string;
  shop_target_mode: ShopBannerTargetLevel;
  shop_product_id: string;
  shop_product_name: string;
  shop_product_sku: string;
}

function buildShopBannerPayload(data: BannerFormData) {
  const shopTarget = buildShopBannerTarget({
    targetMode: data.shop_target_mode,
    productId: data.shop_product_id,
    productName: data.shop_product_name || undefined,
    productSku: data.shop_product_sku || undefined,
  });
  const metadata = mergeShopBannerIntoMetadata(
    { gradient_from: '#FF8C42', gradient_to: '#FF6B35' },
    shopTarget
  );
  return {
    linkUrl: buildShopBannerCtaLink(shopTarget),
    metadata,
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function BannersPage() {
  // Filters
  const [filterPosition, setFilterPosition] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Reusable hooks
  const { data: banners, loading, error: dataError, refetch } = useApiData<Banner>({
    endpoint: '/admin/banners',
    dataKey: 'banners',
    params: {
      ...(filterPosition && filterPosition !== 'all' && { position: filterPosition }),
      ...(filterStatus && filterStatus !== 'all' && { isActive: filterStatus }),
    },
    transformData: (rows) => normalizeAdminBannersList(rows) as unknown as Banner[],
  });

  const notifications = useNotifications({ autoClearSuccess: true });
  
  const { saving, deleting, error: crudError, success: crudSuccess, create, update, remove } = useCrud<Banner, BannerFormData, any>({
    endpoint: '/admin/banners',
    transformCreate: (data) => {
      const shopPayload = isShopBannerPosition(data.position) ? buildShopBannerPayload(data) : null;
      return {
        title: data.title,
        description: data.subtitle,
        imageUrl: data.image_url.trim() || null,
        linkUrl: shopPayload?.linkUrl ?? (isCheckoutBannerPosition(data.position) ? '' : data.cta_link),
        position: data.position,
        priority: data.display_order,
        startDate: data.start_date,
        endDate: data.end_date || null,
        isActive: data.is_active,
        ctaText: data.cta_text,
        targetState: normalizeLocationValue(data.target_state),
        targetCity: normalizeLocationValue(data.target_city),
        ...(shopPayload ? { metadata: shopPayload.metadata } : {}),
      };
    },
    transformUpdate: (data) => {
      const shopPayload = isShopBannerPosition(data.position) ? buildShopBannerPayload(data) : null;
      return {
        title: data.title,
        description: data.subtitle,
        imageUrl: data.image_url.trim() || null,
        linkUrl: shopPayload?.linkUrl ?? (isCheckoutBannerPosition(data.position) ? '' : data.cta_link),
        position: data.position,
        priority: data.display_order,
        startDate: data.start_date,
        endDate: data.end_date || null,
        isActive: data.is_active,
        ctaText: data.cta_text,
        targetState: normalizeLocationValue(data.target_state),
        targetCity: normalizeLocationValue(data.target_city),
        ...(shopPayload ? { metadata: shopPayload.metadata } : {}),
      };
    },
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
      target_state: '',
      target_city: '',
      shop_target_mode: 'informational',
      shop_product_id: '',
      shop_product_name: '',
      shop_product_sku: '',
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
      target_state: '',
      target_city: '',
      shop_target_mode: 'informational',
      shop_product_id: '',
      shop_product_name: '',
      shop_product_sku: '',
    }),
    mapItemToFormData: (banner) => {
      const position = adminBannerPositionFromRow(banner) as BannerFormData['position'];
      const shopTarget = parseShopBannerTargetFromAdminRow(banner as Record<string, unknown>);
      return {
        title: banner.title,
        subtitle: banner.subtitle || '',
        image_url: getStoredBannerImageUrl(banner),
        cta_text: banner.cta_text || '',
        cta_link: banner.cta_link || '',
        position,
        is_active: banner.is_active,
        start_date: formatDateForInput(banner.start_date),
        end_date: formatDateForInput(banner.end_date),
        display_order: banner.display_order,
        target_role_id: banner.target_role_id || '',
        target_service_category: banner.target_service_category || '',
        target_state: normalizeLocationValue((banner as any).target_state) || '',
        target_city: normalizeLocationValue((banner as any).target_city) || '',
        shop_target_mode:
          shopTarget?.targetLevel === 'product' ? 'product' : 'informational',
        shop_product_id: shopTarget?.productId || '',
        shop_product_name: shopTarget?.productName || '',
        shop_product_sku: shopTarget?.productSku || '',
      };
    },
  });
  const selectedTargetState = normalizeLocationValue(modal.formData.target_state);
  const { data: availableStates } = useApiData<{ value: string }>({
    endpoint: '/admin/banners/locations/states',
    dataKey: 'states',
  });
  const { data: availableCities } = useApiData<{ value: string }>({
    endpoint: '/admin/banners/locations/cities',
    dataKey: 'cities',
    params: selectedTargetState ? { state: selectedTargetState } : undefined,
  });
  const stateOptions = useMemo(
    () => availableStates.map((s) => s.value).filter(Boolean),
    [availableStates]
  );
  const cityOptions = useMemo(
    () => availableCities.map((c) => c.value).filter(Boolean),
    [availableCities]
  );

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

    const shopValidation = validateBannerSaveTarget({
      position: modal.formData.position,
      categoryId: '',
      targetMode: 'none',
      serviceStyle: '',
      vendorId: '',
      shopTargetMode: modal.formData.shop_target_mode,
      shopProductId: modal.formData.shop_product_id,
    });
    if (!shopValidation.ok) {
      notifications.setError(shopValidation.message);
      return;
    }

    const payload: BannerFormData = {
      ...modal.formData,
      image_url: modal.formData.image_url.trim(),
    };

    if (modal.editingItem) {
      await update(modal.editingItem.id, payload);
    } else {
      await create(payload);
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
      main: 'Home Top',
      home_top: 'Home Top',
      home_middle: 'Home Middle',
      home_lower: 'Home Lower',
      category: 'Category (Find All Services)',
      shop: 'Shop Main Page',
      checkout: 'Checkout',
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
                      <SelectItem value="all">All Positions</SelectItem>
                      <SelectItem value="home_top">Home Top</SelectItem>
                      <SelectItem value="home_middle">Home Middle</SelectItem>
                      <SelectItem value="home_lower">Home Lower</SelectItem>
                      <SelectItem value="category">Category Page</SelectItem>
                      <SelectItem value="shop">Shop Main Page</SelectItem>
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
                      <SelectItem value="all">All Status</SelectItem>
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
                    {getBannerDisplayImageUrl(banner) ? (
                      <img
                        src={
                          getBannerDisplayImageUrl(banner).startsWith('/')
                            ? `${getCustomerWebBaseUrl()}${getBannerDisplayImageUrl(banner)}`
                            : getBannerDisplayImageUrl(banner)
                        }
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
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Location:</span>
                        <Badge variant="outline">
                          {formatAdminBannerLocationLabel((banner as any).target_state, (banner as any).target_city)}
                        </Badge>
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
        <Dialog open={modal.isOpen} onOpenChange={(open: boolean) => !open && modal.closeModal()}>
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
                  type="text"
                  value={modal.formData.image_url}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    modal.setFormData({ ...modal.formData, image_url: e.target.value })
                  }
                  placeholder="https://example.com/image.jpg"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Leave empty for gradient-only. Image is saved exactly as entered.
                </p>
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
                {!isShopBannerPosition(modal.formData.position) && !isCheckoutBannerPosition(modal.formData.position) ? (
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
                ) : null}
              </div>

              {isShopBannerPosition(modal.formData.position) ? (
                <div className="rounded-lg border border-dashed border-gray-200 p-4 bg-gray-50/80">
                  <ShopBannerDestinationFields
                    targetMode={modal.formData.shop_target_mode}
                    onTargetModeChange={(mode) =>
                      modal.setFormData({
                        ...modal.formData,
                        shop_target_mode: mode,
                        shop_product_id: mode === 'informational' ? '' : modal.formData.shop_product_id,
                        shop_product_name: mode === 'informational' ? '' : modal.formData.shop_product_name,
                        shop_product_sku: mode === 'informational' ? '' : modal.formData.shop_product_sku,
                      })
                    }
                    productId={modal.formData.shop_product_id}
                    onProductIdChange={(id) =>
                      modal.setFormData({ ...modal.formData, shop_product_id: id })
                    }
                    onProductSelect={(product) =>
                      modal.setFormData({
                        ...modal.formData,
                        shop_product_name: product?.name || '',
                        shop_product_sku: product?.sku || '',
                      })
                    }
                    selectedProductLabel={
                      modal.formData.shop_product_name
                        ? formatShopProductOptionLabel({
                            name: modal.formData.shop_product_name,
                            price: 0,
                            sku: modal.formData.shop_product_sku,
                          })
                        : undefined
                    }
                  />
                </div>
              ) : null}

              <div>
                <Label htmlFor="position">Position *</Label>
                <Select
                  value={modal.formData.position}
                  onValueChange={(value: BannerFormData['position']) => {
                    const next: BannerFormData = {
                      ...modal.formData,
                      position: value,
                      shop_target_mode: value === 'shop' ? 'informational' : modal.formData.shop_target_mode,
                      shop_product_id: value === 'shop' ? '' : modal.formData.shop_product_id,
                      shop_product_name: value === 'shop' ? '' : modal.formData.shop_product_name,
                      shop_product_sku: value === 'shop' ? '' : modal.formData.shop_product_sku,
                    };
                    modal.setFormData(next);
                  }}
                >
                  <SelectTrigger id="position">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="home_top">Home Top</SelectItem>
                    <SelectItem value="home_middle">Home Middle</SelectItem>
                    <SelectItem value="home_lower">Home Lower</SelectItem>
                    <SelectItem value="category">Category Page</SelectItem>
                    <SelectItem value="shop">Shop Main Page</SelectItem>
                    <SelectItem value="checkout">Checkout Page</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="target_state">State</Label>
                  <Select
                    value={modal.formData.target_state || '__all_states__'}
                    onValueChange={(value: string) => {
                      const normalizedState = value === '__all_states__' ? '' : value;
                      modal.setFormData({
                        ...modal.formData,
                        target_state: normalizedState,
                        target_city: '',
                      });
                    }}
                  >
                    <SelectTrigger id="target_state">
                      <SelectValue placeholder="All States" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all_states__">All States</SelectItem>
                      {stateOptions.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="target_city">City</Label>
                  <Select
                    value={modal.formData.target_city || '__all_cities__'}
                    onValueChange={(value: string) =>
                      modal.setFormData({
                        ...modal.formData,
                        target_city: value === '__all_cities__' ? '' : value,
                      })
                    }
                    disabled={!modal.formData.target_state}
                  >
                    <SelectTrigger id="target_city">
                      <SelectValue placeholder="All Cities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all_cities__">All Cities</SelectItem>
                      {cityOptions.map((city) => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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

