import React, { useState, useEffect } from 'react';
import { Search, MapPin, Star, Clock, TrendingUp, Filter, SlidersHorizontal } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

const BASE_URL = `${getApiBaseUrl()}`;

interface SearchResult {
  id: string;
  entityType: string;
  entityId: string;
  title: string;
  description: string;
  tags: string[];
  categories: string[];
  location?: {
    lat: number;
    lng: number;
    city: string;
    area: string;
  };
  pricing?: {
    min: number;
    max: number;
    currency: string;
  };
  ratings?: {
    average: number;
    count: number;
  };
  availability?: {
    isAvailable: boolean;
    nextAvailable?: string;
  };
  score: number;
  highlights?: Record<string, string[]>;
}

interface SearchFilters {
  categories?: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  availability?: boolean;
  location?: {
    lat: number;
    lng: number;
    radius: number;
  };
}

interface SearchResultsProps {
  query: string;
  index?: string;
  onResultClick?: (result: SearchResult) => void;
}

export function SearchResultsAdvanced({
  query,
  index = 'vendors',
  onResultClick
}: SearchResultsProps) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [facets, setFacets] = useState<any>(null);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const pageSize = 20;

  useEffect(() => {
    if (query) {
      performSearch();
    }
  }, [query, filters, page]);

  const performSearch = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: query,
        index,
        from: String(page * pageSize),
        size: String(pageSize)
      });

      // Add filters
      if (filters.categories && filters.categories.length > 0) {
        params.append('categories', filters.categories.join(','));
      }

      if (filters.minPrice !== undefined) {
        params.append('minPrice', String(filters.minPrice));
      }

      if (filters.maxPrice !== undefined) {
        params.append('maxPrice', String(filters.maxPrice));
      }

      if (filters.minRating !== undefined) {
        params.append('minRating', String(filters.minRating));
      }

      if (filters.availability !== undefined) {
        params.append('availability', String(filters.availability));
      }

      if (filters.location) {
        params.append('lat', String(filters.location.lat));
        params.append('lng', String(filters.location.lng));
        params.append('radius', String(filters.location.radius));
      }

      const response = await fetch(
        `${BASE_URL}/search/advanced?${params.toString()}`,
        {
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        const data = await response.json();
        setResults(data.results || []);
        setTotal(data.total || 0);
        setFacets(data.facets || null);
      } else {
        toast.error('Search failed');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to perform search');
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    // Track click analytics
    trackClick(result.id);

    if (onResultClick) {
      onResultClick(result);
    }
  };

  const trackClick = async (resultId: string) => {
    try {
      await fetch(
        `${BASE_URL}/search/analytics/click`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            eventId: `search_${Date.now()}`, // Would need to store actual eventId
            clicked: resultId
          })
        }
      );
    } catch (error) {
      console.error('Error tracking click:', error);
    }
  };

  const formatPrice = (pricing: any) => {
    if (!pricing) return 'Price on request';
    const { min, max, currency = '₹' } = pricing;
    if (min === max) return `${currency}${min}`;
    return `${currency}${min} - ${currency}${max}`;
  };

  const highlightText = (text: string, highlights?: string[]) => {
    if (!highlights || highlights.length === 0) return text;
    
    // Simple highlighting (in production, use dangerouslySetInnerHTML carefully)
    return highlights[0] || text;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Search Results for "{query}"
          </h2>
          <p className="text-gray-600 mt-1">
            {total.toLocaleString()} results found
          </p>
        </div>

        <Button
          onClick={() => setShowFilters(!showFilters)}
          variant="outline"
          className="border-2 border-gray-200"
        >
          <SlidersHorizontal className="w-4 h-4 mr-2" />
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </Button>
      </div>

      <div className="grid md:grid-cols-4 gap-6">
        {/* Filters Sidebar */}
        {showFilters && facets && (
          <div className="md:col-span-1 space-y-6">
            <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
              <h3 className="font-bold text-gray-900 mb-4">Filters</h3>

              {/* Categories */}
              {facets.categories && facets.categories.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Categories</h4>
                  <div className="space-y-2">
                    {facets.categories.map((cat: any) => (
                      <label key={cat.key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filters.categories?.includes(cat.key) || false}
                          onChange={(e) => {
                            const newCategories = e.target.checked
                              ? [...(filters.categories || []), cat.key]
                              : (filters.categories || []).filter(c => c !== cat.key);
                            setFilters({ ...filters, categories: newCategories });
                            setPage(0);
                          }}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">{cat.key}</span>
                        <span className="text-xs text-gray-500">({cat.doc_count})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Price Range */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Price Range</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-600">Min Price</label>
                    <input
                      type="number"
                      value={filters.minPrice || ''}
                      onChange={(e) => {
                        setFilters({ ...filters, minPrice: parseInt(e.target.value) || undefined });
                        setPage(0);
                      }}
                      placeholder="₹ 0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Max Price</label>
                    <input
                      type="number"
                      value={filters.maxPrice || ''}
                      onChange={(e) => {
                        setFilters({ ...filters, maxPrice: parseInt(e.target.value) || undefined });
                        setPage(0);
                      }}
                      placeholder="₹ 10000"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Rating */}
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Minimum Rating</h4>
                <div className="space-y-2">
                  {[4, 3, 2, 1].map((rating) => (
                    <label key={rating} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="rating"
                        checked={filters.minRating === rating}
                        onChange={() => {
                          setFilters({ ...filters, minRating: rating });
                          setPage(0);
                        }}
                        className="text-orange-600"
                      />
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-orange-500 text-orange-500" />
                        <span className="text-sm text-gray-700">{rating}+ Stars</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Availability */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.availability || false}
                    onChange={(e) => {
                      setFilters({ ...filters, availability: e.target.checked || undefined });
                      setPage(0);
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Available Now</span>
                </label>
              </div>

              {/* Clear Filters */}
              <Button
                onClick={() => {
                  setFilters({});
                  setPage(0);
                }}
                variant="outline"
                className="w-full mt-6"
              >
                Clear All Filters
              </Button>
            </div>
          </div>
        )}

        {/* Results */}
        <div className={showFilters && facets ? 'md:col-span-3' : 'md:col-span-4'}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600" />
            </div>
          ) : results.length === 0 ? (
            <div className="bg-white rounded-xl border-2 border-gray-200 p-12 text-center">
              <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="font-bold text-gray-900 mb-2">No results found</h3>
              <p className="text-gray-600">
                Try adjusting your search or filters
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleResultClick(result)}
                  className="w-full bg-white rounded-xl border-2 border-gray-200 p-6 hover:border-orange-500 hover:shadow-lg transition-all text-left"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      {/* Title with highlighting */}
                      <h3 className="font-bold text-gray-900 mb-2">
                        {highlightText(result.title, result.highlights?.title)}
                      </h3>

                      {/* Description with highlighting */}
                      <p className="text-gray-600 mb-3 line-clamp-2">
                        {highlightText(result.description, result.highlights?.description)}
                      </p>

                      {/* Tags */}
                      {result.tags && result.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {result.tags.slice(0, 4).map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Meta info */}
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                        {result.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {result.location.area}, {result.location.city}
                          </div>
                        )}

                        {result.ratings && (
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-orange-500 text-orange-500" />
                            {result.ratings.average.toFixed(1)} ({result.ratings.count})
                          </div>
                        )}

                        {result.availability?.isAvailable && (
                          <div className="flex items-center gap-1 text-green-600">
                            <Clock className="w-4 h-4" />
                            Available Now
                          </div>
                        )}

                        <span className="text-xs text-gray-500 capitalize">
                          {result.entityType}
                        </span>
                      </div>
                    </div>

                    {/* Price */}
                    {result.pricing && (
                      <div className="text-right">
                        <div className="font-bold text-gray-900">
                          {formatPrice(result.pricing)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Score: {result.score.toFixed(2)}
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              ))}

              {/* Pagination */}
              {total > pageSize && (
                <div className="flex items-center justify-center gap-4 pt-6">
                  <Button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    variant="outline"
                  >
                    Previous
                  </Button>

                  <span className="text-gray-600">
                    Page {page + 1} of {Math.ceil(total / pageSize)}
                  </span>

                  <Button
                    onClick={() => setPage(page + 1)}
                    disabled={(page + 1) * pageSize >= total}
                    variant="outline"
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
