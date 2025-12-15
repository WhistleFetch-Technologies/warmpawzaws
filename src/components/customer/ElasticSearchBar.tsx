import { useState, useEffect, useRef } from 'react';
import { Search, TrendingUp, Clock, X } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface ElasticSearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  userId?: string;
}

export function ElasticSearchBar({ onSearch, placeholder = 'Search for services, staff, or centers...', userId }: ElasticSearchBarProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState<any[]>([]);
  const [trending, setTrending] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout>();
  const searchRef = useRef<HTMLDivElement>(null);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    // Load recent searches and trending
    if (userId) {
      loadRecentSearches();
    }
    loadTrending();

    // Click outside to close
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userId]);

  const loadRecentSearches = async () => {
    try {
      const response = await fetch(`${API_BASE}/search/history/${userId}?limit=5`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setRecentSearches(data.history || []);
        }
      }
    } catch (error) {
      console.error('Failed to load recent searches:', error);
    }
  };

  const loadTrending = async () => {
    try {
      const response = await fetch(`${API_BASE}/search/trending?limit=5`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setTrending(data.trending || []);
        }
      }
    } catch (error) {
      console.error('Failed to load trending:', error);
    }
  };

  const loadAutocomplete = async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/search/autocomplete?q=${encodeURIComponent(searchQuery)}&limit=10`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSuggestions(data.suggestions || []);
        }
      }
    } catch (error) {
      console.error('Failed to load autocomplete:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (value: string) => {
    setQuery(value);
    setShowSuggestions(true);

    // Debounce autocomplete
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      loadAutocomplete(value);
    }, 300);
  };

  const handleSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    
    onSearch(searchQuery);
    setShowSuggestions(false);
    
    // Add to recent searches
    if (userId) {
      setRecentSearches(prev => [
        { query: searchQuery, timestamp: new Date().toISOString() },
        ...prev.filter(s => s.query !== searchQuery).slice(0, 4)
      ]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch(query);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    handleSearch(suggestion);
  };

  const clearSearch = () => {
    setQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-2xl">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyPress={handleKeyPress}
          onFocus={() => setShowSuggestions(true)}
          placeholder={placeholder}
          className="w-full pl-12 pr-12 py-4 text-lg border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-96 overflow-y-auto z-50">
          {/* Autocomplete Suggestions */}
          {query.length >= 2 && suggestions.length > 0 && (
            <div className="border-b border-gray-100">
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">
                Suggestions
              </div>
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3"
                >
                  <Search className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-900">{suggestion}</span>
                </button>
              ))}
            </div>
          )}

          {/* Recent Searches */}
          {query.length === 0 && recentSearches.length > 0 && (
            <div className="border-b border-gray-100">
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase flex items-center gap-2">
                <Clock className="w-3 h-3" />
                Recent Searches
              </div>
              {recentSearches.map((search, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(search.query)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3"
                >
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-900">{search.query}</span>
                </button>
              ))}
            </div>
          )}

          {/* Trending Searches */}
          {query.length === 0 && trending.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase flex items-center gap-2">
                <TrendingUp className="w-3 h-3" />
                Trending
              </div>
              {trending.map((trend, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(trend.query)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center gap-3"
                >
                  <TrendingUp className="w-4 h-4 text-orange-500" />
                  <span className="text-gray-900">{trend.query}</span>
                  <span className="ml-auto text-xs text-gray-500">{trend.count} searches</span>
                </button>
              ))}
            </div>
          )}

          {/* Loading State */}
          {loading && query.length >= 2 && (
            <div className="px-4 py-8 text-center text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
            </div>
          )}

          {/* No Results */}
          {!loading && query.length >= 2 && suggestions.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-500">
              No suggestions found for "{query}"
            </div>
          )}

          {/* Empty State */}
          {query.length === 0 && recentSearches.length === 0 && trending.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-500">
              Start typing to search...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
