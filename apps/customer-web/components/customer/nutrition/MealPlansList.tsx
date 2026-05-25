"use client";

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Star, MapPin, UtensilsCrossed, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { getMealPlanCatalogDisplay } from '@/lib/meal-plan-catalog-display';
import {
  NutritionVendorDetailsCard,
  type NutritionVendorCardModel,
} from './NutritionVendorDetailsCard';
import { uniqueVendorsFromMealPlans } from './meal-plans-vendor-grouping';
import { resolveCustomerPublicAssetUrl } from '@/lib/public-asset-url';
import { isMealKitchenClosed, mealKitchenClosedMessage } from '@/lib/meal-kitchen-availability';
import {
  MealKitchenClosedBadge,
  MealKitchenStatusBanner,
} from '@/components/customer/nutrition/MealKitchenStatusBanner';

const MAX_RADIUS_KM = 10;

export interface MealPlansListProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  /** Drill-down: single nutritionist’s meal catalog */
  vendorFocus?: { vendorId: string; vendorSnapshot?: NutritionVendorCardModel | Record<string, unknown> } | null;
  /** Clear drill-down (stay on meal plans browse) */
  onExitVendorFocus?: () => void;
}

export function MealPlansList({
  phone,
  onBack,
  onNavigate,
  vendorFocus,
  onExitVendorFocus,
}: MealPlansListProps) {
  const [loading, setLoading] = useState(true);
  /** Full search result — used to derive vendor cards on browse */
  const [mealPlansForVendors, setMealPlansForVendors] = useState<any[]>([]);
  /** Drill-down: plans for one vendor */
  const [vendorMealPlans, setVendorMealPlans] = useState<any[]>([]);
  const [vendorKitchenAvailability, setVendorKitchenAvailability] = useState<{
    acceptingOrders: boolean;
    message: string | null;
  } | null>(null);
  const [pets, setPets] = useState<any[]>([]);
  const [hasPets, setHasPets] = useState<boolean | null>(null);
  const [filterOptions, setFilterOptions] = useState<{ purpose?: string[]; mealType?: string[] }>({});
  const [selectedPurpose, setSelectedPurpose] = useState<string | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<string | null>(null);

  const focusVendorId = vendorFocus?.vendorId?.trim() || null;

  const getLocation = useCallback((): { lat: number; lng: number } | null => {
    if (typeof window === 'undefined') return null;
    const lat = localStorage.getItem('customer_latitude') || localStorage.getItem('customer_lat');
    const lng = localStorage.getItem('customer_longitude') || localStorage.getItem('customer_lng');
    if (lat && lng) {
      const n = parseFloat(lat), g = parseFloat(lng);
      if (!Number.isNaN(n) && !Number.isNaN(g)) return { lat: n, lng: g };
    }
    return null;
  }, []);

  useEffect(() => {
    fetchPets();
    fetchFilters();
  }, [phone]);

  useEffect(() => {
    if (focusVendorId) {
      fetchVendorMealPlans(focusVendorId);
    } else {
      fetchMealPlansForBrowse();
    }
  }, [phone, selectedPurpose, selectedMealType, focusVendorId]);

  const fetchPets = async () => {
    try {
      const petsData = await apiClient.get(`/customer/pets/${phone}`) as any;
      const petsList = petsData?.pets || [];
      setPets(petsList);
      setHasPets(petsList.length > 0);
    } catch (err: any) {
      console.error('Error loading pets:', err);
      setHasPets(false);
    }
  };

  const fetchFilters = async () => {
    try {
      const res = await apiClient.get<{ success?: boolean; filters?: { purpose?: string[]; mealType?: string[] } }>('/meal-plans/search/filters') as any;
      const f = res?.filters || {};
      setFilterOptions({ purpose: f.purpose || [], mealType: f.mealType || [] });
    } catch (_) {
      setFilterOptions({ purpose: [], mealType: [] });
    }
  };

  const fetchMealPlansForBrowse = async () => {
    try {
      setLoading(true);
      const buildParams = (withLocalRadius: boolean) => {
        const params = new URLSearchParams();
        const loc = withLocalRadius ? getLocation() : null;
        if (loc) {
          params.set('lat', String(loc.lat));
          params.set('lng', String(loc.lng));
          params.set('maxRadius', String(MAX_RADIUS_KM));
        }
        if (selectedPurpose) params.set('purpose', selectedPurpose);
        if (selectedMealType) params.set('mealType', selectedMealType);
        return params;
      };
      const load = async (params: URLSearchParams) => {
        const data = (await apiClient.get<{ mealPlans?: any[]; meal_plans?: any[] }>(
          `/meal-plans/search${params.toString() ? `?${params.toString()}` : ''}`
        )) as any;
        return (data.mealPlans || data.meal_plans || []) as any[];
      };
      let plans = await load(buildParams(true));
      if (plans.length === 0) {
        plans = await load(buildParams(false));
      }
      setMealPlansForVendors(plans);
    } catch (error: any) {
      console.error('Error loading meal plans:', error);
      toast.error('Failed to load meal plans. Please try again.');
      setMealPlansForVendors([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchVendorMealPlans = async (vendorId: string) => {
    try {
      setLoading(true);
      const data = (await apiClient.get<{
        mealPlans?: any[];
        meal_plans?: any[];
        kitchenAvailability?: { acceptingOrders?: boolean; message?: string | null };
      }>(`/meal-plans/vendor/${encodeURIComponent(vendorId)}?activeOnly=true`)) as any;
      const plans = (data.mealPlans || data.meal_plans || []) as any[];
      setVendorMealPlans(plans);
      const ka = data.kitchenAvailability;
      if (ka) {
        setVendorKitchenAvailability({
          acceptingOrders: ka.acceptingOrders !== false,
          message: ka.message ?? null,
        });
      } else if (plans.length > 0) {
        setVendorKitchenAvailability({
          acceptingOrders: !isMealKitchenClosed(plans[0]),
          message: isMealKitchenClosed(plans[0]) ? mealKitchenClosedMessage(plans[0]) : null,
        });
      } else {
        setVendorKitchenAvailability(null);
      }
    } catch (error: any) {
      console.error('Error loading vendor meal plans:', error);
      toast.error('Failed to load meal plans for this nutritionist.');
      setVendorMealPlans([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMealPlanClick = (mealPlan: any) => {
    if (isMealKitchenClosed(mealPlan)) {
      toast.error(mealKitchenClosedMessage(mealPlan));
      return;
    }
    if (!hasPets || pets.length === 0) {
      toast.error('Please add a pet first before booking meal plans');
      onNavigate?.('pets', { action: 'add' });
      return;
    }

    try {
      onNavigate?.('meal-order-checkout', {
        vendorId: mealPlan.vendor_id ?? mealPlan.vendorId,
        mealPlanId: mealPlan.id
      });
    } catch (err: any) {
      console.error('Navigation error:', err);
      toast.error('Failed to navigate. Please try again.');
    }
  };

  const handleBackPress = () => {
    if (focusVendorId && onExitVendorFocus) {
      onExitVendorFocus();
      return;
    }
    onBack();
  };

  const vendorGroups = uniqueVendorsFromMealPlans(mealPlansForVendors);

  const mergedFocusVendor: NutritionVendorCardModel = {
    ...(vendorFocus?.vendorSnapshot as NutritionVendorCardModel),
    id: focusVendorId || undefined,
    vendorId: focusVendorId || undefined,
    ...(vendorKitchenAvailability
      ? {
          acceptingMealOrders: vendorKitchenAvailability.acceptingOrders,
          kitchenClosedMessage: vendorKitchenAvailability.message,
        }
      : {}),
  };

  const renderMealPlanCard = (mealPlan: any, index: number) => {
    const vendorName =
      mealPlan.vendor_name ||
      mealPlan.vendorName ||
      (mergedFocusVendor.businessName || mergedFocusVendor.name || mergedFocusVendor.vendor_name) ||
      'Nutritionist';
    const planName = mealPlan.name || mealPlan.plan_name || `Meal Plan ${index + 1}`;
    const description = mealPlan.description || mealPlan.desc || 'Healthy and nutritious meal plan';
    const pricePerMeal = mealPlan.price_per_meal ?? mealPlan.pricePerMeal ?? mealPlan.price ?? 0;
    const pricePerMonth = mealPlan.price_per_month ?? mealPlan.pricePerMonth ?? mealPlan.monthly_price ?? 0;
    const vendorRating = mealPlan.vendor_rating ?? mealPlan.vendorRating ?? mealPlan.avg_rating;
    const catalog = getMealPlanCatalogDisplay(mealPlan as Record<string, unknown>);
    const photosArr = Array.isArray(mealPlan.photos) ? mealPlan.photos : [];
    const firstPhoto =
      typeof photosArr[0] === 'string'
        ? photosArr[0]
        : photosArr[0] && typeof photosArr[0] === 'object'
          ? String((photosArr[0] as { url?: string; src?: string }).url || (photosArr[0] as { url?: string; src?: string }).src || '')
          : '';
    const mealImageRaw =
      mealPlan.mealImageUrl ||
      mealPlan.thumbnail_url ||
      (mealPlan.dietary_requirements &&
        typeof mealPlan.dietary_requirements === 'object' &&
        mealPlan.dietary_requirements.mealImageUrl) ||
      firstPhoto ||
      null;
    const mealImageUrl = resolveCustomerPublicAssetUrl(mealImageRaw);
    const kitchenClosed = isMealKitchenClosed(mealPlan);

    return (
      <Card
        key={mealPlan.id || index}
        className={`rounded-2xl border p-4 shadow-sm transition-all ${
          kitchenClosed
            ? 'cursor-not-allowed border-amber-100 bg-amber-50/40 opacity-90'
            : 'cursor-pointer border-slate-100 hover:border-orange-200 hover:shadow-md'
        }`}
        onClick={() => handleMealPlanClick(mealPlan)}
      >
        <div className="flex items-start gap-4">
          {mealImageUrl ? (
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mealImageUrl} alt="" className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-yellow-100 text-yellow-600">
              <UtensilsCrossed className="h-6 w-6" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h3 className="truncate font-bold text-slate-900">{planName}</h3>
              {kitchenClosed ? <MealKitchenClosedBadge /> : null}
            </div>

            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="font-medium">by {vendorName}</span>
              {vendorRating ? (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1 font-bold text-orange-500">
                    <Star className="h-3 w-3 fill-current" />
                    {typeof vendorRating === 'number' ? vendorRating.toFixed(1) : parseFloat(vendorRating)?.toFixed(1) || 'N/A'}
                  </span>
                </>
              ) : null}
            </div>

            <p className="mb-2 line-clamp-2 text-xs text-slate-600">{description}</p>

            {(mealPlan.distance_km != null || mealPlan.estimatedDeliveryMinutes != null) && (
              <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                {mealPlan.distance_km != null && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-orange-500" />
                    {mealPlan.distance_km <= MAX_RADIUS_KM ? `Within ${MAX_RADIUS_KM} km` : `${Number(mealPlan.distance_km).toFixed(1)} km away`}
                  </span>
                )}
                {mealPlan.estimatedDeliveryMinutes != null && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-orange-500" />
                    ETA ~{mealPlan.estimatedDeliveryMinutes} min
                  </span>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1 text-[11px] text-slate-600">
              <div className="inline-flex w-fit items-center rounded-full border border-orange-100 bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-800">
                {catalog.customerPurchaseHeadline}
              </div>
              {catalog.customerPricingLine ? (
                <div className="pt-0.5 text-sm font-semibold text-slate-900">{catalog.customerPricingLine}</div>
              ) : pricePerMeal > 0 ? (
                <div className="pt-0.5 text-sm font-semibold text-slate-900">
                  ₹{Number(pricePerMeal).toLocaleString('en-IN')}
                  {pricePerMonth > 0 ? (
                    <span className="ml-2 font-semibold text-green-600">
                      ₹{Number(pricePerMonth).toLocaleString('en-IN')}/month
                    </span>
                  ) : null}
                </div>
              ) : null}
              {catalog.customerBenefits.length > 0 ? (
                <ul className="list-inside list-disc space-y-0.5 pt-0.5 text-[10px] text-slate-600">
                  {catalog.customerBenefits.slice(0, 4).map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : null}
              {catalog.shelfLifeDays != null ? (
                <div>
                  <span className="font-medium text-slate-500">Shelf life: </span>
                  <span>{catalog.shelfLifeDays} days</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </Card>
    );
  };

  const browseTitle = focusVendorId ? 'Meal plans' : 'Nutritionists & meal plans';
  const browseSubtitle = focusVendorId
    ? 'Plans from this expert — tap a meal to order'
    : 'Choose a nutritionist, then view their meal catalog';

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-gray-50 pb-24">
      <div className="shrink-0 bg-[#FF8C42] px-6 pb-10 pt-12">
        <div className="flex items-center gap-4">
          <button 
            type="button"
            onClick={handleBackPress}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm transition-colors hover:bg-white/30"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <h1 className="text-2xl font-bold text-white">Meal Plans</h1>
        </div>
      </div>

      <div className="relative z-10 -mt-6 flex flex-1 flex-col rounded-t-[32px] bg-white px-6 pt-8 shadow-[0_-8px_30px_rgba(0,0,0,0.06)]">
        <div className="space-y-4">
          <div className="mb-4">
            <h2 className="mb-2 text-lg font-bold text-slate-900">{browseTitle}</h2>
            <p className="text-sm text-slate-600">{browseSubtitle}</p>
            {!focusVendorId ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="h-3.5 w-3.5" /> Within {MAX_RADIUS_KM} km · Hyperlocal delivery
              </p>
            ) : null}
          </div>

          {!focusVendorId &&
          (filterOptions.purpose?.length || filterOptions.mealType?.length) ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {filterOptions.purpose?.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSelectedPurpose(selectedPurpose === p ? null : p)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${selectedPurpose === p ? 'bg-[#FF8C42] text-white' : 'bg-slate-100 text-slate-600 hover:bg-orange-50'}`}
                >
                  {p.replace(/_/g, ' ')}
                </button>
              ))}
              {filterOptions.mealType?.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setSelectedMealType(selectedMealType === m ? null : m)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${selectedMealType === m ? 'bg-[#FF8C42] text-white' : 'bg-slate-100 text-slate-600 hover:bg-orange-50'}`}
                >
                  {m.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          ) : null}

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="rounded-2xl border border-slate-100 p-4">
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 w-3/4 rounded bg-slate-200" />
                    <div className="h-3 w-1/2 rounded bg-slate-200" />
                  </div>
                </Card>
              ))}
            </div>
          ) : focusVendorId ? (
            <div className="space-y-4">
              <NutritionVendorDetailsCard
                vendor={mergedFocusVendor}
                subtitle={`${vendorMealPlans.length} meal plan${vendorMealPlans.length === 1 ? '' : 's'} available`}
              />
              {vendorKitchenAvailability && !vendorKitchenAvailability.acceptingOrders ? (
                <MealKitchenStatusBanner message={vendorKitchenAvailability.message} />
              ) : null}
              {vendorMealPlans.length === 0 ? (
                <Card className="p-8 text-center">
                  <div className="mb-3 text-4xl">🍽️</div>
                  <p className="mb-2 text-gray-600">No meal plans from this nutritionist yet</p>
                  <p className="text-sm text-gray-500">Try another expert from the list.</p>
                </Card>
              ) : (
                <div className="space-y-3">{vendorMealPlans.map((mp, i) => renderMealPlanCard(mp, i))}</div>
              )}
            </div>
          ) : vendorGroups.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="mb-3 text-4xl">🍽️</div>
              <p className="mb-2 text-gray-600">No nutritionists with meal plans nearby</p>
              <p className="text-sm text-gray-500">Try clearing filters or check back soon.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              <p className="text-sm font-medium text-slate-700">
                {vendorGroups.length} nutritionist{vendorGroups.length === 1 ? '' : 's'} with meal plans
              </p>
              {vendorGroups.map(({ vendorId, vendorMeta }) => (
                <NutritionVendorDetailsCard
                  key={vendorId}
                  vendor={vendorMeta}
                  showViewMealPlans
                  onViewMealPlans={() =>
                    onNavigate?.('nutrition-meal-plans', {
                      vendorId,
                      vendorSnapshot: vendorMeta,
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
