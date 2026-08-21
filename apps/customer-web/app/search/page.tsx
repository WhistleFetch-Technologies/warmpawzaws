'use client';

import React, { Suspense, useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Search } from 'lucide-react';
import { BottomNavigation } from '@/components/customer/bottomNavigation/BottomNavigation';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { buildSearchFetchTrigger } from '@/lib/search-fetch-trigger';
import { applyHubCategoryFilter } from '@/lib/search-hub-category-filter';
import { formatCustomerApiError } from '@/lib/format-api-error';
import { loadCustomerServiceLaunchCatalog } from '@/lib/customer-service-style-launch';
import { filterSearchRowsByLaunch } from '@/lib/search-filter-by-launch';
import { resolveCustomerDiscoveryPhone } from '@/lib/customer-discovery-coords';
import { shopProductDetailPath } from '@/lib/shop-product-path';
import { saveSearchContext } from '@/lib/search-context';
import { saveGuestBookingIntentUnlessLowerPriority } from '@/lib/guest-booking-intent';
import { emitGuestAuthAnalytics, isGuestApplicationState } from '@/lib/guest-auth-gate';
import type { SearchVendorCardData } from '@/lib/search-vendor-card-data';
import {
  buildSearchVendorDetailsUrl,
  launchSearchNutritionBooking,
  launchSearchNutritionMealPlans,
  launchSearchGroomingCenterProfile,
  launchSearchBoardingCenterProfile,
  launchSearchWalkerCenterProfile,
  launchSearchSittingCenterProfile,
  launchSearchTrainingCenterProfile,
  launchSearchVetCenterProfile,
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
  isVetHub,
  isVetLikeCategory,
  isVetVendorResult,
  isWalkerCategory,
  isWalkerHub,
  isWalkerVendorResult,
  isCafeCategory,
  isResortCategory,
  isPharmacyCategory,
  resolveEffectiveSearchCategory,
} from '@/lib/search-category-detect';
import { fetchMergedNutritionProviders } from '@/lib/nutritionist-discovery';
import { enrichNutritionVendorPrices } from '@/lib/nutrition-vendor-price';
import {
  nutritionVendorFromDiscoveryRow,
  type NutritionVendorCardModel,
} from '@/components/customer/nutrition/NutritionVendorDetailsCard';
import { SearchNutritionVendorCard } from '@/components/customer/search/SearchNutritionVendorCard';
import { SearchHubVendorCard } from '@/components/customer/search/SearchHubVendorCard';
import {
  type BoardingListVendor,
} from '@/lib/boarding-vendor-discovery-map';
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
import {
  fetchWapptSearchVendorResults,
  mergeWapptSearchVendorRows,
  resolveWapptHubsForSearch,
  type SearchWapptVendorRow,
} from '@/lib/search-wappt-vendors';
import { filterMarketplaceRowsWhenWapptPresent } from '@/lib/search-wappt-dedup';
import { resolveSearchHubVendorCardMeta } from '@/lib/search-hub-vendor-card-config';
import { searchCardToBoardingListVendor } from '@/lib/search-training-vendor-map';
import { resolveBoardingListVendorProfileServiceStyle } from '@/lib/resolve-wappt-vendor-profile-service-style';
import { useCommerceConfigOptional } from '@/lib/commerce-config-provider';

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
  roleDisplayName?: string;
  preferredServiceStyle?: string;
  serviceStyle?: string;
  nextAvailableSlot?: string;
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
      serviceStyle: s.serviceStyle ?? s.service_style ?? undefined,
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

function wapptRowToSearchResult(row: SearchWapptVendorRow): SearchResult {
  return {
    id: row.id,
    type: 'vendor',
    name: row.name,
    category: row.category,
    rating: row.rating,
    reviewCount: row.reviewCount,
    city: row.city,
    imageUrl: row.imageUrl,
    addressDisplay: row.addressDisplay,
    distanceKm: row.distanceKm,
    roleDisplayName: row.roleDisplayName,
    preferredServiceStyle: row.preferredServiceStyle,
    serviceStyle: row.serviceStyle,
    nextAvailableSlot: row.nextAvailableSlot,
  };
}

