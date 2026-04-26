"use client";

import { useState, useEffect, useCallback, useMemo, type MouseEvent } from 'react';
import {
  Star,
  MapPin,
  Clock,
  Search,
  ChevronRight,
  Building2,
  Stethoscope,
  Shield,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { mergeCustomerVendorServicesPayload } from '@/lib/customer-vendor-services-merge';
import {
  buildWalkerServiceDataForVendorPackagePurchase,
  isVendorServicePackageRow,
} from '@/lib/vendor-package-purchase-nav';
import { ServiceDashboardHeader } from '../shared/ServiceDashboardHeader';
import { StandardizedFooter } from '../shared/StandardizedFooter';
import { formatPriceWithSymbol } from '@/lib/booking-display-utils';
import { ServiceDescriptionInline } from '../shared/ServiceDescriptionInline';

interface ClinicListViewProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

/** One bookable row — stable identity for keys + booking */
export interface ClinicServiceRow {
  stableKey: string;
  name: string;
  price: number;
  duration: number;
  description?: string;
  /** Service category label (e.g. veterinary) for badge — mirrors grooming */
  category?: string;
  catalogServiceId: string | null;
  vendorServiceId: string | number;
  isPackage?: boolean;
  packageDetails?: unknown;
  metadata?: unknown;
}

export interface ClinicProvider {
  id: string;
  name: string;
  address: string;
  rating: number;
  review_count: number;
  distanceKm: number | null;
  timing: string;
  photo?: string;
  nextAvailableSlot?: string;
  roleDisplayName?: string;
  roleName?: string;
  role?: string;
  is_open?: boolean;
  isVerified?: boolean;
  services: ClinicServiceRow[];
  /** When true, expand triggers GET vendor services */
  needsServiceFetch?: boolean;
  vendorType?: string;
}

/** Prefer the longest vendor-authored description (catalog vs custom vs short). */
function pickBestVendorDescription(p: any): string {
  const candidates: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string' && v.trim()) candidates.push(v.trim());
  };
  push(p.longDescription);
  push(p.long_description);
  push(p.description);
  push(p.custom_description);
  push(p.customDescription);
  push(p.shortDescription);
  if (p.metadata && typeof p.metadata === 'object') {
    const m = p.metadata as Record<string, unknown>;
    push(m.description);
    push(m.customDescription);
    push(m.serviceDescription);
  }
  if (candidates.length === 0) return '';
  return candidates.reduce((a, b) => (b.length > a.length ? b : a), '');
}

function isSoloVendor(p: any): boolean {
  const vendorType = String(p.vendorType || p.vendor_type || p.providerType || '').toLowerCase();
  const roleName = String(p.role || p.roleName || '').toLowerCase();
  return (
    vendorType === 'solo' ||
    vendorType === 'individual' ||
    p.isSoloProvider === true ||
    p.isIndividualProvider === true ||
    roleName.includes('solo')
  );
}

function mapApiServiceToRow(p: any, vendorId: string, index: number): ClinicServiceRow {
  const vendorServiceId = p.id ?? p.vendor_service_id ?? `idx-${index}`;
  const catalogServiceId =
    (p.serviceId != null && String(p.serviceId)) || (p.service_id != null && String(p.service_id)) || null;
  const stableKey = catalogServiceId ? `cat-${catalogServiceId}` : `vs-${vendorId}-${vendorServiceId}`;
  const desc = pickBestVendorDescription(p);
  const priceRaw = p.price ?? p.custom_price ?? p.base_price ?? p.amount ?? 0;
  const priceNum = typeof priceRaw === 'string' ? parseFloat(priceRaw) : Number(priceRaw);
  const price = Number.isFinite(priceNum) && !Number.isNaN(priceNum) ? priceNum : 0;
  const durRaw = p.duration ?? p.durationMinutes ?? p.duration_minutes ?? 30;
  const durNum = typeof durRaw === 'string' ? parseInt(durRaw, 10) : Number(durRaw);
  const duration = Number.isFinite(durNum) && durNum > 0 ? durNum : 30;
  const category =
    (p.category && String(p.category)) ||
    (p.category_name && String(p.category_name)) ||
    (p.categorySlug && String(p.categorySlug)) ||
    undefined;
  return {
    stableKey,
    name: String(p.name || p.service_name || p.serviceName || p.display_name || 'Service'),
    price,
    duration,
    description: desc || undefined,
    category,
    catalogServiceId,
    vendorServiceId,
    isPackage: !!(p.isPackage ?? p.metadata?.isPackage),
    packageDetails: p.packageDetails,
    metadata: p.metadata,
  };
}

