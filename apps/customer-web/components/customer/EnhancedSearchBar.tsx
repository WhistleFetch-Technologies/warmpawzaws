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

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.log('Location access denied:', error)
      );
    }
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
        const data = await apiClient.get(`/customer/${customerId}/search-history`);
        const history = data.data?.history || data.history || [];
        setRecentSearches(history.map((h: any) => h.query).slice(0, 5));
        return;
      } catch (error) {
        console.error('Error loading search history:', error);
      }
    }

    // Fallback to localStorage
    const saved = localStorage.getItem('warmpawz_recent_searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
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
      const result = await apiClient.get(`/customer/search-suggestions?${params.toString()}`);
      const suggestionsData = result.data?.suggestions || result.suggestions || [];
      setSuggestions(suggestionsData.map((s: string) => ({ text: s, type: 'trending' as const })));
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setIsOpen(true);

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

      const data = await apiClient.get(`/customer/search?${params.toString()}`);
      setResults((data as any).data?.results || (data as any).results || []);
    } catch (error) {
      console.error('Error performing search:', error);
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
        await apiClient.post('/customer/search/history', {
          customerId,
          query: searchQuery,
          type: 'manual'
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

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => setIsOpen(true)}
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

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden max-h-[70vh] overflow-y-auto z-50">
          {/* Loading */}
          {loading && (
            <div className="p-4 text-center text-gray-500 text-sm">
              Searching...
            </div>
          )}

          {/* Recent Searches */}
          {showRecentSearches && (
            <div className="p-2 border-b border-gray-100">
              <h3 className="text-xs uppercase tracking-wide text-gray-500 px-3 py-2">
                Recent Searches
              </h3>
              {recentSearches.map((term, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuery(term);
                    handleSearch(term);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg text-left transition-colors group"
                >
                  <Clock className="w-4 h-4 text-gray-400 group-hover:text-orange-500" />
                  <span className="text-gray-700 group-hover:text-gray-900">{term}</span>
                </button>
              ))}
            </div>
          )}

          {/* Trending Suggestions */}
          {showSuggestions && (
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
                    {suggestion.text}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Search Results */}
          {results.length > 0 && (
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
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-orange-500 to-pink-500 overflow-hidden flex-shrink-0 flex items-center justify-center text-white">
                    {result.data?.photoUrl || result.data?.imageUrl ? (
                      <img 
                        src={result.data.photoUrl || result.data.imageUrl} 
                        alt={result.data.name || result.data.businessName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-lg">
                        {(result.data?.name || result.data?.businessName || '?')[0]}
                      </span>
                    )}
                  </div>

                  {/* Result Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-gray-900 line-clamp-1 group-hover:text-orange-600">
                        {result.data?.name || result.data?.businessName}
                      </h4>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {result.type}
                      </Badge>
                    </div>

                    <p className="text-sm text-gray-500 line-clamp-1 mt-1">
                      {result.data?.specialization || result.data?.serviceType || result.data?.description}
                    </p>

                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      {result.data?.rating && (
                        <span className="flex items-center gap-1 text-yellow-500">
                          <Star className="w-3 h-3 fill-current" />
                          {result.data.rating.toFixed(1)}
                        </span>
                      )}
                      {result.distance !== undefined && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {result.distance.toFixed(1)} km
                        </span>
                      )}
                      {result.relevanceScore && result.relevanceScore > 80 && (
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