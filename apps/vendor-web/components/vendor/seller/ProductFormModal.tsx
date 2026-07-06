'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Plus, Trash2, X, Upload, IndianRupee, Package, Image as ImageIcon, MapPin,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { TouchFilePicker } from '@/components/shared/TouchFilePicker';
import { IntegerInput } from '@/components/shared/IntegerInput';
import { DecimalInput } from '@/components/shared/DecimalInput';
import {
  type ProductMode,
  type VariantAxisConfig,
  type VariantRow,
  type ProductFormState,
  type SimpleSkuDraft,
  buildVendorProductPayload,
  validateProductForm,
  variantsFromProduct,
  initialProductFormState,
  initialSimpleSkuFromProduct,
  detectProductMode,
  inferVariantAxesFromProduct,
  presetVariantAxes,
  customVariantAxis,
  effectiveVariantMrp,
  effectiveVariantPrice,
  computeListingPreviewFromVariants,
  productGroupIdFromProduct,
  createEmptyVariant,
  migrateSimpleSkuToFirstVariant,
  updateVariantOptionValue,
  isSkuUuid,
  deliveryRegionsFromProduct,
  VENDOR_PET_TYPE_SUGGESTIONS,
  PET_TYPE_SELECT_OTHER,
  petTypeSelectValueFromInput,
  isStandardVendorPetTypeInput,
  categoryIdForForm,
  customSpecRowsFromProduct,
  type SpecKvRow,
  variantAxesFromPresetSuggestion,
} from '@/lib/vendor-product-form';
import {
  getVariantSuggestionsForCategory,
  MAX_VARIANT_ATTRIBUTES,
  KNOWN_CANONICAL_CITIES,
  resolveCityToCanonical,
  displayCityName,
} from '@warmpawz/shared-types';
import {
  discardAllPendingProductImages,
  registerPendingProductImageKey,
  removePendingProductImageByUrl,
  uploadProductImage,
} from '@/lib/product-image-upload';

function stripAwsPresignFromProductImageUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.searchParams.has('X-Amz-Algorithm') || u.searchParams.has('X-Amz-Credential')) {
      u.search = '';
      return u.toString();
    }
  } catch {
    /* ignore */
  }
  return url;
}

type ProductFormModalProps = {
  product: Record<string, unknown> | null;
  sellerId: string;
  categories: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSave: () => void;
};

