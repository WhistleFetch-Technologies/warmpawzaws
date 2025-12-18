import React, { useState, useEffect, useCallback } from 'react';
import { Search, X, Filter, MapPin, Star, ChevronRight, Building, User, Package, ShoppingBag, TrendingUp, Clock } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
// Brand color: #FF8C42

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

interface SearchResult {
  id: string;
  type: 'centers' | 'staff' | 'services' | 'products';
  score: number;
  name?: string;
  businessName?: string;
  serviceName?: string;
  productName?: string;
  description?: string;
  rating?: number;
  location?: string;
  city?: string;
  price?: number;
  category?: string;
  highlight?: any;
  vendorId?: string;
  isActive?: boolean;
}

interface SearchFilters {
  types: string[];
  category?: string;
  city?: string;
  priceMin?: number;
  priceMax?: number;
  ratingMin?: number;
  lat?: number;
  lng?: number;
  radius?: number;
  sort: string;
}

interface EnhancedSearchInterfaceProps {
  onResultSelect?: (result: SearchResult) => void;
  defaultQuery?: string;
  showFilters?: boolean;
}

export function EnhancedSearchInterface({
  onResultSelect,
  defaultQuery = '',
  showFilters = true
}: EnhancedSearchInterfaceProps) {
  const [query, setQuery] = useState(defaultQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [responseTime, setResponseTime] = useState('');

  const [filters, setFilters] = useState<SearchFilters>({
    types: ['centers', 'staff', 'services', 'products'],
    sort: 'relevance'
  });

  // Load search history from localStorage
  useEffect(() => {
    const history = localStorage.getItem('searchHistory');
    if (history) {
      setSearchHistory(JSON.parse(history));
    }
  }, []);

  // Fetch autocomplete suggestions with debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length >= 2) {
        await fetchAutocomplete(query);
      } else {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const fetchAutocomplete = async (searchQuery: string) => {
    try {
      const response = await fetch(
        `${BASE_URL}/elasticsearch/autocomplete?q=${encodeURIComponent(searchQuery)}&type=centers`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error('Error fetching autocomplete:', error);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    setLoading(true);
    setShowSuggestions(false);

    try {
      // Build query params
      const params = new URLSearchParams({
        q: query,
        types: filters.types.join(','),
        sort: filters.sort
      });

      if (filters.category) params.append('category', filters.category);
      if (filters.city) params.append('city', filters.city);
      if (filters.priceMin !== undefined) params.append('priceMin', filters.priceMin.toString());
      if (filters.priceMax !== undefined) params.append('priceMax', filters.priceMax.toString());
      if (filters.ratingMin !== undefined) params.append('ratingMin', filters.ratingMin.toString());
      if (filters.lat !== undefined) params.append('lat', filters.lat.toString());
      if (filters.lng !== undefined) params.append('lng', filters.lng.toString());
      if (filters.radius !== undefined) params.append('radius', filters.radius.toString());

      const response = await fetch(
        `${BASE_URL}/elasticsearch/search?${params}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        // Flatten results from all types
        const allResults: SearchResult[] = [];
        Object.entries(data.results || {}).forEach(([type, typeData]: [string, any]) => {
          if (typeData.hits) {
            allResults.push(...typeData.hits);
          }
        });

        // Sort by score
        allResults.sort((a, b) => (b.score || 0) - (a.score || 0));

        setResults(allResults);
        setTotalResults(data.total || 0);
        setResponseTime(data.responseTime || '');

        // Add to search history
        addToSearchHistory(query);

        if (allResults.length === 0) {
          toast.info('No results found. Try different keywords.');
        }
      } else {
        toast.error('Search failed. Please try again.');
      }
    } catch (error) {
      console.error('Error performing search:', error);
      toast.error('Search error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const addToSearchHistory = (searchQuery: string) => {
    const newHistory = [searchQuery, ...searchHistory.filter(q => q !== searchQuery)].slice(0, 10);
    setSearchHistory(newHistory);
    localStorage.setItem('searchHistory', JSON.stringify(newHistory));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        setQuery(suggestions[selectedIndex].text);
        setShowSuggestions(false);
        setTimeout(() => handleSearch(), 100);
      } else {
        handleSearch();
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const getResultName = (result: SearchResult) => {
    return result.businessName || result.name || result.serviceName || result.productName || 'Unknown';
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'centers': return <Building className="w-6 h-6 text-orange-600" />;
      case 'staff': return <User className="w-6 h-6 text-orange-600" />;
      case 'services': return <Package className="w-6 h-6 text-orange-600" />;
      case 'products': return <ShoppingBag className="w-6 h-6 text-orange-600" />;
      default: return <Search className="w-6 h-6 text-orange-600" />;
    }
  };

  const highlightText = (text: string, highlight: any) => {
    if (!highlight) return text;
    
    // Simple highlighting - in production, use proper HTML sanitization
    return text;
  };

  return (
    <div className="w-full">
      {/* Search Bar */}
      <div className="relative mb-6">
        <div className="flex items-center gap-2 bg-white rounded-lg border-2 border-gray-300 focus-within:border-orange-500 px-4 py-3 shadow-sm">
          <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="Search for services, centers, staff, or products..."
            className="flex-1 outline-none text-gray-900 placeholder-gray-500"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setResults([]);
              }}
              className="flex-shrink-0"
            >
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
          <Button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {loading ? 'Searching...' : 'Search'}
          </Button>
        </div>

        {/* Autocomplete Suggestions */}
        {showSuggestions && (suggestions.length > 0 || searchHistory.length > 0) && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg border border-gray-200 shadow-lg z-50 max-h-96 overflow-y-auto">
            {/* Recent Searches */}
            {searchHistory.length > 0 && query.length === 0 && (
              <div className="border-b border-gray-200">
                <div className="px-4 py-2 text-xs text-gray-500 flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  Recent Searches
                </div>
                {searchHistory.map((historyQuery, index) => (
                  <div
                    key={index}
                    className="px-4 py-3 cursor-pointer hover:bg-gray-50"
                    onClick={() => {
                      setQuery(historyQuery);
                      setShowSuggestions(false);
                      setTimeout(() => handleSearch(), 100);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-700">{historyQuery}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Autocomplete Suggestions */}
            {suggestions.length > 0 && (
              <>
                <div className="px-4 py-2 text-xs text-gray-500 flex items-center gap-2">
                  <TrendingUp className="w-3 h-3" />
                  Suggestions
                </div>
                {suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className={`px-4 py-3 cursor-pointer hover:bg-gray-50 ${
                      index === selectedIndex ? 'bg-orange-50' : ''
                    }`}
                    onClick={() => {
                      setQuery(suggestion.text);
                      setShowSuggestions(false);
                      setTimeout(() => handleSearch(), 100);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Search className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-900">{suggestion.text}</span>
                      <span className="ml-auto text-xs text-gray-500 capitalize">{suggestion.type}</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Filters & Sort */}
      {showFilters && (
        <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </h3>
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className="text-sm text-orange-600 hover:text-orange-700"
            >
              {showFilterPanel ? 'Hide' : 'Show'} Filters
            </button>
          </div>

          {showFilterPanel && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search In
                </label>
                <div className="space-y-2">
                  {['centers', 'staff', 'services', 'products'].map(type => (
                    <label key={type} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filters.types.includes(type)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters(prev => ({ ...prev, types: [...prev.types, type] }));
                          } else {
                            setFilters(prev => ({
                              ...prev,
                              types: prev.types.filter(t => t !== type)
                            }));
                          }
                        }}
                        className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                      />
                      <span className="text-sm text-gray-700 capitalize">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Price Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Price Range
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={filters.priceMin || ''}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      priceMin: e.target.value ? parseFloat(e.target.value) : undefined
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="number"
                    placeholder="Max"
                    value={filters.priceMax || ''}
                    onChange={(e) => setFilters(prev => ({
                      ...prev,
                      priceMax: e.target.value ? parseFloat(e.target.value) : undefined
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Sort */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sort By
                </label>
                <select
                  value={filters.sort}
                  onChange={(e) => setFilters(prev => ({ ...prev, sort: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="relevance">Relevance</option>
                  <option value="rating">Highest Rated</option>
                  <option value="price_low">Price: Low to High</option>
                  <option value="price_high">Price: High to Low</option>
                  <option value="newest">Newest First</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Header */}
      {(results.length > 0 || loading) && (
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {loading ? 'Searching...' : `${totalResults} results found`}
            {responseTime && ` in ${responseTime}`}
          </p>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-4">
          {results.map((result) => (
            <div
              key={result.id}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => onResultSelect?.(result)}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  {getResultIcon(result.type)}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {highlightText(getResultName(result), result.highlight)}
                      </h3>
                      <p className="text-sm text-gray-600 capitalize">{result.type.replace('_', ' ')}</p>
                    </div>
                    {result.rating && (
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-current text-yellow-500" />
                        <span className="font-medium text-gray-900">{result.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>

                  {result.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {result.description}
                    </p>
                  )}

                  {/* Metadata */}
                  <div className="flex flex-wrap gap-2">
                    {result.category && (
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                        {result.category}
                      </span>
                    )}
                    {result.city && (
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {result.city}
                      </span>
                    )}
                    {result.price && (
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-medium">
                        ₹{result.price.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action */}
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      ) : query && !loading ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="font-medium text-gray-900 mb-2">No results found</h3>
          <p className="text-sm text-gray-600 mb-4">
            We couldn't find any results for "{query}"
          </p>
          <p className="text-sm text-gray-600">
            Try different keywords or check your spelling
          </p>
        </div>
      ) : null}
    </div>
  );
}