function mapByStyleProvider(p: any): ClinicProvider | null {
  if (isSoloVendor(p)) return null;
  const id = String(p.providerId || p.vendorId || p.id || '');
  if (!id) return null;
  const rawServices = Array.isArray(p.services) ? p.services : [];
  const services = rawServices.map((s: any, i: number) => mapApiServiceToRow(s, id, i));
  const nextSlot = (() => {
    if (typeof p.nextAvailableSlot === 'string') return p.nextAvailableSlot;
    if (p.nextAvailableSlot && typeof p.nextAvailableSlot === 'object') {
      return p.nextAvailableSlot.formattedDisplay || p.nextAvailableSlot.display;
    }
    if (typeof p.nextAvailability === 'string') return p.nextAvailability;
    if (p.nextAvailable && typeof p.nextAvailable === 'object') {
      return p.nextAvailable.display || p.nextAvailable.formattedDisplay;
    }
    return undefined;
  })();
  const address =
    p.address ||
    p.vendorLocation?.address ||
    [p.city, p.pincode].filter(Boolean).join(', ') ||
    'Location available on booking';
  return {
    id,
    name: cleanProviderName(p.name || p.vendorName || p.businessName || 'Veterinary Clinic'),
    address,
    rating: Number(p.rating ?? 0) || 0,
    review_count: Number(p.reviewCount ?? p.review_count ?? 0) || 0,
    distanceKm: p.distance != null && p.distance !== '' ? Number(p.distance) : null,
    timing: p.businessHours || p.timing || '9 AM - 8 PM',
    photo: p.photo || p.vendorPhoto || p.photoUrl,
    nextAvailableSlot: nextSlot,
    roleDisplayName: p.roleDisplayName || p.roleName || p.role,
    roleName: p.roleName || p.role,
    role: p.role || p.roleDisplayName,
    is_open: p.is_open ?? p.isAvailableToday,
    isVerified: !!p.isVerified,
    services,
    needsServiceFetch: services.length === 0,
    vendorType: p.vendorType,
  };
}

function cleanProviderName(name: string): string {
  return String(name || 'Clinic').replace(/\s*-\s*[a-f0-9-]{8,}\s*$/i, '').trim();
}

