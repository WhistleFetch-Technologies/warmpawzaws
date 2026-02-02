'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Clock, TrendingUp, MapPin, Star, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';

interface SearchResult {
  id: string;
  type: 'staff' | 'center' | 'service' | 'product' | 'vendor' | 'category';
  category?: string; // Service category (veterinary, grooming, etc.)
  data: any;
  relevanceScore: number;
  distance?: number;
  matchedFields: string[];
}

interface SearchSuggestion {
  text: string;
  type: 'recent' | 'trending' | 'autocomplete';
}

interface EnhancedSearchBarProps {
  onSearch?: (query: string) => void;
  onResultSelect?: (result: SearchResult) => void;
  placeholder?: string;
  customerId?: string;
  className?: string;
}

export function EnhancedSearchBar({ 
  onSearch, 
  onResultSelect,
  placeholder = "Search for services, vets, trainers...",
  customerId,
  className = '' 
}: EnhancedSearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Get user location (silent fallback when permission denied)
  useEffect(() => {
    const { getCurrentPositionSafe } = require('@/lib/geolocation-utils');
    getCurrentPositionSafe(
      (coords: { lat: number; lng: number }) => setUserLocation(coords),
      () => {} // Fallback handled by onSuccess with default coords
    );
  }, []);

  // Load recent searches and suggestions
  useEffect(() => {
    loadRecentSearches();
    loadSearchSuggestions();
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
    // Try to load from backend first
    if (customerId) {
      try {
        // AWS Serverless compatible - use apiClient
        const data = await apiClient.get<{ data?: { history?: any[] }, history?: any[] }>(`/customer/${customerId}/search-history`);
        const history = data.data?.history || data.history || [];
        // Safely extract query string from history
        setRecentSearches(
          history
            .map((h: any) => String(h.query || h.text || h || ''))
            .filter(q => q) // Remove empty strings
            .slice(0, 5)
        );
        return;
      } catch (error) {
        console.error('Error loading search history:', error);
      }
    }

    // Fallback to localStorage
    const saved = localStorage.getItem('warmpawz_recent_searches');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Ensure all items are strings
        setRecentSearches(
          (Array.isArray(parsed) ? parsed : [])
            .map(item => String(item || ''))
            .filter(q => q)
            .slice(0, 10)
        );
      } catch (err) {
        console.error('Error loading recent searches from localStorage:', err);
      }
    }
  };

  const loadSearchSuggestions = async () => {
    try {
      const params = new URLSearchParams();
      if (customerId) params.append('customerId', customerId);

      // AWS Serverless compatible - use apiClient
      const result = await apiClient.get<{ data?: { suggestions?: any[] }, suggestions?: any[] }>(`/customer/search-suggestions?${params.toString()}`);
      const suggestionsData = result.data?.suggestions || result.suggestions || [];
      
      // Handle both string[] and object[] suggestions
      setSuggestions(suggestionsData.map((s: any) => {
        // If s is already an object with text, use it; otherwise convert to string
        if (typeof s === 'object' && s !== null) {
          return { 
            text: String(s.text || s.name || s.query || ''), 
            type: 'trending' as const 
          };
        }
        return { text: String(s || ''), type: 'trending' as const };
      }).filter(s => s.text)); // Remove empty suggestions
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    
    // Only open dropdown if we have content to show
    const hasContent = value.trim().length > 0 || recentSearches.length > 0 || suggestions.length > 0;
    setIsOpen(hasContent);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      if (value.trim().length >= 2) {
        performSearch(value.trim());
      } else {
        setResults([]);
      }
    }, 300);
  };

  const performSearch = async (searchQuery: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        limit: '10'
      });

      if (userLocation) {
        params.append('lat', userLocation.lat.toString());
        params.append('lng', userLocation.lng.toString());
      }

      if (customerId) {
        params.append('customerId', customerId);
      }

      // Use universal search endpoint (OpenSearch + SQL fallback)
      const data = await apiClient.get<{ 
        data?: { vendors?: any[], services?: any[], results?: any[] }, 
        vendors?: any[], 
        services?: any[], 
        results?: any[] 
      }>(`/search?${params.toString()}`);
      
      // Transform results from universal search format to SearchResult format
      const transformedResults: SearchResult[] = [];
      
      // Add vendors
      const vendors = data.data?.vendors || data.vendors || [];
      vendors.forEach((vendor: any) => {
        transformedResults.push({
          id: vendor.id || vendor.vendorId,
          type: 'vendor',
          category: vendor.category || vendor.roleId,
          data: {
            name: vendor.businessName || vendor.name,
            businessName: vendor.businessName,
            ownerName: vendor.ownerName,
            specialization: vendor.specialization,
            serviceType: vendor.category,
            description: vendor.specialization || vendor.description,
            rating: vendor.rating,
            photoUrl: vendor.photoUrl || vendor.photo,
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
            city: service.city,
            state: service.state
          },
          relevanceScore: service.relevanceScore || 50,
          distance: service.distance_km || service.distance,
          matchedFields: []
        });
      });
      
      // Fallback to old format if available
      if (transformedResults.length === 0) {
        const oldResults = data.data?.results || data.results || [];
        setResults(oldResults);
      } else {
        setResults(transformedResults);
      }
    } catch (error) {
      console.error('Error performing search:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const saveSearch = async (searchQuery: string) => {
    // Save to localStorage
    const updated = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 10);
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
    saveSearch(searchQuery);
    setIsOpen(false);
    if (onSearch) {
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
    if (query.trim()) {
      handleSearch(query.trim());
    }
  };

  const showRecentSearches = !query && recentSearches.length > 0;
  const showSuggestions = !query && suggestions.length > 0;
  const hasContent = showRecentSearches || showSuggestions || results.length > 0 || loading;
  
  // Auto-close dropdown if there's no content to show (prevents empty white space)
  useEffect(() => {
    if (isOpen && !hasContent) {
      setIsOpen(false);
    }
  }, [isOpen, hasContent]);

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => {
              // Only open if we have content to show
              const hasContent = query.trim().length > 0 || recentSearches.length > 0 || suggestions.length > 0 || results.length > 0;
              setIsOpen(hasContent);
            }}
            placeholder={placeholder}
            className="w-full pl-12 pr-12 py-3 bg-white border border-gray-200 rounded-full shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults([]);
                setIsOpen(false);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </form>

      {/* Dropdown - Only show when there's content to display */}
      {isOpen && (showRecentSearches || showSuggestions || results.length > 0 || loading) && (
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
              <h3 className="text-xs uppercase tracking-wide text-gray-500 px-3 py-2">
                Recent Searches
              </h3>
              {recentSearches.map((term, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    const searchTerm = String(term || '');
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

          {/* Trending Suggestions */}
          {!loading && showSuggestions && (
            <div className="p-2 border-b border-gray-100">
              <h3 className="text-xs uppercase tracking-wide text-gray-500 px-3 py-2">
                Trending Searches
              </h3>
              {suggestions.slice(0, 5).map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuery(suggestion.text);
                    handleSearch(suggestion.text);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg text-left transition-colors group"
                >
                  <TrendingUp className="w-4 h-4 text-orange-500" />
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
                        src={result.data.photoUrl || result.data.imageUrl} 
                        alt={String(result.data.name || result.data.businessName || 'Service')}
                        className="w-full h-full object-cover"
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
                      {(() => {
                        // Safely convert to string to avoid rendering objects
                        const spec = result.data?.specialization;
                        const serviceType = result.data?.serviceType;
                        const desc = result.data?.description;
                        
                        const value = spec || serviceType || desc || '';
                        // If it's an object, extract meaningful text
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
                          {Number(result.distance || 0).toFixed(1)} km
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
          {!loading && query && results.length === 0 && !showRecentSearches && !showSuggestions && (
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