async function loadWapptSearchResults(opts: {
  category: string;
  query: string;
  searchFetchKind: 'keyword' | 'hub' | 'browse';
  keyword?: string;
}): Promise<SearchWapptVendorRow[]> {
  const hubs = resolveWapptHubsForSearch({
    category: opts.category,
    query: opts.query,
    browseAll: opts.searchFetchKind === 'browse',
  });
  if (!hubs.length) return [];

  const keyword =
    opts.searchFetchKind === 'keyword' ? (opts.keyword || opts.query).trim() : undefined;

  const batches = await Promise.all(
    hubs.map((hub) => fetchWapptSearchVendorResults(hub, { keyword, limit: 50 }))
  );
  const seen = new Set<string>();
  const out: SearchWapptVendorRow[] = [];
  for (const batch of batches) {
    for (const row of batch) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      out.push(row);
    }
  }
  return out;
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
  const commerce = useCommerceConfigOptional();
  const commerceReady = commerce?.isLoaded !== false;
  const commerceModelId = commerce?.activeModelId ?? 'pending';
  const initialQuery = searchParams.get('q') || '';
  const initialCategory = searchParams.get('category') || '';
  const vendorIdParam = searchParams.get('vendorId');

  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  /** Last successful API payload (keyword search = full “All” list; hub-only = category browse). */
  const [apiResults, setApiResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Merged nutrition providers (all service styles) — same source as Home Expert Nutritionists. */
  const [nutritionVendors, setNutritionVendors] = useState<NutritionVendorCardModel[]>([]);
  /** Bumps on explicit Search submit / Try again so the same query refetches. */
  const [searchNonce, setSearchNonce] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (category) params.set('category', category);
    if (vendorIdParam) params.set('vendorId', vendorIdParam);
    const next = params.toString() ? `/search?${params.toString()}` : '/search';
    const current = `${window.location.pathname}${window.location.search || ''}`;
    if (current !== next) {
      router.replace(next, { scroll: false });
    }
  }, [query, category, vendorIdParam, router]);

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

  const openSearchHubVendorProfile = (
    e: React.MouseEvent,
    vendor: BoardingListVendor,
    hubCategory: string,
  ) => {
    e.stopPropagation();
    const vendorId = vendor.id;
    const returnUrl = buildReturnSearchUrl();
    const vendorName = vendor.name;
    const serviceStyle = resolveBoardingListVendorProfileServiceStyle(vendor, hubCategory);
    switch (hubCategory) {
      case 'vet':
        launchSearchVetCenterProfile({
          vendorId,
          vendorName,
          router,
          returnSearchUrl: returnUrl,
          serviceStyle,
        });
        break;
      case 'grooming':
        launchSearchGroomingCenterProfile({
          vendorId,
          vendorName,
          router,
          returnSearchUrl: returnUrl,
          serviceStyle,
        });
        break;
      case 'training':
        launchSearchTrainingCenterProfile({
          vendorId,
          vendorName,
          router,
          returnSearchUrl: returnUrl,
          serviceStyle,
        });
        break;
      case 'boarding':
        launchSearchBoardingCenterProfile({
          vendorId,
          vendorName,
          router,
          returnSearchUrl: returnUrl,
          serviceStyle,
        });
        break;
      case 'walker':
        launchSearchWalkerCenterProfile({
          vendorId,
          vendorName,
          router,
          returnSearchUrl: returnUrl,
          serviceStyle,
        });
        break;
      case 'sitting':
        launchSearchSittingCenterProfile({
          vendorId,
          vendorName,
          router,
          returnSearchUrl: returnUrl,
          serviceStyle,
        });
        break;
      default:
        router.push(buildSearchVendorDetailsUrl(vendorId, vendor.name, hubCategory));
    }
  };

  const renderSearchHubVendorCard = (
    vendor: BoardingListVendor,
    hubCategory: string,
    categoryLabelFallback: string,
    keyPrefix: string,
  ) => (
    <SearchHubVendorCard
      key={`${keyPrefix}-${vendor.id}`}
      vendor={vendor}
      category={hubCategory}
      categoryLabelFallback={categoryLabelFallback}
      onOpenProfile={(e, vendorId) => {
        openSearchHubVendorProfile(e, { ...vendor, id: vendorId }, hubCategory);
      }}
    />
  );

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
    if (vendorIdParam) return;
    // Wait for Commerce Switch so WAPPT listing eligibility is not decided on the
    // default marketplace fallback before sync completes.
    if (!commerceReady) return;
    if (!searchFetchTrigger) {
      setApiResults([]);
      setNutritionVendors([]);
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
        if (searchFetchTrigger.kind === 'keyword') {
          emitGuestAuthAnalytics('search_started', { q: searchFetchTrigger.q });
        }
        const response = await apiClient.get<any>(`/search?${params.toString()}`);
        if (cancelled) return;
        let mapped = mapSearchApiToResults(response);

        const wapptHub = categoryRef.current.trim();
        const wapptQuery = queryRef.current;
        const wapptRows = await loadWapptSearchResults({
          category: wapptHub,
          query: wapptQuery,
          searchFetchKind: searchFetchTrigger.kind,
          keyword: searchFetchTrigger.kind === 'keyword' ? searchFetchTrigger.q : undefined,
        });
        if (cancelled) return;
        if (wapptRows.length > 0) {
          mapped = filterMarketplaceRowsWhenWapptPresent(
            mapped,
            wapptRows,
            wapptHub,
            wapptQuery,
          );
        }
        mapped = mergeWapptSearchVendorRows(mapped, wapptRows, wapptRowToSearchResult);

        const launchPhone = resolveCustomerDiscoveryPhone();
        if (launchPhone) {
          const catalog = await loadCustomerServiceLaunchCatalog(launchPhone);
          if (cancelled) return;
          if (catalog.length) {
            mapped = filterSearchRowsByLaunch(
              catalog,
              mapped.map((r) => ({
                ...r,
                serviceType: r.category,
                serviceStyle: (r as { serviceStyle?: string }).serviceStyle,
              }))
            ) as SearchResult[];
          }
        }

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
          mergedNutrition = await enrichNutritionVendorPrices(mergedNutrition);
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
        emitGuestAuthAnalytics('search_result_viewed', {
          kind: searchFetchTrigger.kind,
          count: mapped.length,
        });
        if (isGuestApplicationState()) {
          saveGuestBookingIntentUnlessLowerPriority({
            kind: 'search',
            requiresPet: false,
            returnPath: `/search?${params.toString()}`,
            search: {
              q: searchFetchTrigger.kind === 'keyword' ? searchFetchTrigger.q : undefined,
              category:
                searchFetchTrigger.kind === 'hub'
                  ? searchFetchTrigger.c
                  : categoryRef.current.trim() || undefined,
            },
          });
        }
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
  }, [searchFetchTrigger, vendorIdParam, discoveryCoordsReady, commerceReady, commerceModelId]);

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
      roleDisplayName:
        result.roleDisplayName ||
        roleDisplayNameForCategory(effectiveCategory, result.category || effectiveCategory),
      preferredServiceStyle: result.preferredServiceStyle,
      serviceStyle: result.serviceStyle,
      nextAvailableSlot: result.nextAvailableSlot,
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
  const vetHubActive = isVetHub(category);
  const trainingHubActive = isTrainingHub(category);
  const groomingHubActive = isGroomingHub(category);
  const boardingHubActive = isBoardingHub(category);
  const walkerHubActive = isWalkerHub(category);
  const sittingHubActive = isSittingHub(category);

  const nonNutritionVendorCards = useMemo(() => {
    if (
      nutritionHubActive ||
      vetHubActive ||
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
        !isVetVendorResult(v) &&
        !isTrainingVendorResult(v) &&
        !isGroomingVendorResult(v) &&
        !isBoardingVendorResult(v) &&
        !isWalkerVendorResult(v) &&
        !isSittingVendorResult(v) &&
        !isNutritionCategory(effective) &&
        !isVetLikeCategory(effective) &&
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
    vetHubActive,
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

  const vetCardsBase = useMemo(() => {
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
    const source = vetHubActive
      ? vendorCardsToRender
      : vendorCardsToRender.filter(
          (v) =>
            isVetVendorResult(v) ||
            isVetLikeCategory(resolveEffectiveSearchCategory(v.category, category, query))
        );
    return source.map((card) => searchCardToBoardingListVendor(card, category, query));
  }, [
    vendorCardsToRender,
    vetHubActive,
    nutritionHubActive,
    trainingHubActive,
    groomingHubActive,
    boardingHubActive,
    walkerHubActive,
    sittingHubActive,
    category,
    query,
  ]);

  const vetCardsToRender = vetCardsBase;

  const trainingCardsBase = useMemo(() => {
    if (
      nutritionHubActive ||
      vetHubActive ||
      groomingHubActive ||
      boardingHubActive ||
      walkerHubActive ||
      sittingHubActive
    ) {
      return [];
    }
    const source = trainingHubActive
      ? vendorCardsToRender
      : vendorCardsToRender.filter((v) => isTrainingVendorResult(v));
    return source.map((card) => searchCardToBoardingListVendor(card, category, query));
  }, [vendorCardsToRender, trainingHubActive, nutritionHubActive, vetHubActive, groomingHubActive, boardingHubActive, walkerHubActive, sittingHubActive, category, query]);

  const groomingCardsBase = useMemo(() => {
    if (
      nutritionHubActive ||
      vetHubActive ||
      trainingHubActive ||
      boardingHubActive ||
      walkerHubActive ||
      sittingHubActive
    ) {
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
  }, [vendorCardsToRender, groomingHubActive, nutritionHubActive, vetHubActive, trainingHubActive, boardingHubActive, walkerHubActive, sittingHubActive, category, query]);

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

  const trainingCardsToRender = trainingCardsBase;
  const groomingCardsToRender = groomingCardsBase;
  const boardingCardsToRender = boardingCardsBase;
  const walkerCardsToRender = walkerCardsBase;
  const sittingCardsToRender = sittingCardsBase;

  const miscVendorCardsToRender = useMemo(
    () =>
      nonNutritionVendorCards.map((card) =>
        searchCardToBoardingListVendor(card, category, query),
      ),
    [nonNutritionVendorCards, category, query],
  );

  const hasVendorResults =
    nutritionCardsToRender.length > 0 ||
    vetCardsToRender.length > 0 ||
    trainingCardsToRender.length > 0 ||
    groomingCardsToRender.length > 0 ||
    boardingCardsToRender.length > 0 ||
    walkerCardsToRender.length > 0 ||
    sittingCardsToRender.length > 0 ||
    miscVendorCardsToRender.length > 0;

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
            <h2 className="text-lg font-semibold text-gray-900 max-w-[280px]">
              Oops! We sniffed around, but couldn&apos;t fetch that!!
            </h2>
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
            {vetCardsToRender.map((vendor) =>
              renderSearchHubVendorCard(vendor, 'vet', 'Veterinary', 'vet'),
            )}
            {trainingCardsToRender.map((vendor) =>
              renderSearchHubVendorCard(vendor, 'training', 'Training', 'training'),
            )}
            {groomingCardsToRender.map((vendor) =>
              renderSearchHubVendorCard(vendor, 'grooming', 'Grooming', 'grooming'),
            )}
            {boardingCardsToRender.map((vendor) =>
              renderSearchHubVendorCard(vendor, 'boarding', 'Boarding', 'boarding'),
            )}
            {walkerCardsToRender.map((vendor) =>
              renderSearchHubVendorCard(vendor, 'walker', 'Walker', 'walker'),
            )}
            {sittingCardsToRender.map((vendor) =>
              renderSearchHubVendorCard(vendor, 'sitting', 'Pet Sitting', 'sitting'),
            )}
            {miscVendorCardsToRender.map((vendor, idx) => {
              const card = nonNutritionVendorCards[idx];
              const effectiveCategory = resolveEffectiveSearchCategory(
                card?.category || '',
                category,
                query,
              );
              const meta = resolveSearchHubVendorCardMeta(
                effectiveCategory,
                card?.roleDisplayName,
              );
              return renderSearchHubVendorCard(
                vendor,
                meta.category,
                meta.categoryLabelFallback,
                'misc',
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