export function ClinicListView({ phone, onBack, onNavigate }: ClinicListViewProps) {
  const [loading, setLoading] = useState(true);
  const [clinics, setClinics] = useState<ClinicProvider[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'rating' | 'distance' | 'price'>('all');
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [fetchingServicesFor, setFetchingServicesFor] = useState<string | null>(null);

  const getLocationParams = () => {
    try {
      const customerLat = localStorage.getItem('customer_latitude');
      const customerLng = localStorage.getItem('customer_longitude');
      if (customerLat && customerLng) {
        return `&latitude=${encodeURIComponent(customerLat)}&longitude=${encodeURIComponent(customerLng)}`;
      }
    } catch {
      /* ignore */
    }
    return '';
  };

  const fetchVendorServicesForClinic = useCallback(
    async (clinicId: string) => {
      setFetchingServicesFor(clinicId);
      try {
        const phoneParam = phone ? `&customerPhone=${encodeURIComponent(phone)}` : '';
        const res = (await apiClient.get(
          `/customer/vendor/${clinicId}/services?serviceStyle=at_center${phoneParam}`
        ).catch(() => apiClient.get(`/vendor/${clinicId}/services`))) as any;
        let services: any[] = [];
        const servicesData = res;
        if (servicesData?.services && Array.isArray(servicesData.services)) {
          services = mergeCustomerVendorServicesPayload(servicesData);
        } else if (
          servicesData?.services?.at_home ||
          servicesData?.services?.at_center ||
          servicesData?.services?.tele
        ) {
          services = [
            ...(servicesData.services.at_center?.services || []),
            ...(servicesData.services.at_home?.services || []),
            ...(servicesData.services.tele?.services || []),
          ];
        } else if (Array.isArray(servicesData)) {
          services = servicesData;
        }
        const rows = services.map((s: any, i: number) => mapApiServiceToRow(s, clinicId, i));
        setClinics((prev) =>
          prev.map((c) => (c.id === clinicId ? { ...c, services: rows, needsServiceFetch: false } : c))
        );
      } catch (e) {
        console.error('[CLINIC-LIST] vendor services fetch failed', e);
      } finally {
        setFetchingServicesFor(null);
      }
    },
    [phone]
  );

  useEffect(() => {
    loadClinics();
  }, []);

  const loadDiscoverFallback = async (locationParams: string) => {
    const response = (await apiClient.get(
      `/customer/discover-services?category=vet&serviceStyle=at_center${locationParams}`
    )) as any;
    const servicesData = response.vendors || response.services || [];
    if (servicesData.length === 0) return [];
    const clinicsOnly = servicesData.filter((service: any) => !isSoloVendor(service));
    const vendorMap = new Map<string, ClinicProvider>();
    clinicsOnly.forEach((service: any) => {
      const vendorId = String(service.vendorId || service.id || '');
      if (!vendorId) return;
      const nextSlot = (() => {
        if (service.nextAvailability && typeof service.nextAvailability === 'string')
          return service.nextAvailability;
        if (
          service.nextAvailableSlot &&
          typeof service.nextAvailableSlot === 'object' &&
          service.nextAvailableSlot.formattedDisplay
        )
          return service.nextAvailableSlot.formattedDisplay;
        if (typeof service.nextAvailableSlot === 'string') return service.nextAvailableSlot;
        if (service.nextAvailable && typeof service.nextAvailable === 'object')
          return service.nextAvailable.display || service.nextAvailable.formattedDisplay;
        if (typeof service.nextAvailable === 'string') return service.nextAvailable;
        return undefined;
      })();
      const actualTiming = (() => {
        if (service.operatingHours && typeof service.operatingHours === 'object') {
          const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const today = days[new Date().getDay()];
          const todayHours = service.operatingHours[today];
          if (todayHours && todayHours.isOpen) {
            return `${todayHours.open} - ${todayHours.close}`;
          }
        }
        return service.businessHours || service.timing || '9 AM - 8 PM';
      })();
      if (!vendorMap.has(vendorId)) {
        const raw = service.services;
        let rows: ClinicServiceRow[] = [];
        if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'object') {
          rows = raw.map((s: any, i: number) => mapApiServiceToRow(s, vendorId, i));
        }
        vendorMap.set(vendorId, {
          id: vendorId,
          name: cleanProviderName(
            service.vendorName || service.businessName || service.business_name || service.name || 'Clinic'
          ),
          address:
            service.vendorLocation?.address ||
            service.address ||
            `${service.city || ''}${service.city ? ', ' : ''}${service.pincode || ''}`.trim() ||
            'Location available on booking',
          rating: parseFloat(service.vendorRating || service.rating || service.avgRating || '0') || 0,
          review_count: parseInt(
            String(service.vendorReviewCount || service.reviewsCount || service.review_count || '0'),
            10
          ),
          distanceKm: service.distance != null ? Number(service.distance) : null,
          timing: actualTiming,
          photo: service.vendorPhoto || service.photo || service.photoUrl || service.vendorProfileImage,
          nextAvailableSlot: nextSlot,
          roleDisplayName: service.roleDisplayName || service.role_name || service.roleName,
          roleName: service.roleName || service.role,
          role: service.role,
          is_open:
            service.is_open !== undefined
              ? service.is_open
              : service.isAvailableToday !== undefined
                ? service.isAvailableToday
                : undefined,
          isVerified: !!service.isVerified,
          services: rows,
          needsServiceFetch: rows.length === 0,
          vendorType: service.vendorType,
        });
      }
    });
    return Array.from(vendorMap.values());
  };

  const loadClinics = async () => {
    try {
      setLoading(true);
      const locationParams = getLocationParams();
      const phoneParam = phone ? `&customerPhone=${encodeURIComponent(phone)}` : '';

      let mapped: ClinicProvider[] = [];
      const loadByStyle = async (roleId: string) => {
        const response = (await apiClient.get(
          `/customer/services/by-style?style=at_center&category=vet&roleId=${encodeURIComponent(roleId)}${locationParams}${phoneParam}`
        )) as any;
        if (!response.success) return [];
        const providerData = response.providers || response.vendors || [];
        return providerData.map((p: any) => mapByStyleProvider(p)).filter(Boolean) as ClinicProvider[];
      };
      try {
        mapped = await loadByStyle('veterinarian');
        if (mapped.length === 0) {
          mapped = await loadByStyle('vet_clinic');
        }
      } catch (e) {
        console.warn('[CLINIC-LIST] by-style failed', e);
      }

      if (mapped.length === 0) {
        try {
          mapped = await loadDiscoverFallback(locationParams);
        } catch (e) {
          console.error('[CLINIC-LIST] discover fallback failed', e);
        }
      }

      if (mapped.length === 0) {
        try {
          const fallbackResponse = (await apiClient.get('/vendors?role=veterinarian')) as any;
          if (fallbackResponse?.vendors?.length > 0) {
            mapped = fallbackResponse.vendors
              .filter((v: any) => !isSoloVendor(v))
              .map((v: any) => {
                const id = String(v.id);
                return {
                  id,
                  name: cleanProviderName(v.businessName || v.business_name || v.name || 'Clinic'),
                  address:
                    v.address ||
                    `${v.city || ''}${v.city ? ', ' : ''}${v.pincode || ''}`.trim() ||
                    'Location available on booking',
                  rating: parseFloat(v.rating || v.avgRating || '0') || 0,
                  review_count: parseInt(String(v.reviewCount || v.review_count || '0'), 10),
                  distanceKm: null,
                  timing: v.timing || v.businessHours || '9 AM - 8 PM',
                  photo: v.photo || v.businessPhoto || v.vendorPhoto,
                  services: [],
                  needsServiceFetch: true,
                } as ClinicProvider;
              });
          }
        } catch (e) {
          console.error('[CLINIC-LIST] vendors fallback failed', e);
        }
      }

      setClinics(mapped);
    } catch (error) {
      console.error('Error loading clinics:', error);
      setClinics([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleClinic = (clinicId: string) => {
    setSelectedClinicId((prev) => (prev === clinicId ? null : clinicId));
  };

  useEffect(() => {
    if (!selectedClinicId) return;
    const c = clinics.find((x) => x.id === selectedClinicId);
    if (!c || !c.needsServiceFetch || c.services.length > 0) return;
    if (fetchingServicesFor === selectedClinicId) return;
    fetchVendorServicesForClinic(selectedClinicId);
  }, [selectedClinicId, clinics, fetchingServicesFor, fetchVendorServicesForClinic]);

  const handleBookService = (clinic: ClinicProvider, row: ClinicServiceRow) => {
    const vendorId = clinic.id;
    const serviceIdForBooking = row.catalogServiceId || String(row.vendorServiceId);
    const serviceObj = {
      id: String(row.vendorServiceId),
      serviceId: row.catalogServiceId,
      vendorServiceId: row.vendorServiceId,
      name: row.name,
      price: row.price,
      duration: row.duration,
      isPackage: row.isPackage,
      packageDetails: row.packageDetails,
      metadata: row.metadata,
    };
    if (isVendorServicePackageRow(serviceObj as Record<string, unknown>)) {
      const nav = buildWalkerServiceDataForVendorPackagePurchase({
        vendorId: String(vendorId),
        vendorName: clinic.name,
        serviceRow: serviceObj as Record<string, unknown>,
        serviceTypeCategory: 'vet',
        serviceStyle: 'at_center',
      });
      if (nav) {
        onNavigate('purchase-package', nav);
        return;
      }
    }
    onNavigate('appointment', {
      clinicId: vendorId,
      vendorId,
      vendorName: clinic.name,
      service: serviceObj,
      serviceId: serviceIdForBooking,
      serviceName: row.name,
      price: row.price,
      duration: row.duration,
      serviceStyle: 'at_center',
      serviceType: 'at_center',
      clinic: {
        id: vendorId,
        name: clinic.name,
        address: clinic.address,
        rating: clinic.rating,
        review_count: clinic.review_count,
        timing: clinic.timing,
      },
    });
  };

  const openClinicDetails = (e: MouseEvent, clinicId: string) => {
    e.stopPropagation();
    onNavigate('vet-services-by-style', {
      vendorId: clinicId,
      serviceStyle: 'at_center',
      serviceTypeName: 'Vet Clinic',
      category: 'vet',
      returnScreen: 'vet-clinic-list',
    });
  };

  const filteredClinics = useMemo(
    () =>
      clinics.filter(
        (clinic) =>
          clinic.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          clinic.address.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [clinics, searchQuery]
  );

  const sortedClinics = useMemo(() => {
    const list = [...filteredClinics];
    switch (selectedFilter) {
      case 'rating':
        return list.sort((a, b) => b.rating - a.rating);
      case 'distance':
        return list.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
      case 'price': {
        const minP = (c: ClinicProvider) =>
          c.services.length ? Math.min(...c.services.map((s) => s.price)) : 999999;
        return list.sort((a, b) => minP(a) - minP(b));
      }
      default:
        return list;
    }
  }, [filteredClinics, selectedFilter]);

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'rating', label: 'Top Rated' },
    { id: 'distance', label: 'Nearest' },
    { id: 'price', label: 'Price' },
  ];

  const minPriceForClinic = (c: ClinicProvider) => {
    if (!c.services.length) return null;
    return Math.min(...c.services.map((s) => s.price));
  };

  const dashboardStats = [
    { value: `${filteredClinics.length}+`, label: 'Clinics', icon: <Building2 className="w-4 h-4" /> },
    { value: '1K+', label: 'Bookings' },
    { value: '4.8', label: 'Rating', icon: <Star className="w-4 h-4 fill-white" /> },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <ServiceDashboardHeader
        serviceName="Veterinary Clinic"
        serviceSubtitle="Find a veterinary clinic near you"
        serviceIcon={Stethoscope}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-[#FF8C42]"
      />

      <div className="max-w-customer mx-auto px-4 pt-4 pb-36">
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search clinics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF8C42]/40 focus:border-[#FF8C42] transition-all"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mb-5">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setSelectedFilter(filter.id as any)}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                selectedFilter === filter.id
                  ? 'bg-[#FF8C42] text-white shadow-[0_2px_8px_rgba(255,140,66,0.35)]'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-[#FF8C42]/30 border-t-[#FF8C42]" />
            <p className="text-gray-500 text-sm mt-4">Finding clinics...</p>
          </div>
        ) : sortedClinics.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#FFF5EE] flex items-center justify-center text-3xl">
              🏥
            </div>
            <p className="text-gray-800 font-semibold">No clinics found</p>
            <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">{sortedClinics.length} clinics found</p>

            {sortedClinics.map((clinic) => {
              const expanded = selectedClinicId === clinic.id;
              const minP = minPriceForClinic(clinic);
              const headerActsAsCollapse = expanded;
              const headerInteractive = headerActsAsCollapse;
              return (
                <Card key={clinic.id} className="bg-white rounded-xl border border-gray-100 shadow-sm">
                  <div
                    role={headerInteractive ? 'button' : undefined}
                    tabIndex={headerInteractive ? 0 : undefined}
                    onClick={headerInteractive ? () => toggleClinic(clinic.id) : undefined}
                    onKeyDown={
                      headerInteractive
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggleClinic(clinic.id);
                            }
                          }
                        : undefined
                    }
                    className={`p-4 border-b border-gray-100 text-left w-full ${
                      headerInteractive ? 'cursor-pointer hover:bg-gray-50' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      {clinic.photo ? (
                        <img
                          src={clinic.photo}
                          alt={clinic.name}
                          className="w-16 h-16 rounded-2xl object-cover ring-2 ring-[#FF8C42]/20 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FFF5EE] to-[#FFE8D6] flex items-center justify-center flex-shrink-0 border border-orange-100/50">
                          <Building2 className="w-7 h-7 text-[#FF8C42]" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <h3 className="font-bold text-gray-900 truncate">{clinic.name}</h3>
                            {clinic.isVerified && (
                              <Shield className="w-4 h-4 text-green-500 shrink-0" aria-hidden />
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => openClinicDetails(e, clinic.id)}
                            onKeyDown={(e) => e.stopPropagation()}
                            aria-label="View clinic profile"
                            className="flex-shrink-0 p-1 -m-1 rounded-md text-gray-400 hover:text-[#FF8C42] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8C42]/40"
                          >
                            <ChevronRight className="w-5 h-5 pointer-events-none" aria-hidden />
                          </button>
                        </div>
                        {(clinic.roleDisplayName || clinic.role || clinic.roleName) && (
                          <div className="mt-0.5">
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                              {clinic.roleDisplayName || clinic.role || clinic.roleName}
                            </Badge>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
                          <span className="font-semibold text-sm text-gray-800">
                            {clinic.rating.toFixed(1)}
                          </span>
                          <span className="text-gray-400 text-sm">({clinic.review_count})</span>
                          {clinic.distanceKm != null && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span className="text-sm text-gray-500">
                                {clinic.distanceKm.toFixed(1)} km
                              </span>
                            </>
                          )}
                          {minP != null && clinic.services.length > 0 && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span className="text-sm font-semibold text-[#FF8C42]">
                                from {formatPriceWithSymbol(minP)}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 text-sm text-gray-500">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{clinic.address}</span>
                        </div>
                        {clinic.nextAvailableSlot && (
                          <div className="flex items-center gap-1.5 mt-2">
                            <Clock className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-sm font-medium text-green-600">
                              Next: {clinic.nextAvailableSlot}
                            </span>
                          </div>
                        )}
                        {!clinic.nextAvailableSlot && (
                          <div className="flex items-center gap-1 mt-1.5 text-sm text-gray-500">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            <span>{clinic.timing}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {expanded && (
                    <div className="bg-gray-50 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold text-gray-700">
                          Available Services ({clinic.services.length})
                        </h4>
                        <button
                          type="button"
                          onClick={(e) => openClinicDetails(e, clinic.id)}
                          className="text-xs font-medium text-[#FF8C42] hover:underline"
                        >
                          Clinic details
                        </button>
                      </div>

                      {fetchingServicesFor === clinic.id && clinic.services.length === 0 ? (
                        <div className="flex items-center justify-center py-8 text-gray-500 gap-2">
                          <Loader2 className="w-5 h-5 animate-spin text-[#FF8C42]" />
                          <span className="text-sm">Loading services…</span>
                        </div>
                      ) : clinic.services.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">No services listed for this clinic.</p>
                      ) : (
                        <div className="max-h-[min(60vh,28rem)] overflow-y-auto pr-1 space-y-3">
                          {clinic.services.map((service) => {
                            const descTrim = service.description?.trim() ?? '';
                            return (
                              <div
                                key={service.stableKey}
                                className="bg-white rounded-lg p-4 shadow-sm border border-gray-100"
                              >
                                {/* Price + CTA on the right only; left = name, desc, duration/category (avoids flex overflow on narrow viewports) */}
                                <div className="flex w-full min-w-0 items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1 pr-1">
                                    <h5 className="font-medium text-gray-900 break-words">{service.name}</h5>
                                    {descTrim ? (
                                      <div onClick={(e) => e.stopPropagation()}>
                                        <ServiceDescriptionInline
                                          description={descTrim}
                                          title={service.name}
                                          className="m-0 mt-1 text-sm leading-5 text-gray-500"
                                          dialogHint="Full description from the clinic (vendor-provided)"
                                        />
                                      </div>
                                    ) : (
                                      <p className="text-gray-400 text-sm mt-1 line-clamp-2 italic">
                                        Professional in-clinic care — tap Book Now to continue.
                                      </p>
                                    )}
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                      <Badge variant="outline" className="text-xs shrink-0">
                                        <Clock className="w-3 h-3 mr-1" />
                                        {service.duration} mins
                                      </Badge>
                                      <Badge variant="secondary" className="text-xs shrink-0 max-w-full">
                                        {service.category || 'Veterinary'}
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="shrink-0 text-right ml-2 min-w-[6.5rem]">
                                    <div className="text-lg font-bold text-[#FF8C42] mb-2 tabular-nums">
                                      {formatPriceWithSymbol(service.price)}
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="bg-[#FF8C42] hover:bg-[#E67A35] text-white w-full sm:w-auto"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleBookService(clinic, service);
                                      }}
                                    >
                                      Book Now
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {!expanded && (
                    <div className="px-4 py-3 bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="text-sm text-gray-600">
                        {clinic.services.length > 0 ? (
                          <>
                            {clinic.services.length} service{clinic.services.length !== 1 ? 's' : ''}{' '}
                            available
                            {minP != null && (
                              <span className="text-gray-900 font-medium">
                                {' '}
                                from {formatPriceWithSymbol(minP)}
                              </span>
                            )}
                          </>
                        ) : clinic.needsServiceFetch ? (
                          <span className="text-gray-500">Tap to load services & prices</span>
                        ) : (
                          <span className="text-gray-500">No services available</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-[#FF8C42] border-[#FF8C42] hover:bg-[#FF8C42]/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClinicId(clinic.id);
                          }}
                        >
                          View Services
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-gray-600"
                          onClick={(e) => openClinicDetails(e, clinic.id)}
                        >
                          Details
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <StandardizedFooter
        currentTab="bookings"
        onTabChange={(tab) => {
          if (tab === 'home') onBack();
          else if (tab === 'bookings') onNavigate('my-bookings');
          else if (tab === 'cart') onNavigate('cart');
          else if (tab === 'profile') onNavigate('profile');
        }}
        maxWidth="max-w-customer"
      />

    </div>
  );
}
