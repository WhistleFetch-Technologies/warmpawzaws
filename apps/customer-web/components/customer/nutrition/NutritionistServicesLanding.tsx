"use client";

import { useState, useEffect, useMemo } from 'react';
import { CachedImage } from '@/components/shared/CachedImage';
import {
  Apple,
  UtensilsCrossed,
  Calendar,
  Heart,
  ChevronRight,
  Dog,
  Cat,
  PawPrint,
  Scale,
  Pill,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { isCustomerMealPlansEnabled } from '@/lib/customer-meal-plans-flag';
import { fetchMergedNutritionProviders } from '@/lib/nutritionist-discovery';
import { enrichNutritionVendorPrices } from '@/lib/nutrition-vendor-price';
import { toast } from 'sonner';
import { useProblemGridByRole } from '../useProblemGridByRole';
import { ServiceDashboardHeader } from '../shared/ServiceDashboardHeader';
import { EMPTY_SERVICE_HEADER_STATS } from '@/lib/service-header-stats';
import { NutritionistServicesLandingProps } from './constants/interface';
import {
  NutritionVendorDetailsCard,
  nutritionVendorFromDiscoveryRow,
} from './NutritionVendorDetailsCard';
import { NutritionTeleConsultBanner } from './NutritionTeleConsultBanner';
import { NutritionNeedGrid } from './NutritionNeedGrid';
import {
  NUTRITION_HEADER_BANNER,
  NUTRITION_SERVICE_CARDS,
} from './constants/nutrition-hub-assets';
import { NutritionServiceCardBackground } from './NutritionServiceCardBackground';
import { isWarmpawzAppointmentsHubEnabled, buildWarmpawzAppointmentsProfileNav, WAPPT_VENDOR_PROFILE_SCREEN } from '@/lib/warmpawz-appointments-customer';
import { buildWapptHubTile } from '@/lib/wappt-hub-registry';
import { useWapptHubFeaturedVendors } from '@/hooks/useWapptHubFeaturedVendors';
import { pickCustomerVendorAccountId } from '@warmpawz/shared-types';
import { emitGuestAuthAnalytics } from '@/lib/guest-auth-gate';
import { buildGuestAuthUrlForBooking } from '@/lib/guest-booking-intent';

function hasCustomerPhone(phone: string): boolean {
  return (phone?.replace(/\D/g, '') ?? '').length >= 10;
}

const NUTRITION_HEADER_ICON =
  'fill-none stroke-current [&>path]:fill-none [&>circle]:fill-none [&>rect]:fill-none [&>polygon]:fill-none';

function NutritionHeaderBackground() {
  return (
    <>
      <Apple className={`absolute -left-0.5 top-3 h-8 w-8 rotate-[18deg] ${NUTRITION_HEADER_ICON} sm:h-9 sm:w-9`} strokeWidth={1} />
      <UtensilsCrossed className={`absolute left-[8%] top-12 h-7 w-7 -rotate-12 ${NUTRITION_HEADER_ICON}`} strokeWidth={1} />
      <Heart className={`absolute left-[18%] top-2 h-6 w-6 rotate-[24deg] ${NUTRITION_HEADER_ICON}`} strokeWidth={1} />
      <PawPrint className={`absolute left-[32%] bottom-4 h-9 w-9 rotate-6 ${NUTRITION_HEADER_ICON} sm:h-10 sm:w-10`} strokeWidth={1} />
      <Scale className={`absolute left-[42%] top-1 h-12 w-12 -rotate-[8deg] ${NUTRITION_HEADER_ICON} sm:h-14 sm:w-14`} strokeWidth={1} />
      <Dog className={`absolute right-[38%] top-8 h-8 w-8 rotate-12 ${NUTRITION_HEADER_ICON}`} strokeWidth={1} />
      <Cat className={`absolute right-[28%] bottom-2 h-9 w-9 -rotate-6 ${NUTRITION_HEADER_ICON}`} strokeWidth={1} />
      <Pill className={`absolute right-[14%] top-3 h-7 w-7 -rotate-[20deg] ${NUTRITION_HEADER_ICON}`} strokeWidth={1} />
      <Calendar className={`absolute right-[6%] bottom-6 h-8 w-8 rotate-[14deg] ${NUTRITION_HEADER_ICON}`} strokeWidth={1} />
      <Apple className={`absolute -right-0.5 top-10 h-7 w-7 rotate-[32deg] ${NUTRITION_HEADER_ICON}`} strokeWidth={1} />
    </>
  );
}



/**
 * ✅ FIX: Added pet context validation to prevent crashes (NUT-CUST-001)
 * Nutrition services require a pet to be selected before booking
 */
export function NutritionistServicesLanding({ phone, isGuest = false, onBack, onNavigate }: NutritionistServicesLandingProps) {
  const mealPlansLive = isCustomerMealPlansEnabled();
  const wapptHubEnabled = isWarmpawzAppointmentsHubEnabled('nutrition');
  const wapptTile = buildWapptHubTile('nutrition');
  const wapptDiscovery = useWapptHubFeaturedVendors('nutrition', wapptHubEnabled);
  //---------------------------states----------------------------------//
  const nutritionistNeeds = useProblemGridByRole('nutritionist');
  const [loading, setLoading] = useState(true);
  const [nutritionists, setNutritionists] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [pets, setPets] = useState<any[]>([]);
  const [hasPets, setHasPets] = useState<boolean | null>(null);

  //---------------------------useEffect----------------------------------//
  useEffect(() => {
    loadPets();
    loadNutritionists();
  }, [phone]);

  //---------------------------fucntions----------------------------------//
  const loadPets = async () => {
    if (!hasCustomerPhone(phone)) {
      setPets([]);
      setHasPets(false);
      return;
    }
    try {
      const petsData = await apiClient.get(`/customer/pets/${phone}`) as any;
      const petsList = petsData?.pets || [];
      setPets(petsList);
      setHasPets(petsList.length > 0);
    } catch (err: unknown) {
      console.error('Error loading pets:', err);
      setPets([]);
      setHasPets(false);
    }
  };

  const loadNutritionists = async () => {
    try {
      setLoading(true);
      const nutritionistList = await fetchMergedNutritionProviders({ customerPhone: phone });
      setNutritionists(nutritionistList);

      setStats({
        activeNutritionists: nutritionistList.length || 0,
        consultations: '1.5K+',
      });
    } catch (error) {
      console.error('Error loading nutritionists:', error);
      setNutritionists([]);
      setStats({ activeNutritionists: 0, consultations: '1.5K+' });
    } finally {
      setLoading(false);
    }
  };

  const featuredNutritionists = useMemo(() => {
    const mapRow = (row: Record<string, unknown>) => nutritionVendorFromDiscoveryRow(row);
    if (wapptHubEnabled && wapptDiscovery.vendors.length > 0) {
      return wapptDiscovery.vendors.map((v) => {
        const raw = (v.raw ?? {}) as Record<string, unknown>;
        const vendorId = pickCustomerVendorAccountId(raw) || v.id;
        return mapRow({
          ...raw,
          id: vendorId,
          vendorId,
          name: v.name,
          businessName: v.name,
          photo: v.photo,
          profile_image: v.photo,
          rating: v.rating,
          review_count: v.review_count,
          address: v.address,
        });
      });
    }
    return (nutritionists as Record<string, unknown>[]).map((n) => mapRow(n));
  }, [wapptHubEnabled, nutritionists, wapptDiscovery.vendors]);

  const [pricedNutritionists, setPricedNutritionists] = useState<
    ReturnType<typeof nutritionVendorFromDiscoveryRow>[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!featuredNutritionists.length) {
        setPricedNutritionists([]);
        return;
      }
      const enriched = await enrichNutritionVendorPrices(featuredNutritionists);
      if (!cancelled) setPricedNutritionists(enriched);
    })();
    return () => {
      cancelled = true;
    };
  }, [featuredNutritionists]);

  const expertNutritionistsToShow =
    pricedNutritionists.length > 0 ? pricedNutritionists : featuredNutritionists;

  const openNutritionistProfile = (nutritionist: ReturnType<typeof nutritionVendorFromDiscoveryRow>) => {
    const vendorId = String(nutritionist.vendorId ?? nutritionist.id ?? '').trim();
    if (!vendorId) return;
    if (wapptHubEnabled) {
      onNavigate?.(WAPPT_VENDOR_PROFILE_SCREEN, {
        ...buildWarmpawzAppointmentsProfileNav({
          vendorId,
          category: 'nutrition',
          serviceStyle: 'at_center',
          vendorName: nutritionist.businessName || nutritionist.name || 'Nutritionist',
        }),
        profileBackScreen: 'wappt-discovery',
      });
      return;
    }
    onNavigate?.('nutritionist-profile', { vendorId });
  };

  const handleNutritionistSelect = (nutritionist: any) => {
    if (!hasPets || pets.length === 0) {
      if (isGuest || !hasCustomerPhone(phone)) {
        emitGuestAuthAnalytics('login_prompt_shown');
        emitGuestAuthAnalytics('login_started');
        window.location.href = buildGuestAuthUrlForBooking({
          returnPath: '/',
          resumeScreen: 'nutritionist',
        });
        return;
      }
      toast.error('Please add a pet first before booking nutrition services');
      onNavigate?.('pets', { action: 'add' });
      return;
    }

    try {
      onNavigate?.('nutritionist-booking', {
        vendorId: nutritionist.id || nutritionist.vendorId,
        category: 'pet_nutritionist',
      });
    } catch (err: any) {
      console.error('Navigation error:', err);
      toast.error('Failed to navigate. Please try again.');
    }
  };

  const handleBookNow = (data?: any) => {
    try {
      const serviceType = data?.serviceType || 'Diet Consultation';
      if (serviceType === 'Meal Plans') {
        if (!mealPlansLive) {
          toast.info('Meal plans are coming soon.');
          return;
        }
        onNavigate?.('nutrition-meal-plans');
        return;
      }
      onNavigate?.('diet-consultation-services', { serviceType });
    } catch (err: any) {
      console.error('Navigation error:', err);
      toast.error('Failed to navigate. Please try again.');
    }
  };

  const dashboardStats = EMPTY_SERVICE_HEADER_STATS;


  //---------------------------render----------------------------------//
  if (loading || (wapptHubEnabled && wapptDiscovery.loading)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center max-w-md mx-auto">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-3"></div>
          <p className="text-gray-600">Loading nutrition services...</p>
        </div>
      </div>
    );
  }

  //---------------------------main render----------------------------------//
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <ServiceDashboardHeader
        fullWidth
        serviceName="Pet Nutrition"
        serviceSubtitle="Expert nutrition consultation"
        serviceIcon={Apple}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]"
        sheetToneClass="bg-white"
        headerBackground={<NutritionHeaderBackground />}
        headerTrailingImage={NUTRITION_HEADER_BANNER}
        headerTrailingImageAlt="Dog and cat"
        clipHeaderTrailingImage
        headerTrailingImageClassName="pointer-events-none absolute bottom-0 right-0 top-[2.75rem] z-[5] flex w-[72%] max-w-[420px] items-end justify-end sm:top-12"
        headerTrailingImageImgClassName="block h-full w-auto max-w-full origin-bottom-right scale-[1.35] object-contain object-right object-bottom drop-shadow-lg"
      />

      <div className="mx-auto w-full max-w-customer -mt-4 rounded-t-[1.75rem] bg-white px-4 pt-6 sm:rounded-t-[2rem] min-h-[calc(100vh-180px)]">
        <div className="space-y-8">

          <NutritionNeedGrid
            problems={nutritionistNeeds}
            onNavigate={(screen, navData) => onNavigate?.(screen, navData)}
          />

          <NutritionTeleConsultBanner onClick={() => onNavigate?.('nutritionist-tele')} />

          {wapptHubEnabled && wapptTile ? (
            <div>
              <h2 className="mb-3 text-lg font-bold text-slate-900">Choose Service Type</h2>
              <button
                type="button"
                onClick={() => onNavigate?.('wappt-discovery', { category: 'nutrition' })}
                className="group relative w-full overflow-hidden rounded-2xl border border-slate-100 bg-white text-left shadow-sm transition-all hover:shadow-md"
              >
                <div className="relative h-28 w-full sm:h-32">
                  {wapptTile.image ? (
                    <CachedImage
                      src={wapptTile.image}
                      alt={wapptTile.name}
                      fill
                      className="object-cover transition-transform duration-300 ease-in-out group-hover:scale-105"
                      sizes="(max-width: 640px) 90vw, 400px"
                    />
                  ) : null}
                  <span className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide ${wapptTile.badgeClass}`}>
                    {wapptTile.badge}
                  </span>
                </div>
                <div className="relative p-3 pb-10">
                  <h3 className="text-sm font-bold text-slate-900">{wapptTile.name}</h3>
                  <p className="mt-0.5 text-[11px] text-slate-500">{wapptTile.description}</p>
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">
                    <Heart className="h-3 w-3 text-orange-400" />
                    <span>{wapptTile.trustedBy}</span>
                  </div>
                  <div className={`absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full text-white shadow-md transition-transform group-hover:scale-110 ${wapptTile.arrowClass}`}>
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </button>
            </div>
          ) : null}

          {/* Our Services */}
          <div>
            <h2 className="mb-4 text-lg font-bold text-slate-900">Our Services</h2>
            <div className="grid grid-cols-2 gap-3">
              {NUTRITION_SERVICE_CARDS.map((service) => {
                const isMealPlans = service.id === 'meal_plans';
                const comingSoon = isMealPlans && !mealPlansLive;
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => handleBookNow({ serviceType: service.label })}
                    disabled={comingSoon}
                    aria-label={comingSoon ? `${service.label} — coming soon` : service.label}
                    className={`group relative overflow-hidden rounded-2xl border text-left shadow-sm transition-all ${service.borderClass} ${service.cardBg} ${
                      comingSoon ? 'cursor-not-allowed opacity-90' : 'hover:shadow-md'
                    }`}
                  >
                    <NutritionServiceCardBackground serviceId={service.id} />
                    {comingSoon ? (
                      <span className="absolute right-2 top-2 z-[3] rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800">
                        Coming soon
                      </span>
                    ) : null}
                    <div className="relative z-[1] flex min-h-[132px] flex-col p-3 pr-[42%]">
                      <div
                        className={`mb-2 flex h-10 w-10 items-center justify-center rounded-xl ${service.iconBg}`}
                      >
                        <service.Icon className={`h-5 w-5 ${service.iconColor}`} />
                      </div>
                      <h3 className="text-sm font-bold text-slate-900">{service.label}</h3>
                      <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                        {service.description}
                      </p>
                      {!comingSoon ? (
                        <span
                          className={`mt-auto inline-flex items-center gap-0.5 pt-2 text-[11px] font-semibold ${service.ctaClass} group-hover:gap-1`}
                        >
                          Book Now
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                        </span>
                      ) : null}
                    </div>
                    <div className="pointer-events-none absolute bottom-0 right-0 z-[2] h-[72%] w-[48%]">
                      <CachedImage
                        src={service.image}
                        alt=""
                        fill
                        className="object-contain object-bottom-right"
                        sizes="(max-width: 640px) 45vw, 180px"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Featured Nutritionists — top 3 on hub */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Expert Nutritionists</h2>

            <div className="space-y-3">
              {expertNutritionistsToShow.length === 0 ? (
                <Card className="p-8 text-center">
                  <div className="text-4xl mb-3">🥗</div>
                  <p className="text-gray-600 mb-2">No nutritionists available yet</p>
                  <p className="text-gray-500 text-sm">Check back soon for expert pet nutrition consultants!</p>
                </Card>
              ) : (
                expertNutritionistsToShow.slice(0, 3).map((nutritionist, index) => {
                  const vendorId = String(nutritionist.id ?? nutritionist.vendorId ?? '').trim();
                  const snapshot = nutritionist;
                  return (
                    <NutritionVendorDetailsCard
                      key={vendorId || index}
                      vendor={snapshot}
                      showViewMealPlans={mealPlansLive}
                      onViewMealPlans={() => {
                        if (!mealPlansLive) {
                          toast.info('Meal plans are coming soon.');
                          return;
                        }
                        if (!vendorId) return;
                        onNavigate?.('nutrition-meal-plans', {
                          vendorId,
                          vendorSnapshot: snapshot,
                        });
                      }}
                      showBookConsultation
                      onBookConsultation={() => handleNutritionistSelect(nutritionist)}
                      onViewProfile={
                        wapptHubEnabled ? () => openNutritionistProfile(snapshot) : undefined
                      }
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
