import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Clock, TrendingUp, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom'; // Assuming react-router
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { Badge } from '../ui/badge';

interface SearchResult {
  id: string;
  type: string;
  title: string;
  description: string;
  image?: string;
  rating?: number;
  price?: number;
}

export function ElasticSearchBar() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Debounce logic
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Load recent searches
    const saved = localStorage.getItem('recent_searches');
    if (saved) setRecentSearches(JSON.parse(saved));

    // Click outside handler
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
        setResults([]);
        setSuggestions([]);
        return;
    }

    setLoading(true);
    try {
        // Parallel fetch for autocomplete and results
        const [autoRes, searchRes] = await Promise.all([
            fetch(`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/search/autocomplete?q=${searchTerm}`, {
                headers: { 'Authorization': `Bearer ${publicAnonKey}` }
            }),
            fetch(`https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/search/elastic?q=${searchTerm}`, {
                headers: { 'Authorization': `Bearer ${publicAnonKey}` }
            })
        ]);

        if (autoRes.ok) {
            const data = await autoRes.json();
            setSuggestions(data.suggestions || []);
        }

        if (searchRes.ok) {
            const data = await searchRes.json();
            setResults(data.results || []);
        }

    } catch (error) {
        console.error("Search error", error);
    } finally {
        setLoading(false);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
        handleSearch(val);
    }, 300);
  };

  const saveRecentSearch = (term: string) => {
      const updated = [term, ...recentSearches.filter(s => s !== term)].slice(0, 5);
      setRecentSearches(updated);
      localStorage.setItem('recent_searches', JSON.stringify(updated));
  };

  const selectItem = (item: SearchResult) => {
      saveRecentSearch(item.title);
      setQuery(item.title);
      setIsOpen(false);
      // Navigate to item
      console.log("Navigating to", item);
      // navigation logic here e.g. navigate(`/${item.type}/${item.id}`)
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto z-50" ref={dropdownRef}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInput}
          onFocus={() => setIsOpen(true)}
          placeholder="Search for services, vets, grooming..."
          className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-full shadow-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent text-lg"
        />
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        {query && (
            <button 
                onClick={() => { setQuery(''); setIsOpen(false); }}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
                <X className="w-5 h-5" />
            </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden max-h-[80vh] overflow-y-auto">
            {/* Loading State */}
            {loading && (
                <div className="p-4 text-center text-gray-500">
                    Searching...
                </div>
            )}

            {/* Empty State / Recent Searches */}
            {!query && recentSearches.length > 0 && (
                <div className="p-2">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase px-3 py-2">Recent Searches</h3>
                    {recentSearches.map(term => (
                        <button 
                            key={term}
                            onClick={() => { setQuery(term); handleSearch(term); }}
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg text-left"
                        >
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-700">{term}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Suggestions */}
            {suggestions.length > 0 && (
                <div className="p-2 border-b border-gray-100">
                    {suggestions.map(s => (
                        <button
                            key={s}
                            onClick={() => { setQuery(s); handleSearch(s); }}
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg text-left text-orange-600"
                        >
                            <Search className="w-4 h-4" />
                            <span className="font-medium">{s}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Rich Results */}
            {results.length > 0 ? (
                <div className="p-2">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase px-3 py-2">Results</h3>
                    {results.map(res => (
                        <button
                            key={res.id}
                            onClick={() => selectItem(res)}
                            className="w-full flex items-start gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors text-left group"
                        >
                            <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                                {res.image ? (
                                    <img src={res.image} alt={res.title} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-orange-100 text-orange-600 font-bold">
                                        {res.title[0]}
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <h4 className="font-semibold text-gray-900 truncate group-hover:text-orange-600">{res.title}</h4>
                                    {res.type && (
                                        <Badge variant="secondary" className="text-xs capitalize">
                                            {res.type}
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-sm text-gray-500 line-clamp-1">{res.description}</p>
                                <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                                    {res.rating && (
                                        <span className="flex items-center gap-0.5 text-yellow-500">
                                            ★ {res.rating}
                                        </span>
                                    )}
                                    {res.price && (
                                        <span>• ₹{res.price}</span>
                                    )}
                                </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 self-center" />
                        </button>
                    ))}
                </div>
            ) : (
                query && !loading && (
                    <div className="p-8 text-center">
                        <p className="text-gray-500">No results found for "{query}"</p>
                    </div>
                )
            )}
        </div>
      )}
    </div>
  );
}
