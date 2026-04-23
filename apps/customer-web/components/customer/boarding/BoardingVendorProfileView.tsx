"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  Star,
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
import { ServiceDashboardHeader } from '../shared/ServiceDashboardHeader';
import { StandardizedFooter } from '../shared/StandardizedFooter';
import {
  normalizeBoardingServiceSlug,
  boardingSlugMatchesText,
  BOARDING_SERVICE_LABELS,
} from '@/lib/boarding-service-types';
import { getVendorHeroPhotoUrls } from '@/lib/vendor-display-media';
import { VendorHeroPhotoCarousel } from '../shared/VendorHeroPhotoCarousel';

export interface BoardingVendorProfileViewProps {
  phone: string;
  vendorId: string;
  serviceSlug?: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: Record<string, unknown>) => void;
  /** Bottom nav highlight in the customer app shell (avoid implying user is on Bookings). */
  footerActiveTab?: 'home' | 'cart' | 'bookings' | 'profile';
}

interface MappedBoardingService {
  rowId: string;
  serviceId?: string;
  name: string;
  price: number;
  duration?: number;
  serviceStyle?: string;
}

interface VendorInfo {
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
  phone: _customerPhone,
  vendorId,
  serviceSlug: serviceSlugProp,
  onBack,
  onNavigate,
  footerActiveTab = 'home',
}: BoardingVendorProfileViewProps) {
  const router = useRouter();
  const servicesAnchorRef = useRef<HTMLDivElement>(null);
  const contextSlug = normalizeBoardingServiceSlug(serviceSlugProp ?? null);
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<VendorInfo | null>(null);
  /** Raw vendor payload for hero photos (same shapes as vet profile). */
  const [vendorRaw, setVendorRaw] = useState<Record<string, unknown> | null>(null);
  const [publishedPlans, setPublishedPlans] = useState<MappedBoardingService[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<MappedBoardingService | null>(null);
  /** After user taps "Select Services to Book", show plan list (vet-style: booking is explicit). */
  const [plansPickerActive, setPlansPickerActive] = useState(false);

  useEffect(() => {
    setPlansPickerActive(false);
    loadVendor();
  }, [vendorId]);

  const loadVendor = async () => {
    try {
      setLoading(true);
      const [vendorResponse, servicesResponse] = await Promise.all([
        apiClient.get(`/customer/vendor/${vendorId}`),
        apiClient
          .get(`/customer/vendor/${vendorId}/services?category=boarding`)
          .catch(() => apiClient.get(`/customer/vendor/${vendorId}/services?serviceStyle=at_center`)),
      ]);

      const vendorData = (vendorResponse as any)?.vendor || vendorResponse;
      const raw =
        vendorData && typeof vendorData === 'object' ? (vendorData as Record<string, unknown>) : {};
      setVendorRaw(raw);

      let services: any[] = [];
      const servicesData = servicesResponse as any;
      if (servicesData?.services && Array.isArray(servicesData.services)) {
        services = servicesData.services;
      } else if (servicesData?.services?.at_center) {
        services = servicesData.services.at_center?.services || [];
      }

      const seen = new Set<string>();
      const mapped: MappedBoardingService[] = [];
      for (const s of services) {
        const rowId = String(s.id ?? s.vendorServiceId ?? s.serviceId ?? '');
        if (!rowId || seen.has(rowId)) continue;
        seen.add(rowId);
        mapped.push({
          rowId,
          serviceId: s.serviceId || s.service_id,
          name: s.serviceName || s.name || s.service_name || 'Boarding',
          price: parseFloat(String(s.price || '0')) || 0,
          duration: s.duration || s.duration_minutes,
          serviceStyle: s.serviceStyle || s.service_style,
        });
      }

      setPublishedPlans(mapped);
      setVendor({
        id: (vendorData.id as string) || vendorId,
        name: (vendorData.business_name as string) || (vendorData.name as string) || 'Pet Boarding',
        description: (vendorData.description as string) || '',
        address: (vendorData.address as string) || '',
        city: (vendorData.city as string) || '',
        pincode: (vendorData.pincode as string) || '',
        phone: (vendorData.phone as string) || '',
        rating: parseFloat(String(vendorData.rating || '0')),
        review_count: parseInt(String(vendorData.review_count || '0'), 10),
        timing: (vendorData.timing as string) || (vendorData.businessHours as string) || '9:00 AM - 8:00 PM',
        photos: (vendorData.photos as string[]) || (vendorData.gallery as string[]) || [],
        amenities: Array.isArray(vendorData.amenities) ? (vendorData.amenities as string[]) : [],
        isVerified: !!(vendorData.isVerified ?? vendorData.is_verified),
      });
    } catch (e) {
      console.error('[BoardingVendorProfileView]', e);
      setVendor(null);
      setVendorRaw(null);
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
      setPlansPickerActive(true);
      return;
    }
    setSelectedOffer(null);
  }, [publishedPlans, planMatchingUrlHint]);

  const heroPhotos = useMemo(() => getVendorHeroPhotoUrls({ vendor: vendorRaw }), [vendorRaw]);

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

  const revealPlansAndScroll = useCallback(() => {
    setPlansPickerActive(true);
    requestAnimationFrame(() => {
      servicesAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const handleShare = useCallback(() => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    const title = vendor?.name || 'Pet boarding';
    if (navigator.share) {
      void navigator.share({ title, url }).catch(() => {});
    } else {
      void navigator.clipboard?.writeText(url).catch(() => {});
    }
  }, [vendor?.name]);

  const handleBook = () => {
    if (!selectedOffer?.rowId) {
      return;
    }
    onNavigate('boarding-booking', {
      vendorId: vendor?.id || vendorId,
      serviceType: 'boarding',
      serviceId: selectedOffer.rowId,
      serviceName: selectedOffer.name,
      price: selectedOffer.price,
      duration: selectedOffer.duration || 1440,
      serviceStyle: selectedOffer.serviceStyle || 'at_center',
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

  const dashboardStats = [
    { value: `${vendor.rating?.toFixed(1) || '—'}`, label: 'Rating', icon: <Star className="w-4 h-4 fill-white" /> },
    { value: `${vendor.review_count || 0}`, label: 'Reviews' },
    {
      value: `${publishedPlans.length || '—'}`,
      label: 'Plans',
      icon: <Building2 className="w-4 h-4" />,
    },
  ];

  const hasPhotos = heroPhotos.length > 0;
  const fullAddress = [vendor.address, vendor.city, vendor.pincode].filter(Boolean).join(', ');

  return (
    <div className="mx-auto flex min-h-[100dvh] min-h-screen w-full max-w-customer flex-col overflow-x-hidden border-black/[0.04] bg-gray-50 shadow-[0_0_0_1px_rgba(0,0,0,0.04)] sm:border-x sm:shadow-[0_0_48px_rgba(0,0,0,0.06)]">
      <ServiceDashboardHeader
        className="!z-0 isolation-auto"
        serviceName={vendor.name}
        serviceSubtitle={headerSubtitle}
        serviceIcon={Building2}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-[#FF8C42]"
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

        <div className="px-4 pb-36">
          <div className="relative z-10 -mt-6 mb-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h1 className="mb-3 text-2xl font-bold text-gray-900">{vendor.name}</h1>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-lg bg-orange-50 px-3 py-1.5">
                <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
                <span className="text-lg font-bold text-gray-900">
                  {vendor.rating != null ? vendor.rating.toFixed(1) : '—'}
                </span>
                <span className="text-sm text-gray-600">({vendor.review_count} reviews)</span>
              </div>
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

            {vendor.amenities.length > 0 ? (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <h3 className="mb-2 text-xs font-semibold uppercase text-gray-500">Features</h3>
                <div className="flex flex-wrap gap-2">
                  {vendor.amenities.slice(0, 8).map((a, idx) => (
                    <span
                      key={idx}
                      className="rounded-lg border border-orange-100 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700"
                    >
                      {a}
                    </span>
                  ))}
                  {vendor.amenities.length > 8 ? (
                    <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600">
                      +{vendor.amenities.length - 8} more
                    </span>
                  ) : null}
                </div>
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

          {plansPickerActive ? (
            <div
              id="boarding-services"
              ref={servicesAnchorRef}
              className="scroll-mt-28 rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
            >
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
                <div className="mt-3 max-h-[min(55vh,24rem)] space-y-2 overflow-y-auto pr-1 -mr-1">
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
          ) : null}
        </div>
      </div>

      <div className="cw-fixed-above-customer-tabbar fixed bottom-0 left-0 right-0 z-40 border-t bg-white px-5 py-3 sm:px-6">
        <div className="mx-auto w-full max-w-xs sm:max-w-sm">
          {!plansPickerActive ? (
            <Button
              type="button"
              onClick={revealPlansAndScroll}
              className="h-12 min-h-12 w-full rounded-full bg-orange-500 px-4 text-center text-base font-semibold text-white shadow-md hover:bg-orange-600"
            >
              Select Services to Book
            </Button>
          ) : publishedPlans.length === 0 ? (
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
          else if (tab === 'cart') router.push('/cart');
          else if (tab === 'profile') router.push('/profile');
        }}
        maxWidth="max-w-customer"
      />
    </div>
  );
}
