'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Clock, MapPin, Star, ChevronRight, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { sanitizeCustomerAllowedServiceStyles } from '@/lib/sanitize-customer-allowed-service-styles';
import { pickProfileImageUrl, type SearchApiVendorRow } from '@/lib/search-vendor-display';
import {
  appendDiscoverRoleParams,
  buildSearchDiscoveryQueryParams,
} from '@/lib/search-discovery-params';
import {
  applyHubCategoryFilter,
  dedupeSearchVendorAndServiceRows,
  inferHubSlugFromSearchQuery,
} from '@/lib/search-hub-category-filter';
import {
  traceSearch,
  traceHomeSearchUpstream,
  traceSearchPersistence,
  logSearchLocalStorageOnLoad,
  searchPersistenceContainsTarget,
} from '@/lib/search-trace';

interface SearchResult {
  id: string;
  type: 'staff' | 'center' | 'service' | 'product' | 'vendor' | 'category' | 'symptom';
  category?: string; // Service category (veterinary, grooming, etc.)
  data: any;
  relevanceScore: number;
  distance?: number;
  matchedFields: string[];
}

interface SearchSuggestion {
  text: string;
  type: 'autocomplete';
}

interface EnhancedSearchBarProps {
  onSearch?: (query: string) => void;
  onResultSelect?: (result: SearchResult) => void;
  placeholder?: string;
  customerId?: string;
  className?: string;
  /** Home/mobile compact layout — sizing only. */
  compact?: boolean;
}

