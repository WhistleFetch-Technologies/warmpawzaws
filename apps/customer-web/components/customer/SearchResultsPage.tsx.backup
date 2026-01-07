'use client';

import { useState, useEffect } from 'react';
import { Star, MapPin, DollarSign, Filter, X, Award, Briefcase, Search } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';
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
      const params = new URLSearchParams({
        q: query,
        limit: limit.toString(),
        offset: (page * limit).toString()
      });

      if (userLocation) {
        params.append('lat', userLocation.lat.toString());
        params.append('lng', userLocation.lng.toString());
      }

      if (filters.city) params.append('city', filters.city);
      if (filters.specialization) params.append('specialization', filters.specialization);
      if (filters.minRating) params.append('minRating', filters.minRating.toString());
      if (filters.priceRange?.min) params.append('minPrice', filters.priceRange.min.toString());
      if (filters.priceRange?.max) params.append('maxPrice', filters.priceRange.max.toString());

      const response = await apiClient.get<{ results: any[]; total: number }>(
        `/search/enhanced?${params}`
      );

      if (response.results) {
        setResults(response.results);
        setTotal(response.total || response.results.length);
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

  const renderResult = (result: any) => {
    const { type, data, score } = result;

    return (
      <div key={`${type}-${data.id || data.staffId || data.vendorId || data.serviceId}`} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 hover:shadow-lg transition-shadow">
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
            <button className="mt-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium">
              View Details
            </button>
          </div>

          {/* Match Score */}
          {score && (
            <div className="text-xs text-gray-400">
              {(score * 100).toFixed(0)}% match
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10 px-4 py-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Search Results</h1>
        
        {/* Search Bar */}
        <div className="mb-4">
          <SearchAutocomplete onSelect={handleSearch} />
        </div>

        {/* Filters */}
        <SearchFilters query={query} onFilterChange={handleFilterChange} />
      </div>

      {/* Results */}
      <div className="px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : results.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <Search className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="font-bold text-gray-900 mb-2">No results found</h3>
            <p className="text-gray-600">Try adjusting your search or filters</p>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-gray-600">
              Found {total} result{total !== 1 ? 's' : ''}
            </div>
            <div className="space-y-4">
              {results.map((result) => renderResult(result))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

