'use client';

import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { uploadImageWithProgress } from '@/lib/photo-upload-enhanced';
import { TouchFilePicker } from '@/components/shared/TouchFilePicker';
import {
  ALLERGEN_OPTIONS,
  DAY_OF_WEEK_OPTIONS,
  DELIVERY_FREQUENCY_OPTIONS,
  MEAL_CATEGORY_OPTIONS,
  MEDICAL_TAG_OPTIONS,
  MEALS_PER_DELIVERY_PRESET_OPTIONS,
  PREPARATION_TYPE_OPTIONS,
  PURCHASE_TYPE_OPTIONS,
  RECOMMENDED_PLAN_WEEKS_OPTIONS,
  type MealsPerDayPreset,
  type MealsPerDeliveryPreset,
} from '@/lib/meal-product-catalog';

const FEEDING_MAX = 2000;
const STORAGE_MAX = 1000;

export interface MealProductModalProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  metadata?: unknown;
  duration_days?: number;
  prep_time_minutes?: number;
  lead_time_hours?: number;
  order_cutoff_time?: string;
}

function SectionTitle({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h3
      id={id}
      className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3 mt-1"
    >
      {children}
    </h3>
  );
}

function parseMetadata(product: MealProductModalProduct | null): Record<string, unknown> {
  if (!product?.metadata) return {};
  const m = product.metadata;
  if (typeof m === 'string') {
    try {
      return JSON.parse(m) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return typeof m === 'object' && m !== null ? (m as Record<string, unknown>) : {};
}

function defaultForm() {
  return {
    name: '',
    description: '',
    price: '',
    ingredientChips: [] as string[],
    ingredientInput: '',
    calories: '',
    protein: '',
    dietType: 'Non-Veg',
    petTypes: ['Dog'] as string[],
    preparationTime: '60',
    leadTimeHours: '24',
    orderCutoffTime: '18:00',
    mealImageUrl: '',
    mealCategories: [] as string[],
    categoryQuery: '',
    medicalTags: [] as string[],
    feedingInstructions: '',
    storageInstructions: '',
    shelfLifeDays: '7',
    purchaseType: 'ONE_TIME' as (typeof PURCHASE_TYPE_OPTIONS)[number]['value'],
    deliveryDays: [] as string[],
    mealsPerDeliveryPreset: '2' as MealsPerDeliveryPreset,
    mealsPerDeliveryCustom: '',
    deliveryFrequency: '' as '' | (typeof DELIVERY_FREQUENCY_OPTIONS)[number]['value'],
    subscriptionPrice: '',
    recommendedPlanWeeks: '' as '' | '1' | '2' | '4',
    mealsPerDayPreset: '2' as MealsPerDayPreset,
    mealsPerDayCustom: '',
    allergens: [] as string[],
    preparationType: 'FRESH_COOKED' as (typeof PREPARATION_TYPE_OPTIONS)[number]['value'],
    suitableFor: [] as string[],
  };
}

export type MealProductFormState = ReturnType<typeof defaultForm>;

export interface MealProductFormModalProps {
  open: boolean;
  onClose: () => void;
  vendorId: string;
  editingProduct: MealProductModalProduct | null;
  /** Called with API payload; should throw on failure so the modal stays open. */
  onSave: (args: { payload: Record<string, unknown>; editingId: string | null }) => Promise<void>;
}

export function MealProductFormModal({
  open,
  onClose,
  vendorId,
  editingProduct,
  onSave,
}: MealProductFormModalProps) {
  const titleId = useId();
  const [form, setForm] = useState(defaultForm);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingMealImage, setUploadingMealImage] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [leadBounds, setLeadBounds] = useState({ min: 0, max: 72, defaultHours: 24 });
  const [sameDayEnabled, setSameDayEnabled] = useState(false);

  const handleMealImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingMealImage(true);
    try {
      const res = await uploadImageWithProgress(file, `meal-products/${vendorId}`, { verifyUpload: false });
      if (!res.success || !(res.url || res.publicUrl)) {
        toast.error(res.error || 'Image upload failed');
        return;
      }
      // Prefer presigned display URL (works for private buckets); raw publicUrl often 403s in <img>.
      const url = (res.url || res.publicUrl || '').trim();
      setForm((prev) => ({ ...prev, mealImageUrl: url }));
      toast.success('Meal image uploaded');
    } finally {
      setUploadingMealImage(false);
    }
  };

  const seedFromProduct = useCallback(() => {
    if (!editingProduct) {
      setForm(defaultForm());
      return;
    }
    const md = parseMetadata(editingProduct);
    const ingredientsRaw = md.ingredients;
    let ingredientChips: string[] = [];
    if (Array.isArray(ingredientsRaw)) {
      ingredientChips = ingredientsRaw.map((x) => String(x).trim()).filter(Boolean);
    } else if (typeof ingredientsRaw === 'string') {
      ingredientChips = ingredientsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    const presetRaw = md.mealsPerDayPreset;
    let mealsPerDayPreset: MealsPerDayPreset = '2';
    if (presetRaw === '1' || presetRaw === '2' || presetRaw === '3' || presetRaw === 'CUSTOM') {
      mealsPerDayPreset = presetRaw;
    } else if (typeof md.mealsPerDay === 'number') {
      const n = md.mealsPerDay;
      if (n === 1) mealsPerDayPreset = '1';
      else if (n === 3) mealsPerDayPreset = '3';
      else mealsPerDayPreset = '2';
    }

    setForm({
      ...defaultForm(),
      name: editingProduct.name || '',
      description: (editingProduct.description as string) || '',
      price: editingProduct.price != null ? String(editingProduct.price) : '',
      ingredientChips,
      ingredientInput: '',
      calories: String((md.nutritionalValue as Record<string, unknown>)?.calories ?? ''),
      protein: String((md.nutritionalValue as Record<string, unknown>)?.protein ?? ''),
      dietType: (md.dietType as string) || 'Non-Veg',
      petTypes: Array.isArray(md.petTypes) && md.petTypes.length ? (md.petTypes as string[]) : ['Dog'],
      preparationTime: String(
        md.prepTimeMinutes ??
          editingProduct.prep_time_minutes ??
          md.preparationLeadTime ??
          '60',
      ),
      leadTimeHours: String(
        md.leadTimeHours ??
          editingProduct.lead_time_hours ??
          leadBounds.defaultHours,
      ),
      orderCutoffTime: String(
        (md.orderCutoffTime as string) ||
          editingProduct.order_cutoff_time ||
          '18:00',
      ),
      mealImageUrl: (md.mealImageUrl as string) || '',
      mealCategories: Array.isArray(md.mealCategories) ? (md.mealCategories as string[]) : [],
      categoryQuery: '',
      medicalTags: Array.isArray(md.medicalConditionTags) ? (md.medicalConditionTags as string[]) : [],
      feedingInstructions: (md.feedingInstructions as string) || '',
      storageInstructions: (md.storageInstructions as string) || '',
      shelfLifeDays: String(md.shelfLifeDays ?? md.shelfLife ?? '7'),
      purchaseType: (() => {
        const pt = String(md.purchaseType || '').toUpperCase();
        if (pt === 'WEEKLY_PLAN' || pt === 'MONTHLY_PLAN' || pt === 'ONE_TIME') return pt as MealProductFormState['purchaseType'];
        const dt = String(md.deliveryType || '').toUpperCase();
        if (dt === 'WEEKLY_SUBSCRIPTION') return 'WEEKLY_PLAN';
        if (dt === 'MONTHLY_SUBSCRIPTION') return 'MONTHLY_PLAN';
        return 'ONE_TIME';
      })(),
      deliveryDays: Array.isArray(md.deliveryDays)
        ? (md.deliveryDays as unknown[]).map((x) => String(x).toUpperCase()).filter(Boolean)
        : [],
      mealsPerDeliveryPreset: (() => {
        const pr = md.mealsPerDeliveryPreset;
        if (pr === '1' || pr === '2' || pr === '3' || pr === 'CUSTOM') return pr as MealsPerDeliveryPreset;
        return '2';
      })(),
      mealsPerDeliveryCustom:
        md.mealsPerDeliveryPreset === 'CUSTOM' ? String(md.mealsPerDeliveryCustom ?? md.mealsPerDelivery ?? '') : '',
      deliveryFrequency: (() => {
        const f = String(md.deliveryFrequency || '').toUpperCase();
        if (DELIVERY_FREQUENCY_OPTIONS.some((x) => x.value === f)) return f as MealProductFormState['deliveryFrequency'];
        return '';
      })(),
      subscriptionPrice:
        md.subscriptionPrice != null && md.subscriptionPrice !== '' ? String(md.subscriptionPrice) : '',
      recommendedPlanWeeks: (() => {
        const w = md.recommendedPlanLengthWeeks;
        const n = typeof w === 'number' ? w : parseInt(String(w || ''), 10);
        if (n === 1 || n === 2 || n === 4) return String(n) as '1' | '2' | '4';
        return '';
      })(),
      mealsPerDayPreset,
      mealsPerDayCustom: (md.mealsPerDayCustom as string) || '',
      allergens: Array.isArray(md.allergens) ? (md.allergens as string[]) : [],
      preparationType: (PREPARATION_TYPE_OPTIONS.some((p) => p.value === md.preparationType)
        ? md.preparationType
        : 'FRESH_COOKED') as MealProductFormState['preparationType'],
      suitableFor: Array.isArray(md.suitableFor) ? (md.suitableFor as string[]) : [],
    });
  }, [editingProduct, leadBounds.defaultHours]);

  useEffect(() => {
    if (!open) return;
    apiClient
      .get<{
        success?: boolean;
        bounds?: { minHours: number; maxHours: number; defaultHours: number };
        sameDay?: { enabled: boolean };
        orderCutoff?: { time: string };
      }>('/vendor/meal-booking-policy')
      .then((res) => {
        if (res?.bounds) {
          setLeadBounds({
            min: res.bounds.minHours,
            max: res.bounds.maxHours,
            defaultHours: res.bounds.defaultHours,
          });
        }
        if (res?.sameDay) setSameDayEnabled(!!res.sameDay.enabled);
      })
      .catch(() => undefined);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    seedFromProduct();
    setFieldErrors({});
  }, [open, seedFromProduct]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const filteredCategories = useMemo(() => {
    const q = form.categoryQuery.trim().toLowerCase();
    if (!q) return [...MEAL_CATEGORY_OPTIONS];
    return MEAL_CATEGORY_OPTIONS.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [form.categoryQuery]);

  const toggleCategory = (value: string) => {
    setForm((prev) => {
      const has = prev.mealCategories.includes(value);
      return {
        ...prev,
        mealCategories: has ? prev.mealCategories.filter((v) => v !== value) : [...prev.mealCategories, value],
      };
    });
  };

  const toggleDeliveryDay = (value: string) => {
    setForm((prev) => {
      const has = prev.deliveryDays.includes(value);
      return {
        ...prev,
        deliveryDays: has ? prev.deliveryDays.filter((v) => v !== value) : [...prev.deliveryDays, value],
      };
    });
  };

  const weeklyPreview = useMemo(() => {
    if (form.purchaseType !== 'WEEKLY_PLAN') return null;
    const base = parseFloat(form.price);
    const sub = parseFloat(form.subscriptionPrice);
    const mpd =
      form.mealsPerDeliveryPreset === 'CUSTOM'
        ? parseInt(form.mealsPerDeliveryCustom.trim(), 10) || 2
        : parseInt(form.mealsPerDeliveryPreset, 10) || 2;
    const perDelivery = !Number.isNaN(sub) && sub > 0 ? sub : !Number.isNaN(base) && base > 0 ? Math.round(base * mpd * 100) / 100 : 0;
    const nDel = Math.max(1, form.deliveryDays.length);
    const weeklyTotal = perDelivery > 0 ? Math.round(perDelivery * nDel * 100) / 100 : 0;
    return { perDelivery, nDel, weeklyTotal, mpd };
  }, [form.purchaseType, form.price, form.subscriptionPrice, form.mealsPerDeliveryPreset, form.mealsPerDeliveryCustom, form.deliveryDays]);

  const monthlyPreview = useMemo(() => {
    if (form.purchaseType !== 'MONTHLY_PLAN') return null;
    const base = parseFloat(form.price);
    const sub = parseFloat(form.subscriptionPrice);
    const mpd =
      form.mealsPerDayPreset === 'CUSTOM'
        ? parseInt(form.mealsPerDayCustom.trim(), 10) || 2
        : parseInt(form.mealsPerDayPreset, 10) || 2;
    const perDay = !Number.isNaN(sub) && sub > 0 ? sub : !Number.isNaN(base) && base > 0 ? Math.round(base * mpd * 100) / 100 : 0;
    const monthly = perDay > 0 ? Math.round(perDay * 30 * 100) / 100 : 0;
    return { perDay, monthly, mpd };
  }, [form.purchaseType, form.price, form.subscriptionPrice, form.mealsPerDayPreset, form.mealsPerDayCustom]);

  const toggleInList = (key: 'medicalTags' | 'allergens', value: string) => {
    setForm((prev) => {
      const list = prev[key];
      const has = list.includes(value);
      return {
        ...prev,
        [key]: has ? list.filter((v) => v !== value) : [...list, value],
      };
    });
  };

  const addIngredientChip = () => {
    const t = form.ingredientInput.trim();
    if (!t) return;
    const lower = t.toLowerCase();
    setForm((prev) => {
      if (prev.ingredientChips.some((x) => x.toLowerCase() === lower)) {
        return { ...prev, ingredientInput: '' };
      }
      return {
        ...prev,
        ingredientChips: [...prev.ingredientChips, t],
        ingredientInput: '',
      };
    });
  };

  const validate = (): boolean => {
    const err: Record<string, string> = {};
    if (!form.name.trim()) err.name = 'Meal name is required';
    if (!form.description.trim()) err.description = 'Description is required';
    const price = parseFloat(form.price);
    if (Number.isNaN(price) || price <= 0) err.price = 'Enter a valid price';
    if (!form.mealImageUrl.trim()) err.mealImageUrl = 'Meal image is required';
    if (!form.mealCategories.length) err.mealCategories = 'Select at least one meal category';
    if (!form.petTypes.length) err.petTypes = 'Select at least one pet type';
    if (!form.ingredientChips.length) err.ingredients = 'Add at least one ingredient';
    if (!PREPARATION_TYPE_OPTIONS.some((o) => o.value === form.preparationType)) {
      err.preparationType = 'Select a preparation type';
    }
    if (!PURCHASE_TYPE_OPTIONS.some((o) => o.value === form.purchaseType)) {
      err.purchaseType = 'Select a purchase option';
    }
    if (form.purchaseType === 'WEEKLY_PLAN') {
      if (!form.deliveryDays.length) err.deliveryDays = 'Select at least one delivery day';
      if (form.mealsPerDeliveryPreset === 'CUSTOM') {
        const n = parseInt(form.mealsPerDeliveryCustom.trim(), 10);
        if (!Number.isFinite(n) || n < 1) err.mealsPerDeliveryCustom = 'Enter meals per delivery';
      }
    }
    if (form.purchaseType === 'MONTHLY_PLAN') {
      if (!form.deliveryFrequency) err.deliveryFrequency = 'Select delivery frequency';
      if (form.mealsPerDayPreset === 'CUSTOM') {
        const n = parseInt(form.mealsPerDayCustom.trim(), 10);
        if (!Number.isFinite(n) || n < 1) err.mealsPerDayCustom = 'Enter meals per day';
      }
    }
    const prepMins = parseInt(String(form.preparationTime).trim(), 10);
    if (!Number.isFinite(prepMins) || prepMins < 1 || prepMins > 24 * 60) {
      err.preparationTime = 'Prep time is required (1–1440 minutes)';
    }
    const leadHrs = parseInt(String(form.leadTimeHours).trim(), 10);
    if (!Number.isFinite(leadHrs) || leadHrs < leadBounds.min || leadHrs > leadBounds.max) {
      err.leadTimeHours = `Lead time must be ${leadBounds.min}–${leadBounds.max} hours`;
    }
    if (!/^([01]?\d|2[0-3]):([0-5]\d)$/.test(form.orderCutoffTime.trim())) {
      err.orderCutoffTime = 'Enter cutoff as HH:mm (e.g. 18:00)';
    }
    const shelf = parseInt(form.shelfLifeDays, 10);
    if (Number.isNaN(shelf) || shelf < 1 || shelf > 365) err.shelfLifeDays = 'Shelf life must be between 1 and 365 days';
    if (form.feedingInstructions.length > FEEDING_MAX) err.feedingInstructions = `Max ${FEEDING_MAX} characters`;
    if (form.storageInstructions.length > STORAGE_MAX) err.storageInstructions = `Max ${STORAGE_MAX} characters`;
    if (form.purchaseType === 'ONE_TIME' && form.mealsPerDayPreset === 'CUSTOM' && !form.mealsPerDayCustom.trim()) {
      err.mealsPerDayCustom = 'Describe the custom meal frequency';
    }
    setFieldErrors(err);
    return Object.keys(err).length === 0;
  };

  const buildPayload = (): Record<string, unknown> => {
    const price = parseFloat(form.price);
    const shelfLifeDays = parseInt(form.shelfLifeDays, 10);
    const preparationLeadTime = parseInt(String(form.preparationTime).trim(), 10);
    const leadTimeHours = parseInt(String(form.leadTimeHours).trim(), 10);
    const orderCutoffTime = form.orderCutoffTime.trim();

    const subPriceRaw = form.subscriptionPrice.trim();
    const subscriptionPrice =
      subPriceRaw !== '' && !Number.isNaN(parseFloat(subPriceRaw)) && parseFloat(subPriceRaw) > 0
        ? parseFloat(subPriceRaw)
        : undefined;

    const recommendedPlanLengthWeeks =
      form.recommendedPlanWeeks === '1' || form.recommendedPlanWeeks === '2' || form.recommendedPlanWeeks === '4'
        ? parseInt(form.recommendedPlanWeeks, 10)
        : undefined;

    let mealsPerDelivery: number | undefined;
    if (form.purchaseType === 'WEEKLY_PLAN') {
      if (form.mealsPerDeliveryPreset === 'CUSTOM') {
        mealsPerDelivery = parseInt(form.mealsPerDeliveryCustom.trim(), 10) || undefined;
      } else {
        mealsPerDelivery = parseInt(form.mealsPerDeliveryPreset, 10) || undefined;
      }
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      description: form.description.trim(),
      price,
      mealImageUrl: form.mealImageUrl.trim(),
      ingredients: form.ingredientChips,
      mealCategories: form.mealCategories,
      medicalConditionTags: form.medicalTags,
      feedingInstructions: form.feedingInstructions.trim() || undefined,
      storageInstructions: form.storageInstructions.trim() || undefined,
      shelfLifeDays,
      purchaseType: form.purchaseType,
      deliveryDays: form.purchaseType === 'WEEKLY_PLAN' ? [...form.deliveryDays] : [],
      mealsPerDeliveryPreset: form.purchaseType === 'WEEKLY_PLAN' ? form.mealsPerDeliveryPreset : '2',
      mealsPerDeliveryCustom:
        form.purchaseType === 'WEEKLY_PLAN' && form.mealsPerDeliveryPreset === 'CUSTOM'
          ? form.mealsPerDeliveryCustom.trim() || undefined
          : undefined,
      mealsPerDelivery,
      deliveryFrequency: form.purchaseType === 'MONTHLY_PLAN' ? form.deliveryFrequency || undefined : undefined,
      subscriptionPrice,
      recommendedPlanLengthWeeks,
      mealsPerDayPreset: form.mealsPerDayPreset,
      mealsPerDayCustom:
        form.mealsPerDayPreset === 'CUSTOM' ? form.mealsPerDayCustom.trim() || undefined : undefined,
      allergens: form.allergens,
      preparationType: form.preparationType,
      nutritionalValue: {
        calories: form.calories.trim(),
        protein: form.protein.trim(),
      },
      dietType: form.dietType,
      suitableFor: form.suitableFor,
      petTypes: form.petTypes,
      preparationLeadTime,
      prepTimeMinutes: preparationLeadTime,
      leadTimeHours,
      orderCutoffTime,
    };
    return payload;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await onSave({
        payload: buildPayload(),
        editingId: editingProduct?.id ?? null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white rounded-2xl w-full max-w-3xl max-h-[min(92vh,880px)] shadow-xl flex flex-col overflow-hidden border border-slate-200/80"
      >
        <div className="px-5 py-4 border-b border-slate-100 flex-shrink-0 bg-gradient-to-r from-slate-50 to-white">
          <h2 id={titleId} className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <span className="text-emerald-600" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
                <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2M7 2v20M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
              </svg>
            </span>
            {editingProduct ? 'Edit meal product' : 'Add meal product'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Required: meal name, description, image, price, prep time (minutes), lead time (hours), order cutoff,
            categories, pet types, ingredients, preparation type, purchase options, and shelf life (days).
          </p>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain px-5 py-4 space-y-8">
          {/* Basic */}
          <section aria-labelledby={`${titleId}-basic`}>
            <SectionTitle id={`${titleId}-basic`}>Basic info</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="meal-name">
                  Meal name <span className="text-red-500">*</span>
                </label>
                <input
                  id="meal-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className={`w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 ${
                    fieldErrors.name ? 'border-red-300' : 'border-slate-200'
                  }`}
                  placeholder="e.g. Chicken & rice bowl"
                  autoComplete="off"
                />
                {fieldErrors.name ? <p className="text-xs text-red-600 mt-1">{fieldErrors.name}</p> : null}
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="meal-desc">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="meal-desc"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  className={`w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 ${
                    fieldErrors.description ? 'border-red-300' : 'border-slate-200'
                  }`}
                  placeholder="What makes this meal special?"
                />
                {fieldErrors.description ? (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.description}</p>
                ) : null}
              </div>
              <div className="md:col-span-2">
                <span className="block text-sm font-medium text-slate-700 mb-1">
                  Meal image <span className="text-red-500">*</span>
                </span>
                <p className="text-xs text-slate-500 mb-2">One photo — JPEG, PNG, or WebP up to 10MB.</p>
                <div
                  className={`flex flex-wrap items-center gap-3 rounded-xl p-1 -m-1 ${
                    fieldErrors.mealImageUrl ? 'ring-2 ring-red-200 bg-red-50/40' : ''
                  }`}
                >
                  <TouchFilePicker
                    onFileChange={handleMealImageFile}
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    disabled={uploadingMealImage}
                    className="inline-block min-h-[2.5rem] min-w-[7rem] rounded-xl"
                    innerClassName="items-center justify-center"
                  >
                    <span className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-800 focus-within:ring-2 focus-within:ring-emerald-500/40">
                      {uploadingMealImage ? 'Uploading…' : form.mealImageUrl ? 'Replace image' : 'Upload image'}
                    </span>
                  </TouchFilePicker>
                  {form.mealImageUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={form.mealImageUrl}
                        alt="Meal preview"
                        className="h-16 w-16 rounded-xl object-cover border border-slate-200"
                      />
                      <button
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, mealImageUrl: '' }))}
                        className="text-sm text-red-600 hover:underline focus:outline-none focus:ring-2 focus:ring-red-200 rounded"
                      >
                        Remove
                      </button>
                    </>
                  ) : null}
                </div>
                {fieldErrors.mealImageUrl ? (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.mealImageUrl}</p>
                ) : null}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="meal-price">
                  Price (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  id="meal-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                  className={`w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 ${
                    fieldErrors.price ? 'border-red-300' : 'border-slate-200'
                  }`}
                />
                {fieldErrors.price ? <p className="text-xs text-red-600 mt-1">{fieldErrors.price}</p> : null}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="prep-time">
                  Prep time (min) <span className="text-red-500">*</span>
                </label>
                <input
                  id="prep-time"
                  type="number"
                  min={1}
                  max={1440}
                  required
                  value={form.preparationTime}
                  onChange={(e) => setForm((p) => ({ ...p, preparationTime: e.target.value }))}
                  className={`w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 ${
                    fieldErrors.preparationTime ? 'border-red-300' : 'border-slate-200'
                  }`}
                  aria-invalid={Boolean(fieldErrors.preparationTime)}
                  aria-describedby={fieldErrors.preparationTime ? 'prep-time-error' : undefined}
                />
                {fieldErrors.preparationTime ? (
                  <p id="prep-time-error" className="text-xs text-red-600 mt-1">
                    {fieldErrors.preparationTime}
                  </p>
                ) : null}
                <p className="text-xs text-slate-500 mt-1">Kitchen time to prepare one order.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="lead-time-hrs">
                  Lead time (hrs) <span className="text-red-500">*</span>
                </label>
                <input
                  id="lead-time-hrs"
                  type="number"
                  min={leadBounds.min}
                  max={leadBounds.max}
                  required
                  value={form.leadTimeHours}
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    const v = Number.isFinite(n) ? n : leadBounds.defaultHours;
                    setForm((p) => ({
                      ...p,
                      leadTimeHours: String(Math.min(leadBounds.max, Math.max(leadBounds.min, v))),
                    }));
                  }}
                  className={`w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 ${
                    fieldErrors.leadTimeHours ? 'border-red-300' : 'border-slate-200'
                  }`}
                />
                {fieldErrors.leadTimeHours ? (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.leadTimeHours}</p>
                ) : (
                  <p className="text-xs text-slate-500 mt-1">
                    How far in advance customers must order ({leadBounds.min}–{leadBounds.max}h).
                    {sameDayEnabled ? ' Lower values can allow same-day delivery.' : ''}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="order-cutoff">
                  Order cutoff <span className="text-red-500">*</span>
                </label>
                <input
                  id="order-cutoff"
                  type="time"
                  required
                  value={form.orderCutoffTime}
                  onChange={(e) => setForm((p) => ({ ...p, orderCutoffTime: e.target.value }))}
                  className={`w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 ${
                    fieldErrors.orderCutoffTime ? 'border-red-300' : 'border-slate-200'
                  }`}
                />
                {fieldErrors.orderCutoffTime ? (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.orderCutoffTime}</p>
                ) : (
                  <p className="text-xs text-slate-500 mt-1">Last time today customers can order for same-day rules.</p>
                )}
              </div>
              <div className="md:col-span-2">
                <span className="block text-sm font-medium text-slate-700 mb-1">
                  Meal categories <span className="text-red-500">*</span>
                </span>
                <input
                  type="search"
                  value={form.categoryQuery}
                  onChange={(e) => setForm((p) => ({ ...p, categoryQuery: e.target.value }))}
                  placeholder="Search categories…"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  aria-label="Search meal categories"
                />
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1 rounded-xl bg-slate-50 border border-slate-100">
                  {filteredCategories.map((opt) => {
                    const on = form.mealCategories.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleCategory(opt.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                          on
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {fieldErrors.mealCategories ? (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.mealCategories}</p>
                ) : null}
              </div>
              <div className="md:col-span-2">
                <span className="block text-sm font-medium text-slate-700 mb-1">Diet type</span>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Diet type">
                  {(['Non-Veg', 'Veg', 'Egg'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, dietType: type }))}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                        form.dietType === type ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <span className="block text-sm font-medium text-slate-700 mb-1">
                  Pet types <span className="text-red-500">*</span>
                </span>
                <div
                  className={`flex flex-wrap gap-2 rounded-xl p-1 -m-1 ${
                    fieldErrors.petTypes ? 'ring-2 ring-red-200 bg-red-50/40' : ''
                  }`}
                  role="group"
                  aria-label="Pet types"
                >
                  {(['Dog', 'Cat'] as const).map((type) => {
                    const on = form.petTypes.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            petTypes: on ? p.petTypes.filter((t) => t !== type) : [...p.petTypes, type],
                          }))
                        }
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                          on ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
                {fieldErrors.petTypes ? <p className="text-xs text-red-600 mt-1">{fieldErrors.petTypes}</p> : null}
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="ingredient-input">
                  Ingredients <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-slate-500 mb-2">Type an ingredient and press Enter — chips stay unique.</p>
                <div
                  className={`flex flex-wrap gap-2 items-center min-h-[2.75rem] px-3 py-2 border rounded-xl bg-white focus-within:ring-2 focus-within:ring-emerald-500/30 focus-within:border-emerald-500 ${
                    fieldErrors.ingredients ? 'border-red-300' : 'border-slate-200'
                  }`}
                >
                  {form.ingredientChips.map((chip) => (
                    <span
                      key={chip}
                      className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-lg bg-emerald-50 text-emerald-900 text-sm border border-emerald-100"
                    >
                      {chip}
                      <button
                        type="button"
                        className="p-0.5 rounded hover:bg-emerald-100 text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                        aria-label={`Remove ${chip}`}
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            ingredientChips: p.ingredientChips.filter((c) => c !== chip),
                          }))
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    id="ingredient-input"
                    type="text"
                    value={form.ingredientInput}
                    onChange={(e) => setForm((p) => ({ ...p, ingredientInput: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addIngredientChip();
                      }
                    }}
                    className="flex-1 min-w-[8rem] border-0 p-1 text-sm focus:ring-0 outline-none bg-transparent"
                    placeholder="Add ingredient…"
                  />
                </div>
                {fieldErrors.ingredients ? (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.ingredients}</p>
                ) : null}
              </div>
              <div className="md:col-span-2">
                <span className="block text-sm font-medium text-slate-700 mb-2">
                  Preparation type <span className="text-red-500">*</span>
                </span>
                <div
                  className={`grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-xl p-1 -m-1 ${
                    fieldErrors.preparationType ? 'ring-2 ring-red-200 bg-red-50/40' : ''
                  }`}
                >
                  {PREPARATION_TYPE_OPTIONS.map((opt) => {
                    const on = form.preparationType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, preparationType: opt.value }))}
                        className={`text-left rounded-xl border p-3 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                          on
                            ? 'border-emerald-500 bg-emerald-50 shadow-sm ring-1 ring-emerald-500/20'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="text-sm font-semibold text-slate-800">{opt.label}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{opt.hint}</div>
                      </button>
                    );
                  })}
                </div>
                {fieldErrors.preparationType ? (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.preparationType}</p>
                ) : null}
              </div>
            </div>
          </section>

          {/* Nutrition */}
          <section aria-labelledby={`${titleId}-nutrition`}>
            <SectionTitle id={`${titleId}-nutrition`}>Nutrition</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="calories">
                  Calories
                </label>
                <input
                  id="calories"
                  type="text"
                  value={form.calories}
                  onChange={(e) => setForm((p) => ({ ...p, calories: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  placeholder="e.g. 350 kcal"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="protein">
                  Protein
                </label>
                <input
                  id="protein"
                  type="text"
                  value={form.protein}
                  onChange={(e) => setForm((p) => ({ ...p, protein: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  placeholder="e.g. 25g"
                />
              </div>
            </div>
          </section>

          {/* Purchase options */}
          <section aria-labelledby={`${titleId}-purchase`} className="transition-all duration-200">
            <SectionTitle id={`${titleId}-purchase`}>Purchase options</SectionTitle>
            <div className="space-y-5">
              <div>
                <span className="block text-sm font-medium text-slate-700 mb-2">
                  How customers buy this meal <span className="text-red-500">*</span>
                </span>
                <div
                  className={`grid grid-cols-1 sm:grid-cols-3 gap-2 rounded-xl p-1 -m-1 ${
                    fieldErrors.purchaseType ? 'ring-2 ring-red-200 bg-red-50/40' : ''
                  }`}
                  role="tablist"
                  aria-label="Purchase type"
                >
                  {PURCHASE_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="tab"
                      aria-selected={form.purchaseType === opt.value}
                      onClick={() => setForm((p) => ({ ...p, purchaseType: opt.value }))}
                      className={`px-3 py-3 rounded-xl text-sm font-semibold border text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
                        form.purchaseType === opt.value
                          ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-orange-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {fieldErrors.purchaseType ? (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.purchaseType}</p>
                ) : null}
              </div>

              {form.purchaseType === 'ONE_TIME' ? (
                <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
                  <p className="text-xs text-slate-600">Single purchase — no recurring schedule on this SKU.</p>
                  <div>
                    <span className="block text-sm font-medium text-slate-700 mb-2">Suggested meals per day (optional)</span>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {(
                        [
                          ['1', '1×'],
                          ['2', '2×'],
                          ['3', '3×'],
                          ['CUSTOM', 'Custom'],
                        ] as const
                      ).map(([val, label]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setForm((p) => ({ ...p, mealsPerDayPreset: val }))}
                          className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
                            form.mealsPerDayPreset === val
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-600 border-slate-200'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {form.mealsPerDayPreset === 'CUSTOM' ? (
                      <div>
                        <label className="sr-only" htmlFor="meals-custom-ot">
                          Custom feeding frequency
                        </label>
                        <input
                          id="meals-custom-ot"
                          type="text"
                          value={form.mealsPerDayCustom}
                          onChange={(e) => setForm((p) => ({ ...p, mealsPerDayCustom: e.target.value }))}
                          placeholder="e.g. Every 4 hours for puppies"
                          className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 ${
                            fieldErrors.mealsPerDayCustom ? 'border-red-300' : 'border-slate-200'
                          }`}
                        />
                        {fieldErrors.mealsPerDayCustom ? (
                          <p className="text-xs text-red-600 mt-1">{fieldErrors.mealsPerDayCustom}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {form.purchaseType === 'WEEKLY_PLAN' ? (
                <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-4 space-y-4 transition-opacity duration-200">
                  <div>
                    <span className="block text-sm font-medium text-slate-800 mb-2">
                      Delivery days <span className="text-red-500">*</span>
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {DAY_OF_WEEK_OPTIONS.map((d) => {
                        const on = form.deliveryDays.includes(d.value);
                        return (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => toggleDeliveryDay(d.value)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
                              on
                                ? 'bg-orange-500 text-white border-orange-500'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-orange-300'
                            }`}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                    {fieldErrors.deliveryDays ? (
                      <p className="text-xs text-red-600 mt-1">{fieldErrors.deliveryDays}</p>
                    ) : null}
                  </div>

                  <div>
                    <span className="block text-sm font-medium text-slate-800 mb-2">
                      Meals per delivery <span className="text-red-500">*</span>
                    </span>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {MEALS_PER_DELIVERY_PRESET_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setForm((p) => ({ ...p, mealsPerDeliveryPreset: opt.value }))}
                          className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
                            form.mealsPerDeliveryPreset === opt.value
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-600 border-slate-200'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {form.mealsPerDeliveryPreset === 'CUSTOM' ? (
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={form.mealsPerDeliveryCustom}
                        onChange={(e) => setForm((p) => ({ ...p, mealsPerDeliveryCustom: e.target.value }))}
                        placeholder="Number of meals"
                        className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 ${
                          fieldErrors.mealsPerDeliveryCustom ? 'border-red-300' : 'border-slate-200'
                        }`}
                      />
                    ) : null}
                    {fieldErrors.mealsPerDeliveryCustom ? (
                      <p className="text-xs text-red-600 mt-1">{fieldErrors.mealsPerDeliveryCustom}</p>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="sub-price-weekly">
                        Subscription price (₹ / delivery) <span className="text-slate-400 font-normal">optional</span>
                      </label>
                      <input
                        id="sub-price-weekly"
                        type="number"
                        min={0}
                        step="0.01"
                        value={form.subscriptionPrice}
                        onChange={(e) => setForm((p) => ({ ...p, subscriptionPrice: e.target.value }))}
                        placeholder="Overrides auto price × meals"
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400"
                      />
                    </div>
                    <div>
                      <span className="block text-sm font-medium text-slate-700 mb-2">
                        Recommended plan length <span className="text-slate-400 font-normal text-xs">optional</span>
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {RECOMMENDED_PLAN_WEEKS_OPTIONS.map((w) => (
                          <button
                            key={w.value}
                            type="button"
                            onClick={() =>
                              setForm((p) => ({
                                ...p,
                                recommendedPlanWeeks: p.recommendedPlanWeeks === w.value ? '' : (w.value as '1' | '2' | '4'),
                              }))
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
                              form.recommendedPlanWeeks === w.value
                                ? 'bg-white text-orange-700 border-orange-400 shadow-sm'
                                : 'bg-white/80 text-slate-600 border-slate-200'
                            }`}
                          >
                            {w.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {weeklyPreview && weeklyPreview.perDelivery > 0 ? (
                    <div className="rounded-lg bg-white border border-orange-100 px-3 py-2.5 text-sm text-slate-800">
                      <p className="font-semibold text-orange-700 mb-1">Preview</p>
                      <p>
                        ₹{weeklyPreview.perDelivery.toLocaleString('en-IN')} per delivery · {weeklyPreview.nDel}{' '}
                        {weeklyPreview.nDel === 1 ? 'delivery' : 'deliveries'}/week · {weeklyPreview.mpd} meals/delivery
                      </p>
                      <p className="text-slate-600 mt-1">
                        Estimated weekly total{' '}
                        <span className="font-semibold text-slate-900">
                          ₹{weeklyPreview.weeklyTotal.toLocaleString('en-IN')}
                        </span>
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {form.purchaseType === 'MONTHLY_PLAN' ? (
                <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-4 space-y-4 transition-opacity duration-200">
                  <div>
                    <span className="block text-sm font-medium text-slate-800 mb-2">
                      Delivery frequency <span className="text-red-500">*</span>
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {DELIVERY_FREQUENCY_OPTIONS.map((f) => (
                        <button
                          key={f.value}
                          type="button"
                          onClick={() => setForm((p) => ({ ...p, deliveryFrequency: f.value }))}
                          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                            form.deliveryFrequency === f.value
                              ? 'bg-violet-600 text-white border-violet-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                    {fieldErrors.deliveryFrequency ? (
                      <p className="text-xs text-red-600 mt-1">{fieldErrors.deliveryFrequency}</p>
                    ) : null}
                  </div>

                  <div>
                    <span className="block text-sm font-medium text-slate-800 mb-2">
                      Meals per day <span className="text-red-500">*</span>
                    </span>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {(
                        [
                          ['1', '1'],
                          ['2', '2'],
                          ['3', '3'],
                          ['CUSTOM', 'Custom'],
                        ] as const
                      ).map(([val, label]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setForm((p) => ({ ...p, mealsPerDayPreset: val }))}
                          className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                            form.mealsPerDayPreset === val
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-600 border-slate-200'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {form.mealsPerDayPreset === 'CUSTOM' ? (
                      <div>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={form.mealsPerDayCustom}
                          onChange={(e) => setForm((p) => ({ ...p, mealsPerDayCustom: e.target.value }))}
                          placeholder="Meals per day"
                          className={`w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 ${
                            fieldErrors.mealsPerDayCustom ? 'border-red-300' : 'border-slate-200'
                          }`}
                        />
                        {fieldErrors.mealsPerDayCustom ? (
                          <p className="text-xs text-red-600 mt-1">{fieldErrors.mealsPerDayCustom}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="sub-price-monthly">
                      Subscription price (₹ / day) <span className="text-slate-400 font-normal">optional</span>
                    </label>
                    <input
                      id="sub-price-monthly"
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.subscriptionPrice}
                      onChange={(e) => setForm((p) => ({ ...p, subscriptionPrice: e.target.value }))}
                      placeholder="Overrides auto price × meals/day"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
                    />
                  </div>

                  {monthlyPreview && monthlyPreview.perDay > 0 ? (
                    <div className="rounded-lg bg-white border border-violet-100 px-3 py-2.5 text-sm text-slate-800">
                      <p className="font-semibold text-violet-700 mb-1">Preview</p>
                      <p>
                        ₹{monthlyPreview.perDay.toLocaleString('en-IN')}/day · {monthlyPreview.mpd} meals/day (30-day
                        estimate)
                      </p>
                      <p className="text-slate-600 mt-1">
                        Estimated monthly total{' '}
                        <span className="font-semibold text-slate-900">
                          ₹{monthlyPreview.monthly.toLocaleString('en-IN')}
                        </span>
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>

          {/* Health & safety */}
          <section aria-labelledby={`${titleId}-health`}>
            <SectionTitle id={`${titleId}-health`}>Health & safety</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <span className="block text-sm font-medium text-slate-700 mb-2">Medical focus (optional)</span>
                <div className="flex flex-wrap gap-2">
                  {MEDICAL_TAG_OPTIONS.map((opt) => {
                    const on = form.medicalTags.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleInList('medicalTags', opt.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                          on
                            ? 'bg-violet-600 text-white border-violet-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="feeding">
                  Feeding instructions <span className="text-slate-400 font-normal">(recommended)</span>
                </label>
                <textarea
                  id="feeding"
                  value={form.feedingInstructions}
                  onChange={(e) => setForm((p) => ({ ...p, feedingInstructions: e.target.value }))}
                  rows={4}
                  maxLength={FEEDING_MAX}
                  className={`w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 ${
                    fieldErrors.feedingInstructions ? 'border-red-300' : 'border-slate-200'
                  }`}
                  placeholder='e.g. Serve 200g twice daily for a 15kg adult dog.'
                />
                <div className="flex justify-between text-xs text-slate-500 mt-1">
                  <span>Optional but helps conversions.</span>
                  <span>
                    {form.feedingInstructions.length}/{FEEDING_MAX}
                  </span>
                </div>
                {fieldErrors.feedingInstructions ? (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.feedingInstructions}</p>
                ) : null}
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="storage">
                  Storage instructions
                </label>
                <textarea
                  id="storage"
                  value={form.storageInstructions}
                  onChange={(e) => setForm((p) => ({ ...p, storageInstructions: e.target.value }))}
                  rows={3}
                  maxLength={STORAGE_MAX}
                  className={`w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 ${
                    fieldErrors.storageInstructions ? 'border-red-300' : 'border-slate-200'
                  }`}
                  placeholder="e.g. Refrigerate below 4°C. Consume within 48 hours after opening."
                />
                <div className="text-xs text-slate-500 mt-1 text-right">
                  {form.storageInstructions.length}/{STORAGE_MAX}
                </div>
                {fieldErrors.storageInstructions ? (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.storageInstructions}</p>
                ) : null}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="shelf-life">
                  Shelf life (days) <span className="text-red-500">*</span>
                </label>
                <input
                  id="shelf-life"
                  type="number"
                  min={1}
                  max={365}
                  value={form.shelfLifeDays}
                  onChange={(e) => setForm((p) => ({ ...p, shelfLifeDays: e.target.value }))}
                  className={`w-full px-3 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 ${
                    fieldErrors.shelfLifeDays ? 'border-red-300' : 'border-slate-200'
                  }`}
                />
                {fieldErrors.shelfLifeDays ? (
                  <p className="text-xs text-red-600 mt-1">{fieldErrors.shelfLifeDays}</p>
                ) : null}
              </div>
              <div className="md:col-span-2">
                <span className="block text-sm font-medium text-slate-700 mb-2">Contains allergens (marketing)</span>
                <div className="flex flex-wrap gap-2">
                  {ALLERGEN_OPTIONS.map((opt) => {
                    const on = form.allergens.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleInList('allergens', opt.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                          on
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-amber-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end bg-slate-50/80 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-60 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 flex items-center justify-center gap-2 min-w-[10rem]"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden />
                Saving…
              </>
            ) : editingProduct ? (
              'Save changes'
            ) : (
              'Create product'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
