"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { Star, Clock, MapPin, Phone, CheckCircle2, Building2, Moon, Sun, Calendar, CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { ServiceDashboardHeader } from '../shared/ServiceDashboardHeader';
import { StandardizedFooter } from '../shared/StandardizedFooter';
import { normalizeBoardingServiceSlug, boardingSlugMatchesText } from '@/lib/boarding-service-types';

export interface BoardingVendorProfileViewProps {
  phone: string;
  vendorId: string;
  serviceSlug?: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: Record<string, unknown>) => void;
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
  phone,
  vendorId,
  serviceSlug: serviceSlugProp,
  onBack,
  onNavigate,
}: BoardingVendorProfileViewProps) {
  const router = useRouter();
  const contextSlug = normalizeBoardingServiceSlug(serviceSlugProp ?? null);
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<VendorInfo | null>(null);
  const [publishedPlans, setPublishedPlans] = useState<MappedBoardingService[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<MappedBoardingService | null>(null);

  useEffect(() => {
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
        id: vendorData.id || vendorId,
        name: vendorData.business_name || vendorData.name || 'Pet Boarding',
        description: vendorData.description || '',
        address: vendorData.address || '',
        city: vendorData.city || '',
        pincode: vendorData.pincode || '',
        phone: vendorData.phone || '',
        rating: parseFloat(vendorData.rating || '0'),
        review_count: parseInt(vendorData.review_count || '0', 10),
        timing: vendorData.timing || vendorData.businessHours || '9:00 AM - 8:00 PM',
        photos: vendorData.photos || vendorData.gallery || [],
        amenities: vendorData.amenities || [],
      });
    } catch (e) {
      console.error('[BoardingVendorProfileView]', e);
      setVendor(null);
      setPublishedPlans([]);
    } finally {
      setLoading(false);
    }
  };

  /** Pre-select from ?service= query by matching URL hint to published plan text (API rows only). */
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
    setSelectedOffer((prev) => {
      if (prev && publishedPlans.some((p) => p.rowId === prev.rowId)) return prev;
      return publishedPlans[0];
    });
  }, [publishedPlans, planMatchingUrlHint]);

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
    { value: `${vendor.rating?.toFixed(1) || '4.5'}`, label: 'Rating', icon: <Star className="w-4 h-4 fill-white" /> },
    { value: `${vendor.review_count || 0}`, label: 'Reviews' },
    {
      value: `${publishedPlans.length || '—'}`,
      label: 'Services',
      icon: <Building2 className="w-4 h-4" />,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <ServiceDashboardHeader
        serviceName={vendor.name}
        serviceSubtitle="Pet Boarding Center"
        serviceIcon={Building2}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]"
      />

      <div className="max-w-customer mx-auto px-4 pt-4 pb-32">
        <div className="bg-white rounded-xl p-4 mb-4">
          <h2 className="font-bold text-gray-900 mb-1">Services & prices</h2>
          <p className="text-xs text-gray-500 mb-3">
            Tap a plan to select it for booking. Prices and options are set by this center.
          </p>
          {publishedPlans.length === 0 ? (
            <p className="text-sm text-gray-600 py-6 text-center">No published boarding plans yet. Check back later or contact the center.</p>
          ) : (
            <div className="max-h-[min(55vh,24rem)] overflow-y-auto space-y-2 pr-1 -mr-1">
              {publishedPlans.map((plan) => {
                const Icon = pickIconForPublishedPlan(plan.name, plan.serviceStyle);
                const isSel = selectedOffer?.rowId === plan.rowId;
                return (
                  <button
                    key={plan.rowId}
                    type="button"
                    onClick={() => setSelectedOffer(plan)}
                    className={`w-full flex items-center justify-between gap-3 py-3 px-3 rounded-lg border-2 transition-all text-left ${
                      isSel
                        ? 'border-orange-600 bg-orange-50 shadow-[0_0_0_1px_rgba(234,88,12,0.15)]'
                        : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50/50'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0 flex-1">
                      <Icon className="w-4 h-4 text-orange-500 shrink-0" aria-hidden />
                      <span
                        className={`font-medium truncate ${isSel ? 'text-orange-900' : 'text-gray-800'}`}
                      >
                        {plan.name}
                      </span>
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" aria-label="Available" />
                    </span>
                    <span className={`font-semibold tabular-nums shrink-0 ${isSel ? 'text-orange-900' : 'text-[#FF8C42]'}`}>
                      ₹{plan.price}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-orange-100 flex items-center justify-center text-2xl">🏠</div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">{vendor.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span className="font-semibold">{vendor.rating}</span>
                <span className="text-gray-500 text-sm">({vendor.review_count} reviews)</span>
              </div>
            </div>
          </div>

          {vendor.description ? <p className="text-gray-600 mt-4 text-sm">{vendor.description}</p> : null}

          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">
                {vendor.address}
                {vendor.city ? `, ${vendor.city}` : ''}
                {vendor.pincode ? ` - ${vendor.pincode}` : ''}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">{vendor.timing}</span>
            </div>
          </div>

          {vendor.amenities.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {vendor.amenities.map((a, idx) => (
                <span key={idx} className="px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-xs font-medium">
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-20">
          <button
            type="button"
            onClick={() => {
              if (vendor.phone) window.location.href = `tel:${vendor.phone}`;
            }}
            className="flex items-center justify-center gap-2 p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow"
          >
            <Phone className="w-5 h-5 text-orange-500" />
            <span className="font-medium text-gray-700">Call</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const dest = `${vendor.address}, ${vendor.city}`.trim();
              if (dest.length > 2) {
                window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`, '_blank');
              }
            }}
            className="flex items-center justify-center gap-2 p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow"
          >
            <MapPin className="w-5 h-5 text-orange-500" />
            <span className="font-medium text-gray-700">Directions</span>
          </button>
        </div>
      </div>

      <div className="fixed left-0 right-0 cw-fixed-above-customer-tabbar bg-white border-t px-5 py-3 sm:px-6 z-40">
        <div className="mx-auto w-full max-w-xs sm:max-w-sm">
        <Button
          onClick={handleBook}
          disabled={!selectedOffer}
          className="w-full whitespace-normal text-center rounded-full bg-orange-500 hover:bg-orange-600 min-h-12 px-3 py-2.5 text-sm font-semibold shadow-md disabled:bg-gray-300 disabled:cursor-not-allowed sm:h-12 sm:px-4 sm:text-base sm:py-0"
        >
          {selectedOffer ? `Book ${selectedOffer.name}` : 'Select a service'}
        </Button>
        </div>
      </div>

      <StandardizedFooter
        currentTab="bookings"
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
