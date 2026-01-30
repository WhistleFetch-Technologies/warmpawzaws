'use client';

import { useState, useEffect } from 'react';
import { Search, MapPin, Star, ChevronRight, Clock, Phone, Award } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import React from 'react';
import { useCustomerCategories } from '@/hooks/useCustomerCategories';

interface ServiceDiscoveryProps {
  onSelectVendor: (vendorId: string) => void;
}

/** Fallback when API returns no categories (emoji icons). */
const FALLBACK_CATEGORIES: { id: string; name: string; icon: string; color: string }[] = [
  { id: 'vet', name: 'Veterinary', icon: '🏥', color: 'bg-red-50 text-red-700' },
  { id: 'grooming', name: 'Grooming', icon: '✂️', color: 'bg-blue-50 text-blue-700' },
  { id: 'training', name: 'Training', icon: '🎓', color: 'bg-purple-50 text-purple-700' },
  { id: 'walker', name: 'Walking', icon: '🚶', color: 'bg-green-50 text-green-700' },
  { id: 'boarding', name: 'Boarding', icon: '🏠', color: 'bg-yellow-50 text-yellow-700' },
  { id: 'nutrition', name: 'Nutrition', icon: '🍖', color: 'bg-orange-50 text-orange-700' },
  { id: 'adoption', name: 'Adoption', icon: '❤️', color: 'bg-pink-50 text-pink-700' },
  { id: 'marketplace', name: 'Shop', icon: '🛍️', color: 'bg-indigo-50 text-indigo-700' },
];

type CategoryItem =
  | { id: string; name: string; icon: string; color: string }
  | { id: string; name: string; icon: React.ComponentType<{ className?: string }>; color: string };

export function ServiceDiscovery({ onSelectVendor }: ServiceDiscoveryProps) {
  const { quickServiceTiles } = useCustomerCategories();
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

      const data = await apiClient.get<{ vendors?: any[] }>(`/customer/vendors/search?${params.toString()}`);
      setVendors(data.vendors || []);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  // Dynamic categories from admin catalog; fallback to hardcoded list if API fails or returns empty
  const displayCategories: CategoryItem[] =
    quickServiceTiles.length > 0
      ? quickServiceTiles.map((t) => ({
          id: t.categoryId,
          name: t.label,
          icon: t.icon,
          color: t.color,
        }))
      : FALLBACK_CATEGORIES;

  if (!selectedCategory) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              What does your pet need?
            </h1>
            <p className="text-gray-600">
              Find trusted pet care services near you
            </p>
          </div>
        </div>

        {/* Category Grid */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {displayCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className="p-6 bg-white rounded-xl border-2 border-gray-200 hover:border-blue-500 transition-all text-center group"
              >
                <div className="text-4xl mb-3 flex justify-center items-center min-h-[2.5rem]">
                  {typeof category.icon === 'string' ? (
                    category.icon
                  ) : (
                    <category.icon className="w-10 h-10 text-gray-600" />
                  )}
                </div>
                <h3 className="font-medium text-gray-900 group-hover:text-blue-600">
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
    <div className="min-h-screen bg-gray-50">
      {/* Header with Search */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedCategory(null)}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back
            </button>
            <div className="flex-1">
              <h1 className="font-bold text-gray-900">
                {displayCategories.find((c) => c.id === selectedCategory)?.name} Services
              </h1>
              <p className="text-sm text-gray-600">{vendors.length} providers found</p>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filters.location}
                onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                placeholder="Enter location"
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
              />
            </div>

            <select
              value={filters.minRating}
              onChange={(e) => setFilters({ ...filters, minRating: e.target.value })}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="">All Ratings</option>
              <option value="4">4+ Stars</option>
              <option value="4.5">4.5+ Stars</option>
            </select>

            <select
              value={filters.sortBy}
              onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="rating">Highest Rated</option>
              <option value="price">Lowest Price</option>
              <option value="distance">Nearest</option>
            </select>
          </div>
        </div>
      </div>

      {/* Vendor List */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
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
                className="bg-white rounded-xl border hover:shadow-lg transition-shadow overflow-hidden"
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
                            <span className="font-medium">{Number(vendor.rating || 0).toFixed(1)}</span>
                            <span className="text-gray-400">({vendor.totalReviews})</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {vendor.isAvailableToday && (
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Available Today
                      </span>
                    )}
                  </div>

                  {vendor.description && (
                    <p className="text-gray-600 mb-4 line-clamp-2">
                      {vendor.description}
                    </p>
                  )}

                  {/* Featured Offerings */}
                  {vendor.featuredOfferings.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-gray-500 mb-2">Popular Services</p>
                      <div className="flex flex-wrap gap-2">
                        {vendor.featuredOfferings.map((offering: any) => (
                          <div
                            key={offering.id}
                            className="px-3 py-1.5 bg-gray-50 rounded-lg border"
                          >
                            <span className="text-sm text-gray-700">{offering.name}</span>
                            {offering.price > 0 && (
                              <span className="ml-2 text-sm font-medium text-green-600">
                                ₹{offering.price}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contact & Action */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      {vendor.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          <span>{vendor.phone}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Award className="w-4 h-4" />
                        <span>{vendor.totalOfferings} services</span>
                      </div>
                    </div>

                    <Button
                      onClick={() => onSelectVendor(vendor.id)}
                      className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                    >
                      View Details
                      <ChevronRight className="w-4 h-4" />
                    </Button>
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
