'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Star, MapPin, DollarSign, Filter, X, Award, Briefcase } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchAutocomplete } from './SearchAutocomplete';
import { SearchFilters, FilterValues } from './SearchFilters';

export function SearchResultsPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<FilterValues>({});
  const [page, setPage] = useState(0);
  const [userLocation, setUserLocation] = useState<{lat: number; lng: number} | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const limit = 20;


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
        (error) => {
          console.log('Location access denied:', error);
        }
      );
    }
  }, []);

  useEffect(() => {
    if (query) {
      performSearch();
    }
  }, [query, filters, page, userLocation]);

  const performSearch = async () => {
    setLoading(true);
    try {
      // Build query params
      const params = new URLSearchParams({
        q: query,
        limit: limit.toString(),
        offset: (page * limit).toString()
      });

      // Add location if available
      if (userLocation) {
        params.append('lat', userLocation.lat.toString());
        params.append('lng', userLocation.lng.toString());
      }

      // Add filters
      if (filters.city) params.append('city', filters.city);
      if (filters.specialization) params.append('specialization', filters.specialization);
      if (filters.minRating) params.append('minRating', filters.minRating.toString());
      if (filters.priceRange?.min) params.append('minPrice', filters.priceRange.min.toString());
      if (filters.priceRange?.max) params.append('maxPrice', filters.priceRange.max.toString());

      // Use enhanced search endpoint
      const queryString = params.toString();
      const data = await apiClient.get<{ success?: boolean; results?: any[]; data?: { results?: any[]; total?: number }; total?: number }>(`/vendor/search?${queryString}`);
      if (data && (data.success || data.data || data.results)) {
        setResults(data.data?.results || data.results || []);
        setTotal(data.data?.total || data.total || 0);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (searchQuery: string) => {
    setQuery(searchQuery);
    setPage(0);
  };

  const handleFilterChange = (newFilters: FilterValues) => {
    setFilters(newFilters);
    setPage(0);
  };

  const clearFilters = () => {
    setFilters({});
    setPage(0);
  };

  // Calculate active filters count
  const activeFiltersCount = Object.values(filters).filter(v => 
    v !== undefined && v !== null && v !== '' && 
    (typeof v !== 'object' || (typeof v === 'object' && (v.min !== undefined || v.max !== undefined)))
  ).length;

  const renderResult = (result: any) => {
    const { type, data, score } = result;

    return (
      <Card key={`${type}-${data.id || data.staffId || data.vendorId || data.serviceId}`} className="p-6 hover:shadow-lg transition-shadow">
        <div className="flex items-start gap-4">
          {/* Type Badge */}
          <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
            type === 'staff' ? 'bg-blue-100 text-blue-700' :
            type === 'center' ? 'bg-green-100 text-green-700' :
            'bg-purple-100 text-purple-700'
          }`}>
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </div>

          <div className="flex-1">
            {/* Title */}
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {data.name || data.businessName}
            </h3>

            {/* Rating */}
            {data.rating > 0 && (
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold text-gray-900">{data.rating.toFixed(1)}</span>
                </div>
                {data.reviewCount && (
                  <span className="text-sm text-gray-600">({data.reviewCount} reviews)</span>
                )}
              </div>
            )}

            {/* Details */}
            <div className="space-y-2 mb-3">
              {/* Location */}
              {data.location && (
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm">
                    {data.location.area}, {data.location.city}
                  </span>
                  {result.distance && (
                    <span className="text-xs text-gray-500">• {result.distance} km away</span>
                  )}
                </div>
              )}

              {/* Price */}
              {data.price && (
                <div className="flex items-center gap-2 text-gray-600">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-sm">₹{data.price}</span>
                </div>
              )}

              {/* Specialization/Category */}
              {(data.specialization || data.category) && (
                <p className="text-sm text-gray-600">
                  {data.specialization || data.category}
                </p>
              )}

              {/* Description */}
              {data.description && (
                <p className="text-sm text-gray-600 line-clamp-2">
                  {data.description}
                </p>
              )}
            </div>

            {/* Services/Tags */}
            {data.services && data.services.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {data.services.slice(0, 5).map((service: string, idx: number) => (
                  <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                    {service}
                  </span>
                ))}
                {data.services.length > 5 && (
                  <span className="px-2 py-1 text-gray-500 text-xs">
                    +{data.services.length - 5} more
                  </span>
                )}
              </div>
            )}

            {/* Action Button */}
            <Button size="sm" className="mt-2">
              View Details
            </Button>
          </div>

          {/* Match Score (for debugging) */}
          {score && (
            <div className="text-xs text-gray-400">
              {(score * 100).toFixed(0)}% match
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Search Bar */}
        <div className="mb-8 flex justify-center">
          <SearchAutocomplete onSelect={handleSearch} />
        </div>

        {/* Results Header */}
        {query && (
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Search Results for "{query}"
              </h2>
              <p className="text-gray-600 mt-1">
                {loading ? 'Searching...' : `${total} results found`}
              </p>
            </div>

            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Filters
              {activeFiltersCount > 0 && (
                <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
          </div>
        )}

        {/* Filters Panel */}
        {showFilters && (
          <Card className="p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Filters</h3>
              {activeFiltersCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Clear all
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type
                </label>
                <select
                  value={(filters as any).type || filters.serviceType || ''}
                  onChange={(e) => handleFilterChange({ ...filters, serviceType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Types</option>
                  <option value="staff">Staff</option>
                  <option value="center">Centers</option>
                  <option value="service">Services</option>
                </select>
              </div>

              {/* City Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  City
                </label>
                <input
                  type="text"
                  value={filters.city}
                  onChange={(e) => handleFilterChange({ ...filters, city: e.target.value })}
                  placeholder="Enter city"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Area Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Area
                </label>
                <input
                  type="text"
                  value={(filters as any).area || ''}
                  onChange={(e) => handleFilterChange({ ...filters, city: e.target.value })}
                  placeholder="Enter area"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Rating Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Minimum Rating
                </label>
                <select
                  value={filters.minRating || ''}
                  onChange={(e) => handleFilterChange({ ...filters, minRating: e.target.value ? parseFloat(e.target.value) : undefined })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Any Rating</option>
                  <option value="4">4+ Stars</option>
                  <option value="4.5">4.5+ Stars</option>
                  <option value="4.8">4.8+ Stars</option>
                </select>
              </div>

              {/* Price Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Min Price (₹)
                </label>
                <input
                  type="number"
                  value={filters.priceRange?.min || ''}
                  onChange={(e) => handleFilterChange({ ...filters, priceRange: { ...filters.priceRange, min: e.target.value ? parseFloat(e.target.value) : undefined } })}
                  placeholder="Min"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Price (₹)
                </label>
                <input
                  type="number"
                  value={filters.priceRange?.max || ''}
                  onChange={(e) => handleFilterChange({ ...filters, priceRange: { ...filters.priceRange, max: e.target.value ? parseFloat(e.target.value) : undefined } })}
                  placeholder="Max"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </Card>
        )}

        {/* Results */}
        {loading ? (
          <div className="py-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Searching...</p>
          </div>
        ) : results.length > 0 ? (
          <div className="space-y-4">
            {results.map(renderResult)}

            {/* Pagination */}
            {total > limit && (
              <div className="flex items-center justify-center gap-4 mt-8">
                <Button
                  variant="outline"
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <span className="text-gray-600">
                  Page {page + 1} of {Math.ceil(total / limit)}
                </span>
                <Button
                  variant="outline"
                  disabled={(page + 1) * limit >= total}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        ) : query ? (
          <Card className="p-12 text-center">
            <p className="text-xl text-gray-600 mb-2">No results found for "{query}"</p>
            <p className="text-gray-500">Try adjusting your search or filters</p>
          </Card>
        ) : (
          <Card className="p-12 text-center">
            <p className="text-xl text-gray-600">Start searching to see results</p>
          </Card>
        )}
      </div>
    </div>
  );
}