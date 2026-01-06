'use client';

import { useState, useEffect } from 'react';
import { Search, MapPin, Star, Filter, ChevronRight, Clock, Phone, Award } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface ServiceDiscoveryProps {
  onSelectVendor: (vendorId: string) => void;
  onNavigate?: (path: string) => void;
}

const CATEGORIES = [
  { id: 'vet', name: 'Veterinary', icon: '🏥', color: 'bg-red-50 text-red-700' },
  { id: 'grooming', name: 'Grooming', icon: '✂️', color: 'bg-blue-50 text-blue-700' },
  { id: 'training', name: 'Training', icon: '🎓', color: 'bg-purple-50 text-purple-700' },
  { id: 'walker', name: 'Walking', icon: '🚶', color: 'bg-green-50 text-green-700' },
  { id: 'boarding', name: 'Boarding', icon: '🏠', color: 'bg-yellow-50 text-yellow-700' },
  { id: 'nutrition', name: 'Nutrition', icon: '🍖', color: 'bg-orange-50 text-orange-700' },
  { id: 'adoption', name: 'Adoption', icon: '❤️', color: 'bg-pink-50 text-pink-700' },
  { id: 'marketplace', name: 'Shop', icon: '🛍️', color: 'bg-indigo-50 text-indigo-700' }
];

export function ServiceDiscovery({ onSelectVendor, onNavigate }: ServiceDiscoveryProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    location: '',
    minRating: '',
    sortBy: 'rating'
  });

  useEffect(() => {
    if (selectedCategory) {
      searchVendors();
    }
  }, [selectedCategory, filters]);

  const searchVendors = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        category: selectedCategory || '',
        ...(filters.location && { location: filters.location }),
        ...(filters.minRating && { minRating: filters.minRating }),
        sortBy: filters.sortBy
      });

      const response = await apiClient.get<{ vendors: any[] }>(
        `/customer/discover-services?${params}`
      );
      
      if (response.vendors) {
        setVendors(response.vendors);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!selectedCategory) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
        {/* Header */}
        <div className="bg-white border-b px-4 py-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            What does your pet need?
          </h1>
          <p className="text-gray-600">
            Find trusted pet care services near you
          </p>
        </div>

        {/* Category Grid */}
        <div className="px-4 py-8">
          <div className="grid grid-cols-2 gap-4">
            {CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className="p-6 bg-white rounded-xl border-2 border-gray-200 hover:border-primary transition-all text-center group active:scale-[0.98]"
              >
                <div className="text-4xl mb-3">{category.icon}</div>
                <h3 className="font-medium text-gray-900 group-hover:text-primary">
                  {category.name}
                </h3>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header with Search */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back
            </button>
            <div className="flex-1">
              <h1 className="font-bold text-gray-900">
                {CATEGORIES.find(c => c.id === selectedCategory)?.name} Services
              </h1>
              <p className="text-sm text-gray-600">{vendors.length} providers found</p>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 gap-3">
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filters.location}
                onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                placeholder="Enter location"
                className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <select
                value={filters.minRating}
                onChange={(e) => setFilters({ ...filters, minRating: e.target.value })}
                className="px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
              >
                <option value="">All Ratings</option>
                <option value="4">4+ Stars</option>
                <option value="4.5">4.5+ Stars</option>
              </select>

              <select
                value={filters.sortBy}
                onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                className="px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-primary focus:outline-none"
              >
                <option value="rating">Highest Rated</option>
                <option value="price">Lowest Price</option>
                <option value="distance">Nearest</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Vendor List */}
      <div className="px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : vendors.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <Search className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="font-bold text-gray-900 mb-2">No providers found</h3>
            <p className="text-gray-600">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="space-y-4">
            {vendors.map((vendor) => (
              <div
                key={vendor.id}
                className="bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-shadow overflow-hidden active:scale-[0.98]"
                onClick={() => onSelectVendor(vendor.id)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 text-lg mb-1">
                        {vendor.businessName}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span>{vendor.city || vendor.address}</span>
                        </div>
                        {vendor.rating > 0 && (
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span className="font-medium">{vendor.rating.toFixed(1)}</span>
                            <span className="text-gray-400">({vendor.totalReviews})</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {vendor.isAvailableToday && (
                      <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                        Available Today
                      </span>
                    )}
                  </div>

                  {vendor.services && vendor.services.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {vendor.services.slice(0, 3).map((service: string, idx: number) => (
                        <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                          {service}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      {vendor.priceRange && (
                        <span className="font-semibold text-primary">
                          ₹{vendor.priceRange.min} - ₹{vendor.priceRange.max}
                        </span>
                      )}
                      {vendor.distance && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {vendor.distance.toFixed(1)} km
                        </span>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

