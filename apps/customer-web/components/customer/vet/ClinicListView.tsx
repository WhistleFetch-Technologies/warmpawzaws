"use client";

import { useState, useEffect, useCallback, useMemo, useRef, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
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
import { discoveryVendorList, discoveryNextCursor } from '@/lib/discovery-list';
import { apiClient } from '@/lib/api-client';
import { resolveCustomerDiscoveryCoords } from '@/lib/customer-discovery-coords';
import { mapVendorServicesForVetHub } from '@/lib/map-vendor-services-for-vet';
import {
  buildVendorServicesPageUrl,
  vendorServicesNextCursor,
  vendorServicesRowsFromResponse,
} from '@/lib/vendor-services-page';
import { HUB_DISCOVERY_VET } from '@/lib/service-hub-discovery-config';
import {
  buildWalkerServiceDataForVendorPackagePurchase,
  isVendorServicePackageRow,
  normalizeVendorServiceRowForPackage,
} from '@/lib/vendor-package-purchase-nav';
import { toast } from 'sonner';
import {
  filterServicesForVetHub,
  resolveServiceCategoryDisplayLabel,
  applyVetHubDiscoveryToProviders,
  isNonVetProviderRow,
} from '@/lib/filter-hub-services';
import { ServiceDashboardHeader } from '../shared/ServiceDashboardHeader';
import { EMPTY_SERVICE_HEADER_STATS } from '@/lib/service-header-stats';
import { StandardizedFooter } from '../shared/StandardizedFooter';
import { formatPriceWithSymbol } from '@/lib/booking-display-utils';
import { ServicePricingDisplay } from '../ServicePricingDisplay';
import { pickProviderDistanceKm } from '@/lib/distance-display';
import { INDICATIVE_PRICING_NOTE } from '@/lib/pricing-disclaimer';
import { ServiceDescriptionInline } from '../shared/ServiceDescriptionInline';
import { VendorRatingDisplay } from '../shared/VendorRatingDisplay';
import { applyResolvedRatingToStoredFields } from '@/lib/resolve-vendor-rating';
import { WarmpawzPayVendorCard } from '@/components/warmpawz-pay/vendor-card/WarmpawzPayVendorCard';
import { buildWapptDiscoveryVendorCardProps } from '@/lib/wappt-discovery-vendor-card';
import { launchWarmpawzPayServiceBooking } from '@/lib/commerce-switch-routing/launch-warmpawz-pay-service-booking';
import { resolveNextAvailableLabel } from '@/lib/available-slots-response';
import { useServiceStyleLaunchGate } from '@/hooks/useServiceStyleLaunchGate';
import { ServiceStyleLaunchBlocked } from '../shared/ServiceStyleLaunchBlocked';
import { DiscoveryVendorFeedSentinel } from '../shared/DiscoveryVendorFeedSentinel';
import {
  buildWarmpawzAppointmentsBookingNav,
  resolveWarmpawzBookingScreen,
} from '@/lib/warmpawz-appointments-customer';
import { discoveryServiceSections } from '@/lib/vendor-services-package-sections';

interface ClinicListViewProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  /** Problem tile / specialization id for GET /customer/services/by-style */
  specialization?: string;
  /** `returnScreen` when opening vet-services-by-style from Details (default: vet-clinic-list). */
  vetStyleProfileReturnScreen?: string;
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
  catalogCategoryId?: string;
  catalogServiceSlug?: string;
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
  servicesHydrated?: boolean;
  servicesNextCursor?: string | null;
  servicesLoadingMore?: boolean;
  vendorType?: string;
  warmpawzAppointments?: boolean;
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

function coerceOptionalString(v: unknown): string | undefined {
  if (v == null || v === '') return undefined;
  if (typeof v === 'string') return v.trim() || undefined;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return undefined;
}

function coerceStringOrNumber(v: unknown, fallback: string | number): string | number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = coerceOptionalString(v);
  return s ?? fallback;
}