export function ProductFormModal({
  product,
  sellerId,
  categories,
  onClose,
  onSave,
}: ProductFormModalProps) {
  const [form, setForm] = useState<ProductFormState>(() => initialProductFormState(product));
  const [productMode, setProductMode] = useState<ProductMode>(() => detectProductMode(product));
  const [simpleSku, setSimpleSku] = useState<SimpleSkuDraft>(() =>
    initialSimpleSkuFromProduct(product),
  );
  const [variants, setVariants] = useState<VariantRow[]>(() =>
    variantsFromProduct(product),
  );
  const [variantAxes, setVariantAxes] = useState<VariantAxisConfig[]>(() =>
    variants.length > 0
      ? inferVariantAxesFromProduct(product, variants)
      : presetVariantAxes('size_color'),
  );
  const [pendingAxisPick, setPendingAxisPick] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const pendingFileKeysRef = useRef<Map<string, string>>(new Map());
  const saveCommittedRef = useRef(false);
  const [deliveryRegions, setDeliveryRegions] = useState<string[]>(() =>
    deliveryRegionsFromProduct(product),
  );
  const [customSpecs, setCustomSpecs] = useState<SpecKvRow[]>(() =>
    customSpecRowsFromProduct(product),
  );
  const [deliveryCityInput, setDeliveryCityInput] = useState('');
  const [productGroupId, setProductGroupId] = useState(() => productGroupIdFromProduct(product));
  const [petTypeSelect, setPetTypeSelect] = useState(() =>
    petTypeSelectValueFromInput(initialProductFormState(product).petTypeInput),
  );
  const [commissionModel, setCommissionModel] = useState<'category' | 'ownership' | null>(null);

  const requiresListingOwnership = commissionModel === 'ownership';

  const listingPreview = useMemo(
    () => (productMode === 'multi' ? computeListingPreviewFromVariants(variants, variantAxes) : null),
    [productMode, variants, variantAxes],
  );

  const selectedCategoryName = useMemo(() => {
    const cat = categories.find((c) => c.id === form.category_id);
    return cat?.name?.trim() ?? '';
  }, [categories, form.category_id]);

  const variantSuggestions = useMemo(
    () => getVariantSuggestionsForCategory(form.category_id, selectedCategoryName),
    [form.category_id, selectedCategoryName],
  );

  const categorySelectOptions = useMemo(() => {
    const currentId = form.category_id.trim();
    if (!currentId || categories.some((c) => String(c.id) === currentId)) {
      return categories;
    }
    const fallbackName = String(
      product?.category_name ?? product?.category ?? 'Current category',
    ).trim();
    return [
      ...categories,
      { id: currentId, name: fallbackName ? `${fallbackName} (inactive)` : 'Current category (inactive)' },
    ];
  }, [categories, form.category_id, product?.category, product?.category_name]);

  const showCustomPetTypeInput = petTypeSelect === PET_TYPE_SELECT_OTHER;

  useEffect(() => {
    if (!categories.length) return;
    const resolved = categoryIdForForm(product, categories);
    if (!resolved) return;
    setForm((prev) => (prev.category_id === resolved ? prev : { ...prev, category_id: resolved }));
  }, [categories, product?.id, product?.category_id, product?.category, product?.category_name]);

  useEffect(() => {
    if (!product?.id) return;
    const nextForm = initialProductFormState(product);
    if (categories.length) {
      nextForm.category_id = categoryIdForForm(product, categories);
    }
    const nextVariants = variantsFromProduct(product);
    setForm(nextForm);
    setPetTypeSelect(petTypeSelectValueFromInput(nextForm.petTypeInput));
    setProductMode(detectProductMode(product));
    setSimpleSku(initialSimpleSkuFromProduct(product));
    setVariants(nextVariants);
    setVariantAxes(
      nextVariants.length > 0
        ? inferVariantAxesFromProduct(product, nextVariants)
        : presetVariantAxes('size_color'),
    );
    setDeliveryRegions(deliveryRegionsFromProduct(product));
    setCustomSpecs(customSpecRowsFromProduct(product));
    setProductGroupId(productGroupIdFromProduct(product));
  }, [product?.id, product?.gst_rate, product?.gstRate, product?.updated_at, categories]);

  const totalVariantStock = useMemo(
    () =>
      variants.reduce((sum, v) => {
        const n = parseInt(String(v.stock), 10);
        return sum + (Number.isFinite(n) ? Math.max(0, n) : 0);
      }, 0),
    [variants],
  );

  useEffect(() => {
    saveCommittedRef.current = false;
    pendingFileKeysRef.current.clear();
  }, [product?.id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiClient.get<{ commissionModel?: 'category' | 'ownership' | null }>(
          `/vendor/${sellerId}/ecommerce/commission-model`
        );
        if (!cancelled) {
          setCommissionModel(data.commissionModel ?? null);
        }
      } catch {
        if (!cancelled) setCommissionModel(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sellerId]);

  const registerPendingFileKey = useCallback((urls: string[], fileKey: string) => {
    registerPendingProductImageKey(pendingFileKeysRef.current, urls, fileKey);
  }, []);

  const handleClose = useCallback(async () => {
    if (!saveCommittedRef.current) {
      await discardAllPendingProductImages(sellerId, pendingFileKeysRef.current);
    }
    onClose();
  }, [sellerId, onClose]);

  const removePendingUploadFromS3 = useCallback(
    async (url: string) => {
      await removePendingProductImageByUrl(sellerId, pendingFileKeysRef.current, url);
    },
    [sellerId],
  );

  const uploadImages = async (files: FileList | File[]): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const result = await uploadProductImage(sellerId, file);
        const stableUrl = result.s3_url || result.displayUrl;
        registerPendingFileKey([stableUrl, result.displayUrl], result.fileKey);
        uploadedUrls.push(result.displayUrl || stableUrl);
      } catch (error) {
        console.warn('Image upload failed; using data URL for save:', error);
        const message = error instanceof Error ? error.message : 'Failed to upload image';
        try {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error('Failed to read image file'));
            reader.readAsDataURL(file);
          });
          uploadedUrls.push(dataUrl);
        } catch {
          toast.error(message || `Failed to upload ${file.name}`);
        }
      }
    }
    return uploadedUrls;
  };

  const removeSimpleImageAt = async (index: number) => {
    const url = simpleSku.images[index];
    if (url) await removePendingUploadFromS3(url);
    setSimpleSku({
      ...simpleSku,
      images: simpleSku.images.filter((_, i) => i !== index),
    });
  };

  const removeVariantImageAt = async (variantId: string, imgIdx: number) => {
    const variant = variants.find((v) => v.id === variantId);
    const url = variant?.images[imgIdx];
    if (url) await removePendingUploadFromS3(url);
    setVariants((prev) =>
      prev.map((v) =>
        v.id === variantId ? { ...v, images: v.images.filter((_, i) => i !== imgIdx) } : v,
      ),
    );
  };

  const handleSimpleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;
    try {
      setUploadingImages(true);
      const urls = await uploadImages(files);
      if (urls.length) setSimpleSku((prev) => ({ ...prev, images: [...prev.images, ...urls] }));
    } finally {
      setUploadingImages(false);
      event.target.value = '';
    }
  };

  const handleVariantImageUpload = async (variantId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;
    try {
      setUploadingImages(true);
      const urls = await uploadImages(files);
      if (urls.length) {
        setVariants((prev) =>
          prev.map((v) =>
            v.id === variantId ? { ...v, images: [...v.images, ...urls] } : v,
          ),
        );
      }
    } finally {
      setUploadingImages(false);
      event.target.value = '';
    }
  };

  const switchToMultiMode = (axes: VariantAxisConfig[]) => {
    setProductMode('multi');
    setVariantAxes(axes);
    if (variants.length === 0) {
      const migrated =
        simpleSku.images.length > 0 || simpleSku.stock
          ? migrateSimpleSkuToFirstVariant(simpleSku, axes)
          : createEmptyVariant(axes);
      setVariants([migrated]);
    }
    setPendingAxisPick(false);
  };

  const requestAddVariant = () => {
    if (productMode === 'simple') {
      setPendingAxisPick(true);
      return;
    }
    if (variants.length === 0) {
      setPendingAxisPick(true);
      return;
    }
    const row = createEmptyVariant(variantAxes);
    setVariants((prev) => [...prev, row]);
  };

  const confirmAxisAndAdd = (axes: VariantAxisConfig[]) => {
    if (productMode === 'simple' && variants.length === 0) {
      switchToMultiMode(axes);
      return;
    }
    setProductMode('multi');
    setVariantAxes(axes);
    setPendingAxisPick(false);
    const row = createEmptyVariant(axes);
    if (variants.length === 0) {
      setVariants([row]);
    } else {
      setVariants((prev) => [...prev, row]);
    }
  };

  const switchToSimpleMode = () => {
    if (variants.length > 0) {
      const ok = window.confirm(
        'Switch to single product mode? Variant data will be discarded.',
      );
      if (!ok) return;
    }
    setProductMode('simple');
    setVariants([]);
    setPendingAxisPick(false);
  };

  const updateVariant = (id: string, field: keyof VariantRow, value: string | boolean) => {
    setVariants((prev) =>
      prev.map((v) => (v.id === id ? { ...v, [field]: value } : v)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (petTypeSelect === PET_TYPE_SELECT_OTHER && !form.petTypeInput.trim()) {
      toast.error('Enter the specific pet type (e.g. Birds, Rabbits)');
      return;
    }
    const err = validateProductForm({
      form,
      mode: productMode,
      variants,
      simpleSku,
      variantAxes,
      deliveryRegions,
      customSpecs,
      requiresListingOwnership,
    });
    if (err) {
      toast.error(err);
      return;
    }

    setSaving(true);
    try {
      const payload = buildVendorProductPayload({
        form,
        mode: productMode,
        variants,
        simpleSku,
        variantAxes,
        deliveryRegions,
        customSpecs,
        sellerId,
        productGroupId,
        stripImageUrl: stripAwsPresignFromProductImageUrl,
      });

      if (product?.id) {
        await apiClient.put(`/vendor/${sellerId}/products/${product.id}`, payload);
      } else {
        await apiClient.post(`/vendor/${sellerId}/products`, payload);
      }
      saveCommittedRef.current = true;
      pendingFileKeysRef.current.clear();
      onSave();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleCustomAxis = () => {
    const axes: VariantAxisConfig[] = [];
    for (let i = 0; i < MAX_VARIANT_ATTRIBUTES; i++) {
      const label = window.prompt(
        i === 0
          ? 'Custom variant attribute name (e.g. Flavour, Material):'
          : `Add another attribute? (${i + 1} of ${MAX_VARIANT_ATTRIBUTES}) — leave blank to finish:`,
      );
      if (label == null) return;
      const trimmed = String(label).trim();
      if (!trimmed) break;
      const axis = customVariantAxis(trimmed);
      if (!axis) {
        toast.error('Enter a valid attribute name');
        return;
      }
      if (axes.some((a) => a.key === axis.key)) {
        toast.error(`Attribute "${axis.label}" is already added`);
        return;
      }
      axes.push(axis);
      if (axes.length >= MAX_VARIANT_ATTRIBUTES) break;
    }
    if (axes.length === 0) return;
    confirmAxisAndAdd(axes);
  };

  const handlePresetSuggestion = (suggestionId: string) => {
    const preset = variantSuggestions.find((s) => s.id === suggestionId);
    if (!preset) return;
    confirmAxisAndAdd(variantAxesFromPresetSuggestion(preset));
  };

  const axisLabel =
    variantAxes.length === 0
      ? 'Variants'
      : variantAxes.map((a) => a.label).join(' & ');

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={() => void handleClose()}
    >
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 border-b border-slate-100 bg-white p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {product?.id ? 'Edit Product' : 'Add New Product'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">Fill in the details below</p>
          </div>
          <button type="button" onClick={() => void handleClose()} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-orange-500" />
              Basic Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Product Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Premium Dog Food"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="Describe your product..."
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Key Features</label>
                <textarea
                  value={form.keyFeatures}
                  onChange={(e) => setForm({ ...form, keyFeatures: e.target.value })}
                  rows={2}
                  placeholder="Bullet-style features (one per line)"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Brand <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  value={form.brand}
                  onChange={(e) => setForm({ ...form, brand: e.target.value })}
                  placeholder="e.g. Royal Canin (leave blank for unbranded)"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                />
              </div>
              {requiresListingOwnership && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Listing Ownership *
                  </label>
                  <select
                    required
                    value={form.listingOwnership}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        listingOwnership: e.target.value as '' | 'own_brand' | 'third_party',
                      })
                    }
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
                  >
                    <option value="">Select ownership</option>
                    <option value="own_brand">Own brand</option>
                    <option value="third_party">Third party</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Is this product your own brand or a third-party brand you sell?
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Pet Type</label>
                <select
                  value={petTypeSelect}
                  onChange={(e) => {
                    const next = e.target.value;
                    setPetTypeSelect(next);
                    if (next === PET_TYPE_SELECT_OTHER) {
                      if (isStandardVendorPetTypeInput(form.petTypeInput)) {
                        setForm({ ...form, petTypeInput: '' });
                      }
                      return;
                    }
                    setForm({ ...form, petTypeInput: next });
                  }}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                >
                  <option value="">Select pet type (optional)</option>
                  {VENDOR_PET_TYPE_SUGGESTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  <option value={PET_TYPE_SELECT_OTHER}>Other (specific pet)</option>
                </select>
                {showCustomPetTypeInput ? (
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Specific pet type *
                    </label>
                    <input
                      required
                      value={form.petTypeInput}
                      onChange={(e) => setForm({ ...form, petTypeInput: e.target.value })}
                      placeholder="e.g. Birds, Rabbits, Hamsters"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>
                ) : null}
                <p className="text-xs text-slate-500 mt-1">
                  Choose Dog or Cat, All pets if unknown or general, or Other for a specific pet.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Category *</label>
                <select
                  required
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
                >
                  <option value="">Select Category</option>
                  {categorySelectOptions.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              {product?.id ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">System SKU</label>
                  {product.sku ? (
                    <p className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 font-mono text-sm text-slate-700">
                      {String(product.sku)}
                    </p>
                  ) : (
                    <p className="w-full px-4 py-3 border border-amber-200 rounded-xl bg-amber-50 text-sm text-amber-800">
                      Not assigned yet — a system SKU will be generated when you save.
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-xs text-slate-500 pt-8">System SKU is assigned automatically when you save.</p>
                </div>
              )}
            </div>
          </div>

          {/* Physical & specs */}
          <div className="space-y-4 border-t border-slate-200 pt-6">
            <h3 className="font-semibold text-slate-900">Weight & Dimensions</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Weight (kg)</label>
                <DecimalInput
                  maxDecimals={3}
                  value={form.weightKg}
                  onChange={(v) => setForm({ ...form, weightKg: v })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Length (cm)</label>
                <DecimalInput
                  maxDecimals={1}
                  value={form.lengthCm}
                  onChange={(v) => setForm({ ...form, lengthCm: v })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Breadth (cm)</label>
                <DecimalInput
                  maxDecimals={1}
                  value={form.breadthCm}
                  onChange={(v) => setForm({ ...form, breadthCm: v })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Height (cm)</label>
                <DecimalInput
                  maxDecimals={1}
                  value={form.heightCm}
                  onChange={(v) => setForm({ ...form, heightCm: v })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Manufacturing Details</label>
              <textarea
                value={form.manufacturingDetails}
                onChange={(e) => setForm({ ...form, manufacturingDetails: e.target.value })}
                rows={2}
                placeholder="Country of origin, manufacturer, etc."
                className="w-full px-4 py-3 border border-slate-200 rounded-xl resize-none"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-slate-700">Product Specifications</label>
                <button
                  type="button"
                  onClick={() =>
                    setCustomSpecs((prev) => [
                      ...prev,
                      { id: `spec-${Date.now()}`, key: '', value: '' },
                    ])
                  }
                  className="text-sm text-orange-600"
                >
                  + Add spec
                </button>
              </div>
              {customSpecs.map((row) => (
                <div key={row.id} className="grid grid-cols-5 gap-2">
                  <input
                    value={row.key}
                    onChange={(e) =>
                      setCustomSpecs((prev) =>
                        prev.map((r) => (r.id === row.id ? { ...r, key: e.target.value } : r)),
                      )
                    }
                    placeholder="Key"
                    className="col-span-2 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                  <input
                    value={row.value}
                    onChange={(e) =>
                      setCustomSpecs((prev) =>
                        prev.map((r) => (r.id === row.id ? { ...r, value: e.target.value } : r)),
                      )
                    }
                    placeholder="Value"
                    className="col-span-2 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setCustomSpecs((prev) => prev.filter((r) => r.id !== row.id))}
                    className="text-red-500"
                  >
                    <Trash2 className="w-4 h-4 mx-auto" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-orange-500" />
              {productMode === 'multi' ? 'Shop listing preview' : 'Pricing & Inventory'}
            </h3>
            {productMode === 'multi' && listingPreview && (
              <div className="rounded-xl border border-orange-200 bg-orange-50/60 px-4 py-3 text-sm text-slate-800">
                <span className="font-medium">Customers see: </span>
                ₹{listingPreview.price.toLocaleString('en-IN')}
                <span className="text-slate-500 ml-2">
                  (lowest in-stock variant — set per variant below)
                </span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              {productMode === 'simple' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Price (₹) *</label>
                    <DecimalInput
                      required
                      value={form.basePrice}
                      onChange={(v) => setForm({ ...form, basePrice: v })}
                      placeholder="Product price"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>
                </>
              )}
              {productMode === 'simple' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Stock Quantity *</label>
                  <IntegerInput
                    required
                    value={simpleSku.stock}
                    onChange={(v) => setSimpleSku({ ...simpleSku, stock: v })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              )}
              {productMode === 'simple' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Barcode (EAN)</label>
                  <input
                    value={simpleSku.barcode}
                    onChange={(e) => setSimpleSku({ ...simpleSku, barcode: e.target.value })}
                    placeholder="Optional"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl font-mono text-sm"
                  />
                </div>
              )}
              {productMode === 'multi' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Total stock (auto)</label>
                  <div className="w-full px-4 py-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-900 font-semibold">
                    {totalVariantStock}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Sum of all variant stocks</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">HSN *</label>
                <input
                  required
                  value={form.hsn_code}
                  onChange={(e) =>
                    setForm({ ...form, hsn_code: e.target.value.replace(/\D/g, '').slice(0, 8) })
                  }
                  placeholder="4–8 digit code"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tax (GST %) *</label>
                <select
                  required
                  value={form.gst_rate}
                  onChange={(e) => setForm({ ...form, gst_rate: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
                >
                  <option value="">Select GST slab</option>
                  <option value="0">0%</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Product Icon</label>
                <input
                  value={form.emoji}
                  onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                  placeholder="📦"
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-2xl text-center"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
            >
              <option value="draft">Draft</option>
              <option value="pending">Submit for Approval</option>
              <option value="active">Active (if auto-approved)</option>
            </select>
          </div>

          {/* Simple product images */}
          {productMode === 'simple' && (
            <div className="border-t border-slate-200 pt-6 space-y-4">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-orange-500" />
                Product Images *
              </h3>
              <div className="flex items-center gap-4 flex-wrap">
                {simpleSku.images.map((image, index) => (
                  <div key={index} className="relative w-24 h-24 border-2 border-slate-200 rounded-xl overflow-hidden">
                    <img src={image} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => void removeSimpleImageAt(index)}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <TouchFilePicker
                  onFileChange={handleSimpleImageUpload}
                  accept="image/*"
                  multiple
                  disabled={uploadingImages}
                  className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl border-2 border-dashed border-slate-300 hover:border-orange-500"
                  innerClassName="flex w-full flex-col items-center justify-center p-1"
                >
                  <Upload className="mb-1 w-6 h-6 text-slate-400" />
                  <span className="text-xs text-slate-500">
                    {uploadingImages ? 'Compressing…' : 'Upload'}
                  </span>
                </TouchFilePicker>
              </div>
            </div>
          )}

          {/* Variants section */}
          <div className="border-t border-slate-200 pt-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-semibold text-slate-900">
                {productMode === 'multi' ? `Variants (${axisLabel})` : 'Product Variants'}
              </h3>
              <div className="flex items-center gap-2">
                {productMode === 'multi' ? (
                  <button
                    type="button"
                    onClick={switchToSimpleMode}
                    className="text-xs text-slate-600 hover:text-slate-900 px-2 py-1"
                  >
                    Single product mode
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={requestAddVariant}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200"
                >
                  <Plus className="w-4 h-4" />
                  Add Variant
                </button>
              </div>
            </div>

            {productMode === 'simple' && variants.length === 0 && !pendingAxisPick && (
              <p className="text-xs text-slate-500">
                No variants — this is a single SKU product. Click Add Variant if your product comes in different packs, sizes, colors, or other options.
              </p>
            )}

            {pendingAxisPick && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl space-y-3">
                <p className="text-sm font-medium text-slate-800">What varies between variants?</p>
                {selectedCategoryName ? (
                  <p className="text-xs text-slate-600">
                    Suggestions for {selectedCategoryName} — you can still enter any attribute manually.
                  </p>
                ) : (
                  <p className="text-xs text-slate-600">
                    Select a category above for tailored suggestions, or pick a preset below.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {variantSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() => handlePresetSuggestion(suggestion.id)}
                      className="px-3 py-1.5 text-sm bg-white border border-orange-300 rounded-lg hover:bg-orange-100"
                      title={suggestion.description}
                    >
                      {suggestion.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleCustomAxis}
                    className="px-3 py-1.5 text-sm bg-white border border-orange-300 rounded-lg hover:bg-orange-100"
                  >
                    Custom…
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingAxisPick(false)}
                    className="px-3 py-1.5 text-sm text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {productMode === 'multi' && variants.length > 0 && (
              <div className="space-y-3">
                {variants.map((variant, idx) => {
                  const effMrp = effectiveVariantMrp(variant);
                  const effPrice = effectiveVariantPrice(variant);
                  return (
                    <div key={variant.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-slate-700">Variant #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const next = variants.filter((v) => v.id !== variant.id);
                            setVariants(next);
                            if (next.length === 0) setProductMode('simple');
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {variantAxes.map((axis) => (
                          <div key={axis.key}>
                            <label className="block text-xs text-slate-600 mb-1">{axis.label} *</label>
                            <input
                              type="text"
                              value={variant.optionValues[axis.key] ?? ''}
                              onChange={(e) =>
                                setVariants(updateVariantOptionValue(variants, variant.id, axis.key, e.target.value))
                              }
                              className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg"
                              placeholder={
                                axis.preset === 'pack'
                                  ? 'e.g., 1X100'
                                  : axis.preset === 'weight'
                                    ? 'e.g., 500g'
                                    : axis.key === 'size'
                                      ? 'e.g., Small, Medium'
                                      : axis.key === 'color'
                                        ? 'e.g., Red, Blue'
                                        : `Enter ${axis.label.toLowerCase()}`
                              }
                            />
                          </div>
                        ))}
                        <div>
                          <label className="block text-xs text-slate-600 mb-1">Price (₹) *</label>
                          <DecimalInput
                            required
                            value={variant.price}
                            onChange={(v) => updateVariant(variant.id, 'price', v)}
                            placeholder="Variant price"
                            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-600 mb-1">Stock *</label>
                          <IntegerInput
                            value={variant.stock}
                            onChange={(v) => updateVariant(variant.id, 'stock', v)}
                            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-600 mb-1">Barcode (EAN)</label>
                          <input
                            value={variant.barcode ?? ''}
                            onChange={(e) => updateVariant(variant.id, 'barcode', e.target.value)}
                            className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg font-mono"
                            placeholder="Optional"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs text-slate-600 mb-1">System SKU</label>
                          <p className="text-xs font-mono text-slate-600 px-3 py-1.5 bg-slate-100 rounded-lg">
                            {variant.systemSku || (isSkuUuid(variant.skuRowId) ? 'Assigned on save' : 'Assigned on save')}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs text-slate-600 mb-1">Variant images *</label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {variant.images.map((img, imgIdx) => (
                              <div key={imgIdx} className="relative h-16 w-16 rounded-lg overflow-hidden border border-slate-200">
                                <img src={img} alt="" className="h-full w-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => void removeVariantImageAt(variant.id, imgIdx)}
                                  className="absolute top-0 right-0 bg-red-500 text-white rounded-bl p-0.5"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                            <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 hover:border-orange-500">
                              <Upload className="w-4 h-4 text-slate-400" />
                              <span className="text-[10px] text-slate-500">Add</span>
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(e) => handleVariantImageUpload(variant.id, e)}
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Delivery regions */}
          <div className="border-t border-slate-200 pt-6 space-y-4">
            <label className="block text-sm font-medium text-slate-700 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Delivery Regions (cities)
            </label>
            <p className="text-xs text-slate-500">
              Leave empty to ship everywhere. City aliases are resolved automatically (e.g. &quot;Bangalore&quot; → &quot;Bengaluru&quot;).
            </p>
            <div className="flex gap-2 flex-wrap">
              {/* Datalist provides browser autocomplete from canonical city names */}
              <datalist id="city-suggestions">
                {KNOWN_CANONICAL_CITIES.map((c) => (
                  <option key={c} value={displayCityName(c)} />
                ))}
              </datalist>
              <input
                list="city-suggestions"
                value={deliveryCityInput}
                onChange={(e) => setDeliveryCityInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const canonical = resolveCityToCanonical(deliveryCityInput.trim());
                    if (!canonical) return;
                    if (deliveryRegions.includes(canonical)) {
                      toast.error('City already added');
                      return;
                    }
                    setDeliveryRegions([...deliveryRegions, canonical]);
                    setDeliveryCityInput('');
                  }
                }}
                placeholder="Type city name, press Enter to add"
                className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm min-w-[180px]"
              />
              <button
                type="button"
                onClick={() => {
                  const canonical = resolveCityToCanonical(deliveryCityInput.trim());
                  if (!canonical) return;
                  if (deliveryRegions.includes(canonical)) {
                    toast.error('City already added');
                    return;
                  }
                  setDeliveryRegions([...deliveryRegions, canonical]);
                  setDeliveryCityInput('');
                }}
                className="px-4 py-2 text-sm bg-orange-50 text-orange-700 rounded-xl"
              >
                Add
              </button>
              <button
                type="button"
                title="Clear all restrictions — product ships to every city"
                onClick={() => setDeliveryRegions([])}
                className="px-4 py-2 text-sm bg-green-50 text-green-700 rounded-xl whitespace-nowrap"
              >
                Ship everywhere
              </button>
            </div>
            {deliveryRegions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {deliveryRegions.map((region) => (
                  <span
                    key={region}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm"
                  >
                    {displayCityName(region)}
                    <button
                      type="button"
                      onClick={() => setDeliveryRegions(deliveryRegions.filter((r) => r !== region))}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => void handleClose()}
              className="flex-1 py-3 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploadingImages}
              className="flex-1 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : product?.id ? 'Update Product' : 'Create Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
