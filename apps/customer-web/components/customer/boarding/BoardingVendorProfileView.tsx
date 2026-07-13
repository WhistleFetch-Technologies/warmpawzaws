"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  Clock,
  MapPin,
  Phone,
  CheckCircle2,
  Building2,
  Moon,
  Sun,
  Calendar,
  CalendarRange,
  Shield,
  Navigation,
  Share2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { mergeCustomerVendorServicesPayload } from '@/lib/customer-vendor-services-merge';
import { VendorProfileDashboardHeader } from '../shared/VendorProfileDashboardHeader';
import { StandardizedFooter } from '../shared/StandardizedFooter';
import { StarRating } from '../shared/StarRating';
import { resolveVendorRating } from '@/lib/resolve-vendor-rating';
import {
  normalizeBoardingServiceSlug,
  boardingSlugMatchesText,
  serviceNameLooksLikeSwimming,
  BOARDING_SERVICE_LABELS,
} from '@/lib/boarding-service-types';
import {
  mergeCustomerFacilityPayload,
  resolveCustomerVendorAmenities,
  resolveVendorProfileHeroGallery,
} from '@/lib/vendor-display-media';
import { AmenitiesSection } from '../shared/AmenitiesSection';
import { VendorHeroPhotoCarousel } from '../shared/VendorHeroPhotoCarousel';
import { shareVendorProfile } from '@/lib/vendor-profile-share';
import {
  buildWalkerServiceDataForVendorPackagePurchase,
  isVendorServicePackageRow,
} from '@/lib/vendor-package-purchase-nav';

export interface BoardingVendorProfileViewProps {
  phone: string;
  vendorId: string;
  serviceSlug?: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: Record<string, unknown>) => void;
  /** Bottom nav highlight in the customer app shell (avoid implying user is on Bookings). */
  footerActiveTab?: 'home' | 'shop' | 'bookings' | 'profile';
}

interface MappedBoardingService {
  rowId: string;
  serviceId?: string;
  name: string;
  price: number;
  duration?: number;
  serviceStyle?: string;
  /** Original API row — package detection + purchase-package payload. */
  rawRow: Record<string, unknown>;
}

interface VendorInfo {
  vendorId?: string;
  id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  pincode: string;
  phone: string;
  rating: number;
  review_count: number;
  timing: string;
  photos: string[];
  amenities: string[];
  customAmenities: string[];
  isVerified: boolean;
}

/** Infer icon from API-provided name + style only (no fixed catalog of service types). */
function pickIconForPublishedPlan(name: string, serviceStyle?: string): LucideIcon {
  const st = `${name} ${serviceStyle || ''}`.toLowerCase();
  if (st.includes('overnight') || st.includes('night stay') || /\bnight\b/.test(st)) return Moon;
  if (st.includes('weekend')) return CalendarRange;
  if (st.includes('weekly') || /\bweek\b/.test(st)) return Calendar;
  if (st.includes('half')) return Clock;
  if (st.includes('daycare') || st.includes('day care') || st.includes('full day') || st.includes('fullday')) return Sun;
  if (st.includes('day')) return Sun;
  if (st.includes('drop') || st.includes('visit') || st.includes('check')) return Clock;
  if (st.includes('extend')) return Calendar;
  return Building2;
}