export function EnhancedSearchBar({ 
  onSearch, 
  onResultSelect,
  placeholder = "Search for services, vets, trainers...",
  customerId,
  className = '',
  compact = false,
}: EnhancedSearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState<SearchSuggestion[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  /** Latest coords for async search — avoids debounced `performSearch` using a stale `userLocation` closure. */
  const userLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  /** Monotonic id: only the latest in-flight `/search` may update `results` / `loading`. */
  const searchRequestSeqRef = useRef(0);
  /** Monotonic id: only the latest in-flight `/search/autocomplete` may update suggestions. */
  const autocompleteRequestSeqRef = useRef(0);
  /** Always invoke latest `performSearch` from debounce (stable closure). */
  const performSearchRef = useRef<(q: string) => void>(() => {});

  useEffect(() => {
    logSearchLocalStorageOnLoad(customerId);
    traceSearch('EnhancedSearchBar.mount', {
      query,
      placeholder,
      recentSearchesCount: recentSearches.length,
      recentSearchesPreview: recentSearches.slice(0, 5),
    });
  }, []);

  useEffect(() => {
    traceSearch('EnhancedSearchBar.query-changed', { query, placeholder });
  }, [query, placeholder]);

  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  // Get user location (silent fallback when permission denied)
  useEffect(() => {
    const { getCurrentPositionSafe } = require('@/lib/geolocation-utils');
    getCurrentPositionSafe(
      (coords: { lat: number; lng: number }) => {
        userLocationRef.current = coords;
        setUserLocation(coords);
      },
      () => {} // Fallback handled by onSuccess with default coords
    );
  }, []);

  // Load recent searches
  useEffect(() => {
    loadRecentSearches();
  }, [customerId]);

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadRecentSearches = async () => {
    traceSearchPersistence('loadRecentSearches.start', { customerId: customerId || null });

    // Try to load from backend first
    if (customerId) {
      try {
        const url = `/customer/${customerId}/search-history`;
        const data = await apiClient.get<{ data?: { history?: any[] }, history?: any[] }>(url);
        const history = data.data?.history || data.history || [];
        traceSearchPersistence('search-history.api.rawResponse', {
          customerId,
          url,
          historyCount: history.length,
          historyRaw: history,
          targetInRawHistory: history.filter((h: unknown) =>
            searchPersistenceContainsTarget(h)
          ),
        });
        const loaded = history
          .map((h: any) => String(h.query || h.text || h || ''))
          .filter(q => q)
          .slice(0, 15);
        traceSearchPersistence('search-history.api.hydrated', {
          source: 'GET /customer/:id/search-history',
          customerId,
          loaded,
          targetInLoaded: loaded.filter((q) => searchPersistenceContainsTarget(q)),
        });
        traceSearch('EnhancedSearchBar.loadRecentSearches.api', { loaded });
        setRecentSearches(loaded);
        return;
      } catch (error) {
        console.error('Error loading search history:', error);
        traceSearchPersistence('search-history.api.error', {
          customerId,
          error: String(error),
        });
      }
    } else {
      traceSearchPersistence('search-history.api.skipped', {
        reason: 'no customerId prop on EnhancedSearchBar',
      });
    }

    const saved = localStorage.getItem('warmpawz_recent_searches');
    traceSearchPersistence('localStorage.warmpawz_recent_searches.read', {
      raw: saved,
      targetInRaw: searchPersistenceContainsTarget(saved),
    });
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const loaded = (Array.isArray(parsed) ? parsed : [])
          .map(item => String(item || ''))
          .filter(q => q)
          .slice(0, 15);
        traceSearchPersistence('localStorage.warmpawz_recent_searches.hydrated', {
          source: 'localStorage warmpawz_recent_searches',
          loaded,
          targetInLoaded: loaded.filter((q) => searchPersistenceContainsTarget(q)),
        });
        traceSearch('EnhancedSearchBar.loadRecentSearches.localStorage', {
          raw: saved?.slice(0, 500),
          loaded,
        });
        setRecentSearches(loaded);
      } catch (err) {
        console.error('Error loading recent searches from localStorage:', err);
      }
    } else {
      traceSearchPersistence('localStorage.warmpawz_recent_searches.empty', {});
    }

    const ctxRaw = localStorage.getItem('warmpawz_search_context');
    if (ctxRaw) {
      traceSearchPersistence('localStorage.warmpawz_search_context.read', {
        raw: ctxRaw,
        targetInRaw: searchPersistenceContainsTarget(ctxRaw),
      });
    }
  };

  const clearAllHistory = async () => {
    setRecentSearches([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('warmpawz_recent_searches');
      if (customerId) {
        try {
          await apiClient.delete(`/customer/${customerId}/search-history`);
        } catch {
          // ignore
        }
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    traceSearch('EnhancedSearchBar.handleInputChange', { value, placeholder });
    setQuery(value);
    
    // Only open dropdown if we have content to show
    const hasContent =
      value.trim().length > 0 ||
      recentSearches.length > 0 ||
      autocompleteSuggestions.length > 0;
    setIsOpen(hasContent);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const trimmed = value.trim();
      if (trimmed.length >= 2) {
        const acReqId = ++autocompleteRequestSeqRef.current;
        apiClient
          .get<{ suggestions?: { text?: string }[]; data?: { suggestions?: { text?: string }[] } }>(
            `/search/autocomplete?q=${encodeURIComponent(trimmed)}`
          )
          .then((result) => {
            if (acReqId !== autocompleteRequestSeqRef.current) return;
            const items = result.data?.suggestions || result.suggestions || [];
            setAutocompleteSuggestions(
              items
                .map((s) => ({
                  text: String(s.text || ''),
                  type: 'autocomplete' as const,
                }))
                .filter((s) => s.text)
            );
          })
          .catch(() => {
            if (acReqId === autocompleteRequestSeqRef.current) {
              setAutocompleteSuggestions([]);
            }
          });
        performSearchRef.current(trimmed);
      } else {
        autocompleteRequestSeqRef.current += 1;
        setAutocompleteSuggestions([]);
        setResults([]);
      }
    }, 300);
  };

  const performSearch = async (searchQuery: string) => {
    traceSearch('EnhancedSearchBar.performSearch', { searchQuery, placeholder });
    const reqId = ++searchRequestSeqRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        limit: '30',
      });

      const inferredHub = inferHubSlugFromSearchQuery(searchQuery);
      if (inferredHub) {
        params.set('category', inferredHub);
        appendDiscoverRoleParams(params, inferredHub);
      }

      const discoveryParams = await buildSearchDiscoveryQueryParams();
      discoveryParams.forEach((value, key) => params.set(key, value));

      const locLat = params.get('userLat');
      const locLng = params.get('userLng');
      if (locLat && locLng) {
        const lat = parseFloat(locLat);
        const lng = parseFloat(locLng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          userLocationRef.current = { lat, lng };
          setUserLocation({ lat, lng });
        }
      }

      if (customerId) {
        params.append('customerId', customerId);
      }

      // Parallel: universal search + symptom search (so e.g. "vomiting" shows vet options and drives to booking)
      const [searchData, symptomData] = await Promise.all([
        apiClient.get<{ 
          data?: { vendors?: any[], services?: any[], results?: any[] }, 
          vendors?: any[], 
          services?: any[], 
          results?: any[] 
        }>(`/search?${params.toString()}`),
        apiClient.get<{ success?: boolean; results?: any[] }>(`/public/search/symptoms?q=${encodeURIComponent(searchQuery)}`).catch(() => ({ success: false, results: [] })),
      ]);

      if (reqId !== searchRequestSeqRef.current) {
        return;
      }

      const data = searchData;
      
      // Transform results from universal search format to SearchResult format
      const transformedResults: SearchResult[] = [];
      
      // Prepend symptom-based results (e.g. "vomiting" -> Vet at Home, Vet at Clinic, Tele) so user can go straight to booking
      const symptomResults = symptomData?.success && Array.isArray(symptomData.results) ? symptomData.results : [];
      symptomResults.slice(0, 5).forEach((row: any) => {
        transformedResults.push({
          id: `symptom-${row.specializationId || row.name}`,
          type: 'symptom',
          category: row.categoryId || row.roleId || 'veterinary',
          data: {
            specializationId: row.specializationId,
            name: row.name,
            matchedSymptom: row.matchedSymptom,
            roleId: row.roleId,
            allowedServiceStyles: sanitizeCustomerAllowedServiceStyles(row.allowedServiceStyles, {
              roleId: row.roleId,
              specializationId: row.specializationId,
              categoryHint: row.categoryId,
            }),
            categoryId: row.categoryId,
          },
          relevanceScore: 100,
          matchedFields: ['symptom'],
        });
      });
      
      // Add vendors
      const vendors = data.data?.vendors || data.vendors || [];
      vendors.forEach((vendor: any) => {
        const photoUrl = pickProfileImageUrl(vendor as SearchApiVendorRow);
        transformedResults.push({
          id: vendor.id || vendor.vendorId,
          type: 'vendor',
          category: vendor.category || vendor.roleId,
          data: {
            name: vendor.businessName || vendor.name,
            businessName: vendor.businessName,
            ownerName: vendor.ownerName,
            serviceType: vendor.category,
            description: vendor.description,
            rating: vendor.rating,
            photoUrl,
            imageUrl: photoUrl,
            city: vendor.city,
            state: vendor.state
          },
          relevanceScore: vendor.relevanceScore || vendor.rating * 20 || 50,
          distance: vendor.distance_km || vendor.distance,
          matchedFields: []
        });
      });
      
      // Add services
      const services = data.data?.services || data.services || [];
      services.forEach((service: any) => {
        const vendorFacet: SearchApiVendorRow = {
          ...service,
          profileImage: service.vendorProfileImage ?? service.vendor_profile_image,
          profile_image: service.vendor_profile_image ?? service.vendorProfileImage,
        };
        const photoUrl = pickProfileImageUrl(vendorFacet);
        transformedResults.push({
          id: service.id || service.serviceId,
          type: 'service',
          category: service.category || service.serviceType,
          data: {
            name: service.serviceName || service.name,
            businessName: service.vendorName,
            serviceType: service.category,
            description: service.description,
            price: service.price,
            vendorId: service.vendorId,
            photoUrl,
            imageUrl: photoUrl,
            city: service.city,
            state: service.state
          },
          relevanceScore: service.relevanceScore || 50,
          distance: service.distance_km || service.distance,
          matchedFields: []
        });
      });
      
      let finalResults = transformedResults;
      if (inferredHub && finalResults.length > 0) {
        finalResults = finalResults.filter((r) =>
          applyHubCategoryFilter(
            [
              {
                type: r.type,
                category: String(r.category || r.data?.serviceType || ''),
                name: String(r.data?.name || r.data?.businessName || ''),
              },
            ],
            inferredHub,
            searchQuery
          ).length > 0
        );
      }

      finalResults = dedupeSearchVendorAndServiceRows(
        finalResults.map((r) => ({
          ...r,
          vendorOwnerId:
            r.type === 'service' ? String(r.data?.vendorId || '').trim() || undefined : undefined,
        }))
      );

      // Walker service screen lists vendors only — avoid vendor + walk service double-count.
      if (inferredHub === 'walker') {
        const vendorHits = finalResults.filter((r) => r.type === 'vendor');
        if (vendorHits.length > 0) {
          finalResults = vendorHits;
        } else {
          const seenVendor = new Set<string>();
          finalResults = finalResults.filter((r) => {
            const vid = String(r.data?.vendorId || '').trim();
            if (!vid || seenVendor.has(vid)) return false;
            seenVendor.add(vid);
            return true;
          });
        }
      }

      const oldResults = data.data?.results || data.results || [];
      if (finalResults.length === 0) {
        setResults(oldResults);
      } else {
        setResults(finalResults);
      }
    } catch (error) {
      console.error('Error performing search:', error);
      if (reqId === searchRequestSeqRef.current) {
        setResults([]);
      }
    } finally {
      if (reqId === searchRequestSeqRef.current) {
        setLoading(false);
      }
    }
  };

  performSearchRef.current = (q: string) => {
    void performSearch(q);
  };

  const saveSearch = async (searchQuery: string) => {
    // Save to localStorage (same key as /search page; limit 15)
    const updated = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 15);
    setRecentSearches(updated);
    localStorage.setItem('warmpawz_recent_searches', JSON.stringify(updated));

    // Save to backend
    if (customerId) {
      try {
        await apiClient.post('/customer/search/track', {
          customerId,
          query: searchQuery,
          searchType: 'manual'
        });
      } catch (error) {
        console.error('Error saving search history:', error);
      }
    }
  };

  const handleSearch = (searchQuery: string) => {
    traceHomeSearchUpstream('EnhancedSearchBar.handleSearch', {
      searchQuery,
      queryState: query,
      placeholder,
      recentSearchesPreview: recentSearches.slice(0, 5),
      hasOnSearch: typeof onSearch === 'function',
    });
    saveSearch(searchQuery);
    setIsOpen(false);
    if (onSearch) {
      traceHomeSearchUpstream('EnhancedSearchBar.onSearch.invoke', {
        payload: searchQuery,
        placeholder,
        queryState: query,
      });
      onSearch(searchQuery);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    saveSearch(query);
    setIsOpen(false);
    setQuery(''); // Clear query after selection
    if (onResultSelect) {
      onResultSelect(result);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    traceHomeSearchUpstream('EnhancedSearchBar.handleSubmit', {
      query,
      placeholder,
      trimmed: query.trim(),
      willSubmit: !!query.trim(),
    });
    if (query.trim()) {
      handleSearch(query.trim());
    }
  };

  const showRecentSearches = !query && recentSearches.length > 0;
  const showAutocomplete = query.trim().length >= 2 && autocompleteSuggestions.length > 0;

  useEffect(() => {
    traceSearchPersistence('recentSearches.stateAfterHydration', {
      customerId: customerId || null,
      recentSearches,
      recentSearchesCount: recentSearches.length,
      targetInState: recentSearches.filter((q) => searchPersistenceContainsTarget(q)),
    });
  }, [recentSearches, customerId]);

  useEffect(() => {
    if (!showRecentSearches) return;
    const renderedRecentItems = recentSearches.map((term, idx) => ({
      index: idx,
      term: String(term || ''),
    }));
    traceSearchPersistence('recentSearches.renderedDropdownItems', {
      customerId: customerId || null,
      renderedRecentItems,
      targetInRendered: renderedRecentItems.filter((r) =>
        searchPersistenceContainsTarget(r.term)
      ),
    });
  }, [showRecentSearches, recentSearches, customerId]);
  const hasContent =
    showRecentSearches || showAutocomplete || results.length > 0 || loading;
  
  // Auto-close dropdown if there's no content to show (prevents empty white space)
  useEffect(() => {
    if (isOpen && !hasContent) {
      setIsOpen(false);
    }
  }, [isOpen, hasContent]);

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search
            className={`absolute top-1/2 -translate-y-1/2 text-gray-400 ${
              compact ? 'left-3 h-4 w-4' : 'left-4 h-5 w-5'
            }`}
          />
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => {
              // Only open if we have content to show
              const hasContent = query.trim().length > 0 || recentSearches.length > 0 || results.length > 0;
              setIsOpen(hasContent);
            }}
            placeholder={placeholder}
            className={`w-full bg-white border border-gray-200 rounded-full shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all ${
              compact
                ? 'h-12 py-0 pl-10 pr-10 text-sm'
                : 'py-3 pl-12 pr-12'
            }`}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults([]);
                setAutocompleteSuggestions([]);
                setIsOpen(false);
              }}
              className={`absolute top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors ${
                compact ? 'right-3' : 'right-4'
              }`}
            >
              <X className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
            </button>
          )}
        </div>
        <button
          type="submit"
          className={`shrink-0 bg-orange-500 text-white font-medium rounded-full hover:bg-orange-600 transition-colors shadow-sm ${
            compact ? 'h-12 px-4 text-sm' : 'px-5 py-3'
          }`}
        >
          Search
        </button>
      </form>

      {/* Dropdown - Only show when there's content to display */}
      {isOpen && (showRecentSearches || showAutocomplete || results.length > 0 || loading) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden max-h-[70vh] overflow-y-auto z-50">
          {/* Loading */}
          {loading && (
            <div className="p-4 text-center text-gray-500 text-sm">
              Searching...
            </div>
          )}

          {/* Recent Searches */}
          {!loading && showRecentSearches && (
            <div className="p-2 border-b border-gray-100">
              <div className="flex items-center justify-between px-3 py-2">
                <h3 className="text-xs uppercase tracking-wide text-gray-500">
                  Recent Searches
                </h3>
                <button
                  type="button"
                  onClick={clearAllHistory}
                  className="text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear all
                </button>
              </div>
              {recentSearches.map((term, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    const searchTerm = String(term || '');
                    traceHomeSearchUpstream('EnhancedSearchBar.recentSearch.click', {
                      searchTerm,
                      placeholder,
                      queryBefore: query,
                    });
                    setQuery(searchTerm);
                    handleSearch(searchTerm);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg text-left transition-colors group"
                >
                  <Clock className="w-4 h-4 text-gray-400 group-hover:text-orange-500" />
                  <span className="text-gray-700 group-hover:text-gray-900">{String(term || '')}</span>
                </button>
              ))}
            </div>
          )}

          {/* Taxonomy autocomplete */}
          {!loading && showAutocomplete && (
            <div className="p-2 border-b border-gray-100">
              <h3 className="text-xs uppercase tracking-wide text-gray-500 px-3 py-2">
                Suggestions
              </h3>
              {autocompleteSuggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    traceHomeSearchUpstream('EnhancedSearchBar.autocomplete.click', {
                      suggestionText: suggestion.text,
                      placeholder,
                      queryBefore: query,
                    });
                    setQuery(suggestion.text);
                    handleSearch(suggestion.text);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg text-left transition-colors group"
                >
                  <Search className="w-4 h-4 text-gray-400 group-hover:text-orange-500" />
                  <span className="text-gray-700 group-hover:text-gray-900 capitalize">
                    {String(suggestion.text || '')}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Search Results */}
          {!loading && results.length > 0 && (
            <div className="p-2">
              <h3 className="text-xs uppercase tracking-wide text-gray-500 px-3 py-2">
                Results
              </h3>
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleResultClick(result)}
                  className="w-full flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors text-left group"
                >
                  {/* Icon/Image */}
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-orange-500 to-pink-500 overflow-hidden flex-shrink-0 flex items-center justify-center text-white font-semibold">
                    {result.data?.photoUrl || result.data?.imageUrl ? (
                      <img 
                        key={result.data.photoUrl || result.data.imageUrl}
                        src={result.data.photoUrl || result.data.imageUrl} 
                        alt={String(result.data.name || result.data.businessName || 'Service')}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        decoding="async"
                      />
                    ) : (
                      <span className="text-xl uppercase">
                        {String(result.data?.name || result.data?.businessName || result.type || '?')[0]}
                      </span>
                    )}
                  </div>

                  {/* Result Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-gray-900 line-clamp-1 group-hover:text-orange-600 font-medium">
                        {String(result.data?.name || result.data?.businessName || 'Service')}
                      </h4>
                      <Badge variant="secondary" className="text-xs capitalize flex-shrink-0">
                        {String(result.type || 'service')}
                      </Badge>
                    </div>

                    <p className="text-sm text-gray-500 line-clamp-1 mt-1">
                      {result.type === 'symptom'
                        ? `Consult for "${result.data?.matchedSymptom || result.data?.name || 'symptom'}" — book vet / clinic / tele`
                        : (() => {
                            const serviceType = result.data?.serviceType;
                            const desc = result.data?.description;
                            const value = serviceType || desc || '';
                            if (typeof value === 'object' && value !== null) {
                              return String(value.name || value.type || value.text || '');
                            }
                            return String(value || '');
                          })()}
                    </p>

                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      {result.data?.rating && typeof result.data.rating === 'number' && (
                        <span className="flex items-center gap-1 text-yellow-500">
                          <Star className="w-3 h-3 fill-current" />
                          {result.data.rating.toFixed(1)}
                        </span>
                      )}
                      {typeof result.distance === 'number' && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {result.distance < 1
                            ? `${Math.round(result.distance * 1000)} m`
                            : `${Math.round(result.distance)} km`}
                        </span>
                      )}
                      {typeof result.relevanceScore === 'number' && result.relevanceScore > 80 && (
                        <Badge className="bg-green-100 text-green-700 text-xs">
                          Best Match
                        </Badge>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 self-center" />
                </button>
              ))}
            </div>
          )}

          {/* No Results */}
          {!loading && query && results.length === 0 && !showRecentSearches && !showAutocomplete && (
            <div className="p-8 text-center">
              <p className="text-gray-500 text-sm">No results found for "{query}"</p>
              <p className="text-gray-400 text-xs mt-1">Try a different search term</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}