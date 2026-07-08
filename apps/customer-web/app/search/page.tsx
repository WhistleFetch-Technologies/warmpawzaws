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
  launchSearchServiceBooking,
} from '@/lib/search-booking-launch';
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

  useEffect(() => {
    if (vendorIdParam) {
      setExpandedVendorId(vendorIdParam);
      void loadVendorServices(vendorIdParam);
    }
  }, [vendorIdParam]);

  useEffect(() => {
    if (vendorIdParam) return;
    if (!searchFetchTrigger) {
      setApiResults([]);
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
          saveSearchContext({
            query: '',
            category: searchFetchTrigger.c,
            results: mapped,
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

  const searchResultToVendorCard = (result: SearchResult): SearchVendorCardData => ({
    id: result.id,
    name: result.name,
    category: result.category,
    address:
      result.addressDisplay ||
      [result.city, result.state].filter(Boolean).join(', ') ||
      'Address on file',
    rating: result.rating,
    reviewCount: result.reviewCount,
    distanceKm: result.distanceKm ?? null,
    photo: result.imageUrl,
    roleDisplayName: result.category || undefined,
  });

  const serviceResultToVendorCard = (result: SearchResult): SearchVendorCardData | null => {
    const vendorId = result.vendorOwnerId?.trim();
    if (!vendorId) return null;
    return {
      id: vendorId,
      name: result.vendorBusinessName || 'Service provider',
      category: result.category,
      address:
        result.addressDisplay ||
        [result.city, result.state].filter(Boolean).join(', ') ||
        'Address on file',
      rating: result.rating,
      reviewCount: result.reviewCount,
      distanceKm: result.distanceKm ?? null,
      photo: result.imageUrl,
      roleDisplayName: result.category || undefined,
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
        category: category || 'vet',
        address: 'Address on file',
        rating: 0,
        reviewCount: 0,
        distanceKm: null,
      });
    }

    return cards;
  }, [displayedWithDistance, vendorIdParam, category]);

  const productResults = useMemo(
    () => displayedWithDistance.filter((r) => r.type === 'product'),
    [displayedWithDistance]
  );

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
    launchSearchServiceBooking({
      vendorId: vendor.id,
      vendorName: vendor.name,
      service,
      category: vendor.category,
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
        ) : vendorCardsToRender.length === 0 && productResults.length === 0 ? (
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
            {vendorCardsToRender.map((vendor) => {
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
                    router.push(buildSearchVendorDetailsUrl(vendor.id, vendor.name, vendor.category));
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
