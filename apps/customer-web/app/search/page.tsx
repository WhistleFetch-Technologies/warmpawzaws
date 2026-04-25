'use client';

import React, { Suspense, useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, Home, Search, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { applyHubCategoryFilter } from '@/lib/search-hub-category-filter';
import { saveSearchContext, updateSearchContextSelection } from '@/lib/search-context';
import { ServiceEvents } from '@/components/customer/ServiceEvents';

interface SearchResult {
  id: string;
  type: 'vendor' | 'service';
  name: string;
  category: string;
  rating: number;
  reviewCount: number;
  city: string;
  price?: number;
  imageUrl?: string;
}

function mapSearchApiToResults(response: any): SearchResult[] {
  const vendorsRaw = response.vendors ?? response.data?.vendors ?? [];
  const servicesRaw = response.services ?? response.data?.services ?? [];

  const vendors = (vendorsRaw || []).map((v: any) => ({
    id: v.id,
    type: 'vendor' as const,
    name: v.businessName ?? v.business_name ?? '',
    category:
      v.category ??
      v.roleId ??
      v.role_id ??
      v.serviceType ??
      v.service_type ??
      '',
    rating: parseFloat(v.rating ?? v.avg_rating) || 0,
    reviewCount: v.review_count ?? v.completedBookings ?? 0,
    city: v.city ?? '',
    imageUrl: v.profile_image ?? v.photoUrl,
  }));

  const services = (servicesRaw || []).map((s: any) => ({
    id: s.id,
    type: 'service' as const,
    name: s.serviceName ?? s.service_name ?? '',
    category: s.category ?? s.serviceType ?? s.service_type ?? '',
    rating: 0,
    reviewCount: 0,
    city: s.city ?? '',
    price: parseFloat(s.price ?? s.base_price) || undefined,
    imageUrl: s.image_url,
  }));

  return [...vendors, ...services];
}

function categoryEmoji(cat: string): string {
  const c = (cat || '').toLowerCase();
  if (c.includes('vet') || c.includes('veterinar') || c.includes('clinic')) return '🏥';
  if (c.includes('groom')) return '✂️';
  if (c.includes('train')) return '🎓';
  if (c.includes('board')) return '🏨';
  if (c.includes('walk')) return '🚶';
  if (c.includes('cafe')) return '☕';
  if (c.includes('resort')) return '🏝️';
  if (c.includes('pharma') || c.includes('chemist')) return '💊';
  return '🐾';
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
  const initialQuery = searchParams.get('q') || '';
  const initialCategory = searchParams.get('category') || '';
  const vendorIdParam = searchParams.get('vendorId');

  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  /** Last successful API payload (keyword search = full “All” list; hub-only = category browse). */
  const [apiResults, setApiResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vendorServices, setVendorServices] = useState<any[]>([]);
  const [showVendorServices, setShowVendorServices] = useState(!!vendorIdParam);
  /** Bumps on explicit Search submit / Try again so the same query refetches. */
  const [searchNonce, setSearchNonce] = useState(0);

  const categoryRef = React.useRef(category);
  const queryRef = React.useRef(query);
  const apiResultsRef = React.useRef(apiResults);
  categoryRef.current = category;
  queryRef.current = query;
  apiResultsRef.current = apiResults;

  /**
   * Keyword present → fetch GET /search?q=… only (no category); hub chips filter client-side.
   * No keyword but hub selected → fetch GET /search?category=… (browse-by-hub).
   */
  const searchFetchTrigger = useMemo(() => {
    if (vendorIdParam) return null;
    const q = (query || '').trim();
    const c = (category || '').trim();
    if (q) return { kind: 'keyword' as const, q, n: searchNonce };
    if (c) return { kind: 'hub' as const, c, n: searchNonce };
    return null;
  }, [query, category, vendorIdParam, searchNonce]);

  const displayedResults = useMemo(() => {
    const q = (query || '').trim();
    const hub = (category || '').trim();
    if (!q) return apiResults;
    return applyHubCategoryFilter(apiResults, hub, q);
  }, [apiResults, query, category]);

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

  useEffect(() => {
    if (vendorIdParam) {
      loadVendorServices(vendorIdParam);
      setShowVendorServices(true);
    } else {
      setShowVendorServices(false);
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
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (searchFetchTrigger.kind === 'keyword') {
          params.set('q', searchFetchTrigger.q);
          params.set('limit', '50');
        } else {
          params.set('category', searchFetchTrigger.c);
        }
        const response = await apiClient.get<any>(`/search?${params.toString()}`);
        if (cancelled) return;
        const mapped = mapSearchApiToResults(response);
        setApiResults(mapped);
        if (searchFetchTrigger.kind === 'keyword') {
          const qStr = searchFetchTrigger.q;
          const hub = categoryRef.current.trim();
          const contextResults = hub ? applyHubCategoryFilter(mapped, hub, qStr) : mapped;
          saveSearchContext({
            query: qStr,
            category: hub || undefined,
            results: contextResults,
            timestamp: Date.now(),
          });
        } else {
          saveSearchContext({
            query: '',
            category: searchFetchTrigger.c,
            results: mapped,
            timestamp: Date.now(),
          });
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('Search error:', err);
          setError(err.message || 'Search failed');
          setApiResults([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchFetchTrigger, vendorIdParam]);

  /** Keyword results loaded: keep localStorage context in sync when only the hub chip changes (no refetch). */
  useEffect(() => {
    if (vendorIdParam) return;
    const q = queryRef.current.trim();
    if (!q || !apiResultsRef.current.length) return;
    const hub = category.trim();
    const filtered = hub ? applyHubCategoryFilter(apiResultsRef.current, hub, q) : apiResultsRef.current;
    saveSearchContext({
      query: q,
      category: hub || undefined,
      results: filtered,
      timestamp: Date.now(),
    });
  }, [category, vendorIdParam]);

  const loadVendorServices = async (vendorId: string) => {
    try {
      setLoading(true);
      // Update search context with vendor selection
      updateSearchContextSelection(vendorId, undefined);
      
      // Prefer customer endpoint (only published, vendor price)
      let response: any;
      try {
        response = await apiClient.get<any>(`/customer/vendor/${vendorId}/services`);
      } catch {
        response = await apiClient.get<any>(`/vendor/${vendorId}/services`);
      }
      const serviceList = Array.isArray(response?.services) ? response.services : (response?.services?.at_home?.services || response?.services?.at_center?.services || response?.services?.tele?.services || []);
      if (serviceList.length) {
        setVendorServices(Array.isArray(response?.services) ? response.services : serviceList);
        saveSearchContext({
          query: query || '',
          category: category || undefined,
          selectedVendorId: vendorId,
          timestamp: Date.now(),
          results: serviceList.map((s: any) => ({
            id: s.id || s.service_id,
            type: 'service' as const,
            name: s.name || s.service_name,
            category: s.category,
          })),
        });
      }
    } catch (err: any) {
      console.error('Error loading vendor services:', err);
      setError(err.message || 'Failed to load vendor services');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query?.trim() && !category) return;
    setSearchNonce((n) => n + 1);
  };

  const mainBottomPad =
    'pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]';

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
              className="h-11 w-full rounded-2xl border border-gray-200 bg-white py-2 pl-10 pr-12 text-[15px] text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/25"
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
                onClick={() => setCategory(cat.id)}
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
        {showVendorServices && vendorIdParam ? (
          // Show vendor services
          <div>
            <div className="mb-3">
              <Button
                type="button"
                variant="ghost"
                className="h-9 -ml-2 gap-1 px-2 text-[#FF8C42] hover:text-[#E67A35]"
                onClick={() => {
                  setShowVendorServices(false);
                  router.push('/search');
                }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </div>
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading services...</p>
              </div>
            ) : vendorServices.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No services available for this vendor</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-3">
                  {vendorServices.map((service: any) => (
                    <a
                      key={service.id}
                      href={`/booking/${service.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        updateSearchContextSelection(vendorIdParam, service.id);
                        router.push(`/booking/${service.id}`);
                      }}
                      className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer"
                    >
                      <div className="p-4">
                        <h3 className="font-semibold text-gray-900">{service.service_name}</h3>
                        {service.price && (
                          <p className="text-orange-500 font-semibold mt-2">₹{service.price}</p>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
                {/* Show events related to vendor services */}
                {vendorServices.length > 0 && vendorIdParam && (
                  <ServiceEvents serviceId={vendorServices[0]?.id} vendorId={vendorIdParam} />
                )}
              </div>
            )}
          </div>
        ) : loading ? (
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
        ) : displayedResults.length === 0 ? (
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
          <div className="grid grid-cols-1 gap-3">
            {displayedResults.map((result) => (
              <a
                key={`${result.type}-${result.id}`}
                href={result.type === 'service' ? `/booking/${result.id}` : `/search?vendorId=${result.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  // Update search context with selection before navigation
                  if (result.type === 'vendor') {
                    updateSearchContextSelection(result.id, undefined);
                    // For vendors, redirect to search with vendorId to show services
                    router.push(`/search?vendorId=${result.id}`);
                  } else {
                    updateSearchContextSelection(undefined, result.id);
                    // For services, go directly to booking (will be guarded)
                    router.push(`/booking/${result.id}`);
                  }
                }}
                className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition cursor-pointer"
              >
                <div className="flex h-32 items-center justify-center bg-gradient-to-br from-orange-100 to-amber-100 text-5xl">
                  {categoryEmoji(result.category)}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{result.name}</h3>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <span>📍</span> {result.city}
                      </p>
                    </div>
                    {result.price && (
                      <span className="text-orange-500 font-semibold">₹{result.price}</span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-500">⭐</span>
                      <span className="font-medium">{result.rating.toFixed(1)}</span>
                      <span className="text-gray-400">({result.reviewCount})</span>
                    </div>
                    <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded-full">
                      {result.category}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>

      {/* Bottom tab bar — aligned with phone shell */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200/90 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/90">
        <div className="mx-auto flex w-full max-w-md items-stretch justify-between gap-0 px-1 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] pt-2">
          {[
            { Icon: Home, label: 'Home', href: '/' },
            { Icon: Search, label: 'Search', href: '/search', active: true },
            { Icon: Calendar, label: 'Bookings', href: '/bookings' },
            { Icon: User, label: 'Profile', href: '/profile' },
          ].map(({ Icon, label, href, active }) => (
            <Link
              key={label}
              href={href}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-1 transition-colors ${
                active ? 'text-[#FF8C42]' : 'text-gray-500 active:text-gray-700'
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.25 : 2} />
              <span className="max-w-full truncate text-[10px] font-medium leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
