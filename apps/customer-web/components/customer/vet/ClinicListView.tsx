'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Search, SlidersHorizontal, MapPin, Star, Users, Clock, Award, X, Navigation } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface ClinicListViewProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

interface ClinicData {
  id: string;
  name: string;
  businessName: string;
  address: string;
  rating: number;
  reviews: number;
  distance: number;
  photos: string[];
  specialties: string[];
  doctors: number;
  openNow: boolean;
  operatingHours: string;
  isMultispecialty: boolean;
}

export function ClinicListView({ phone, onBack, onNavigate }: ClinicListViewProps) {
  const [loading, setLoading] = useState(true);
  const [clinics, setClinics] = useState<ClinicData[]>([]);
  const [filteredClinics, setFilteredClinics] = useState<ClinicData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  const [maxDistance, setMaxDistance] = useState<number>(10);
  const [minRating, setMinRating] = useState<number>(0);
  const [multispecialtyOnly, setMultispecialtyOnly] = useState(false);
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'reviews'>('distance');

  useEffect(() => {
    loadClinics();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [clinics, searchQuery, maxDistance, minRating, multispecialtyOnly, openNowOnly, sortBy]);

  const loadClinics = async () => {
    try {
      setLoading(true);
      
      const response = await apiClient.get<{ success: boolean; services: any[] }>(
        `/customer/services?serviceStyle=at_center&roleId=veterinarian`
      );

      if (response.success && response.services) {
        const vendorMap = new Map<string, any>();
        
        response.services.forEach((service: any) => {
          const vendorId = service.vendorId;
          if (!vendorMap.has(vendorId)) {
            vendorMap.set(vendorId, {
              id: vendorId,
              name: service.vendorName || 'Unnamed Clinic',
              businessName: service.vendorName,
              address: service.vendorLocation || 'Address not provided',
              rating: service.vendorRating || 4.5,
              reviews: service.vendorReviewCount || 0,
              distance: Math.random() * 8 + 0.5,
              photos: service.vendorProfileImage ? [service.vendorProfileImage] : [],
              specialties: [],
              doctors: 3,
              openNow: Math.random() > 0.3,
              operatingHours: 'Mon-Sat: 9AM-7PM',
              isMultispecialty: false,
              serviceCount: 1
            });
          } else {
            const clinic = vendorMap.get(vendorId);
            clinic.serviceCount = (clinic.serviceCount || 1) + 1;
            clinic.isMultispecialty = clinic.serviceCount > 3;
          }
        });
        
        const clinicsData: ClinicData[] = Array.from(vendorMap.values());
        setClinics(clinicsData);
      } else {
        setClinics([]);
      }
    } catch (error) {
      console.error('Error loading clinics:', error);
      setClinics([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...clinics];

    if (searchQuery) {
      filtered = filtered.filter(clinic =>
        clinic.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        clinic.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        clinic.specialties.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    filtered = filtered.filter(clinic => clinic.distance <= maxDistance);

    if (minRating > 0) {
      filtered = filtered.filter(clinic => clinic.rating >= minRating);
    }

    if (multispecialtyOnly) {
      filtered = filtered.filter(clinic => clinic.isMultispecialty);
    }

    if (openNowOnly) {
      filtered = filtered.filter(clinic => clinic.openNow);
    }

    filtered.sort((a, b) => {
      if (sortBy === 'distance') return a.distance - b.distance;
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'reviews') return b.reviews - a.reviews;
      return 0;
    });

    setFilteredClinics(filtered);
  };

  const clearFilters = () => {
    setMaxDistance(10);
    setMinRating(0);
    setMultispecialtyOnly(false);
    setOpenNowOnly(false);
    setSortBy('distance');
    setSearchQuery('');
  };

  const activeFiltersCount = 
    (maxDistance < 10 ? 1 : 0) +
    (minRating > 0 ? 1 : 0) +
    (multispecialtyOnly ? 1 : 0) +
    (openNowOnly ? 1 : 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-[430px] mx-auto">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Finding nearby clinics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
        <div className="px-6 py-4 flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-lg">Vet Clinics</h1>
            <p className="text-sm text-gray-600">{filteredClinics.length} clinics found</p>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="relative p-2 hover:bg-gray-100 rounded-full"
          >
            <SlidersHorizontal className="w-5 h-5" />
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-white rounded-full text-xs flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-6 pb-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search clinics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white border-b border-gray-200 px-6 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Filters</h3>
            <button onClick={clearFilters} className="text-sm text-primary">
              Clear All
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Max Distance: {maxDistance} km</label>
            <input
              type="range"
              min="1"
              max="20"
              value={maxDistance}
              onChange={(e) => setMaxDistance(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Min Rating: {minRating > 0 ? minRating.toFixed(1) : 'Any'}</label>
            <input
              type="range"
              min="0"
              max="5"
              step="0.5"
              value={minRating}
              onChange={(e) => setMinRating(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={multispecialtyOnly}
                onChange={(e) => setMultispecialtyOnly(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Multispecialty only</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={openNowOnly}
                onChange={(e) => setOpenNowOnly(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Open now</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full p-2 border border-gray-300 rounded-lg"
            >
              <option value="distance">Distance</option>
              <option value="rating">Rating</option>
              <option value="reviews">Reviews</option>
            </select>
          </div>
        </div>
      )}

      {/* Clinics List */}
      <div className="p-4 space-y-3">
        {filteredClinics.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl">
            <p className="text-gray-500">No clinics found</p>
          </div>
        ) : (
          filteredClinics.map((clinic) => (
            <div
              key={clinic.id}
              onClick={() => onNavigate('clinic-profile', { clinicId: clinic.id })}
              className="bg-white rounded-xl p-4 border border-gray-200 hover:border-primary transition-colors cursor-pointer"
            >
              <div className="flex gap-4">
                {clinic.photos.length > 0 ? (
                  <img
                    src={clinic.photos[0]}
                    alt={clinic.name}
                    className="w-20 h-20 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center">
                    <Award className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{clinic.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm font-medium">{clinic.rating.toFixed(1)}</span>
                    <span className="text-xs text-gray-500">({clinic.reviews})</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1 text-gray-600">
                    <MapPin className="w-3 h-3" />
                    <span className="text-xs truncate">{clinic.address}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {clinic.doctors} doctors
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {clinic.operatingHours}
                    </span>
                  </div>
                  {clinic.isMultispecialty && (
                    <span className="inline-block mt-2 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                      Multispecialty
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

