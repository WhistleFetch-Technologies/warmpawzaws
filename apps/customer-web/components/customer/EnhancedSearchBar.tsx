'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Clock, TrendingUp, MapPin, Star, ChevronRight } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface SearchResult {
  id: string;
  type: 'staff' | 'center' | 'service' | 'product' | 'vendor' | 'category';
  category?: string;
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

  // Load recent searches
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
    if (customerId) {
      try {
        const response = await apiClient.get<{ history: Array<{ query: string }> }>(
          `/customer/${customerId}/search-history`
        );
        const history = response.history || [];
        setRecentSearches(history.map((h: any) => h.query).slice(0, 5));
        return;
      } catch (error) {
        console.error('Error loading search history:', error);
      }
    }

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

      const response = await apiClient.get<{ suggestions: string[] }>(
        `/customer/search-suggestions?${params}`
      );
      const suggestionsData = response.suggestions || [];
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
      const params = new URLSearchParams({ q: searchQuery });
      if (userLocation) {
        params.append('lat', userLocation.lat.toString());
        params.append('lng', userLocation.lng.toString());
      }

      const response = await apiClient.get<{ results: SearchResult[] }>(
        `/search/enhanced?${params}`
      );
      
      setResults(response.results || []);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (text: string) => {
    setQuery(text);
    setIsOpen(false);
    onSearch?.(text);
  };

  const handleResultSelect = (result: SearchResult) => {
    setIsOpen(false);
    onResultSelect?.(result);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setIsOpen(false);
      onSearch?.(query.trim());
    }
  };

  const showRecentSearches = !query && recentSearches.length > 0;
  const showTrending = !query && suggestions.length > 0;

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <Search className="absolute left-4 top-0/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            className="w-full pl-12 pr-12 py-0 bg-white border border-gray-200 rounded-full shadow-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults([]);
                setIsOpen(false);
              }}
              className="absolute right-4 top-0/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </form>

      {/* Dropdown */}
      {isOpen && (results.length > 0 || showRecentSearches || showTrending) && (
        <div className="absolute top-full left-0 right-0 mt-0 bg-white rounded-2xl shadow-xl border border-gray-200 max-h-96 overflow-y-auto z-50">
          {/* Recent Searches */}
          {showRecentSearches && (
            <div className="p-0 border-b border-gray-100">
              <div className="flex items-center gap-0 text-xs font-semibold text-gray-500 mb-0">
                <Clock className="w-4 h-4" />
                Recent Searches
              </div>
              <div className="space-y-1">
                {recentSearches.map((search, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelect(search)}
                    className="w-full text-left px-0 py-0 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-0"
                  >
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-700">{search}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Trending Suggestions */}
          {showTrending && (
            <div className="p-0 border-b border-gray-100">
              <div className="flex items-center gap-0 text-xs font-semibold text-gray-500 mb-0">
                <TrendingUp className="w-4 h-4" />
                Trending
              </div>
              <div className="space-y-1">
                {suggestions.slice(0, 5).map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelect(suggestion.text)}
                    className="w-full text-left px-0 py-0 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-0"
                  >
                    <TrendingUp className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-700">{suggestion.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Results */}
          {results.length > 0 && (
            <div className="p-0">
              <div className="text-xs font-semibold text-gray-500 mb-0">Results</div>
              <div className="space-y-1">
                {results.slice(0, 5).map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleResultSelect(result)}
                    className="w-full text-left px-0 py-0 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-0">
                          <span className="text-xs px-0 py-0.5 bg-primary/10 text-primary rounded-full">
                            {result.type}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {result.data.name || result.data.businessName}
                          </span>
                        </div>
                        {result.distance && (
                          <div className="flex items-center gap-0 text-xs text-gray-500 mt-0">
                            <MapPin className="w-3 h-3" />
                            <span>{result.distance.toFixed(1)} km away</span>
                          </div>
                        )}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="p-4 text-center">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