export function BoardingVendorProfileView({
  phone: customerPhone,
  vendorId,
  serviceSlug: serviceSlugProp,
  onBack,
  onNavigate,
  footerActiveTab = 'home',
}: BoardingVendorProfileViewProps) {
  const router = useRouter();
  const contextSlug = normalizeBoardingServiceSlug(serviceSlugProp ?? null);
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<VendorInfo | null>(null);
  /** Raw vendor payload + facility row for hero photos (presigned from /customer/facility when available). */
  const [vendorRaw, setVendorRaw] = useState<Record<string, unknown> | null>(null);
  const [facilityForHero, setFacilityForHero] = useState<Record<string, unknown> | null>(null);
  const [publishedPlans, setPublishedPlans] = useState<MappedBoardingService[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<MappedBoardingService | null>(null);

  const mapBoardingPlans = useCallback((rows: any[]): MappedBoardingService[] => {
    const seen = new Set<string>();
    const mapped: MappedBoardingService[] = [];
    for (const s of rows || []) {
      const rowId = String(s?.id ?? s?.vendorServiceId ?? s?.serviceId ?? s?.service_id ?? '');
      if (!rowId || seen.has(rowId)) continue;
      seen.add(rowId);
      mapped.push({
        rowId,
        serviceId: s?.serviceId || s?.service_id,
        name: s?.serviceName || s?.name || s?.service_name || 'Boarding',
        price: parseFloat(String(s?.price || '0')) || 0,
        duration: s?.duration || s?.duration_minutes,
        serviceStyle: s?.serviceStyle || s?.service_style,
        rawRow: (s && typeof s === 'object' ? s : {}) as Record<string, unknown>,
      });
    }
    return mapped;
  }, []);

  useEffect(() => {
    loadVendor();
  }, [vendorId]);

  const loadVendor = async () => {
    try {
      setLoading(true);
      const [vendorResponse, servicesResponse, facilityRes] = await Promise.all([
        apiClient.get(`/customer/vendor/${vendorId}`),
        apiClient
          .get(`/customer/vendor/${vendorId}/services?category=boarding`)
          .catch(() => apiClient.get(`/customer/vendor/${vendorId}/services?serviceStyle=at_center`)),
        apiClient.get(`/customer/facility/${vendorId}`).catch(() => null),
      ]);

      const fr = facilityRes as Record<string, unknown> | null;
      let facilityRoot: Record<string, unknown> | null = null;
      if (fr && typeof fr === 'object' && fr.success !== false && (fr.facility || fr.vendor)) {
        facilityRoot = fr;
        if (fr.facility && typeof fr.facility === 'object') {
          setFacilityForHero(fr.facility as Record<string, unknown>);
        } else {
          setFacilityForHero(null);
        }
      } else {
        setFacilityForHero(null);
      }

      const vendorData = (vendorResponse as any)?.vendor || vendorResponse;
      const vendorRow =
        vendorData && typeof vendorData === 'object' ? (vendorData as Record<string, unknown>) : {};

      const merged: Record<string, unknown> = facilityRoot
        ? { ...mergeCustomerFacilityPayload(facilityRoot), ...vendorRow }
        : { ...vendorRow };

      setVendorRaw(merged);

      const { amenities, customAmenities } = resolveCustomerVendorAmenities(merged);

      let services: any[] = [];
      const servicesData = servicesResponse as any;
      if (servicesData?.services && Array.isArray(servicesData.services)) {
        services = mergeCustomerVendorServicesPayload(servicesData);
      } else if (servicesData?.services?.at_center) {
        services = servicesData.services.at_center?.services || [];
      } else if (servicesData?.services && typeof servicesData.services === 'object') {
        services = Object.values(servicesData.services).flatMap((bucket: any) =>
          Array.isArray(bucket?.services) ? bucket.services : []
        );
      }

      let mapped = mapBoardingPlans(services);

      /**
       * Fallback: align with discovery/listing data source in case vendor-services
       * endpoint shape differs for some vendors.
       */
      if (mapped.length === 0) {
        const phoneParam = customerPhone ? `&customerPhone=${encodeURIComponent(customerPhone)}` : '';
        const styleRes = (await apiClient.get(
          `/customer/services/by-style?style=at_center&category=boarding${phoneParam}`
        ).catch(() => null)) as any;
        const providers = styleRes?.providers || styleRes?.vendors || [];
        const thisProvider = providers.find((p: any) => {
          const pid = String(p?.providerId || p?.vendorId || p?.id || '').trim();
          const vid = String(p?.vendorId || p?.id || '').trim();
          return pid === String(vendorId) || vid === String(vendorId);
        });
        mapped = mapBoardingPlans(thisProvider?.services || []);
      }

      setPublishedPlans(mapped);
      setVendor({
        id: String(merged.id ?? vendorId),
        name:
          String(merged.businessName ?? merged.business_name ?? merged.name ?? '').trim() ||
          'Pet Boarding',
        description: String(merged.description ?? '').trim(),
        address: String(merged.address ?? '').trim(),
        city: String(merged.city ?? '').trim(),
        pincode: String(merged.pincode ?? '').trim(),
        phone: String(merged.phone ?? '').trim(),
        rating: parseFloat(String(merged.rating ?? '0')),
        review_count: parseInt(String(merged.review_count ?? merged.totalReviews ?? '0'), 10),
        timing:
          String(merged.timing ?? merged.businessHours ?? merged.operatingHours ?? '').trim() ||
          '9:00 AM - 8:00 PM',
        photos: (Array.isArray(merged.photos) ? merged.photos : merged.gallery) as string[] | undefined ?? [],
        amenities,
        customAmenities,
        isVerified: !!(merged.isVerified ?? merged.is_verified),
      });
    } catch (e) {
      console.error('[BoardingVendorProfileView]', e);
      setVendor(null);
      setVendorRaw(null);
      setFacilityForHero(null);
      setPublishedPlans([]);
    } finally {
      setLoading(false);
    }
  };

  const planMatchingUrlHint = useMemo(() => {
    return publishedPlans.find((p) =>
      boardingSlugMatchesText(contextSlug, `${p.name} ${p.serviceStyle || ''}`)
    );
  }, [publishedPlans, contextSlug]);

  useEffect(() => {
    if (publishedPlans.length === 0) {
      setSelectedOffer(null);
      return;
    }
    if (planMatchingUrlHint) {
      setSelectedOffer(planMatchingUrlHint);
      return;
    }
    setSelectedOffer(null);
  }, [publishedPlans, planMatchingUrlHint]);

  const heroPhotos = useMemo(
    () => resolveVendorProfileHeroGallery({ facility: facilityForHero, vendor: vendorRaw, profileProvider: null }),
    [facilityForHero, vendorRaw]
  );

  const headerSubtitle = useMemo(() => {
    const label = BOARDING_SERVICE_LABELS[contextSlug] ?? 'Pet boarding & daycare';
    const city = vendor?.city?.trim();
    if (city) return `${label} · ${city}`;
    return label;
  }, [contextSlug, vendor?.city]);

  const serviceFocusChip = useMemo(() => {
    const fromSlug = BOARDING_SERVICE_LABELS[contextSlug];
    if (contextSlug !== 'all' && fromSlug) return fromSlug;
    const first = publishedPlans[0]?.name?.trim();
    if (first) return first.length > 36 ? `${first.slice(0, 34)}…` : first;
    return 'Boarding & daycare';
  }, [contextSlug, publishedPlans]);

  const handleShare = useCallback(() => {
    void shareVendorProfile({
      title: vendor?.name || 'Pet boarding',
      vendorId: vendor?.id || vendorId,
      persona: 'boarding',
      vendorName: vendor?.name,
      serviceSlug: contextSlug !== 'all' ? contextSlug : undefined,
    });
  }, [vendor?.id, vendor?.name, vendorId, contextSlug]);

  const handleBook = () => {
    if (!selectedOffer?.rowId) {
      return;
    }
    const rawRow = selectedOffer.rawRow;
    if (isVendorServicePackageRow(rawRow)) {
      const nav = buildWalkerServiceDataForVendorPackagePurchase({
        vendorId: String(vendor?.id || vendorId),
        vendorName: vendor?.name,
        serviceRow: rawRow,
        serviceTypeCategory: 'boarding',
        serviceStyle: selectedOffer.serviceStyle || 'at_center',
      });
      if (nav) {
        onNavigate('purchase-package', nav);
        return;
      }
    }
    const isSwimming =
      boardingSlugMatchesText('swimming', selectedOffer.name) ||
      serviceNameLooksLikeSwimming(selectedOffer.name);
    onNavigate('boarding-booking', {
      vendorId: vendor?.id || vendorId,
      serviceType: isSwimming ? 'swimming' : 'boarding',
      flowVariant: isSwimming ? 'swimming' : 'boarding',
      serviceId: selectedOffer.rowId,
      serviceName: selectedOffer.name,
      price: selectedOffer.price,
      duration: selectedOffer.duration || (isSwimming ? 60 : 1440),
      serviceStyle: selectedOffer.serviceStyle || 'at_center',
      serviceSlug: isSwimming ? 'swimming' : contextSlug !== 'all' ? contextSlug : undefined,
      facility: vendor,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto text-center py-12">
          <p className="text-gray-600">Boarding center not found</p>
          <Button onClick={onBack} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const profileVendorId = String(vendor.id ?? vendor.vendorId ?? '').trim();
  const hasPhotos = heroPhotos.length > 0;
  const fullAddress = [vendor.address, vendor.city, vendor.pincode].filter(Boolean).join(', ');

  return (
    <div className="mx-auto flex min-h-[100dvh] min-h-screen w-full max-w-customer flex-col overflow-x-hidden border-black/[0.04] bg-gray-50 shadow-[0_0_0_1px_rgba(0,0,0,0.04)] sm:border-x sm:shadow-[0_0_48px_rgba(0,0,0,0.06)]">
      <VendorProfileDashboardHeader
        className="!z-0 isolation-auto"
        serviceName="Pet Boarding"
        serviceSubtitle={headerSubtitle}
        serviceIcon={Building2}
        iconColor="text-white"
        onBack={onBack}
        showBackButton={true}
        bottomEdge="flat"
      />

      <div className="relative z-0 w-full flex-1">
        {hasPhotos ? (
          <div className="relative w-full -mt-3 sm:-mt-3">
            <div className="overflow-hidden rounded-t-[24px] bg-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] sm:rounded-t-[28px]">
              <VendorHeroPhotoCarousel
                photos={heroPhotos}
                name={vendor.name}
                frameClassName="relative aspect-[5/4] w-full max-h-[420px] overflow-hidden sm:aspect-auto sm:h-[280px] sm:max-h-none"
              />
            </div>
          </div>
        ) : (
          <div className="relative w-full -mt-3 sm:-mt-3">
            <div className="overflow-hidden rounded-t-[24px] sm:rounded-t-[28px]">
              <div className="relative flex aspect-[5/4] w-full max-h-[420px] items-center justify-center bg-gradient-to-br from-[#FF8C42] to-[#FF7029] sm:aspect-auto sm:h-[280px] sm:max-h-none">
                <div className="text-center text-white">
                  <Building2 className="mx-auto mb-3 h-20 w-20 opacity-50" aria-hidden />
                  <p className="text-sm opacity-80">No photos yet</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="px-4 cw-scroll-pad-tabbar-sticky-cta">
          <div className="relative z-10 -mt-6 mb-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h1 className="mb-3 text-2xl font-bold text-gray-900">{vendor.name}</h1>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              {resolveVendorRating(
                {
                  vendorId: profileVendorId,
                  vendorRating: vendor.rating,
                  review_count: vendor.review_count,
                },
                { expectedVendorId: profileVendorId }
              ).shouldShowRating ? (
                <div className="rounded-lg bg-orange-50 px-3 py-1.5">
                  <StarRating
                    rating={vendor.rating}
                    reviewCount={vendor.review_count}
                    starsClassName="h-5 w-5"
                    textClassName="text-sm text-gray-600"
                  />
                </div>
              ) : null}
              {vendor.isVerified ? (
                <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                  <Shield className="h-3.5 w-3.5" aria-hidden />
                  Verified
                </span>
              ) : null}
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5">
                <Building2 className="h-4 w-4 text-[#FF8C42]" aria-hidden />
                <span className="text-sm font-medium text-gray-700">Boarding center</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-purple-50 px-3 py-1.5">
                <Calendar className="h-4 w-4 text-[#FF8C42]" aria-hidden />
                <span className="max-w-[200px] truncate text-sm font-medium text-gray-700">{serviceFocusChip}</span>
              </div>
            </div>

            <div
              className={`mb-4 grid gap-2 border-t border-gray-100 pt-4 ${fullAddress ? 'grid-cols-3' : 'grid-cols-2'}`}
            >
              <button
                type="button"
                onClick={() => {
                  if (vendor.phone) window.location.href = `tel:${vendor.phone}`;
                }}
                className="group flex flex-col items-center justify-center gap-1.5 rounded-xl bg-gray-50 p-3 transition-colors hover:bg-gray-100"
              >
                <Phone className="h-5 w-5 text-[#FF8C42] transition-transform group-hover:scale-110" />
                <span className="text-xs font-medium text-gray-700">Call</span>
              </button>
              {fullAddress ? (
                <button
                  type="button"
                  onClick={() =>
                    window.open(
                      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`,
                      '_blank'
                    )
                  }
                  className="group flex flex-col items-center justify-center gap-1.5 rounded-xl bg-gray-50 p-3 transition-colors hover:bg-gray-100"
                >
                  <Navigation className="h-5 w-5 text-[#FF8C42] transition-transform group-hover:scale-110" />
                  <span className="text-xs font-medium text-gray-700">Directions</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={handleShare}
                className="group flex flex-col items-center justify-center gap-1.5 rounded-xl bg-gray-50 p-3 transition-colors hover:bg-gray-100"
              >
                <Share2 className="h-5 w-5 text-[#FF8C42] transition-transform group-hover:scale-110" />
                <span className="text-xs font-medium text-gray-700">Share</span>
              </button>
            </div>

            <div className="space-y-2.5 border-t border-gray-100 pt-4">
              {fullAddress ? (
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <span className="leading-relaxed text-gray-700">{fullAddress}</span>
                </div>
              ) : null}
              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="text-gray-700">{vendor.timing}</span>
              </div>
            </div>

            {vendor.amenities.length > 0 || vendor.customAmenities.length > 0 ? (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <AmenitiesSection
                  amenities={vendor.amenities}
                  customAmenities={vendor.customAmenities}
                  compact
                />
              </div>
            ) : null}

            <div className="mt-4 border-t border-gray-100 pt-4">
              <h3 className="mb-2 text-lg font-bold text-gray-900">About</h3>
              <p className="text-sm leading-relaxed text-gray-700">
                {vendor.description?.trim() ||
                  `${vendor.name} offers safe pet boarding and daycare. Browse plans below when you are ready to book.`}
              </p>
            </div>
          </div>

          <div id="boarding-services" className="scroll-mt-28 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <h2 className="font-bold text-gray-900">{'Services & prices'}</h2>
            <p className="mt-1 text-xs text-gray-500">
              Tap a plan to select it, then use <span className="font-medium text-gray-700">Continue to book</span>{' '}
              below.
            </p>
            {publishedPlans.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-600">
                No published boarding plans yet. Check back later or contact the center.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {publishedPlans.map((plan) => {
                  const Icon = pickIconForPublishedPlan(plan.name, plan.serviceStyle);
                  const isSel = selectedOffer?.rowId === plan.rowId;
                  return (
                    <button
                      key={plan.rowId}
                      type="button"
                      onClick={() => setSelectedOffer(plan)}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg border-2 px-3 py-3 text-left transition-all ${
                        isSel
                          ? 'border-orange-600 bg-orange-50 shadow-[0_0_0_1px_rgba(234,88,12,0.15)]'
                          : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/50'
                      }`}
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-2">
                        <Icon className="h-4 w-4 shrink-0 text-orange-500" aria-hidden />
                        <span className={`truncate font-medium ${isSel ? 'text-orange-900' : 'text-gray-800'}`}>
                          {plan.name}
                        </span>
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" aria-label="Available" />
                      </span>
                      <span
                        className={`shrink-0 font-semibold tabular-nums ${isSel ? 'text-orange-900' : 'text-[#FF8C42]'}`}
                      >
                        ₹{plan.price}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="cw-fixed-above-customer-tabbar fixed left-0 right-0 z-40 mx-auto w-full max-w-customer border-t bg-white px-5 py-3 sm:px-6">
        <div className="mx-auto w-full max-w-xs sm:max-w-sm">
          {publishedPlans.length === 0 ? (
            <Button
              type="button"
              disabled
              className="h-12 min-h-12 w-full cursor-not-allowed rounded-full bg-gray-300 px-4 text-center text-base font-semibold text-white"
            >
              No plans available yet
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleBook}
              disabled={!selectedOffer}
              className="h-12 min-h-12 w-full rounded-full bg-orange-500 px-4 text-center text-base font-semibold text-white shadow-md hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {selectedOffer ? 'Continue to book' : 'Choose a plan above'}
            </Button>
          )}
        </div>
      </div>

      <StandardizedFooter
        currentTab={footerActiveTab}
        onTabChange={(tab) => {
          if (tab === 'home') router.push('/');
          else if (tab === 'bookings') router.push('/bookings');
          else if (tab === 'shop') router.push('/shop');
          else if (tab === 'profile') router.push('/profile');
        }}
        maxWidth="max-w-customer"
      />
    </div>
  );
}
