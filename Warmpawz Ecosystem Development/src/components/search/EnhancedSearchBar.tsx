import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Clock, TrendingUp, Mic, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

interface Suggestion {
  id: string;
  text: string;
  type: string;
  entityId: string;
  score: number;
}

interface PopularSearch {
  query: string;
  count: number;
}

interface EnhancedSearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  index?: string;
  showPopular?: boolean;
  showRecent?: boolean;
  className?: string;
}

export function EnhancedSearchBar({
  onSearch,
  placeholder = "Search for services, providers, or centers...",
  index = 'vendors',
  showPopular = true,
  showRecent = true,
  className = ''
}: EnhancedSearchBarProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [popularSearches, setPopularSearches] = useState<PopularSearch[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    const recent = localStorage.getItem('recent_searches');
    if (recent) {
      setRecentSearches(JSON.parse(recent));
    }
  }, []);

  // Fetch popular searches
  useEffect(() => {
    if (showPopular) {
      fetchPopularSearches();
    }
  }, [showPopular]);

  // Fetch autocomplete suggestions
  useEffect(() => {
    if (query.length >= 2) {
      const timer = setTimeout(() => {
        fetchSuggestions();
      }, 300); // Debounce

      return () => clearTimeout(timer);
    } else {
      setSuggestions([]);
    }
  }, [query]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSuggestions = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${BASE_URL}/search/autocomplete?q=${encodeURIComponent(query)}&index=${index}&size=8`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
        setIsOpen(true);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPopularSearches = async () => {
    try {
      const response = await fetch(
        `${BASE_URL}/search/analytics/popular?limit=5`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPopularSearches(data.popular || []);
      }
    } catch (error) {
      console.error('Error fetching popular searches:', error);
    }
  };

  const handleSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    // Save to recent searches
    const updated = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 10);
    setRecentSearches(updated);
    localStorage.setItem('recent_searches', JSON.stringify(updated));

    // Track search analytics
    trackSearch(searchQuery);

    // Execute search
    onSearch(searchQuery);
    setIsOpen(false);
  };

  const trackSearch = async (searchQuery: string) => {
    try {
      await fetch(
        `${BASE_URL}/search/analytics/track`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query: searchQuery,
            source: 'search_bar',
            deviceType: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
          })
        }
      );
    } catch (error) {
      console.error('Error tracking search:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleSearch(suggestions[selectedIndex].text);
      } else {
        handleSearch(query);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleClearRecent = () => {
    setRecentSearches([]);
    localStorage.removeItem('recent_searches');
  };

  const showDropdown = isOpen && (query.length >= 2 || showPopular || showRecent);

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
          <Search className="w-5 h-5" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-12 pr-12 py-4 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none text-gray-900 placeholder-gray-400 transition-colors"
        />

        {/* Loading or Clear Button */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          ) : query.length > 0 ? (
            <button
              onClick={() => {
                setQuery('');
                setSuggestions([]);
                inputRef.current?.focus();
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border-2 border-gray-200 shadow-xl max-h-96 overflow-y-auto z-50">
          {/* Autocomplete Suggestions */}
          {suggestions.length > 0 && (
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                Suggestions
              </div>
              {suggestions.map((suggestion, idx) => (
                <button
                  key={suggestion.id}
                  onClick={() => handleSearch(suggestion.text)}
                  className={`w-full px-3 py-3 flex items-center gap-3 rounded-lg transition-colors ${
                    idx === selectedIndex
                      ? 'bg-orange-50 text-orange-900'
                      : 'hover:bg-gray-50 text-gray-900'
                  }`}
                >
                  <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="flex-1 text-left truncate">{suggestion.text}</span>
                  <span className="text-xs text-gray-500 capitalize">{suggestion.type}</span>
                </button>
              ))}
            </div>
          )}

          {/* Recent Searches */}
          {showRecent && recentSearches.length > 0 && query.length < 2 && (
            <div className="p-2 border-t border-gray-200">
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase">
                  Recent Searches
                </span>
                <button
                  onClick={handleClearRecent}
                  className="text-xs text-orange-600 hover:text-orange-700"
                >
                  Clear
                </button>
              </div>
              {recentSearches.slice(0, 5).map((search, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSearch(search)}
                  className="w-full px-3 py-3 flex items-center gap-3 hover:bg-gray-50 rounded-lg transition-colors text-gray-900"
                >
                  <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="flex-1 text-left truncate">{search}</span>
                </button>
              ))}
            </div>
          )}

          {/* Popular Searches */}
          {showPopular && popularSearches.length > 0 && query.length < 2 && (
            <div className="p-2 border-t border-gray-200">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                Popular Searches
              </div>
              {popularSearches.map((popular, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSearch(popular.query)}
                  className="w-full px-3 py-3 flex items-center gap-3 hover:bg-gray-50 rounded-lg transition-colors text-gray-900"
                >
                  <TrendingUp className="w-4 h-4 text-orange-500 flex-shrink-0" />
                  <span className="flex-1 text-left truncate">{popular.query}</span>
                  <span className="text-xs text-gray-500">{popular.count} searches</span>
                </button>
              ))}
            </div>
          )}

          {/* No Results */}
          {query.length >= 2 && suggestions.length === 0 && !isLoading && (
            <div className="p-6 text-center text-gray-500">
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p>No suggestions found for "{query}"</p>
              <button
                onClick={() => handleSearch(query)}
                className="mt-3 text-orange-600 hover:text-orange-700 text-sm"
              >
                Search anyway
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
