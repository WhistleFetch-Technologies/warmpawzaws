'use client';

/**
 * ========================================
 * ENHANCED VENDOR SEARCH PAGE
 * ========================================
 * 
 * Complete vendor search experience with:
 * - Advanced search with filters
 * - Map view toggle
 * - Real-time results
 * - Mobile responsive
 * - Location-aware
 * 
 * Usage:
 * <VendorSearchEnhanced />
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, List, Map, SlidersHorizontal, X } from 'lucide-react';
import { SearchAutocomplete } from './SearchAutocomplete';
import { SearchFilters, FilterValues } from './SearchFilters';
import { UniversalVendorCard } from './UniversalVendorCard';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

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

export function VendorSearchEnhanced() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<FilterValues & { radius?: number; sortBy?: string; location?: { lat: number; lng: number } }>({
    radius: 10,
    sortBy: 'relevance'
  });
  const [results, setResults] = useState<VendorResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [showFilters, setShowFilters] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Get user location on mount
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
          // Default to Delhi if location denied
          const defaultLocation = { lat: 28.6139, lng: 77.2090 };
          setUserLocation(defaultLocation);
          setFilters(prev => ({ ...prev, location: defaultLocation }));
        }
      );
    }
  }, []);

  // Search vendors
  const searchVendors = async () => {
    setLoading(true);
    try {
      const data = await apiClient.post<{ results?: VendorResult[], totalResults?: number }>('/customer/vendors/search', {
        query,
        ...filters,
        limit: 50
      });
      setResults(data.results || []);
      setTotalResults(data.totalResults || 0);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Search when query or filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2 || Object.keys(filters).length > 2) {
        searchVendors();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, filters]);

  // Handle search from search bar
  const handleSearchNavigate = (type: string, id?: string) => {
    if (type === 'vendor' && id) {
      router.push(`/vendor/${id}`);
    } else if (type === 'search') {
      setQuery(id || '');
    }
  };

  // Handle filter removal
  const handleRemoveFilter = (key: keyof FilterValues) => {
    setFilters(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  // Handle vendor click
  const handleVendorClick = (vendorId: string) => {
    router.push(`/vendor/${vendorId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Search Bar */}
          <div className="mb-4">
            <SearchAutocomplete
              onSelect={handleSearchNavigate}
              placeholder="Search for veterinary, grooming, training..."
            />
          </div>

          {/* View Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Location Display */}
              {userLocation && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4" />
                  <span>Searching nearby</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Filters Toggle (Mobile) */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="lg:hidden"
              >
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                Filters
              </Button>

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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Filters Sidebar */}
          {(showFilters || window.innerWidth >= 1024) && (
            <div className="w-80 flex-shrink-0">
              <div className="sticky top-32">
                {/* Mobile: Filters Overlay */}
                {showFilters && window.innerWidth < 1024 && (
                  <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowFilters(false)}>
                    <div className="absolute inset-y-0 left-0 w-80 bg-white" onClick={(e) => e.stopPropagation()}>
                      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                        <h3 className="font-semibold">Filters</h3>
                        <button onClick={() => setShowFilters(false)}>
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <SearchFilters
                        query={query}
                        onFilterChange={(newFilters) => {
                          setFilters(newFilters as any);
                          setShowFilters(false);
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Desktop: Filters Sidebar */}
                <div className="hidden lg:block">
                  <SearchFilters
                    query={query}
                    onFilterChange={(newFilters) => setFilters(newFilters as any)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Results */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading vendors...</p>
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">{query ? `No vendors found for "${query}"` : 'No vendors found'}</p>
                <p className="text-sm text-gray-500 mt-2">Try adjusting your search terms or filters</p>
              </div>
            ) : viewMode === 'list' ? (
              <div className="space-y-4">
                <div className="text-sm text-gray-600 mb-4">
                  {totalResults} {totalResults === 1 ? 'vendor' : 'vendors'} found
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {results.map((vendor) => (
                    <UniversalVendorCard
                      key={vendor.id}
                      vendor={{
                        id: vendor.id,
                        vendorId: vendor.id,
                        vendorName: vendor.businessName || '',
                        vendorRating: vendor.rating,
                        vendorReviewCount: vendor.totalReviews,
                        vendorLocation: vendor.location ? `${vendor.location.lat}, ${vendor.location.lng}` : undefined,
                        price: vendor.priceRange,
                        description: vendor.description,
                        serviceStyle: vendor.serviceStyle,
                        serviceName: vendor.services?.[0] || undefined,
                        vendorProfileImage: vendor.photos?.[0]
                      }}
                      onViewDetails={() => handleVendorClick(vendor.id)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Map View Placeholder */}
                <div className="bg-gray-100 rounded-xl p-12 text-center border-2 border-dashed border-gray-300">
                  <div className="space-y-2">
                    <div className="w-16 h-16 bg-gray-300 rounded-lg mx-auto flex items-center justify-center">
                      <span className="text-2xl">🗺️</span>
                    </div>
                    <p className="text-gray-600 font-medium">Interactive Map View</p>
                    <p className="text-sm text-gray-500">Map integration will show vendor locations</p>
                    <p className="text-xs text-gray-400 mt-2">Use list view below to browse vendors</p>
                  </div>
                </div>
                
                {/* Vendor List Below Map */}
                {results.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <h3 className="font-semibold mb-4">
                      {totalResults} vendors found
                    </h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {results.map((vendor, index) => (
                        <button
                          key={vendor.id}
                          onClick={() => handleVendorClick(vendor.id)}
                          className="w-full flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors text-left"
                        >
                          <div className="flex-shrink-0 w-8 h-8 bg-[#FF8C42] text-white rounded-full flex items-center justify-center font-semibold">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 truncate">
                              {vendor.businessName}
                            </h4>
                            <div className="flex items-center gap-3 mt-1">
                              {vendor.rating && (
                                <span className="text-sm text-gray-600">
                                  ⭐ {Number(vendor.rating || 0).toFixed(1)}
                                </span>
                              )}
                              {vendor.distance !== undefined && (
                                <span className="text-sm text-gray-600">
                                  📍 {Number(vendor.distance || 0).toFixed(1)} km
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}