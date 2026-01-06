'use client';

import { useState, useEffect } from 'react';
import { MapPin, List, Map, SlidersHorizontal, X, Star, Clock, Phone } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';
import { EnhancedSearchBar } from './EnhancedSearchBar';

interface VendorResult {
  id: string;
  businessName: string;
  description?: string;
  rating?: number;
  totalReviews?: number;
  services?: string[];
  serviceStyle?: string;
  priceRange?: string;
  location?: { lat: number; lng: number };
  distance?: number;
  photos?: string[];
  specializations?: string[];
  isVerified?: boolean;
  responseTime?: string;
}

interface SearchFilters {
  radius?: number;
  sortBy?: string;
  location?: { lat: number; lng: number };
  minRating?: number;
  serviceStyle?: string;
}

export function VendorSearchEnhanced() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({
    radius: 10,
    sortBy: 'relevance'
  });
  const [results, setResults] = useState<VendorResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(location);
          setFilters(prev => ({ ...prev, location }));
        },
        (error) => {
          console.log('Location permission denied:', error);
          const defaultLocation = { lat: 28.6139, lng: 77.2090 };
          setUserLocation(defaultLocation);
          setFilters(prev => ({ ...prev, location: defaultLocation }));
        }
      );
    }
  }, []);

  const searchVendors = async () => {
    setLoading(true);
    try {
      const response = await apiClient.post<{ results: VendorResult[]; totalResults: number }>(
        '/advanced-search/vendors',
        {
          query,
          ...filters,
          limit: 50
        }
      );

      if (response.results) {
        setResults(response.results);
        setTotalResults(response.totalResults || response.results.length);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2 || Object.keys(filters).length > 2) {
        searchVendors();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, filters]);

  const handleVendorClick = (vendorId: string) => {
    // Navigate to vendor profile
    window.location.href = `/vendor/${vendorId}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-4">
          {/* Search Bar */}
          <div className="mb-4">
            <EnhancedSearchBar
              onSearch={setQuery}
              placeholder="Search for veterinary, grooming, training..."
            />
          </div>

          {/* View Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {userLocation && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4" />
                  <span>Searching nearby</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Filters Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filters
              </button>

              {/* View Mode Toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    viewMode === 'map'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Map className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white border-b border-gray-200 px-4 py-4">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Radius (km)</label>
              <input
                type="number"
                value={filters.radius || 10}
                onChange={(e) => setFilters({ ...filters, radius: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
                min="1"
                max="50"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Sort By</label>
              <select
                value={filters.sortBy || 'relevance'}
                onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
              >
                <option value="relevance">Relevance</option>
                <option value="rating">Highest Rated</option>
                <option value="distance">Nearest</option>
                <option value="price">Price: Low to High</option>
              </select>
            </div>
            {filters.minRating && (
              <button
                onClick={() => setFilters({ ...filters, minRating: undefined })}
                className="text-sm text-primary hover:text-primary-dark"
              >
                Clear rating filter
              </button>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      <div className="px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : results.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <p className="text-gray-600">No vendors found</p>
            <p className="text-sm text-gray-500 mt-2">Try adjusting your search or filters</p>
          </div>
        ) : viewMode === 'list' ? (
          <>
            <div className="mb-4 text-sm text-gray-600">
              Found {totalResults} result{totalResults !== 1 ? 's' : ''}
            </div>
            <div className="space-y-4">
              {results.map((vendor) => (
                <div
                  key={vendor.id}
                  onClick={() => handleVendorClick(vendor.id)}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg transition-shadow active:scale-[0.98] cursor-pointer"
                >
                  <div className="flex gap-4">
                    {vendor.photos && vendor.photos[0] ? (
                      <img
                        src={vendor.photos[0]}
                        alt={vendor.businessName}
                        className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center text-white text-2xl flex-shrink-0">
                        {vendor.businessName.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1">
                        <h3 className="font-bold text-gray-900 truncate">{vendor.businessName}</h3>
                        {vendor.isVerified && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                            Verified
                          </span>
                        )}
                      </div>
                      {vendor.rating && (
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-sm font-semibold">{vendor.rating.toFixed(1)}</span>
                          </div>
                          {vendor.totalReviews && (
                            <span className="text-sm text-gray-600">({vendor.totalReviews} reviews)</span>
                          )}
                        </div>
                      )}
                      {vendor.description && (
                        <p className="text-sm text-gray-600 line-clamp-2 mb-2">{vendor.description}</p>
                      )}
                      {vendor.services && vendor.services.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {vendor.services.slice(0, 3).map((service, idx) => (
                            <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                              {service}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        {vendor.distance && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            <span>{vendor.distance.toFixed(1)} km</span>
                          </div>
                        )}
                        {vendor.responseTime && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{vendor.responseTime}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-xl border p-12 text-center">
            <Map className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-600">Map view coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}