function mapApiServiceToRow(p: any, vendorId: string, index: number, omitPrice: boolean): ClinicServiceRow {
  const normalized = normalizeVendorServiceRowForPackage(p);
  const vendorServiceId = coerceStringOrNumber(
    normalized.id ?? normalized.vendor_service_id ?? p.vendor_service_id,
    `idx-${index}`
  );
  const catalogServiceId =
    coerceOptionalString(normalized.serviceId) ??
    coerceOptionalString(normalized.service_id) ??
    coerceOptionalString(p.serviceId) ??
    coerceOptionalString(p.service_id) ??
    null;
  const stableKey = catalogServiceId ? `cat-${catalogServiceId}` : `vs-${vendorId}-${vendorServiceId}`;
  const desc = pickBestVendorDescription(normalized);
  const priceRaw =
    normalized.price ?? normalized.custom_price ?? normalized.base_price ?? normalized.amount;
  const priceNum = typeof priceRaw === 'string' ? parseFloat(priceRaw) : Number(priceRaw);
  const price =
    omitPrice || priceRaw === null || priceRaw === undefined
      ? 0
      : Number.isFinite(priceNum) && !Number.isNaN(priceNum)
        ? priceNum
        : 0;
  const durRaw = normalized.duration ?? normalized.durationMinutes ?? normalized.duration_minutes ?? 30;
  const durNum = typeof durRaw === 'string' ? parseInt(durRaw, 10) : Number(durRaw);
  const duration = Number.isFinite(durNum) && durNum > 0 ? durNum : 30;
  const category =
    coerceOptionalString(normalized.category) ??
    coerceOptionalString(normalized.category_name) ??
    coerceOptionalString(normalized.categorySlug) ??
    undefined;
  const catalogCategoryId =
    normalized.catalogCategoryId ?? normalized.catalog_category_id ?? normalized.category_id;
  const catalogServiceSlug =
    normalized.catalogServiceId ?? normalized.catalog_service_id ?? undefined;
  return {
    stableKey,
    name: String(
      normalized.name || normalized.service_name || normalized.serviceName || normalized.display_name || 'Service'
    ),
    price,
    duration,
    description: desc || undefined,
    category,
    catalogCategoryId: catalogCategoryId != null ? String(catalogCategoryId) : undefined,
    catalogServiceSlug: catalogServiceSlug != null ? String(catalogServiceSlug) : undefined,
    catalogServiceId,
    vendorServiceId,
    isPackage: isVendorServicePackageRow(normalized),
    packageDetails: normalized.packageDetails,
    metadata: normalized.metadata,
  };
}

function mapByStyleProvider(p: any): ClinicProvider | null {
  if (isNonVetProviderRow(p)) return null;
  if (isSoloVendor(p)) return null;
  const id = String(p.providerId || p.vendorId || p.id || '');
  if (!id) return null;
  const omitPrice = p.warmpawzAppointments === true;
  const rawServices = Array.isArray(p.services) ? p.services : [];
  const services = filterServicesForVetHub<ClinicServiceRow>(
    rawServices.map((s: any, i: number) => mapApiServiceToRow(s, id, i, omitPrice))
  );
  const nextSlot = resolveNextAvailableLabel(p);
  const address =
    p.address ||
    p.vendorLocation?.address ||
    [p.city, p.pincode].filter(Boolean).join(', ') ||
    'Location available on booking';
  const ratingFields = applyResolvedRatingToStoredFields({ ...p, vendorId: id, id }, id);
  return {
    id,
    name: cleanProviderName(p.name || p.vendorName || p.businessName || 'Veterinary Clinic'),
    address,
    rating: ratingFields.rating,
    review_count: ratingFields.review_count,
    distanceKm: (() => {
      if (p.distance != null && p.distance !== '') {
        const n = Number(p.distance);
        return Number.isFinite(n) ? n : null;
      }
      return pickProviderDistanceKm(p);
    })(),
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
    warmpawzAppointments: omitPrice,
  };
}

function cleanProviderName(name: string): string {
  return String(name || 'Clinic').replace(/\s*-\s*[a-f0-9-]{8,}\s*$/i, '').trim();
}

