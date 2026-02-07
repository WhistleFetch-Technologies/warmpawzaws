import React, { useState, useEffect } from 'react';
import { Search, MapPin, Calendar, Users, DollarSign, Star, Filter } from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

/**
 * 🏖️ HOLIDAY PACKAGE BROWSE COMPONENT
 * 
 * Phase 7B: Critical Services - Rule 13 Implementation
 * 
 * Features:
 * - Browse holiday packages
 * - Filter by destination, type, price
 * - View package details
 * - Check availability
 */

interface HolidayPackage {
  packageId: string;
  packageName: string;
  description: string;
  destination: string;
  destinationImage?: string;
  packageType: 'beach' | 'mountain' | 'city' | 'wildlife' | 'adventure' | 'luxury';
  duration: {
    days: number;
    nights: number;
  };
  pricing: {
    basePrice: number;
    pricePerPet: number;
    pricePerAdult: number;
    pricePerChild: number;
    currency: string;
  };
  inclusions: string[];
  isGroupTour: boolean;
}

interface HolidayPackageBrowseProps {
  onSelectPackage: (packageId: string) => void;
}

export default function HolidayPackageBrowse({ onSelectPackage }: HolidayPackageBrowseProps) {
  const [packages, setPackages] = useState<HolidayPackage[]>([]);
  const [filteredPackages, setFilteredPackages] = useState<HolidayPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [selectedPackage, setSelectedPackage] = useState<HolidayPackage | null>(null);

  useEffect(() => {
    fetchPackages();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [packages, searchQuery, selectedType, priceRange]);

  const fetchPackages = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${getApiBaseUrl()}/holiday-packages/list`,
        {
          headers: {
            Authorization: (getAuthHeaders().Authorization || ""),
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        setPackages(data.data.packages || []);
      }
    } catch (error) {
      console.error('Error fetching packages:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...packages];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (pkg) =>
          pkg.packageName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          pkg.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
          pkg.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Type filter
    if (selectedType !== 'all') {
      filtered = filtered.filter((pkg) => pkg.packageType === selectedType);
    }

    // Price filter
    if (priceRange.min) {
      filtered = filtered.filter((pkg) => pkg.pricing.basePrice >= parseFloat(priceRange.min));
    }
    if (priceRange.max) {
      filtered = filtered.filter((pkg) => pkg.pricing.basePrice <= parseFloat(priceRange.max));
    }

    setFilteredPackages(filtered);
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      beach: 'bg-blue-100 text-blue-800',
      mountain: 'bg-green-100 text-green-800',
      city: 'bg-purple-100 text-purple-800',
      wildlife: 'bg-yellow-100 text-yellow-800',
      adventure: 'bg-red-100 text-red-800',
      luxury: 'bg-pink-100 text-pink-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-pink-500 text-white py-12">
        <div className="max-w-7xl mx-auto px-6">
          <h1 className="mb-4">Pet Holiday Packages</h1>
          <p className="text-orange-50 text-lg">Explore amazing destinations with your furry friends</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search packages or destinations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            {/* Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="beach">Beach</option>
              <option value="mountain">Mountain</option>
              <option value="city">City</option>
              <option value="wildlife">Wildlife</option>
              <option value="adventure">Adventure</option>
              <option value="luxury">Luxury</option>
            </select>

            {/* Price Filter */}
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Min ₹"
                value={priceRange.min}
                onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                className="w-1/2 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <input
                type="number"
                placeholder="Max ₹"
                value={priceRange.max}
                onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                className="w-1/2 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Packages Grid */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-600">{filteredPackages.length} packages found</p>
        </div>

        {filteredPackages.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center">
            <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-gray-900 mb-2">No Packages Found</h3>
            <p className="text-gray-600">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPackages.map((pkg) => (
              <div
                key={pkg.packageId}
                className="bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedPackage(pkg)}
              >
                {pkg.destinationImage && (
                  <div className="h-48 bg-gray-200">
                    <img
                      src={pkg.destinationImage}
                      alt={pkg.destination}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-gray-900 mb-2">{pkg.packageName}</h3>
                      <div className="flex items-center gap-2 text-gray-600 text-sm mb-2">
                        <MapPin className="w-4 h-4" />
                        <span>{pkg.destination}</span>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs ${getTypeColor(pkg.packageType)}`}>
                      {pkg.packageType}
                    </span>
                  </div>

                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{pkg.description}</p>

                  <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {pkg.duration.days}D/{pkg.duration.nights}N
                      </span>
                    </div>
                    {pkg.isGroupTour && (
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>Group Tour</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-600">Starting from</p>
                        <p className="text-orange-600 text-xl">
                          {pkg.pricing.currency} {pkg.pricing.basePrice}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPackage(pkg.packageId);
                        }}
                        className="bg-orange-500 text-white px-6 py-2 rounded-lg hover:bg-orange-600 transition-colors"
                      >
                        Book Now
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Package Details Modal */}
      {selectedPackage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {selectedPackage.destinationImage && (
              <div className="h-64 bg-gray-200">
                <img
                  src={selectedPackage.destinationImage}
                  alt={selectedPackage.destination}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="p-8">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-gray-900 mb-2">{selectedPackage.packageName}</h2>
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-5 h-5" />
                    <span>{selectedPackage.destination}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedPackage(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <p className="text-gray-600 mb-6">{selectedPackage.description}</p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <Calendar className="w-6 h-6 text-orange-500 mb-2" />
                  <p className="text-xs text-gray-600">Duration</p>
                  <p className="text-gray-900">
                    {selectedPackage.duration.days}D/{selectedPackage.duration.nights}N
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <DollarSign className="w-6 h-6 text-orange-500 mb-2" />
                  <p className="text-xs text-gray-600">Base Price</p>
                  <p className="text-gray-900">{selectedPackage.pricing.currency} {selectedPackage.pricing.basePrice}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <Users className="w-6 h-6 text-orange-500 mb-2" />
                  <p className="text-xs text-gray-600">Per Pet</p>
                  <p className="text-gray-900">{selectedPackage.pricing.currency} {selectedPackage.pricing.pricePerPet}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <Star className="w-6 h-6 text-orange-500 mb-2" />
                  <p className="text-xs text-gray-600">Type</p>
                  <p className="text-gray-900 capitalize">{selectedPackage.packageType}</p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-gray-900 mb-3">Inclusions</h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {selectedPackage.inclusions.map((item, index) => (
                    <li key={index} className="flex items-center gap-2 text-gray-600">
                      <span className="text-green-500">✓</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setSelectedPackage(null)}
                  className="flex-1 bg-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    onSelectPackage(selectedPackage.packageId);
                    setSelectedPackage(null);
                  }}
                  className="flex-1 bg-orange-500 text-white py-3 rounded-lg hover:bg-orange-600 transition-colors"
                >
                  Book This Package
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
