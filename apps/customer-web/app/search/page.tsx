'use client';

import React, { Suspense, useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Search } from 'lucide-react';
import { BottomNavigation } from '@/components/customer/bottomNavigation/BottomNavigation';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { mergeCustomerVendorServicesPayload } from '@/lib/customer-vendor-services-merge';
import { buildSearchFetchTrigger } from '@/lib/search-fetch-trigger';
import { applyHubCategoryFilter } from '@/lib/search-hub-category-filter';
import { formatCustomerApiError } from '@/lib/format-api-error';
import { shopProductDetailPath } from '@/lib/shop-product-path';
import { saveSearchContext, updateSearchContextSelection } from '@/lib/search-context';
import {
  SearchVendorExpandableCard,
  type SearchVendorCardData,
} from '@/components/customer/search/SearchVendorExpandableCard';
import {
  mapApiServicesToRows,
  type ClinicServiceRow,
} from '@/lib/clinic-service-row-mapper';
import {
  buildSearchVendorDetailsUrl,
  launchSearchNutritionBooking,
  launchSearchNutritionMealPlans,
  launchSearchServiceBooking,
  launchSearchGroomingBooking,
  launchSearchGroomingCenterProfile,
  launchSearchBoardingBooking,
  launchSearchBoardingCenterProfile,
  launchSearchWalkerBooking,
  launchSearchWalkerCenterProfile,
  launchSearchSittingBooking,
  launchSearchSittingCenterProfile,
  launchSearchTrainingBooking,
  launchSearchTrainingCenterProfile,
} from '@/lib/search-booking-launch';
import {
  isBoardingCategory,
  isBoardingHub,
  isBoardingVendorResult,
  isGroomingCategory,
  isGroomingHub,
  isGroomingVendorResult,
  isNutritionCategory,
  isNutritionHub,
  isNutritionVendorResult,
  isSittingCategory,
  isSittingHub,
  isSittingVendorResult,
  isTrainingCategory,
  isTrainingHub,
  isTrainingVendorResult,
  isWalkerCategory,
  isWalkerHub,
  isWalkerVendorResult,
  isCafeCategory,
  isResortCategory,
  isPharmacyCategory,
  resolveEffectiveSearchCategory,
} from '@/lib/search-category-detect';
import { fetchMergedNutritionProviders } from '@/lib/nutritionist-discovery';
import {
  nutritionVendorFromDiscoveryRow,
  type NutritionVendorCardModel,
} from '@/components/customer/nutrition/NutritionVendorDetailsCard';
import { SearchNutritionVendorCard } from '@/components/customer/search/SearchNutritionVendorCard';
import { SearchTrainingVendorCard } from '@/components/customer/search/SearchTrainingVendorCard';
import { SearchGroomingVendorCard } from '@/components/customer/search/SearchGroomingVendorCard';
import { SearchBoardingVendorCard } from '@/components/customer/search/SearchBoardingVendorCard';
import { SearchWalkerVendorCard } from '@/components/customer/search/SearchWalkerVendorCard';
import { SearchSittingVendorCard } from '@/components/customer/search/SearchSittingVendorCard';
import {
  mapServicesApiResponseToPlanRows,
  type BoardingListVendor,
  type BoardingPlanRow,
} from '@/lib/boarding-vendor-discovery-map';
import { searchCardToBoardingListVendor } from '@/lib/search-training-vendor-map';
import { minPriceForVendor } from '@/lib/boarding-vendor-booking-utils';
import {
  formatVendorAddressLine,
  haversineDistanceKm,
  pickDistanceKmFromApi,
  pickProfileImageUrl,
  pickServiceListingImage,
  pickVendorLatLng,
  type SearchApiVendorRow,
} from '@/lib/search-vendor-display';
import {
  appendDiscoverRoleParams,
  buildSearchDiscoveryQueryParams,
} from '@/lib/search-discovery-params';
import { dedupeSearchVendorAndServiceRows } from '@/lib/search-hub-category-filter';
import { useCustomerAccountSidebarHost } from '@/lib/customer-account-sidebar-host';
import { traceSearch } from '@/lib/search-trace';

interface SearchResult {
  id: string;
  type: 'vendor' | 'service' | 'product';
  /** For services: listing title (shown under business name). Hub filter uses this for service rows. */
  name: string;
  category: string;
  rating: number;
  reviewCount: number;
  city: string;
  price?: number;
  imageUrl?: string;
  /** Service rows: owning vendor id. */
  vendorOwnerId?: string;
  /** Service rows: headline (business name). */
  vendorBusinessName?: string;
  /** Vendor rows: single line for cards (never raw coordinates). */
  addressDisplay?: string;
  state?: string;
  latitude?: number | null;
  longitude?: number | null;
  /** From GET /search `distanceKm` and/or client when geo + coords exist. */
  distanceKm?: number | null;
  /** Product rows: seller/vendor name. */
  sellerName?: string;
}