export function ClinicListView({
  phone,
  onBack,
  onNavigate,
  specialization,
  vetStyleProfileReturnScreen = 'vet-clinic-list',
}: ClinicListViewProps) {
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const listCursorRef = useRef<string | null>(null);
  const [clinics, setClinics] = useState<ClinicProvider[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'rating' | 'distance' | 'price'>('all');
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [fetchingServicesFor, setFetchingServicesFor] = useState<string | null>(null);
  const router = useRouter();
  const launchGate = useServiceStyleLaunchGate(phone, 'vet', 'at_center');

  const fetchVendorServicesForClinic = useCallback(
    async (clinicId: string, append = false) => {
      const clinic = clinics.find((c) => c.id === clinicId);
      if (!clinic) return;
      if (append) {
        if (!clinic.servicesNextCursor || clinic.servicesLoadingMore) return;
      } else if (clinic.servicesHydrated) {
        return;
      }
      if (append) {
        setClinics((prev) =>
          prev.map((c) =>
            c.id === clinicId ? { ...c, servicesLoadingMore: true } : c
          )
        );
      } else {
        setFetchingServicesFor(clinicId);
      }
      try {
        const res = (await apiClient
          .get(
            buildVendorServicesPageUrl({
              vendorId: clinicId,
              serviceStyle: 'at_center',
              category: HUB_DISCOVERY_VET.servicesApiCategory,
              customerPhone: phone || undefined,
              cursor: append ? clinic.servicesNextCursor : undefined,
            })
          )
          .catch(() =>
            apiClient.get(
              buildVendorServicesPageUrl({
                vendorId: clinicId,
                customerPhone: phone || undefined,
                cursor: append ? clinic.servicesNextCursor : undefined,
              })
            )
          )) as any;
        const rawRows = vendorServicesRowsFromResponse(res);
        const vetRows = mapVendorServicesForVetHub(rawRows);
        const rows = filterServicesForVetHub<ClinicServiceRow>(
          vetRows.map((s, i) => mapApiServiceToRow(s, clinicId, i, clinic.warmpawzAppointments === true))
        );
        const nextCursor = vendorServicesNextCursor(res);
        setClinics((prev) =>
          prev.map((c) => {
            if (c.id !== clinicId) return c;
            const seen = new Set(
              append ? c.services.map((s) => s.stableKey) : []
            );
            const merged = append ? [...c.services] : [];
            for (const row of rows) {
              if (seen.has(row.stableKey)) continue;
              seen.add(row.stableKey);
              merged.push(row);
            }
            return {
              ...c,
              services: merged,
              needsServiceFetch: false,
              servicesHydrated: true,
              servicesNextCursor: nextCursor,
              servicesLoadingMore: false,
            };
          })
        );
      } catch (e) {
        console.error('[CLINIC-LIST] vendor services fetch failed', e);
        setClinics((prev) =>
          prev.map((c) =>
            c.id === clinicId
              ? { ...c, servicesHydrated: true, servicesLoadingMore: false }
              : c
          )
        );
      } finally {
        setFetchingServicesFor(null);
      }
    },
    [phone, clinics]
  );

  const loadMoreClinicServices = useCallback(
    (clinicId: string) => {
      void fetchVendorServicesForClinic(clinicId, true);
    },
    [fetchVendorServicesForClinic]
  );

  useEffect(() => {
    if (!launchGate.ready || launchGate.blocked) {
      if (launchGate.ready && launchGate.blocked) setLoading(false);
      return;
    }
    loadClinics();
  }, [launchGate.ready, launchGate.blocked, specialization, phone]);

  const loadDiscoverFallback = async (locationParams: string) => {
    const specParam = specialization
      ? `&specialization=${encodeURIComponent(specialization)}`
      : '';
    const response = (await apiClient.get(
      `/customer/discover-services?category=vet&serviceStyle=at_center${locationParams}${specParam}`
    )) as any;
    const servicesData = response.vendors || response.services || [];
    if (servicesData.length === 0) return [];
    const clinicsOnly = servicesData.filter((service: any) => !isSoloVendor(service));
    const vendorMap = new Map<string, ClinicProvider>();
    clinicsOnly.forEach((service: any) => {
      if (isNonVetProviderRow(service)) return;
      const vendorId = String(service.vendorId || service.id || '');
      if (!vendorId) return;
      const nextSlot = resolveNextAvailableLabel(service);
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
          rows = filterServicesForVetHub<ClinicServiceRow>(
            raw.map((s: any, i: number) => mapApiServiceToRow(s, vendorId, i, service.warmpawzAppointments === true))
          );
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
          ...(() => {
            const rf = applyResolvedRatingToStoredFields(
              { ...service, vendorId, vendor_id: vendorId },
              vendorId
            );
            return { rating: rf.rating, review_count: rf.review_count };
          })(),
          distanceKm: (() => {
            if (service.distance != null) {
              const n = Number(service.distance);
              return Number.isFinite(n) ? n : null;
            }
            return pickProviderDistanceKm(service);
          })(),
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

  const loadClinics = async (append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        listCursorRef.current = null;
        setHasMore(false);
      }
      const { latitude, longitude } = await resolveCustomerDiscoveryCoords(phone);
      let locationParams = '';
      if (latitude != null && longitude != null) {
        locationParams = `&latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`;
      }
      const phoneParam = phone ? `&customerPhone=${encodeURIComponent(phone)}` : '';

      let mapped: ClinicProvider[] = [];
      const loadByStyle = async (roleId: string, withCursor = false) => {
        const specParam = specialization
          ? `&specialization=${encodeURIComponent(specialization)}`
          : '';
        const cursorParam =
          withCursor && listCursorRef.current
            ? `&cursor=${encodeURIComponent(listCursorRef.current)}`
            : '';
        const response = (await apiClient.get(
          `/customer/services/by-style?style=at_center&category=vet&roleId=${encodeURIComponent(roleId)}&limit=3${cursorParam}${locationParams}${phoneParam}${specParam}`
        )) as any;
        if (!response.success) return { rows: [] as ClinicProvider[], cursor: null as string | null };
        const providerData = discoveryVendorList(response);
        const rows = providerData.map((p: any) => mapByStyleProvider(p)).filter(Boolean) as ClinicProvider[];
        return { rows, cursor: discoveryNextCursor(response) };
      };

      if (append) {
        const { rows, cursor } = await loadByStyle('veterinarian', true);
        mapped = rows;
        listCursorRef.current = cursor;
        setHasMore(!!cursor);
        if (mapped.length > 0) {
          setClinics((prev) =>
            applyVetHubDiscoveryToProviders<ClinicProvider, ClinicServiceRow>([...prev, ...mapped], {
              keepProvidersPendingServiceFetch: true,
            })
          );
        }
        return;
      }

      try {
        const primary = await loadByStyle('veterinarian');
        mapped = primary.rows;
        listCursorRef.current = primary.cursor;
        setHasMore(!!primary.cursor);
        if (mapped.length === 0) {
          const fallback = await loadByStyle('vet_clinic');
          mapped = fallback.rows;
          listCursorRef.current = fallback.cursor;
          setHasMore(!!fallback.cursor);
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

      // Only use the unfiltered /vendors fallback when there is no specialization filter.
      // If specialization is active, an empty list is correct — do not widen to all vets.
      if (mapped.length === 0 && !specialization) {
        try {
          const fallbackResponse = (await apiClient.get('/vendors?role=veterinarian')) as any;
          if (fallbackResponse?.vendors?.length > 0) {
            mapped = fallbackResponse.vendors
              .filter((v: any) => !isSoloVendor(v) && !isNonVetProviderRow(v))
              .map((v: any) => {
                const id = String(v.id);
                return {
                  id,
                  name: cleanProviderName(v.businessName || v.business_name || v.name || 'Clinic'),
                  address:
                    v.address ||
                    `${v.city || ''}${v.city ? ', ' : ''}${v.pincode || ''}`.trim() ||
                    'Location available on booking',
                  ...applyResolvedRatingToStoredFields({ ...v, vendorId: id, id }, id),
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

      setClinics(
        applyVetHubDiscoveryToProviders<ClinicProvider, ClinicServiceRow>(mapped, {
          keepProvidersPendingServiceFetch: true,
        })
      );
    } catch (error) {
      console.error('Error loading clinics:', error);
      setClinics([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreClinics = useCallback(() => {
    if (!hasMore || loadingMore || loading) return;
    void loadClinics(true);
  }, [hasMore, loadingMore, loading]);

  const toggleClinic = (clinicId: string) => {
    setSelectedClinicId((prev) => (prev === clinicId ? null : clinicId));
  };

  useEffect(() => {
    if (!selectedClinicId) return;
    const c = clinics.find((x) => x.id === selectedClinicId);
    if (!c || c.servicesHydrated) return;
    if (fetchingServicesFor === selectedClinicId) return;
    fetchVendorServicesForClinic(selectedClinicId);
  }, [selectedClinicId, clinics, fetchingServicesFor, fetchVendorServicesForClinic]);

  const handleBookService = (clinic: ClinicProvider, row: ClinicServiceRow) => {
    const vendorId = clinic.id;
    const serviceIdForBooking = row.catalogServiceId || String(row.vendorServiceId);
    const serviceObj = normalizeVendorServiceRowForPackage({
      id: String(row.vendorServiceId),
      serviceId: row.catalogServiceId,
      vendorServiceId: row.vendorServiceId,
      name: row.name,
      price: row.price,
      duration: row.duration,
      isPackage: row.isPackage,
      packageDetails: row.packageDetails,
      metadata: row.metadata,
    });
    if (isVendorServicePackageRow(serviceObj)) {
      const nav = buildWalkerServiceDataForVendorPackagePurchase({
        vendorId: String(vendorId),
        vendorName: clinic.name,
        serviceRow: serviceObj,
        serviceTypeCategory: 'vet',
        serviceStyle: 'at_center',
      });
      if (nav) {
        onNavigate('purchase-package', nav);
        return;
      }
      toast.error('Could not start package booking. Please try again or pick another service.');
      return;
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
      returnScreen: vetStyleProfileReturnScreen,
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
    if (c.warmpawzAppointments) return null;
    if (!c.services.length) return null;
    const prices = c.services.map((s) => s.price).filter((p) => p > 0);
    return prices.length > 0 ? Math.min(...prices) : null;
  };

  const handleBookAppointment = (clinic: ClinicProvider) => {
    onNavigate(
      resolveWarmpawzBookingScreen('vet'),
      buildWarmpawzAppointmentsBookingNav({
        vendorId: clinic.id,
        vendorName: clinic.name,
        serviceStyle: 'at_center',
        category: 'vet',
      })
    );
  };

  const clinicSubtitle = (clinic: ClinicProvider) =>
    clinic.roleDisplayName || clinic.role || clinic.roleName || 'Vet Clinic';

  const clinicFooterHint = (clinic: ClinicProvider) => {
    if (clinic.nextAvailableSlot) return `Next: ${clinic.nextAvailableSlot}`;
    if (clinic.services.length > 0) {
      return `${clinic.services.length} service${clinic.services.length !== 1 ? 's' : ''} available`;
    }
    if (clinic.needsServiceFetch) return 'Tap to view services & prices';
    return 'Tap to view profile & book';
  };

  const dashboardStats = EMPTY_SERVICE_HEADER_STATS;

  if (launchGate.ready && launchGate.blocked) {
    return (
      <div className="min-h-screen bg-gray-50">
        <ServiceStyleLaunchBlocked message={launchGate.blockMessage} onBack={onBack} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen min-h-[100dvh] w-full max-w-customer flex-col bg-gray-50">
      <ServiceDashboardHeader
        fullWidth
        serviceName="Veterinary Clinic"
        serviceSubtitle="Find a veterinary clinic near you"
        serviceIcon={Stethoscope}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-[#FF8C42]"
        sheetToneClass="bg-white"
      />

      {/* Unified body panel — matches Pet Boarding pattern (one continuous white surface, no gray gaps) */}
      <div className="flex-1 -mt-4 rounded-t-[1.75rem] bg-white px-4 pt-6 pb-36 sm:rounded-t-[2rem]">
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
            <p className="text-sm text-gray-500 mt-1">
              {specialization
                ? 'No clinics offering this specialization are available in your area'
                : 'Try adjusting your search or filters'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">{sortedClinics.length} clinics found</p>

            {sortedClinics.map((clinic) => {
              const minP = minPriceForClinic(clinic);
              const appointmentsMode = clinic.warmpawzAppointments === true;
              const subtitle = clinicSubtitle(clinic);
              const openProfile = (e: MouseEvent<HTMLButtonElement>) => openClinicDetails(e, clinic.id);
              const expanded = selectedClinicId === clinic.id;
              const headerActsAsCollapse = expanded;
              const headerInteractive = headerActsAsCollapse;

              if (appointmentsMode) {
                return (
                  <WarmpawzPayVendorCard
                    key={clinic.id}
                    {...buildWapptDiscoveryVendorCardProps({
                      provider: {
                        name: clinic.name,
                        photo: clinic.photo,
                        isVerified: clinic.isVerified,
                        rating: clinic.rating,
                        reviewCount: clinic.review_count,
                        distance: clinic.distanceKm,
                        nextAvailableSlot: clinic.nextAvailableSlot,
                        providerType: 'vendor',
                        vendorId: clinic.id,
                        providerId: clinic.id,
                      },
                      subtitle,
                      address: clinic.address,
                      category: 'vet',
                      serviceKey: 'vet',
                      onPrimary: (e) => {
                        e.stopPropagation();
                        handleBookAppointment(clinic);
                      },
                      onProfileClick: openProfile,
                      router,
                    })}
                  />
                );
              }

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
                          <VendorRatingDisplay
                            row={{
                              vendorId: clinic.id,
                              id: clinic.id,
                              rating: clinic.rating,
                              vendorRating: clinic.rating,
                              review_count: clinic.review_count,
                              vendorReviewCount: clinic.review_count,
                            }}
                            vendorId={String(clinic.id ?? '')}
                            textClassName="text-xs text-gray-500"
                          />
                          {clinic.distanceKm != null && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span className="text-sm text-gray-500">
                                {clinic.distanceKm < 1
                                  ? `${Math.round(clinic.distanceKm * 1000)} m`
                                  : `${Math.round(clinic.distanceKm)} km`}
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
                      <div className="flex items-center justify-end gap-2 flex-wrap">
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
                        <div className="max-h-[min(60vh,28rem)] overflow-y-auto pr-1 space-y-4">
                          {discoveryServiceSections(
                            clinic.services as unknown as Record<string, unknown>[]
                          ).map((sec) => (
                            <div key={sec.title} className="space-y-3">
                              <h4 className="text-sm font-semibold text-gray-700">
                                {sec.title} ({sec.list.length}
                                {sec.title === 'Available Services' && clinic.servicesNextCursor
                                  ? '+'
                                  : ''}
                                )
                              </h4>
                              {(sec.list as unknown as ClinicServiceRow[]).map((service) => {
                            const descTrim = service.description?.trim() ?? '';
                            const isPackage = Boolean((service as any).isPackage);
                            return (
                              <div
                                key={service.stableKey}
                                className="bg-white rounded-lg p-4 shadow-sm border border-gray-100"
                              >
                                {/* Row 1: name + package badge (left) | price + note (right) */}
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-start gap-2">
                                      <h5 className="min-w-0 flex-1 font-semibold text-gray-900 text-[15px] leading-snug">
                                        {service.name}
                                      </h5>
                                      {isPackage && (
                                        <span className="mt-0.5 px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-700 border border-purple-200 shrink-0">
                                          Package
                                        </span>
                                      )}
                                    </div>

                                    {/* Row 2: description */}
                                    {descTrim ? (
                                      <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                                        <ServiceDescriptionInline
                                          description={descTrim}
                                          title={service.name}
                                          className="m-0 text-sm leading-5 text-gray-500"
                                          dialogHint="Full description from the clinic (vendor-provided)"
                                        />
                                      </div>
                                    ) : (
                                      <p className="mt-1.5 text-gray-400 text-sm line-clamp-2 italic">
                                        Professional in-clinic care — tap Book Now to continue.
                                      </p>
                                    )}
                                  </div>

                                  <div className="shrink-0 text-right">
                                    <ServicePricingDisplay
                                      basePrice={service.price}
                                      usePromoQuote
                                      vendorId={String(clinic.id)}
                                      serviceId={String(service.vendorServiceId)}
                                      customerId={phone}
                                      serviceStyle="at_center"
                                      serviceCategory="vet"
                                    />
                                    <p className="mt-0.5 text-[11px] leading-4 text-gray-500 max-w-[9rem]">{INDICATIVE_PRICING_NOTE}</p>
                                  </div>
                                </div>

                                {/* Row 3: badges (left) | Book Now (right) */}
                                <div className="flex items-center justify-between gap-2 mt-3">
                                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                                    <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                    <span>{service.duration} mins</span>
                                    <span className="text-gray-300">·</span>
                                    <span>{resolveServiceCategoryDisplayLabel(service) || 'Vet Care'}</span>
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="bg-[#FF8C42] hover:bg-[#E67A35] text-white shrink-0 rounded-full px-5"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleBookService(clinic, service);
                                    }}
                                  >
                                    Book Now
                                  </Button>
                                </div>
                              </div>
                            );
                              })}
                            </div>
                          ))}
                          <DiscoveryVendorFeedSentinel
                            hasMore={!!clinic.servicesNextCursor}
                            loading={fetchingServicesFor === clinic.id}
                            loadingMore={!!clinic.servicesLoadingMore}
                            onLoadMore={() => loadMoreClinicServices(clinic.id)}
                          />
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
                        {minP != null && (
                          <p className="mt-0.5 text-xs text-gray-500">{INDICATIVE_PRICING_NOTE}</p>
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
            <DiscoveryVendorFeedSentinel
              hasMore={hasMore}
              loading={loading}
              loadingMore={loadingMore}
              onLoadMore={loadMoreClinics}
            />
          </div>
        )}
      </div>

      <StandardizedFooter
        currentTab="bookings"
        onTabChange={(tab) => {
          if (tab === 'home') onNavigate('home');
          else if (tab === 'bookings') onNavigate('my-bookings');
          else if (tab === 'shop') onNavigate('shop');
          else if (tab === 'profile') onNavigate('profile');
        }}
        maxWidth="max-w-customer"
      />

    </div>
  );
}
