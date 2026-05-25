/**
 * HomeServiceProviderListView - Provider Discovery & Listing
 * 
 * Features:
 * - Hyperlocal provider discovery with distance calculation
 * - Problem-based filtering
 * - Filter by: distance, rating, relevance, next available slot
 * - Provider metric cards with photo, specialization, distance, amenities, reviews
 * - Consultation price display per provider
 */

"use client";

import { useState, useEffect, useCallback, type MouseEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Search, 
  MapPin, 
  Clock, 
  ChevronRight,
  X,
  SlidersHorizontal,
  BadgeCheck
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { resolveVendorProfilePhotoUrl } from '@/lib/vendor-display-media';
import { pickCustomerVendorAccountId } from '@warmpawz/shared-types';
import { HomeServiceType } from './UniversalHomeServiceRouter';
import { VendorRatingDisplay } from '@/components/customer/shared/VendorRatingDisplay';

interface ServiceConfig {
  roleId: string;
  displayName: string;
  icon: string;
  primaryColor: string;
  bgGradient: string;
  problems: Array<{ id: string; name: string; icon: string }>;
  priceUnit: string;
  defaultDuration: number;
  requiresOTP: boolean;
  requiresStartOTP: boolean;
  supportsPackages: boolean;
  showMedicalHistory: boolean;
}

interface Provider {
  id: string;
  vendorId: string;
  businessName: string;
  fullName: string;
  name: string;
  photo: string;
  logo: string;
  address: string;
  phone: string;
  distance: number;
  rating: number;
  reviewCount: number;
  specializations: string[];
  amenities: string[];
  nextAvailableSlot: string;
  consultationFee: number;
  price: number;
  isVerified: boolean;
  experience: number;
  serviceCount: number;
  previouslyUsed?: boolean;
}

function ProviderListAvatar({
  photoUrl,
  businessName,
  icon,
  bgGradient,
}: {
  photoUrl: string;
  businessName: string;
  icon: string;
  bgGradient: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [photoUrl]);
  const show = Boolean(photoUrl && !failed);
  return show ? (
    <img
      src={photoUrl}
      alt={businessName}
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  ) : (
    <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${bgGradient} text-3xl text-white`}>
      {icon}
    </div>
  );
}

interface HomeServiceProviderListViewProps {
  phone: string;
  serviceType: HomeServiceType;
  config: ServiceConfig;
  selectedProblem?: string | null;
  onBack: () => void;
  /** Opens provider/center profile (header chevron). */
  onSelectProvider: (provider: Provider) => void;
  /** Opens full service list for booking (same as profile → “services” step). Omit to hide View Services. */
  onViewProviderServices?: (provider: Provider) => void;
  onNavigate?: (screen: string, data?: any) => void;
}

type SortOption = 'relevance' | 'distance' | 'rating' | 'next_slot' | 'price_low' | 'price_high';

export function HomeServiceProviderListView({
  phone,
  serviceType,
  config,
  selectedProblem,
  onBack,
  onSelectProvider,
  onViewProviderServices,
  onNavigate
}: HomeServiceProviderListViewProps) {

  // State
  const [providers, setProviders] = useState<Provider[]>([]);
  const [filteredProviders, setFilteredProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Filter states
  const [selectedProblems, setSelectedProblems] = useState<string[]>(
    selectedProblem ? [selectedProblem] : []
  );
  const [maxDistance, setMaxDistance] = useState<number>(15);
  const [minRating, setMinRating] = useState<number>(0);
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // Get user location on mount (silent fallback when permission denied)
  useEffect(() => {
    const { getCurrentPositionSafe, DEFAULT_COORDS } = require('@/lib/geolocation-utils');
    getCurrentPositionSafe(
      (coords: { lat: number; lng: number }) => setUserLocation(coords),
      () => setUserLocation(DEFAULT_COORDS)
    );
  }, []);

  // Load providers when location is available
  useEffect(() => {
    if (userLocation) {
      loadProviders();
    }
  }, [userLocation, serviceType]);

  // Apply filters whenever filter states change
  useEffect(() => {
    applyFilters();
  }, [providers, searchQuery, selectedProblems, maxDistance, minRating, sortBy, verifiedOnly]);

  const loadProviders = async () => {
    try {
      setLoading(true);
      console.log(`📍 [HOME-SERVICE-LIST] Loading providers for roleId: ${config.roleId}, serviceType: ${serviceType}`);

      // Map serviceType to discover-services category (vet, grooming, training, walker, etc.)
      const categoryMap: Record<string, string> = {
        vet: 'vet',
        grooming: 'grooming',
        training: 'training',
        walker: 'walker',
        behaviourist: 'behaviourist',
        sitting: 'sitting',
        sitter: 'sitting',
        diagnostics: 'diagnostics',
        nutrition: 'nutritionist',
        nutritionist: 'nutritionist',
      };
      const category = categoryMap[serviceType] || serviceType;

      let locationParams = '';
      try {
        const lat = typeof localStorage !== 'undefined' && localStorage.getItem('customer_latitude');
        const lng = typeof localStorage !== 'undefined' && localStorage.getItem('customer_longitude');
        if (lat && lng) locationParams = `&latitude=${lat}&longitude=${lng}`;
      } catch (_) {}

      // Primary: /customer/discover-services (solo providers only, at_home, enriched data)
      try {
        const discoverData = await apiClient.get<{ success: boolean; vendors?: any[]; providers?: any[] }>(
          `/customer/discover-services?category=${category}&serviceStyle=at_home&roleId=${config.roleId || category}${locationParams}`
        );

        const list = discoverData.providers ?? discoverData.vendors ?? [];
        if (discoverData.success && list.length > 0) {
          const enrichedProviders: Provider[] = list.map((p: any) => {
            const canonicalId = pickCustomerVendorAccountId(p as Record<string, unknown>) || String(p.vendorId || p.id || '');
            return {
            id: canonicalId,
            vendorId: canonicalId,
            businessName: p.businessName || p.name || p.fullName,
            fullName: p.fullName ?? p.name ?? p.businessName,
            name: p.businessName || p.name || p.fullName || 'Provider',
            photo:
              resolveVendorProfilePhotoUrl(p as Record<string, unknown>) ||
              p.photoUrl ||
              p.vendorProfileImage ||
              p.photo ||
              p.logo ||
              '',
            logo: p.photoUrl || p.vendorProfileImage || p.logo || p.photo || '',
            address: [p.city, p.state].filter(Boolean).join(', ') || p.address || 'Location not specified',
            phone: p.phone || '',
            distance: typeof p.distance === 'number' ? p.distance : (userLocation ? calculateDistance(userLocation, p.latitude != null && p.longitude != null ? { lat: Number(p.latitude), lng: Number(p.longitude) } : undefined) : 999),
            rating: (() => {
              const rc = Number(p.totalReviews ?? p.reviewCount ?? 0) || 0;
              const r = p.rating != null ? Number(p.rating) : NaN;
              return rc > 0 && Number.isFinite(r) && r > 0 ? r : 0;
            })(),
            reviewCount: Number(p.totalReviews ?? p.reviewCount ?? 0),
            specializations: Array.isArray(p.specializations) ? p.specializations : [],
            amenities: Array.isArray(p.amenities) ? p.amenities : [],
            nextAvailableSlot: p.nextAvailability ?? p.nextAvailableSlot?.formattedDisplay ?? p.nextAvailableSlot ?? 'Today',
            consultationFee: Number(p.consultationFee ?? p.price ?? 0),
            price: Number(p.price ?? p.consultationFee ?? 199),
            isVerified: Boolean(p.isVerified),
            experience: Number(p.experience ?? p.yearsExperience ?? 0),
            serviceCount: Number(p.completedBookings ?? p.serviceCount ?? 0),
            previouslyUsed: Boolean(p.previouslyUsed),
          };
          });

          console.log(`✅ [HOME-SERVICE-LIST] Found ${enrichedProviders.length} providers from discover-services`);
          setProviders(enrichedProviders);
          return;
        }
      } catch (e) {
        console.warn('discover-services failed, trying fallback:', e);
      }

      // Fallback: /customer/services (extract unique vendors from services)
      console.log('📍 [HOME-SERVICE-LIST] Fallback: customer/services');
      const data = await apiClient.get<{ services: any[] }>(`/customer/services?roleId=${config.roleId}&serviceStyle=at_home`).catch(() => ({ services: [] }));
      const services = data.services || [];

      const vendorMap = new Map<string, Provider>();
      services.forEach((service: any) => {
        const vendorId = service.vendorId;
        if (vendorId && !vendorMap.has(vendorId)) {
          vendorMap.set(vendorId, {
            id: vendorId,
            vendorId: vendorId,
            businessName: service.vendorName || 'Provider',
            fullName: service.vendorName,
            name: service.vendorName || 'Provider',
            photo: service.vendorPhoto || service.vendorLogo || '',
            logo: service.vendorLogo || service.vendorPhoto || '',
            address: service.vendorAddress || service.vendorLocation || 'Location not specified',
            phone: service.vendorPhone || '',
            distance: 999,
            rating: (() => {
              const rc = Number(service.vendorReviewCount ?? service.review_count ?? 0) || 0;
              const r =
                service.vendorRating != null ? Number(service.vendorRating) : NaN;
              return rc > 0 && Number.isFinite(r) && r > 0 ? r : 0;
            })(),
            reviewCount: Number(service.vendorReviewCount ?? service.review_count ?? 0) || 0,
            specializations: service.specializations || [],
            amenities: service.amenities || [],
            nextAvailableSlot: 'Today',
            consultationFee: service.price || 0,
            price: service.price || 199,
            isVerified: Boolean(service.vendorVerified),
            experience: 0,
            serviceCount: service.vendorServiceCount || 0,
            previouslyUsed: false,
          });
        }
      });

      const enrichedProviders = Array.from(vendorMap.values());
      console.log(`✅ [HOME-SERVICE-LIST] Fallback: ${enrichedProviders.length} vendors from services`);
      setProviders(enrichedProviders);
    } catch (error) {
      console.error('❌ [HOME-SERVICE-LIST] Exception:', error);
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (
    userLoc: { lat: number; lng: number } | null,
    providerCoords?: { lat: number; lng: number }
  ): number => {
    if (!userLoc || !providerCoords) return 999;

    const R = 6371; // Earth's radius in km
    const dLat = toRad(providerCoords.lat - userLoc.lat);
    const dLon = toRad(providerCoords.lng - userLoc.lng);
    const lat1 = toRad(userLoc.lat);
    const lat2 = toRad(providerCoords.lat);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c * 10) / 10;
  };

  const toRad = (deg: number) => deg * (Math.PI / 180);

  const applyFilters = () => {
    let result = [...providers];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name?.toLowerCase().includes(query) ||
        p.businessName?.toLowerCase().includes(query) ||
        p.address?.toLowerCase().includes(query) ||
        p.specializations?.some(s => s.toLowerCase().includes(query))
      );
    }

    // Distance filter
    result = result.filter(p => p.distance <= maxDistance);

    // Rating filter
    if (minRating > 0) {
      result = result.filter(p => p.rating >= minRating);
    }

    // Verified only filter
    if (verifiedOnly) {
      result = result.filter(p => p.isVerified);
    }

    // Sort
    switch (sortBy) {
      case 'distance':
        result.sort((a, b) => a.distance - b.distance);
        break;
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'next_slot':
        // Sort by next available slot (simplified)
        result.sort((a, b) => {
          if (a.nextAvailableSlot === 'Today') return -1;
          if (b.nextAvailableSlot === 'Today') return 1;
          return 0;
        });
        break;
      case 'price_low':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price_high':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'relevance':
      default:
        // Sort by previously used first, then by rating
        result.sort((a, b) => {
          if (a.previouslyUsed && !b.previouslyUsed) return -1;
          if (!a.previouslyUsed && b.previouslyUsed) return 1;
          return b.rating - a.rating;
        });
        break;
    }

    setFilteredProviders(result);
  };

  const toggleProblem = (problemId: string) => {
    setSelectedProblems(prev =>
      prev.includes(problemId)
        ? prev.filter(p => p !== problemId)
        : [...prev, problemId]
    );
  };

  const clearFilters = () => {
    setSelectedProblems([]);
    setMaxDistance(15);
    setMinRating(0);
    setSortBy('relevance');
    setVerifiedOnly(false);
  };

  const activeFilterCount = [
    selectedProblems.length > 0,
    maxDistance !== 15,
    minRating > 0,
    sortBy !== 'relevance',
    verifiedOnly
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      {/* Header – standard orange to match vet dashboard (forensic theme compliance) */}
      <div 
        className="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] text-white sticky top-0 z-30"
      >
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold">{config.icon} {config.displayName}</h1>
              <p className="text-sm opacity-90">
                {filteredProviders.length} providers near you
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search providers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
        </div>

        {/* Problem Pills */}
        <div className="px-4 pb-3 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2">
            {config.problems.slice(0, 6).map((problem) => (
              <button
                key={problem.id}
                onClick={() => toggleProblem(problem.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedProblems.includes(problem.id)
                    ? 'bg-white text-gray-800'
                    : 'bg-white/20 text-white'
                }`}
              >
                {problem.icon} {problem.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="sticky top-[156px] z-20 bg-white border-b px-4 py-2 flex items-center justify-between">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setShowFilters(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${
              activeFilterCount > 0
                ? 'bg-orange-50 border-orange-300 text-orange-600'
                : 'bg-gray-50 border-gray-200 text-gray-600'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 bg-orange-500 text-white rounded-full text-xs flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-3 py-1.5 rounded-full text-sm font-medium border border-gray-200 bg-gray-50 text-gray-600 focus:outline-none"
          >
            <option value="relevance">Relevance</option>
            <option value="distance">Nearest</option>
            <option value="rating">Top Rated</option>
            <option value="next_slot">Available Now</option>
            <option value="price_low">Price: Low to High</option>
            <option value="price_high">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Provider List */}
      <div className="p-4 space-y-4">
        {loading ? (
          // Loading skeleton
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
              <div className="flex gap-4">
                <div className="w-24 h-24 bg-gray-200 rounded-xl" />
                <div className="flex-1 space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                </div>
              </div>
            </div>
          ))
        ) : filteredProviders.length === 0 ? (
          // No results
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No providers found</h3>
            <p className="text-gray-500 mb-4">Try adjusting your filters or search</p>
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          // Provider cards
          filteredProviders.map((provider, index) => (
            <motion.div
              key={provider.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
            >
              <div className="p-4">
                <div className="flex gap-4">
                  {/* Provider Photo */}
                  <div className="relative">
                    <div className="h-24 w-24 overflow-hidden rounded-xl bg-gray-100">
                      <ProviderListAvatar
                        photoUrl={provider.photo}
                        businessName={provider.name}
                        icon={config.icon}
                        bgGradient={config.bgGradient}
                      />
                    </div>
                    {provider.isVerified && (
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <BadgeCheck className="w-4 h-4 text-white" />
                      </div>
                    )}
                    {provider.previouslyUsed && (
                      <div
                        className="absolute -bottom-1 -right-1 rounded-full px-1.5 py-0.5"
                        style={{ backgroundColor: config.primaryColor }}
                      >
                        <span className="text-[10px] font-medium text-white">Used</span>
                      </div>
                    )}
                  </div>

                  {/* Provider Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1 gap-2">
                      <h3 className="font-semibold text-gray-800 truncate pr-2">
                        {provider.name}
                      </h3>
                      <button
                        type="button"
                        aria-label={`View ${provider.name} profile`}
                        className="flex-shrink-0 p-1 -m-1 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors focus-visible:outline focus-visible:ring-2 focus-visible:ring-orange-300"
                        onClick={(e: MouseEvent) => {
                          e.stopPropagation();
                          onSelectProvider(provider);
                        }}
                      >
                        <ChevronRight className="w-5 h-5" aria-hidden />
                      </button>
                    </div>

                    {/* Rating & Reviews */}
                    <VendorRatingDisplay
                      row={{
                        vendorId: provider.vendorId ?? provider.id,
                        vendorRating: provider.rating,
                        vendorReviewCount: provider.reviewCount,
                      }}
                      vendorId={String(provider.vendorId ?? provider.id ?? '')}
                      className="mb-2"
                      textClassName="text-xs text-gray-500"
                    />

                    {/* Location & Distance */}
                    <div className="flex items-center gap-1 text-sm text-gray-500 mb-2">
                      <MapPin className="w-4 h-4" />
                      <span className="truncate">{provider.address}</span>
                      {provider.distance != null && provider.distance < 999 && (
                        <span className="flex-shrink-0 text-orange-600 font-medium">
                          • {Number(provider.distance) < 1
                            ? `${Math.round(Number(provider.distance) * 1000)} m`
                            : `${Math.round(Number(provider.distance))} km`}
                        </span>
                      )}
                    </div>

                  </div>
                </div>

                {/* Bottom Row: Price & Availability */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Clock className="w-4 h-4" />
                    <span>Next: {provider.nextAvailableSlot}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold" style={{ color: config.primaryColor }}>
                      ₹{provider.price}
                    </span>
                    <span className="text-xs text-gray-500 ml-1">{config.priceUnit}</span>
                  </div>
                </div>

                {/* Amenities Row */}
                {provider.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {provider.amenities.slice(0, 4).map((amenity, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-blue-50 rounded-full text-xs text-blue-600"
                      >
                        {amenity}
                      </span>
                    ))}
                  </div>
                )}

                {onViewProviderServices && provider.serviceCount > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-orange-700 border-orange-300 hover:bg-orange-50"
                      onClick={(e: MouseEvent) => {
                        e.stopPropagation();
                        onViewProviderServices(provider);
                      }}
                    >
                      View Services
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Filter Sheet */}
      <AnimatePresence>
        {showFilters && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFilters(false)}
              className="fixed inset-0 bg-black/50 z-40"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 mb-14 max-h-[calc(85vh-3.5rem)] overflow-y-auto bg-white rounded-t-3xl z-50 max-w-md mx-auto"
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">Filters</h3>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Distance Filter */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maximum Distance: {maxDistance} km
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    value={maxDistance}
                    onChange={(e) => setMaxDistance(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>1 km</span>
                    <span>30 km</span>
                  </div>
                </div>

                {/* Rating Filter */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Rating
                  </label>
                  <div className="flex gap-2">
                    {[0, 3, 3.5, 4, 4.5].map((rating) => (
                      <button
                        key={rating}
                        onClick={() => setMinRating(rating)}
                        className={`flex items-center gap-1 px-3 py-2 rounded-lg border ${
                          minRating === rating
                            ? 'bg-orange-50 border-orange-300 text-orange-600'
                            : 'bg-white border-gray-200 text-gray-600'
                        }`}
                      >
                        {rating === 0 ? (
                          'Any'
                        ) : (
                          <>
                            <Star className="w-4 h-4 fill-current" />
                            {rating}+
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Verified Only Toggle */}
                <div className="mb-6">
                  <label className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Verified Providers Only
                    </span>
                    <button
                      onClick={() => setVerifiedOnly(!verifiedOnly)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        verifiedOnly ? 'bg-orange-500' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          verifiedOnly ? 'translate-x-6' : ''
                        }`}
                      />
                    </button>
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="sticky bottom-3 bg-white pt-2 flex gap-3">
                  <button
                    onClick={clearFilters}
                    className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={() => setShowFilters(false)}
                    className="flex-1 py-3 rounded-xl bg-orange-500 text-white font-medium"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default HomeServiceProviderListView;
