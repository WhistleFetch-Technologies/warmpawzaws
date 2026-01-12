/**
 * ========================================
 * UNIVERSAL SEARCH BAR
 * ========================================
 * 
 * Global search component with:
 * - Real-time autocomplete
 * - Debounced search
 * - Category filtering (vendors, products, staff)
 * - Keyboard navigation
 * - Recent searches
 * - Mobile optimized
 * 
 * Usage:
 * <UniversalSearchBar onNavigate={(type, id) => router.push(`/${type}/${id}`)} />
 */

import { useState, useEffect, useRef } from 'react';
import { Search, X, Clock, TrendingUp, MapPin, Star, Package, User, Building2, Loader2 } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface SearchResult {
  type: 'vendor' | 'product' | 'staff' | 'service';
  id?: string;
  text: string;
  subtext?: string;
  icon?: string;
  rating?: number;
  distance?: number;
  price?: number;
}

interface UniversalSearchBarProps {
  onNavigate?: (type: string, id?: string) => void;
  placeholder?: string;
  showRecentSearches?: boolean;
  className?: string;
}

export function UniversalSearchBar({
  onNavigate,
  placeholder = 'Search for services, vendors, or products...',
  showRecentSearches = true,
  className = ''
}: UniversalSearchBarProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    if (showRecentSearches) {
      const recent = localStorage.getItem('warmpawz_recent_searches');
      if (recent) {
        setRecentSearches(JSON.parse(recent).slice(0, 5));
      }
    }
  }, [showRecentSearches]);

  // Save search to recent searches
  const saveRecentSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    const recent = recentSearches.filter(s => s !== searchQuery);
    recent.unshift(searchQuery);
    const updated = recent.slice(0, 5);
    
    setRecentSearches(updated);
    localStorage.setItem('warmpawz_recent_searches', JSON.stringify(updated));
  };

  // Fetch autocomplete suggestions
  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/advanced-search/autocomplete?query=${encodeURIComponent(query)}&type=all`,
          {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`
            }
          }
        );

        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.suggestions || []);
        }
      } catch (error) {
        console.error('Autocomplete error:', error);
      } finally {
        setLoading(false);
      }
    }, 200); // 200ms debounce

    return () => clearTimeout(timer);
  }, [query]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        } else if (query.trim()) {
          handleSearch();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestion: SearchResult) => {
    saveRecentSearch(suggestion.text);
    setQuery('');
    setIsOpen(false);
    
    if (onNavigate) {
      onNavigate(suggestion.type, suggestion.id);
    }
  };

  // Handle full search (when user presses Enter without selecting suggestion)
  const handleSearch = () => {
    if (query.trim()) {
      saveRecentSearch(query);
      setIsOpen(false);
      
      if (onNavigate) {
        onNavigate('search', query);
      }
    }
  };

  // Handle recent search selection
  const handleRecentSearch = (search: string) => {
    setQuery(search);
    setIsOpen(true);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get icon for result type
  const getResultIcon = (result: SearchResult) => {
    if (result.icon) return result.icon;
    
    switch (result.type) {
      case 'vendor':
        return <Building2 className="w-4 h-4 text-blue-600" />;
      case 'product':
        return <Package className="w-4 h-4 text-green-600" />;
      case 'staff':
        return <User className="w-4 h-4 text-purple-600" />;
      case 'service':
        return <Star className="w-4 h-4 text-orange-600" />;
      default:
        return <Search className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-11 pr-10 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent transition-all"
        />

        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
        )}

        {!loading && query && (
          <button
            onClick={() => {
              setQuery('');
              setSuggestions([]);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (query.length >= 2 || (showRecentSearches && recentSearches.length > 0)) && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 max-h-96 overflow-y-auto z-50"
        >
          {/* Recent Searches */}
          {showRecentSearches && query.length < 2 && recentSearches.length > 0 && (
            <div className="p-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                <Clock className="w-4 h-4" />
                <span>Recent Searches</span>
              </div>
              {recentSearches.map((search, index) => (
                <button
                  key={index}
                  onClick={() => handleRecentSearch(search)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded-lg text-sm text-gray-700 transition-colors"
                >
                  {search}
                </button>
              ))}
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="p-2">
              <div className="flex items-center gap-2 text-sm text-gray-500 px-3 py-2">
                <TrendingUp className="w-4 h-4" />
                <span>Suggestions</span>
              </div>
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className={`w-full flex items-start gap-3 px-3 py-3 rounded-lg transition-colors ${
                    selectedIndex === index
                      ? 'bg-orange-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {typeof suggestion.icon === 'string' ? (
                      <span className="text-xl">{suggestion.icon}</span>
                    ) : (
                      getResultIcon(suggestion)
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {suggestion.text}
                    </div>
                    {suggestion.subtext && (
                      <div className="text-sm text-gray-500 truncate">
                        {suggestion.subtext}
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="flex-shrink-0 flex items-center gap-2 text-sm text-gray-500">
                    {suggestion.rating && (
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        <span>{suggestion.rating.toFixed(1)}</span>
                      </div>
                    )}
                    {suggestion.distance && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>{suggestion.distance.toFixed(1)}km</span>
                      </div>
                    )}
                    {suggestion.price && (
                      <span className="font-medium">₹{suggestion.price}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No Results */}
          {query.length >= 2 && suggestions.length === 0 && !loading && (
            <div className="p-8 text-center text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No results found</p>
              <p className="text-sm mt-1">Try different keywords</p>
            </div>
          )}

          {/* Loading */}
          {loading && query.length >= 2 && (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 mx-auto text-gray-400 animate-spin" />
              <p className="text-sm text-gray-500 mt-2">Searching...</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
