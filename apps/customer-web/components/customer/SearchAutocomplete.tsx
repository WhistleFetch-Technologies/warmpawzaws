'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Clock, TrendingUp, MapPin, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';

interface AutocompleteProps {
  onSelect: (value: string) => void;
  placeholder?: string;
  className?: string;
}

interface Suggestion {
  text: string;
  type?: 'recent' | 'trending' | 'location' | 'specialization';
  score?: number;
}

export function SearchAutocomplete({ onSelect, placeholder, className = '' }: AutocompleteProps) {
  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('warmpawz_recent_searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (err) {
        console.error('Error loading recent searches:', err);
      }
    }
  }, []);

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

  // Fetch autocomplete suggestions
  const fetchSuggestions = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    try {
      const data = await apiClient.get<{ suggestions?: (Suggestion | string)[]; data?: { suggestions?: (Suggestion | string)[] } }>(`/customer/autocomplete?q=${encodeURIComponent(query)}`);
      const suggestionsList = data.data?.suggestions || data.suggestions || [];
      const suggestionsData: Suggestion[] = suggestionsList.map((s: string | Suggestion): Suggestion => {
        if (typeof s === 'string') {
          return { text: s };
        }
        return s;
      });
      setSuggestions(suggestionsData);
    } catch (error) {
      console.error('Error fetching autocomplete:', error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle input change with debounce
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    setIsOpen(true);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 300);
  };

  // Save search to recent history
  const saveRecentSearch = (searchTerm: string) => {
    const updated = [searchTerm, ...recentSearches.filter(s => s !== searchTerm)].slice(0, 10);
    setRecentSearches(updated);
    localStorage.setItem('warmpawz_recent_searches', JSON.stringify(updated));
  };

  // Handle suggestion selection
  const handleSelect = (text: string) => {
    setValue(text);
    saveRecentSearch(text);
    setIsOpen(false);
    onSelect(text);
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      handleSelect(value.trim());
    }
  };

  const showRecentSearches = !value && recentSearches.length > 0;

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={value}
            onChange={handleChange}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder || "Search for services, vets, trainers..."}
            className="w-full pl-12 pr-12 py-3 bg-white border border-gray-200 rounded-full shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all"
          />
          {value && (
            <button
              type="button"
              onClick={() => {
                setValue('');
                setSuggestions([]);
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
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden max-h-96 overflow-y-auto z-50">
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
                  onClick={() => handleSelect(term)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg text-left transition-colors group"
                >
                  <Clock className="w-4 h-4 text-gray-400 group-hover:text-orange-500" />
                  <span className="text-gray-700 group-hover:text-gray-900">{term}</span>
                </button>
              ))}
            </div>
          )}

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="p-2">
              <h3 className="text-xs uppercase tracking-wide text-gray-500 px-3 py-2">
                Suggestions
              </h3>
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelect(suggestion.text)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg text-left transition-colors group"
                >
                  <Search className="w-4 h-4 text-orange-500" />
                  <span className="text-gray-700 group-hover:text-gray-900 capitalize">
                    {suggestion.text}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* No Results */}
          {!loading && value && suggestions.length === 0 && !showRecentSearches && (
            <div className="p-8 text-center">
              <p className="text-gray-500 text-sm">No suggestions found</p>
              <p className="text-gray-400 text-xs mt-1">Try a different search term</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