function mapSearchApiToResults(response: any): SearchResult[] {
  const vendorsRaw = response.vendors ?? response.data?.vendors ?? [];
  const servicesRaw = response.services ?? response.data?.services ?? [];

  const vendors = (vendorsRaw || []).map((v: any) => {
    const row = v as SearchApiVendorRow;
    const geo = pickVendorLatLng(row);
    const apiDist = pickDistanceKmFromApi(row);
    return {
      id: v.id,
      type: 'vendor' as const,
      name: v.businessName ?? v.business_name ?? '',
      category:
        v.category ??
        v.roleName ??
        v.role_name ??
        v.searchRoleName ??
        v.search_role_name ??
        v.serviceType ??
        v.service_type ??
        '',
      rating: parseFloat(v.rating ?? v.avg_rating) || 0,
      reviewCount: v.review_count ?? v.completedBookings ?? 0,
      city: v.city ?? '',
      imageUrl: pickProfileImageUrl(row),
      addressDisplay: formatVendorAddressLine({
        address: v.address,
        landmark: v.landmark,
        city: v.city,
        state: v.state,
        pincode: v.pincode,
      }),
      state: v.state ?? undefined,
      latitude: geo?.lat ?? null,
      longitude: geo?.lng ?? null,
      distanceKm: apiDist,
    };
  });

  const services = (servicesRaw || []).map((s: any) => {
    const id = String(s.id ?? s.vendor_service_id ?? s.vendorServiceId ?? '').trim();
    const row = s as SearchApiVendorRow;
    const vendorFacet: SearchApiVendorRow = {
      ...row,
      latitude: s.vendorLatitude ?? s.vendor_latitude ?? s.latitude,
      longitude: s.vendorLongitude ?? s.vendor_longitude ?? s.longitude,
      profileImage: s.vendorProfileImage ?? s.vendor_profile_image,
      profile_image: s.vendor_profile_image ?? s.vendorProfileImage,
      address: s.vendorAddress ?? s.vendor_address,
      landmark: s.vendorLandmark ?? s.vendor_landmark,
      pincode: s.vendorPincode ?? s.vendor_pincode,
      distanceKm: s.distanceKm ?? s.distance_km,
    };
    const geo = pickVendorLatLng(vendorFacet);
    const apiDist = pickDistanceKmFromApi(vendorFacet);
    const headline =
      (typeof s.vendorName === 'string' && s.vendorName.trim()) ||
      (typeof s.business_name === 'string' && s.business_name.trim()) ||
      '';
    const serviceTitle = (s.serviceName ?? s.service_name ?? '').trim() || 'Service';
    const profileImg = pickProfileImageUrl(vendorFacet);
    const galleryImg = pickServiceListingImage(row);
    return {
      id,
      type: 'service' as const,
      name: serviceTitle,
      category:
        s.category ??
        s.serviceType ??
        s.service_type ??
        s.searchRoleName ??
        s.search_role_name ??
        s.vendorRoleName ??
        s.vendor_role_name ??
        '',
      rating: parseFloat(s.vendorRating ?? s.vendor_rating ?? s.rating) || 0,
      reviewCount: parseInt(String(s.vendorReviewCount ?? s.total_reviews ?? 0), 10) || 0,
      city: s.city ?? '',
      price: parseFloat(s.price ?? s.base_price) || undefined,
      imageUrl: profileImg ?? galleryImg,
      vendorOwnerId: String(s.vendorId ?? s.vendor_id ?? '').trim(),
      vendorBusinessName: headline,
      addressDisplay: formatVendorAddressLine({
        address: s.vendorAddress ?? s.vendor_address,
        landmark: s.vendorLandmark ?? s.vendor_landmark,
        city: s.city,
        state: s.state,
        pincode: s.vendorPincode ?? s.vendor_pincode,
      }),
      state: s.state ?? undefined,
      latitude: geo?.lat ?? null,
      longitude: geo?.lng ?? null,
      distanceKm: apiDist,
    };
  }).filter((s: SearchResult) => s.id);

  const productsRaw = response.products ?? response.data?.products ?? [];
  const products = (productsRaw || [])
    .map((p: any) => {
      const id = String(p.id ?? '').trim();
      if (!id) return null;
      return {
        id,
        type: 'product' as const,
        name: (p.productName ?? p.name ?? '').trim() || 'Product',
        category: p.category ?? '',
        rating: 0,
        reviewCount: 0,
        city: '',
        price: p.price ? parseFloat(String(p.price)) || undefined : undefined,
        imageUrl: p.imageUrl ?? p.image_url ?? p.thumbnail_url ?? undefined,
        sellerName: p.vendorName ?? p.vendor_name ?? undefined,
        distanceKm: null,
      };
    })
    .filter(Boolean) as SearchResult[];

  return [...vendors, ...services, ...products];
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[100dvh] w-full max-w-md items-center justify-center bg-gradient-to-b from-orange-50/90 to-amber-50/80 text-sm text-gray-600">
          Loading search…
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { openAccountMenu, accountSidebar, handleTabbedBottomNav } = useCustomerAccountSidebarHost();
  const initialQuery = searchParams.get('q') || '';
  const initialCategory = searchParams.get('category') || '';
  const vendorIdParam = searchParams.get('vendorId');

  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  /** Last successful API payload (keyword search = full “All” list; hub-only = category browse). */
  const [apiResults, setApiResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedVendorId, setExpandedVendorId] = useState<string | null>(vendorIdParam);
  const [vendorServicesById, setVendorServicesById] = useState<Record<string, ClinicServiceRow[]>>({});
  const [servicesLoadingVendorId, setServicesLoadingVendorId] = useState<string | null>(null);
  /** Merged nutrition providers (all service styles) — same source as Home Expert Nutritionists. */
  const [nutritionVendors, setNutritionVendors] = useState<NutritionVendorCardModel[]>([]);
  /** Training vendors as BoardingListVendor — same card model as TrainingServiceRouter. */
  const [trainingVendors, setTrainingVendors] = useState<BoardingListVendor[]>([]);
  const [fetchingTrainingPlansFor, setFetchingTrainingPlansFor] = useState<string | null>(null);
  const [groomingVendors, setGroomingVendors] = useState<BoardingListVendor[]>([]);
  const [fetchingGroomingPlansFor, setFetchingGroomingPlansFor] = useState<string | null>(null);
  const [boardingVendors, setBoardingVendors] = useState<BoardingListVendor[]>([]);
  const [fetchingBoardingPlansFor, setFetchingBoardingPlansFor] = useState<string | null>(null);
  const [walkerVendors, setWalkerVendors] = useState<BoardingListVendor[]>([]);
  const [fetchingWalkerPlansFor, setFetchingWalkerPlansFor] = useState<string | null>(null);
  const [sittingVendors, setSittingVendors] = useState<BoardingListVendor[]>([]);
  const [fetchingSittingPlansFor, setFetchingSittingPlansFor] = useState<string | null>(null);
  /** Bumps on explicit Search submit / Try again so the same query refetches. */
  const [searchNonce, setSearchNonce] = useState(0);

  const categoryRef = React.useRef(category);
  const queryRef = React.useRef(query);
  const apiResultsRef = React.useRef(apiResults);
  const lastSearchTriggerRef = React.useRef<string>('');
  categoryRef.current = category;
  queryRef.current = query;
  apiResultsRef.current = apiResults;

  /**
   * Keyword present → fetch GET /search?q=… only (no category query param); hub chips filter client-side.
   * No keyword but hub selected → fetch GET /search?category=… (backend strict hub browse).
   * Whenever a hub chip is selected, results are filtered client-side with canonical category tokens (defense in depth).
   */
  const searchFetchTrigger = useMemo(() => {
    return buildSearchFetchTrigger(query, category, vendorIdParam, searchNonce);
  }, [query, category, vendorIdParam, searchNonce]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const recentRaw = localStorage.getItem('warmpawz_recent_searches');
    const ctxRaw = localStorage.getItem('warmpawz_search_context');
    traceSearch('SearchPage.mount', {
      initialQuery,
      query,
      category,
      searchFetchTrigger,
      url: window.location.href,
      warmpawz_recent_searches: recentRaw,
      warmpawz_search_context: ctxRaw,
    });
  }, []);

  useEffect(() => {
    traceSearch('SearchPage.state', { query, initialQuery, category, searchFetchTrigger });
  }, [query, category, searchFetchTrigger, initialQuery]);

  const displayedResults = useMemo(() => {
    const q = (query || '').trim();
    const hub = (category || '').trim();

    // For hub browse the backend already filtered by category+role. Re-applying the client
    // filter is defense-in-depth but must not silently drop rows whose category came from
    // the role-name fallback (which the backend matched via JOIN on roles but which may not
    // perfectly round-trip through normalizeCategoryToken). Apply client filter only for
    // keyword mode (where the backend returned the full unfiltered set).
    const filtered = hub ? applyHubCategoryFilter(apiResults, hub, q) : apiResults;

    return dedupeSearchVendorAndServiceRows(filtered);
  }, [apiResults, query, category]);

  /** Same coord order as discover-services (profile → localStorage → GPS). */
  const [userGeo, setUserGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [discoveryCoordsReady, setDiscoveryCoordsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const discoveryParams = await buildSearchDiscoveryQueryParams();
      if (cancelled) return;
      const latRaw = discoveryParams.get('userLat');
      const lngRaw = discoveryParams.get('userLng');
      if (latRaw && lngRaw) {
        const lat = parseFloat(latRaw);
        const lng = parseFloat(lngRaw);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          setUserGeo({ lat, lng });
        }
      }
      setDiscoveryCoordsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayedWithDistance = useMemo(() => {
    return displayedResults.map((r) => {
      let distanceKm = r.distanceKm;
      if (
        (distanceKm == null || !Number.isFinite(Number(distanceKm))) &&
        userGeo &&
        r.latitude != null &&
        r.longitude != null &&
        Number.isFinite(r.latitude) &&
        Number.isFinite(r.longitude)
      ) {
        distanceKm = haversineDistanceKm(userGeo.lat, userGeo.lng, r.latitude, r.longitude);
      }
      return { ...r, distanceKm };
    });
  }, [displayedResults, userGeo]);

  const categories = [
    { id: '', label: 'All', icon: '🔍' },
    { id: 'vet', label: 'Veterinary', icon: '🏥' },
    { id: 'grooming', label: 'Grooming', icon: '✂️' },
    { id: 'training', label: 'Training', icon: '🎓' },
    { id: 'boarding', label: 'Boarding', icon: '🏨' },
    { id: 'sitting', label: 'Pet Sitter', icon: '🏠' },
    { id: 'walker', label: 'Walker', icon: '🚶' },
    { id: 'cafe', label: 'Pet Cafe', icon: '☕' },
    { id: 'resort', label: 'Resort', icon: '🏝️' },
    { id: 'pharmacy', label: 'Pharmacy', icon: '💊' },
    { id: 'nutritionist', label: 'Nutritionist', icon: '🥗' },
  ];

  const buildReturnSearchUrl = () => {
    const params = new URLSearchParams();
    const q = (query || '').trim();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    const qs = params.toString();
    return qs ? `/search?${qs}` : '/search';
  };

  const roleDisplayNameForCategory = (effectiveCategory: string, fallback?: string) => {
    if (effectiveCategory === 'training' || isTrainingCategory(effectiveCategory)) return 'Training';
    if (effectiveCategory === 'grooming' || isGroomingCategory(effectiveCategory)) return 'Grooming';
    if (effectiveCategory === 'boarding' || isBoardingCategory(effectiveCategory)) return 'Boarding';
    if (effectiveCategory === 'walker' || isWalkerCategory(effectiveCategory)) return 'Walker';
    if (effectiveCategory === 'sitting' || isSittingCategory(effectiveCategory)) return 'Sitting';
    if (effectiveCategory === 'nutritionist' || effectiveCategory === 'nutrition' || isNutritionCategory(effectiveCategory)) {
      return 'Nutritionist';
    }
    if (effectiveCategory === 'cafe' || isCafeCategory(effectiveCategory)) return 'Pet Cafe';
    if (effectiveCategory === 'resort' || isResortCategory(effectiveCategory)) return 'Resort';
    if (effectiveCategory === 'pharmacy' || isPharmacyCategory(effectiveCategory)) return 'Pharmacy';
    return fallback || effectiveCategory || undefined;
  };

  useEffect(() => {
    if (vendorIdParam) {
      setExpandedVendorId(vendorIdParam);
      const effectiveHub = resolveEffectiveSearchCategory('', category, query);
      if (isTrainingHub(category) || effectiveHub === 'training' || isTrainingCategory(effectiveHub)) {
        void loadTrainingVendorPlans(vendorIdParam);
      } else if (
        isGroomingHub(category) ||
        effectiveHub === 'grooming' ||
        isGroomingCategory(effectiveHub)
      ) {
        void loadGroomingVendorPlans(vendorIdParam);
      } else if (
        isBoardingHub(category) ||
        effectiveHub === 'boarding' ||
        isBoardingCategory(effectiveHub)
      ) {
        void loadBoardingVendorPlans(vendorIdParam);
      } else if (
        isWalkerHub(category) ||
        effectiveHub === 'walker' ||
        isWalkerCategory(effectiveHub)
      ) {
        void loadWalkerVendorPlans(vendorIdParam);
      } else if (
        isSittingHub(category) ||
        effectiveHub === 'sitting' ||
        isSittingCategory(effectiveHub)
      ) {
        void loadSittingVendorPlans(vendorIdParam);
      } else {
        void loadVendorServices(vendorIdParam);
      }
    }
  }, [vendorIdParam, category, query]);

  useEffect(() => {
    if (vendorIdParam) return;
    if (!searchFetchTrigger) {
      setApiResults([]);
      setNutritionVendors([]);
      setTrainingVendors([]);
      setGroomingVendors([]);
      setBoardingVendors([]);
      setWalkerVendors([]);
      setSittingVendors([]);
      setError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      lastSearchTriggerRef.current = JSON.stringify(searchFetchTrigger);
      setLoading(true);
      try {
        const params = new URLSearchParams();
        const discoveryParams = await buildSearchDiscoveryQueryParams();
        discoveryParams.forEach((value, key) => params.set(key, value));
        if (searchFetchTrigger.kind === 'keyword') {
          traceSearch('SearchPage.fetch.keyword', { q: searchFetchTrigger.q, params: params.toString() });
          params.set('q', searchFetchTrigger.q);
          params.set('limit', '50');
          const hub = categoryRef.current.trim();
          if (hub) {
            params.set('category', hub);
            appendDiscoverRoleParams(params, hub);
          }
        } else if (searchFetchTrigger.kind === 'hub') {
          params.set('category', searchFetchTrigger.c);
          appendDiscoverRoleParams(params, searchFetchTrigger.c);
          params.set('limit', '50');
        } else {
          params.set('limit', '50');
        }
        const response = await apiClient.get<any>(`/search?${params.toString()}`);
        if (cancelled) return;
        const mapped = mapSearchApiToResults(response);

        let mergedNutrition: NutritionVendorCardModel[] = [];
        const hub = categoryRef.current.trim();
        if (isNutritionHub(hub)) {
          const phone =
            typeof window !== 'undefined'
              ? localStorage.getItem('customerPhone') || localStorage.getItem('customer_phone') || ''
              : '';
          const rawProviders = await fetchMergedNutritionProviders({ customerPhone: phone });
          if (cancelled) return;
          mergedNutrition = rawProviders.map((row) =>
            nutritionVendorFromDiscoveryRow(row as Record<string, unknown>)
          );
          const qLower = (queryRef.current || '').trim().toLowerCase();
          if (qLower) {
            mergedNutrition = mergedNutrition.filter((v) => {
              const label = (v.businessName || v.name || v.vendor_name || '').toLowerCase();
              const city = (v.city || '').toLowerCase();
              return label.includes(qLower) || city.includes(qLower);
            });
          }
        }
        if (cancelled) return;

        setNutritionVendors(mergedNutrition);
        setApiResults(mapped);
        if (searchFetchTrigger.kind === 'keyword') {
          const qStr = searchFetchTrigger.q;
          const hub = categoryRef.current.trim();
          const filtered = hub ? applyHubCategoryFilter(mapped, hub, qStr) : mapped;
          const vIds = new Set(filtered.filter(r => r.type === 'vendor').map(r => r.id));
          const contextResults = filtered.filter(r => r.type === 'vendor' || !(r.vendorOwnerId && vIds.has(r.vendorOwnerId)));
          saveSearchContext({
            query: qStr,
            category: hub || undefined,
            results: contextResults,
            timestamp: Date.now(),
          });
        } else if (searchFetchTrigger.kind === 'hub') {
          const hubResults = isNutritionHub(searchFetchTrigger.c)
            ? mergedNutrition.map((v) => ({
                id: String(v.id || v.vendorId || ''),
                type: 'vendor' as const,
                name: v.businessName || v.name || 'Nutritionist',
                category: 'pet_nutritionist',
              }))
            : mapped;
          saveSearchContext({
            query: '',
            category: searchFetchTrigger.c,
            results: hubResults,
            timestamp: Date.now(),
          });
        } else {
          saveSearchContext({
            query: '',
            category: undefined,
            results: mapped,
            timestamp: Date.now(),
          });
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('Search error:', err);
          setError(formatCustomerApiError(err.message || 'Search failed'));
          setApiResults([]);
          setNutritionVendors([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchFetchTrigger, vendorIdParam, discoveryCoordsReady]);

  /** Keyword results loaded: keep localStorage context in sync when only the hub chip changes (no refetch). */
  useEffect(() => {
    if (vendorIdParam) return;
    const q = queryRef.current.trim();
    if (!q || !apiResultsRef.current.length) return;
    const hub = category.trim();
    // Use same dedup logic as displayedResults so stored context matches what's shown.
    const filtered = hub ? applyHubCategoryFilter(apiResultsRef.current, hub, q) : apiResultsRef.current;
    const vendorIds = new Set(filtered.filter(r => r.type === 'vendor').map(r => r.id));
    const deduped = filtered.filter(r => r.type === 'vendor' || !(r.vendorOwnerId && vendorIds.has(r.vendorOwnerId)));
    saveSearchContext({
      query: q,
      category: hub || undefined,
      results: deduped,
      timestamp: Date.now(),
    });
  }, [category, vendorIdParam]);

  const loadVendorServices = async (vendorId: string) => {
    if (servicesLoadingVendorId === vendorId) return;
    if (vendorServicesById[vendorId] !== undefined) return;
    try {
      setServicesLoadingVendorId(vendorId);
      updateSearchContextSelection(vendorId, undefined);

      let response: any;
      try {
        response = await apiClient.get<any>(`/customer/vendor/${vendorId}/services`);
      } catch {
        response = await apiClient.get<any>(`/vendor/${vendorId}/services`);
      }
      const serviceList = Array.isArray(response?.services)
        ? mergeCustomerVendorServicesPayload(response)
        : (response?.services?.at_home?.services ||
            response?.services?.at_center?.services ||
            response?.services?.tele?.services ||
            []);
      const mapped = mapApiServicesToRows(serviceList, vendorId);
      setVendorServicesById((prev) => ({ ...prev, [vendorId]: mapped }));
      if (mapped.length) {
        saveSearchContext({
          query: query || '',
          category: category || undefined,
          selectedVendorId: vendorId,
          timestamp: Date.now(),
          results: mapped.map((s) => ({
            id: String(s.vendorServiceId),
            type: 'service' as const,
            name: s.name,
            category: s.category,
          })),
        });
      }
    } catch (err: any) {
      console.error('Error loading vendor services:', err);
      setError(err.message || 'Failed to load vendor services');
    } finally {
      setServicesLoadingVendorId((cur) => (cur === vendorId ? null : cur));
    }
  };

  const searchResultToVendorCard = (result: SearchResult): SearchVendorCardData => {
    const effectiveCategory = resolveEffectiveSearchCategory(result.category, category, query);
    return {
      id: result.id,
      name: result.name,
      category: effectiveCategory,
      address:
        result.addressDisplay ||
        [result.city, result.state].filter(Boolean).join(', ') ||
        'Address on file',
      rating: result.rating,
      reviewCount: result.reviewCount,
      distanceKm: result.distanceKm ?? null,
      photo: result.imageUrl,
      roleDisplayName: roleDisplayNameForCategory(effectiveCategory, result.category || effectiveCategory),
    };
  };

  const serviceResultToVendorCard = (result: SearchResult): SearchVendorCardData | null => {
    const vendorId = result.vendorOwnerId?.trim();
    if (!vendorId) return null;
    const effectiveCategory = resolveEffectiveSearchCategory(result.category, category, query);
    return {
      id: vendorId,
      name: result.vendorBusinessName || 'Service provider',
      category: effectiveCategory,
      address:
        result.addressDisplay ||
        [result.city, result.state].filter(Boolean).join(', ') ||
        'Address on file',
      rating: result.rating,
      reviewCount: result.reviewCount,
      distanceKm: result.distanceKm ?? null,
      photo: result.imageUrl,
      roleDisplayName: roleDisplayNameForCategory(effectiveCategory, result.category || effectiveCategory),
    };
  };

  const vendorCardsToRender = useMemo(() => {
    const withDistance = displayedWithDistance;
    const vendorRows = withDistance.filter((r) => r.type === 'vendor');
    const vendorIds = new Set(vendorRows.map((v) => v.id));

    const orphanServices = withDistance.filter(
      (r) => r.type === 'service' && r.vendorOwnerId && !vendorIds.has(r.vendorOwnerId)
    );
    const syntheticFromServices: SearchVendorCardData[] = [];
    const seenOrphanVendor = new Set<string>();
    for (const svc of orphanServices) {
      const vid = svc.vendorOwnerId!;
      if (seenOrphanVendor.has(vid)) continue;
      seenOrphanVendor.add(vid);
      const card = serviceResultToVendorCard(svc);
      if (card) syntheticFromServices.push(card);
    }

    const cards: SearchVendorCardData[] = [
      ...vendorRows.map(searchResultToVendorCard),
      ...syntheticFromServices,
    ];

    if (vendorIdParam && !cards.some((c) => c.id === vendorIdParam)) {
      cards.unshift({
        id: vendorIdParam,
        name: 'Provider',
        category: resolveEffectiveSearchCategory('', category, query) || category || 'vet',
        address: 'Address on file',
        rating: 0,
        reviewCount: 0,
        distanceKm: null,
      });
    }

    return cards;
  }, [displayedWithDistance, vendorIdParam, category, query]);

  const productResults = useMemo(
    () => displayedWithDistance.filter((r) => r.type === 'product'),
    [displayedWithDistance]
  );

  const nutritionHubActive = isNutritionHub(category);
  const trainingHubActive = isTrainingHub(category);
  const groomingHubActive = isGroomingHub(category);
  const boardingHubActive = isBoardingHub(category);
  const walkerHubActive = isWalkerHub(category);
  const sittingHubActive = isSittingHub(category);

  const nonNutritionVendorCards = useMemo(() => {
    if (
      nutritionHubActive ||
      trainingHubActive ||
      groomingHubActive ||
      boardingHubActive ||
      walkerHubActive ||
      sittingHubActive
    ) {
      return [];
    }
    return vendorCardsToRender.filter((v) => {
      const effective = resolveEffectiveSearchCategory(v.category, category, query);
      return (
        !isNutritionVendorResult(v) &&
        !isTrainingVendorResult(v) &&
        !isGroomingVendorResult(v) &&
        !isBoardingVendorResult(v) &&
        !isWalkerVendorResult(v) &&
        !isSittingVendorResult(v) &&
        !isNutritionCategory(effective) &&
        !isTrainingCategory(effective) &&
        !isGroomingCategory(effective) &&
        !isBoardingCategory(effective) &&
        !isWalkerCategory(effective) &&
        !isSittingCategory(effective)
      );
    });
  }, [
    vendorCardsToRender,
    nutritionHubActive,
    trainingHubActive,
    groomingHubActive,
    boardingHubActive,
    walkerHubActive,
    sittingHubActive,
    category,
    query,
  ]);

  const inlineNutritionVendorCards = useMemo(() => {
    if (nutritionHubActive) return [];
    return vendorCardsToRender
      .filter((v) => isNutritionVendorResult(v))
      .map((v) =>
        nutritionVendorFromDiscoveryRow({
          id: v.id,
          vendorId: v.id,
          businessName: v.name,
          name: v.name,
          rating: v.rating,
          reviewCount: v.reviewCount,
          address: v.address,
          photo: v.photo,
        })
      );
  }, [vendorCardsToRender, nutritionHubActive]);

  const nutritionCardsToRender = nutritionHubActive
    ? nutritionVendors
    : inlineNutritionVendorCards;

  const trainingCardsBase = useMemo(() => {
    if (nutritionHubActive || groomingHubActive || boardingHubActive || walkerHubActive || sittingHubActive) {
      return [];
    }
    const source = trainingHubActive
      ? vendorCardsToRender
      : vendorCardsToRender.filter((v) => isTrainingVendorResult(v));
    return source.map((card) => searchCardToBoardingListVendor(card, category, query));
  }, [vendorCardsToRender, trainingHubActive, nutritionHubActive, groomingHubActive, boardingHubActive, walkerHubActive, sittingHubActive, category, query]);

  const trainingCardsToRender = useMemo(() => {
    if (!trainingCardsBase.length) return [];
    const byId = new Map(trainingVendors.map((v) => [v.id, v]));
    return trainingCardsBase.map((base) => byId.get(base.id) ?? base);
  }, [trainingCardsBase, trainingVendors]);

  const groomingCardsBase = useMemo(() => {
    if (nutritionHubActive || trainingHubActive || boardingHubActive || walkerHubActive || sittingHubActive) {
      return [];
    }
    const source = groomingHubActive
      ? vendorCardsToRender
      : vendorCardsToRender.filter(
          (v) =>
            isGroomingVendorResult(v) ||
            isGroomingCategory(resolveEffectiveSearchCategory(v.category, category, query))
        );
    return source.map((card) => searchCardToBoardingListVendor(card, category, query));
  }, [vendorCardsToRender, groomingHubActive, nutritionHubActive, trainingHubActive, boardingHubActive, walkerHubActive, sittingHubActive, category, query]);

  const groomingCardsToRender = useMemo(() => {
    if (!groomingCardsBase.length) return [];
    const byId = new Map(groomingVendors.map((v) => [v.id, v]));
    return groomingCardsBase.map((base) => byId.get(base.id) ?? base);
  }, [groomingCardsBase, groomingVendors]);

  const boardingCardsBase = useMemo(() => {
    if (nutritionHubActive || trainingHubActive || groomingHubActive || walkerHubActive || sittingHubActive) {
      return [];
    }
    const source = boardingHubActive
      ? vendorCardsToRender
      : vendorCardsToRender.filter(
          (v) =>
            isBoardingVendorResult(v) ||
            isBoardingCategory(resolveEffectiveSearchCategory(v.category, category, query))
        );
    return source.map((card) => searchCardToBoardingListVendor(card, category, query));
  }, [vendorCardsToRender, boardingHubActive, nutritionHubActive, trainingHubActive, groomingHubActive, walkerHubActive, sittingHubActive, category, query]);

  const boardingCardsToRender = useMemo(() => {
    if (!boardingCardsBase.length) return [];
    const byId = new Map(boardingVendors.map((v) => [v.id, v]));
    return boardingCardsBase.map((base) => byId.get(base.id) ?? base);
  }, [boardingCardsBase, boardingVendors]);

  const walkerCardsBase = useMemo(() => {
    if (nutritionHubActive || trainingHubActive || groomingHubActive || boardingHubActive || sittingHubActive) {
      return [];
    }
    const source = walkerHubActive
      ? vendorCardsToRender
      : vendorCardsToRender.filter(
          (v) =>
            isWalkerVendorResult(v) ||
            isWalkerCategory(resolveEffectiveSearchCategory(v.category, category, query))
        );
    return source.map((card) => searchCardToBoardingListVendor(card, category, query));
  }, [vendorCardsToRender, walkerHubActive, nutritionHubActive, trainingHubActive, groomingHubActive, boardingHubActive, sittingHubActive, category, query]);

  const walkerCardsToRender = useMemo(() => {
    if (!walkerCardsBase.length) return [];
    const byId = new Map(walkerVendors.map((v) => [v.id, v]));
    return walkerCardsBase.map((base) => byId.get(base.id) ?? base);
  }, [walkerCardsBase, walkerVendors]);

  const sittingCardsBase = useMemo(() => {
    if (nutritionHubActive || trainingHubActive || groomingHubActive || boardingHubActive || walkerHubActive) {
      return [];
    }
    const source = sittingHubActive
      ? vendorCardsToRender
      : vendorCardsToRender.filter(
          (v) =>
            isSittingVendorResult(v) ||
            isSittingCategory(resolveEffectiveSearchCategory(v.category, category, query))
        );
    return source.map((card) => searchCardToBoardingListVendor(card, category, query));
  }, [vendorCardsToRender, sittingHubActive, nutritionHubActive, trainingHubActive, groomingHubActive, boardingHubActive, walkerHubActive, category, query]);

  const sittingCardsToRender = useMemo(() => {
    if (!sittingCardsBase.length) return [];
    const byId = new Map(sittingVendors.map((v) => [v.id, v]));
    return sittingCardsBase.map((base) => byId.get(base.id) ?? base);
  }, [sittingCardsBase, sittingVendors]);

  useEffect(() => {
    if (!groomingCardsBase.length) {
      setGroomingVendors([]);
      return;
    }
    setGroomingVendors((prev) => {
      const prevById = new Map(prev.map((v) => [v.id, v]));
      return groomingCardsBase.map((base) => {
        const existing = prevById.get(base.id);
        if (existing) {
          return { ...base, planRows: existing.planRows, needsServiceFetch: existing.needsServiceFetch };
        }
        return base;
      });
    });
  }, [groomingCardsBase]);

  useEffect(() => {
    if (!boardingCardsBase.length) {
      setBoardingVendors([]);
      return;
    }
    setBoardingVendors((prev) => {
      const prevById = new Map(prev.map((v) => [v.id, v]));
      return boardingCardsBase.map((base) => {
        const existing = prevById.get(base.id);
        if (existing) {
          return { ...base, planRows: existing.planRows, needsServiceFetch: existing.needsServiceFetch };
        }
        return base;
      });
    });
  }, [boardingCardsBase]);

  useEffect(() => {
    if (!trainingCardsBase.length) {
      setTrainingVendors([]);
      return;
    }
    setTrainingVendors((prev) => {
      const prevById = new Map(prev.map((v) => [v.id, v]));
      return trainingCardsBase.map((base) => {
        const existing = prevById.get(base.id);
        if (existing) {
          return { ...base, planRows: existing.planRows, needsServiceFetch: existing.needsServiceFetch };
        }
        return base;
      });
    });
  }, [trainingCardsBase]);

  useEffect(() => {
    if (!walkerCardsBase.length) {
      setWalkerVendors([]);
      return;
    }
    setWalkerVendors((prev) => {
      const prevById = new Map(prev.map((v) => [v.id, v]));
      return walkerCardsBase.map((base) => {
        const existing = prevById.get(base.id);
        if (existing) {
          return { ...base, planRows: existing.planRows, needsServiceFetch: existing.needsServiceFetch };
        }
        return base;
      });
    });
  }, [walkerCardsBase]);

  useEffect(() => {
    if (!sittingCardsBase.length) {
      setSittingVendors([]);
      return;
    }
    setSittingVendors((prev) => {
      const prevById = new Map(prev.map((v) => [v.id, v]));
      return sittingCardsBase.map((base) => {
        const existing = prevById.get(base.id);
        if (existing) {
          return { ...base, planRows: existing.planRows, needsServiceFetch: existing.needsServiceFetch };
        }
        return base;
      });
    });
  }, [sittingCardsBase]);

  const hasVendorResults =
    nutritionCardsToRender.length > 0 ||
    trainingCardsToRender.length > 0 ||
    groomingCardsToRender.length > 0 ||
    boardingCardsToRender.length > 0 ||
    walkerCardsToRender.length > 0 ||
    sittingCardsToRender.length > 0 ||
    nonNutritionVendorCards.length > 0;

  const loadBoardingVendorPlans = async (vendorId: string) => {
    if (fetchingBoardingPlansFor === vendorId) return;
    const existing = boardingVendors.find((v) => v.id === vendorId);
    if (existing && existing.planRows.length > 0 && !existing.needsServiceFetch) return;
    try {
      setFetchingBoardingPlansFor(vendorId);
      const servicesResponse = await apiClient
        .get<any>(`/customer/vendor/${vendorId}/services?category=boarding`)
        .catch(() =>
          apiClient.get<any>(`/customer/vendor/${vendorId}/services?serviceStyle=at_center`)
        );
      const rows = mapServicesApiResponseToPlanRows(servicesResponse);
      setBoardingVendors((prev) =>
        prev.map((v) =>
          v.id === vendorId ? { ...v, planRows: rows, needsServiceFetch: false } : v
        )
      );
    } catch (err: any) {
      console.error('Error loading boarding vendor services:', err);
      setError(err.message || 'Failed to load boarding services');
    } finally {
      setFetchingBoardingPlansFor((cur) => (cur === vendorId ? null : cur));
    }
  };

  const handleExpandBoardingVendor = (vendorId: string) => {
    setExpandedVendorId(vendorId);
    updateSearchContextSelection(vendorId, undefined);
    const params = new URLSearchParams(searchParams.toString());
    params.set('vendorId', vendorId);
    router.replace(`/search?${params.toString()}`, { scroll: false });
    void loadBoardingVendorPlans(vendorId);
  };

  const handleCollapseBoardingVendor = (vendorId: string) => {
    setExpandedVendorId((cur) => (cur === vendorId ? null : cur));
    const params = new URLSearchParams(searchParams.toString());
    params.delete('vendorId');
    const qs = params.toString();
    router.replace(qs ? `/search?${qs}` : '/search', { scroll: false });
  };

  const handleBookBoardingPlan = (v: BoardingListVendor, plan: BoardingPlanRow) => {
    updateSearchContextSelection(v.id, plan.rowId);
    launchSearchBoardingBooking({
      vendorId: v.id,
      vendorName: v.name,
      serviceId: plan.rowId,
      serviceName: plan.name,
      price: plan.price,
      duration: plan.duration,
      serviceStyle: plan.serviceStyle || 'at_center',
      facility: { id: v.id, vendorId: v.id, name: v.name, businessName: v.name },
      router,
      returnSearchUrl: buildReturnSearchUrl(),
    });
  };

  const loadWalkerVendorPlans = async (vendorId: string) => {
    if (fetchingWalkerPlansFor === vendorId) return;
    const existing = walkerVendors.find((v) => v.id === vendorId);
    if (existing && existing.planRows.length > 0 && !existing.needsServiceFetch) return;
    try {
      setFetchingWalkerPlansFor(vendorId);
      const servicesResponse = await apiClient
        .get<any>(`/customer/vendor/${vendorId}/services?category=walking`)
        .catch(() =>
          apiClient.get<any>(`/customer/vendor/${vendorId}/services?category=walker&serviceStyle=at_home`)
        );
      const rows = mapServicesApiResponseToPlanRows(servicesResponse);
      setWalkerVendors((prev) =>
        prev.map((v) =>
          v.id === vendorId ? { ...v, planRows: rows, needsServiceFetch: false } : v
        )
      );
    } catch (err: any) {
      console.error('Error loading walker vendor services:', err);
      setError(err.message || 'Failed to load walker services');
    } finally {
      setFetchingWalkerPlansFor((cur) => (cur === vendorId ? null : cur));
    }
  };

  const handleExpandWalkerVendor = (vendorId: string) => {
    setExpandedVendorId(vendorId);
    updateSearchContextSelection(vendorId, undefined);
    const params = new URLSearchParams(searchParams.toString());
    params.set('vendorId', vendorId);
    router.replace(`/search?${params.toString()}`, { scroll: false });
    void loadWalkerVendorPlans(vendorId);
  };

  const handleCollapseWalkerVendor = (vendorId: string) => {
    setExpandedVendorId((cur) => (cur === vendorId ? null : cur));
    const params = new URLSearchParams(searchParams.toString());
    params.delete('vendorId');
    const qs = params.toString();
    router.replace(qs ? `/search?${qs}` : '/search', { scroll: false });
  };

  const handleBookWalkerPlan = (v: BoardingListVendor, plan: BoardingPlanRow) => {
    updateSearchContextSelection(v.id, plan.rowId);
    launchSearchWalkerBooking({
      vendorId: v.id,
      vendorName: v.name,
      serviceId: plan.rowId,
      serviceName: plan.name,
      price: plan.price,
      duration: plan.duration,
      serviceStyle: plan.serviceStyle || 'at_home',
      walker: { id: v.id, vendorId: v.id, name: v.name, businessName: v.name },
      router,
      returnSearchUrl: buildReturnSearchUrl(),
    });
  };

  const loadSittingVendorPlans = async (vendorId: string) => {
    if (fetchingSittingPlansFor === vendorId) return;
    const existing = sittingVendors.find((v) => v.id === vendorId);
    if (existing && existing.planRows.length > 0 && !existing.needsServiceFetch) return;
    try {
      setFetchingSittingPlansFor(vendorId);
      const servicesResponse = await apiClient
        .get<any>(`/customer/vendor/${vendorId}/services?category=sitting`)
        .catch(() =>
          apiClient.get<any>(`/customer/vendor/${vendorId}/services?serviceStyle=at_home`)
        );
      const rows = mapServicesApiResponseToPlanRows(servicesResponse);
      setSittingVendors((prev) =>
        prev.map((v) =>
          v.id === vendorId ? { ...v, planRows: rows, needsServiceFetch: false } : v
        )
      );
    } catch (err: any) {
      console.error('Error loading sitting vendor services:', err);
      setError(err.message || 'Failed to load sitting services');
    } finally {
      setFetchingSittingPlansFor((cur) => (cur === vendorId ? null : cur));
    }
  };

  const handleExpandSittingVendor = (vendorId: string) => {
    setExpandedVendorId(vendorId);
    updateSearchContextSelection(vendorId, undefined);
    const params = new URLSearchParams(searchParams.toString());
    params.set('vendorId', vendorId);
    router.replace(`/search?${params.toString()}`, { scroll: false });
    void loadSittingVendorPlans(vendorId);
  };

  const handleCollapseSittingVendor = (vendorId: string) => {
    setExpandedVendorId((cur) => (cur === vendorId ? null : cur));
    const params = new URLSearchParams(searchParams.toString());
    params.delete('vendorId');
    const qs = params.toString();
    router.replace(qs ? `/search?${qs}` : '/search', { scroll: false });
  };

  const handleBookSittingPlan = (v: BoardingListVendor, plan: BoardingPlanRow) => {
    updateSearchContextSelection(v.id, plan.rowId);
    launchSearchSittingBooking({
      vendorId: v.id,
      vendorName: v.name,
      serviceId: plan.rowId,
      serviceName: plan.name,
      price: plan.price,
      duration: plan.duration,
      serviceStyle: plan.serviceStyle || 'at_home',
      sitter: { id: v.id, vendorId: v.id, name: v.name, businessName: v.name },
      router,
      returnSearchUrl: buildReturnSearchUrl(),
    });
  };

  const loadGroomingVendorPlans = async (vendorId: string) => {
    if (fetchingGroomingPlansFor === vendorId) return;
    const existing = groomingVendors.find((v) => v.id === vendorId);
    if (existing && existing.planRows.length > 0 && !existing.needsServiceFetch) return;
    try {
      setFetchingGroomingPlansFor(vendorId);
      const servicesResponse = await apiClient
        .get<any>(`/customer/vendor/${vendorId}/services?category=grooming`)
        .catch(() =>
          apiClient.get<any>(`/customer/vendor/${vendorId}/services?serviceStyle=at_center`)
        );
      const rows = mapServicesApiResponseToPlanRows(servicesResponse);
      setGroomingVendors((prev) =>
        prev.map((v) =>
          v.id === vendorId ? { ...v, planRows: rows, needsServiceFetch: false } : v
        )
      );
    } catch (err: any) {
      console.error('Error loading grooming vendor services:', err);
      setError(err.message || 'Failed to load grooming services');
    } finally {
      setFetchingGroomingPlansFor((cur) => (cur === vendorId ? null : cur));
    }
  };

  const handleExpandGroomingVendor = (vendorId: string) => {
    setExpandedVendorId(vendorId);
    updateSearchContextSelection(vendorId, undefined);
    const params = new URLSearchParams(searchParams.toString());
    params.set('vendorId', vendorId);
    router.replace(`/search?${params.toString()}`, { scroll: false });
    void loadGroomingVendorPlans(vendorId);
  };

  const handleCollapseGroomingVendor = (vendorId: string) => {
    setExpandedVendorId((cur) => (cur === vendorId ? null : cur));
    const params = new URLSearchParams(searchParams.toString());
    params.delete('vendorId');
    const qs = params.toString();
    router.replace(qs ? `/search?${qs}` : '/search', { scroll: false });
  };

  const handleBookGroomingPlan = (v: BoardingListVendor, plan: BoardingPlanRow) => {
    updateSearchContextSelection(v.id, plan.rowId);
    launchSearchGroomingBooking({
      vendorId: v.id,
      vendorName: v.name,
      serviceId: plan.rowId,
      serviceName: plan.name,
      price: plan.price,
      duration: plan.duration,
      serviceStyle: plan.serviceStyle || 'at_center',
      groomer: { id: v.id, vendorId: v.id, name: v.name, businessName: v.name },
      router,
      returnSearchUrl: buildReturnSearchUrl(),
    });
  };

  const loadTrainingVendorPlans = async (vendorId: string) => {
    if (fetchingTrainingPlansFor === vendorId) return;
    const existing = trainingVendors.find((v) => v.id === vendorId);
    if (existing && existing.planRows.length > 0 && !existing.needsServiceFetch) return;
    try {
      setFetchingTrainingPlansFor(vendorId);
      const servicesResponse = await apiClient
        .get<any>(`/customer/vendor/${vendorId}/services?category=training`)
        .catch(() =>
          apiClient.get<any>(`/customer/vendor/${vendorId}/services?serviceStyle=at_center`)
        );
      const rows = mapServicesApiResponseToPlanRows(servicesResponse);
      setTrainingVendors((prev) =>
        prev.map((v) =>
          v.id === vendorId ? { ...v, planRows: rows, needsServiceFetch: false } : v
        )
      );
    } catch (err: any) {
      console.error('Error loading training vendor services:', err);
      setError(err.message || 'Failed to load training services');
    } finally {
      setFetchingTrainingPlansFor((cur) => (cur === vendorId ? null : cur));
    }
  };

  const handleExpandTrainingVendor = (vendorId: string) => {
    setExpandedVendorId(vendorId);
    updateSearchContextSelection(vendorId, undefined);
    const params = new URLSearchParams(searchParams.toString());
    params.set('vendorId', vendorId);
    router.replace(`/search?${params.toString()}`, { scroll: false });
    void loadTrainingVendorPlans(vendorId);
  };

  const handleCollapseTrainingVendor = (vendorId: string) => {
    setExpandedVendorId((cur) => (cur === vendorId ? null : cur));
    const params = new URLSearchParams(searchParams.toString());
    params.delete('vendorId');
    const qs = params.toString();
    router.replace(qs ? `/search?${qs}` : '/search', { scroll: false });
  };

  const handleBookTrainingPlan = (v: BoardingListVendor, plan: BoardingPlanRow) => {
    updateSearchContextSelection(v.id, plan.rowId);
    launchSearchTrainingBooking({
      vendorId: v.id,
      vendorName: v.name,
      serviceId: plan.rowId,
      serviceName: plan.name,
      price: plan.price,
      duration: plan.duration,
      serviceStyle: plan.serviceStyle || 'at_center',
      trainer: { id: v.id, vendorId: v.id, name: v.name, businessName: v.name },
      router,
      returnSearchUrl: buildReturnSearchUrl(),
    });
  };

  const handleExpandVendor = (vendorId: string) => {
    setExpandedVendorId(vendorId);
    updateSearchContextSelection(vendorId, undefined);
    const params = new URLSearchParams(searchParams.toString());
    params.set('vendorId', vendorId);
    router.replace(`/search?${params.toString()}`, { scroll: false });
    void loadVendorServices(vendorId);
  };

  const handleCollapseVendor = (vendorId: string) => {
    setExpandedVendorId((cur) => (cur === vendorId ? null : cur));
    const params = new URLSearchParams(searchParams.toString());
    params.delete('vendorId');
    const qs = params.toString();
    router.replace(qs ? `/search?${qs}` : '/search', { scroll: false });
  };

  const handleBookFromSearch = (vendor: SearchVendorCardData, service: ClinicServiceRow) => {
    updateSearchContextSelection(vendor.id, String(service.vendorServiceId));
    const effectiveCategory = resolveEffectiveSearchCategory(vendor.category, category, query);
    launchSearchServiceBooking({
      vendorId: vendor.id,
      vendorName: vendor.name,
      service,
      category: effectiveCategory,
      address: vendor.address,
      rating: vendor.rating,
      reviewCount: vendor.reviewCount,
      router,
      returnSearchUrl: buildReturnSearchUrl(),
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Keyword submit → clear hub chip so results are not AND-filtered by category.
    // The user's typed query is the primary intent; the chip was a browse mode.
    if (query.trim()) setCategory('');
    setSearchNonce((n) => n + 1);
  };

  const mainBottomPad = 'pb-[var(--customer-tabbed-nav-offset)]';

  return (
    <div className="mx-auto flex h-[100dvh] max-h-[100dvh] min-h-0 w-full max-w-md flex-col overflow-hidden bg-gradient-to-b from-orange-50/90 to-amber-50/80 shadow-[0_0_0_1px_rgba(0,0,0,0.06)]">
      {/* App shell: fixed top block (no wide desktop layout) */}
      <div className="shrink-0 border-b border-orange-200/80 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/85 cw-header-safe-top">
        <div className="relative flex h-14 items-center justify-center px-2">
          <div className="absolute left-1 top-1/2 -translate-y-1/2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 text-gray-800"
              onClick={() => router.push('/')}
              aria-label="Go to home"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>
          <h1 className="pointer-events-none max-w-[65%] truncate text-center text-lg font-bold tracking-tight text-gray-900">
            Search
          </h1>
        </div>
        <p className="px-4 pb-2 text-center text-xs leading-snug text-gray-500">
          Find vendors and services for your pets
        </p>

        <form onSubmit={handleSearch} className="px-4 pb-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400"
              aria-hidden
            />
            <input
              type="search"
              enterKeyHint="search"
              value={query}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
              placeholder="Services, vendors…"
              className="h-11 w-full rounded-2xl border border-gray-200 bg-white py-2 pl-10 pr-12 text-[16px] text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/25"
            />
            <Button
              type="submit"
              size="icon"
              className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2 rounded-xl bg-[#FF8C42] text-white hover:bg-[#FF7A2E]"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </form>

        <div className="-mx-0 border-t border-orange-100/80 bg-white/80 pb-3 pt-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div
            className="flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-1 pt-0.5 touch-pan-x"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  // Hub chip click → clear keyword so results are not AND-filtered.
                  // The chip is a browse mode; keyword is a search mode. Keep them exclusive.
                  if (cat.id) setQuery('');
                  setCategory(cat.id);
                }}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition active:scale-[0.98] ${
                  category === cat.id
                    ? 'bg-[#FF8C42] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="text-base leading-none" aria-hidden>
                  {cat.icon}
                </span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results — scrolls under header; padding for tab bar + home indicator */}
      <main
        className={`min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 [-webkit-overflow-scrolling:touch] ${mainBottomPad}`}
      >
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Searching...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-500">{error}</p>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setSearchNonce((n) => n + 1);
              }}
              className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-full"
            >
              Try Again
            </button>
          </div>
        ) : !hasVendorResults && productResults.length === 0 ? (
          <div className="flex min-h-[45vh] flex-col items-center justify-center px-2 py-10 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-sm ring-1 ring-orange-100">
              <Search className="h-10 w-10 text-[#FF8C42]" strokeWidth={1.75} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">No results found</h2>
            <p className="mt-2 max-w-[260px] text-sm text-gray-500">
              Try a different keyword or pick another category.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {nutritionCardsToRender.map((vendor) => {
              const vendorId = String(vendor.id || vendor.vendorId || '').trim();
              if (!vendorId) return null;
              const vendorName =
                vendor.businessName || vendor.name || vendor.vendor_name || 'Nutritionist';
              return (
                <SearchNutritionVendorCard
                  key={`nutrition-${vendorId}`}
                  vendor={vendor}
                  onViewMealPlans={() =>
                    launchSearchNutritionMealPlans({
                      vendorId,
                      vendorSnapshot: vendor,
                      router,
                    })
                  }
                  onViewServices={() =>
                    launchSearchNutritionBooking({
                      vendorId,
                      vendorName,
                      nutritionist: { ...vendor, id: vendorId, vendorId },
                      router,
                      returnSearchUrl: buildReturnSearchUrl(),
                    })
                  }
                />
              );
            })}
            {trainingCardsToRender.map((vendor) => {
              const expanded = expandedVendorId === vendor.id;
              const minP = minPriceForVendor(vendor);
              return (
                <SearchTrainingVendorCard
                  key={`training-${vendor.id}`}
                  vendor={vendor}
                  expanded={expanded}
                  fetchingPlansFor={fetchingTrainingPlansFor}
                  minPrice={minP}
                  onToggleHeader={() => {
                    if (expanded) {
                      handleCollapseTrainingVendor(vendor.id);
                    } else {
                      handleExpandTrainingVendor(vendor.id);
                    }
                  }}
                  onViewServices={(e) => {
                    e.stopPropagation();
                    handleExpandTrainingVendor(vendor.id);
                  }}
                  onDetails={(e, vendorId) => {
                    e.stopPropagation();
                    launchSearchTrainingCenterProfile({
                      vendorId,
                      router,
                      returnSearchUrl: buildReturnSearchUrl(),
                    });
                  }}
                  onBookPlan={handleBookTrainingPlan}
                  onOpenCenterDetails={(e, vendorId) => {
                    e.stopPropagation();
                    launchSearchTrainingCenterProfile({
                      vendorId,
                      router,
                      returnSearchUrl: buildReturnSearchUrl(),
                    });
                  }}
                />
              );
            })}
            {groomingCardsToRender.map((vendor) => {
              const expanded = expandedVendorId === vendor.id;
              const minP = minPriceForVendor(vendor);
              return (
                <SearchGroomingVendorCard
                  key={`grooming-${vendor.id}`}
                  vendor={vendor}
                  expanded={expanded}
                  fetchingPlansFor={fetchingGroomingPlansFor}
                  minPrice={minP}
                  onToggleHeader={() => {
                    if (expanded) {
                      handleCollapseGroomingVendor(vendor.id);
                    } else {
                      handleExpandGroomingVendor(vendor.id);
                    }
                  }}
                  onViewServices={(e) => {
                    e.stopPropagation();
                    handleExpandGroomingVendor(vendor.id);
                  }}
                  onDetails={(e, vendorId) => {
                    e.stopPropagation();
                    launchSearchGroomingCenterProfile({
                      vendorId,
                      router,
                      returnSearchUrl: buildReturnSearchUrl(),
                    });
                  }}
                  onBookPlan={handleBookGroomingPlan}
                  onOpenCenterDetails={(e, vendorId) => {
                    e.stopPropagation();
                    launchSearchGroomingCenterProfile({
                      vendorId,
                      router,
                      returnSearchUrl: buildReturnSearchUrl(),
                    });
                  }}
                />
              );
            })}
            {boardingCardsToRender.map((vendor) => {
              const expanded = expandedVendorId === vendor.id;
              const minP = minPriceForVendor(vendor);
              return (
                <SearchBoardingVendorCard
                  key={`boarding-${vendor.id}`}
                  vendor={vendor}
                  expanded={expanded}
                  fetchingPlansFor={fetchingBoardingPlansFor}
                  minPrice={minP}
                  onToggleHeader={() => {
                    if (expanded) {
                      handleCollapseBoardingVendor(vendor.id);
                    } else {
                      handleExpandBoardingVendor(vendor.id);
                    }
                  }}
                  onViewServices={(e) => {
                    e.stopPropagation();
                    handleExpandBoardingVendor(vendor.id);
                  }}
                  onDetails={(e, vendorId) => {
                    e.stopPropagation();
                    launchSearchBoardingCenterProfile({
                      vendorId,
                      router,
                      returnSearchUrl: buildReturnSearchUrl(),
                    });
                  }}
                  onBookPlan={handleBookBoardingPlan}
                  onOpenCenterDetails={(e, vendorId) => {
                    e.stopPropagation();
                    launchSearchBoardingCenterProfile({
                      vendorId,
                      router,
                      returnSearchUrl: buildReturnSearchUrl(),
                    });
                  }}
                />
              );
            })}
            {walkerCardsToRender.map((vendor) => {
              const expanded = expandedVendorId === vendor.id;
              const minP = minPriceForVendor(vendor);
              return (
                <SearchWalkerVendorCard
                  key={`walker-${vendor.id}`}
                  vendor={vendor}
                  expanded={expanded}
                  fetchingPlansFor={fetchingWalkerPlansFor}
                  minPrice={minP}
                  onToggleHeader={() => {
                    if (expanded) {
                      handleCollapseWalkerVendor(vendor.id);
                    } else {
                      handleExpandWalkerVendor(vendor.id);
                    }
                  }}
                  onViewServices={(e) => {
                    e.stopPropagation();
                    handleExpandWalkerVendor(vendor.id);
                  }}
                  onDetails={(e, vendorId) => {
                    e.stopPropagation();
                    launchSearchWalkerCenterProfile({
                      vendorId,
                      router,
                      returnSearchUrl: buildReturnSearchUrl(),
                    });
                  }}
                  onBookPlan={handleBookWalkerPlan}
                  onOpenCenterDetails={(e, vendorId) => {
                    e.stopPropagation();
                    launchSearchWalkerCenterProfile({
                      vendorId,
                      router,
                      returnSearchUrl: buildReturnSearchUrl(),
                    });
                  }}
                />
              );
            })}
            {sittingCardsToRender.map((vendor) => {
              const expanded = expandedVendorId === vendor.id;
              const minP = minPriceForVendor(vendor);
              return (
                <SearchSittingVendorCard
                  key={`sitting-${vendor.id}`}
                  vendor={vendor}
                  expanded={expanded}
                  fetchingPlansFor={fetchingSittingPlansFor}
                  minPrice={minP}
                  onToggleHeader={() => {
                    if (expanded) {
                      handleCollapseSittingVendor(vendor.id);
                    } else {
                      handleExpandSittingVendor(vendor.id);
                    }
                  }}
                  onViewServices={(e) => {
                    e.stopPropagation();
                    handleExpandSittingVendor(vendor.id);
                  }}
                  onDetails={(e, vendorId) => {
                    e.stopPropagation();
                    launchSearchSittingCenterProfile({
                      vendorId,
                      router,
                      returnSearchUrl: buildReturnSearchUrl(),
                    });
                  }}
                  onBookPlan={handleBookSittingPlan}
                  onOpenCenterDetails={(e, vendorId) => {
                    e.stopPropagation();
                    launchSearchSittingCenterProfile({
                      vendorId,
                      router,
                      returnSearchUrl: buildReturnSearchUrl(),
                    });
                  }}
                />
              );
            })}
            {nonNutritionVendorCards.map((vendor) => {
              const expanded = expandedVendorId === vendor.id;
              const services = vendorServicesById[vendor.id] ?? [];
              const loadingServices = servicesLoadingVendorId === vendor.id;
              return (
                <SearchVendorExpandableCard
                  key={`vendor-${vendor.id}`}
                  vendor={vendor}
                  services={services}
                  expanded={expanded}
                  loadingServices={loadingServices}
                  onViewServices={(e) => {
                    e.stopPropagation();
                    handleExpandVendor(vendor.id);
                  }}
                  onDetails={(e) => {
                    e.stopPropagation();
                    const effectiveCategory = resolveEffectiveSearchCategory(vendor.category, category, query);
                    router.push(buildSearchVendorDetailsUrl(vendor.id, vendor.name, effectiveCategory));
                  }}
                  onBookService={(service) => handleBookFromSearch(vendor, service)}
                  onToggleCollapse={() => handleCollapseVendor(vendor.id)}
                />
              );
            })}
            {productResults.map((result) => (
              <button
                key={`product-${result.id}`}
                type="button"
                className="block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 rounded-2xl"
                onClick={() => router.push(shopProductDetailPath(String(result.id)))}
              >
                <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-gray-100">
                  {result.imageUrl ? (
                    <img
                      src={result.imageUrl}
                      alt={result.name}
                      className="h-16 w-16 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-2xl">
                      🛍️
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{result.name}</p>
                    {result.sellerName && (
                      <p className="truncate text-xs text-gray-500">{result.sellerName}</p>
                    )}
                    {result.category && (
                      <span className="mt-1 inline-block rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-600">
                        {result.category}
                      </span>
                    )}
                  </div>
                  {result.price != null && (
                    <p className="shrink-0 text-sm font-bold text-[#FF8C42]">
                      ₹{result.price.toLocaleString('en-IN')}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      <BottomNavigation
        currentScreen="search"
        onNavigate={handleTabbedBottomNav}
        onProfileClick={openAccountMenu}
      />
      {accountSidebar}
    </div>
  );
}
