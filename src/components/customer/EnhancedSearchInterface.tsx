import React, { useState, useEffect, useRef } from 'react';
import { Search, X, TrendingUp, MapPin, Star, Package, User, Briefcase } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface SearchResult {
  id: string;
  type: 'vendor' | 'service' | 'product' | 'staff';
  score: number;
  data: any;
  highlights?: string[];
}

export function EnhancedSearchInterface() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<any>(null);

  useEffect(() => {
    // Initialize search indices on mount
    initializeSearch();
  }, []);

  const initializeSearch = async () => {
    try {
      await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/elasticsearch/init`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );
      console.log('✅ Search indices initialized');
    } catch (error) {
      console.error('Error initializing search:', error);
    }
  };

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);

      const types = selectedType === 'all' ? '' : `&types=${selectedType}`;
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/elasticsearch/search?q=${encodeURIComponent(searchQuery)}${types}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setResults(data.results || []);
      }
    } catch (error) {
      console.error('Error searching:', error);
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAutocomplete = async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/elasticsearch/autocomplete?q=${encodeURIComponent(searchQuery)}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error('Error getting suggestions:', error);
    }
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setShowSuggestions(true);

    // Debounce autocomplete
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      handleAutocomplete(value);
    }, 300);

    // Debounce search
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      handleSearch(value);
    }, 500);
  };

  const selectSuggestion = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    handleSearch(suggestion);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setSuggestions([]);
    searchInputRef.current?.focus();
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'vendor':
        return <Briefcase className="w-5 h-5 text-orange-600" />;
      case 'service':
        return <Star className="w-5 h-5 text-blue-600" />;
      case 'product':
        return <Package className="w-5 h-5 text-green-600" />;
      case 'staff':
        return <User className="w-5 h-5 text-purple-600" />;
      default:
        return <Search className="w-5 h-5 text-gray-600" />;
    }
  };

  const getResultTypeBadge = (type: string) => {
    const colors = {
      vendor: 'bg-orange-100 text-orange-700',
      service: 'bg-blue-100 text-blue-700',
      product: 'bg-green-100 text-green-700',
      staff: 'bg-purple-100 text-purple-700'
    };

    return (
      <span className={`text-xs px-2 py-1 rounded-full ${colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-700'}`}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
    );
  };

  const renderResult = (result: SearchResult) => {
    const { type, data, highlights } = result;

    return (
      <button
        key={result.id}
        onClick={() => {
          // Navigate to result
          if (type === 'vendor') {
            window.location.href = `/vendor/${data.id}`;
          } else if (type === 'service') {
            window.location.href = `/service/${data.id}`;
          } else if (type === 'product') {
            window.location.href = `/product/${data.id}`;
          } else if (type === 'staff') {
            window.location.href = `/staff/${data.id}`;
          }
        }}
        className="w-full p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-start gap-3">
          <div className="mt-1">
            {getResultIcon(type)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900">
                {type === 'vendor' ? (data.businessName || data.fullName) :
                 type === 'service' ? data.name :
                 type === 'product' ? data.name :
                 type === 'staff' ? data.name : 'Unknown'}
              </h3>
              {getResultTypeBadge(type)}
            </div>

            {/* Description */}
            {data.description && (
              <p className="text-sm text-gray-600 mb-2">
                {data.description.substring(0, 150)}
                {data.description.length > 150 ? '...' : ''}
              </p>
            )}

            {/* Highlights */}
            {highlights && highlights.length > 0 && (
              <div className="text-xs text-gray-500 italic">
                "{highlights[0]}"
              </div>
            )}

            {/* Type-specific metadata */}
            <div className="flex items-center gap-3 mt-2 text-sm text-gray-600">
              {type === 'vendor' && (
                <>
                  {data.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                      <span>{data.rating.toFixed(1)}</span>
                    </div>
                  )}
                  {data.city && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      <span>{data.city}</span>
                    </div>
                  )}
                </>
              )}

              {type === 'product' && (
                <>
                  {data.price && <span className="font-semibold text-orange-600">₹{data.price}</span>}
                  {data.brand && <span>Brand: {data.brand}</span>}
                </>
              )}

              {type === 'service' && (
                <>
                  {data.price && <span className="font-semibold text-orange-600">From ₹{data.price}</span>}
                  {data.duration && <span>{data.duration} min</span>}
                </>
              )}

              {type === 'staff' && (
                <>
                  {data.role && <span>{data.role}</span>}
                  {data.specialization && <span>• {data.specialization}</span>}
                </>
              )}
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Search Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto p-4">
          {/* Search Input */}
          <div className="relative">
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-4 py-3">
              <Search className="w-5 h-5 text-gray-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Search for services, products, vendors..."
                className="flex-1 bg-transparent border-none outline-none text-gray-900"
              />
              {query && (
                <button onClick={clearSearch} className="text-gray-500 hover:text-gray-700">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Autocomplete Suggestions */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg mt-2 shadow-lg z-20">
                {suggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => selectSuggestion(suggestion)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2"
                  >
                    <TrendingUp className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700">{suggestion}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 mt-3 overflow-x-auto">
            {[
              { id: 'all', label: 'All' },
              { id: 'vendor', label: 'Vendors' },
              { id: 'service', label: 'Services' },
              { id: 'product', label: 'Products' },
              { id: 'staff', label: 'Staff' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setSelectedType(tab.id);
                  if (query) handleSearch(query);
                }}
                className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
                  selectedType === tab.id
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search Results */}
      <div className="max-w-4xl mx-auto p-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-gray-600">Searching...</p>
          </div>
        ) : results.length > 0 ? (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <p className="text-sm text-gray-600">
                Found <span className="font-semibold">{results.length}</span> results for "{query}"
              </p>
            </div>
            {results.map(renderResult)}
          </div>
        ) : query ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No results found</h3>
            <p className="text-gray-600">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Search Warmpawz</h3>
            <p className="text-gray-600">Find vendors, services, products, and staff</p>
          </div>
        )}
      </div>
    </div>
  );
}
