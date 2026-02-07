"use client";

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Star, MapPin, UtensilsCrossed, Calendar, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

const MAX_RADIUS_KM = 10;

interface MealPlansListProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function MealPlansList({ phone, onBack, onNavigate }: MealPlansListProps) {
  const [loading, setLoading] = useState(true);
  const [mealPlans, setMealPlans] = useState<any[]>([]);
  const [pets, setPets] = useState<any[]>([]);
  const [hasPets, setHasPets] = useState<boolean | null>(null);
  const [filterOptions, setFilterOptions] = useState<{ purpose?: string[]; mealType?: string[] }>({});
  const [selectedPurpose, setSelectedPurpose] = useState<string | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<string | null>(null);

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
    fetchMealPlans();
  }, [phone, selectedPurpose, selectedMealType]);

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

  const fetchMealPlans = async () => {
    try {
      setLoading(true);
      const loc = getLocation();
      const params = new URLSearchParams();
      if (loc) {
        params.set('lat', String(loc.lat));
        params.set('lng', String(loc.lng));
        params.set('maxRadius', String(MAX_RADIUS_KM));
      }
      if (selectedPurpose) params.set('purpose', selectedPurpose);
      if (selectedMealType) params.set('mealType', selectedMealType);
      const url = `/meal-plans/search${params.toString() ? `?${params.toString()}` : ''}`;
      const data = await apiClient.get<{ success?: boolean; mealPlans?: any[] }>(url) as any;
      const plans = data.mealPlans || data.meal_plans || [];
      setMealPlans(plans);
    } catch (error: any) {
      console.error('Error loading meal plans:', error);
      toast.error('Failed to load meal plans. Please try again.');
      setMealPlans([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMealPlanClick = (mealPlan: any) => {
    // ✅ FIX: Validate pet context before navigation (fallback)
    if (!hasPets || pets.length === 0) {
      toast.error('Please add a pet first before booking meal plans');
      onNavigate?.('pets', { action: 'add' });
      return;
    }

    try {
      // Phase 2: Navigate to meal order checkout (cart, payment, order)
      onNavigate?.('meal-order-checkout', {
        vendorId: mealPlan.vendor_id,
        mealPlanId: mealPlan.id
      });
    } catch (err: any) {
      console.error('Navigation error:', err);
      toast.error('Failed to navigate. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#FF8C42] max-w-md mx-auto pb-24">
      {/* Header - Orange Background */}
      <div className="px-6 pt-12 pb-6">
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={onBack}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-2xl font-bold text-white">Meal Plans</h1>
        </div>
      </div>

      {/* Main Content - White Card with Top Radius */}
      <div className="bg-white rounded-t-[32px] px-6 pt-8 min-h-[calc(100vh-180px)]">
        <div className="space-y-4">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900 mb-2">Available Meal Plans</h2>
            <p className="text-sm text-slate-600">Choose from curated meal plans by expert nutritionists</p>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> Within {MAX_RADIUS_KM} km · Hyperlocal delivery
            </p>
          </div>

          {/* Filter chips */}
          {(filterOptions.purpose?.length || filterOptions.mealType?.length) ? (
            <div className="flex flex-wrap gap-2 mb-4">
              {filterOptions.purpose?.map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedPurpose(selectedPurpose === p ? null : p)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedPurpose === p ? 'bg-[#FF8C42] text-white' : 'bg-slate-100 text-slate-600 hover:bg-orange-50'}`}
                >
                  {p.replace(/_/g, ' ')}
                </button>
              ))}
              {filterOptions.mealType?.map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedMealType(selectedMealType === m ? null : m)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${selectedMealType === m ? 'bg-[#FF8C42] text-white' : 'bg-slate-100 text-slate-600 hover:bg-orange-50'}`}
                >
                  {m.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          ) : null}

          {/* Loading State */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-4 rounded-2xl border border-slate-100">
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                    <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                  </div>
                </Card>
              ))}
            </div>
          ) : mealPlans.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="text-4xl mb-3">🍽️</div>
              <p className="text-gray-600 mb-2">No meal plans available</p>
              <p className="text-gray-500 text-sm">Check back soon for expert meal plans!</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {mealPlans.map((mealPlan: any, index: number) => {
                const vendorName = mealPlan.vendor_name || mealPlan.vendorName || 'Nutritionist';
                const vendorId = mealPlan.vendor_id || mealPlan.vendorId;
                const planName = mealPlan.name || mealPlan.plan_name || `Meal Plan ${index + 1}`;
                const description = mealPlan.description || mealPlan.desc || 'Healthy and nutritious meal plan';
                const pricePerMeal = mealPlan.price_per_meal ?? mealPlan.pricePerMeal ?? mealPlan.price ?? 0;
                const pricePerMonth = mealPlan.price_per_month ?? mealPlan.pricePerMonth ?? mealPlan.monthly_price ?? 0;
                const duration = mealPlan.duration_days ?? mealPlan.duration ?? 30;
                const vendorRating = mealPlan.vendor_rating ?? mealPlan.vendorRating ?? mealPlan.avg_rating;

                return (
                  <Card
                    key={mealPlan.id || index}
                    className="p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-orange-200 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => handleMealPlanClick(mealPlan)}
                  >
                    <div className="flex items-start gap-4">
                      {/* Meal Plan Icon */}
                      <div className="w-14 h-14 bg-yellow-100 rounded-xl flex items-center justify-center text-yellow-600 shrink-0">
                        <UtensilsCrossed className="w-6 h-6" />
                      </div>

                      {/* Meal Plan Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 truncate mb-1">
                          {planName}
                        </h3>
                        
                        {/* Vendor Name */}
                        <div className="flex items-center gap-2 text-xs text-slate-600 mb-2">
                          <span className="font-medium">by {vendorName}</span>
                          {vendorRating && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1 text-orange-500 font-bold">
                                <Star className="w-3 h-3 fill-current" />
                                {typeof vendorRating === 'number' ? vendorRating.toFixed(1) : parseFloat(vendorRating)?.toFixed(1) || 'N/A'}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Description */}
                        <p className="text-xs text-slate-600 mb-2 line-clamp-2">
                          {description}
                        </p>

                        {/* Distance & ETA labels */}
                        {(mealPlan.distance_km != null || mealPlan.estimatedDeliveryMinutes != null) && (
                          <div className="flex items-center gap-3 text-xs text-slate-600 mb-2">
                            {mealPlan.distance_km != null && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-orange-500" />
                                {mealPlan.distance_km <= MAX_RADIUS_KM ? `Within ${MAX_RADIUS_KM} km` : `${Number(mealPlan.distance_km).toFixed(1)} km away`}
                              </span>
                            )}
                            {mealPlan.estimatedDeliveryMinutes != null && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-orange-500" />
                                ETA ~{mealPlan.estimatedDeliveryMinutes} min
                              </span>
                            )}
                          </div>
                        )}

                        {/* Plan Details – labels & prices from backend (price_per_meal, price_per_month) */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          {duration && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{duration} days</span>
                            </div>
                          )}
                          {pricePerMeal > 0 && (
                            <span className="font-medium text-slate-700">₹{Number(pricePerMeal).toLocaleString()}/meal</span>
                          )}
                          {pricePerMonth > 0 && (
                            <span className="font-semibold text-green-600">₹{Number(pricePerMonth).toLocaleString()}/month</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}