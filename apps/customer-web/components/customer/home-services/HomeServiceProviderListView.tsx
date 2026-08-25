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
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Search, 
  X,
  SlidersHorizontal,
  Star,
} from 'lucide-react';
import { mapDiscoveryRowBaseFields } from '@/lib/map-discovery-list-row';
import { useDiscoverServicesFeed } from '@/hooks/useDiscoverServicesFeed';
import { useWarmpawzAppointmentsByCategoryFeed } from '@/hooks/useWarmpawzAppointmentsByCategoryFeed';
import { DiscoveryVendorFeedSentinel } from '@/components/customer/shared/DiscoveryVendorFeedSentinel';
import { WarmpawzPayVendorCard } from '@/components/warmpawz-pay/vendor-card/WarmpawzPayVendorCard';
import { mapDiscoveryProviderToVendorCardProps } from '@/lib/warmpawz-pay/map-discovery-provider-to-vendor-card-props';
import { launchWarmpawzPayServiceBooking } from '@/lib/commerce-switch-routing/launch-warmpawz-pay-service-booking';
import { shouldUseWapptDiscoveryFeed, shouldUseWapptPayVendorCardUi } from '@/lib/commerce-switch-routing';
import { pickCustomerVendorAccountId } from '@warmpawz/shared-types';
import { HomeServiceType } from './UniversalHomeServiceRouter';

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
  nextAvailableSlot?: string;
  consultationFee: number;
  price: number;
  isVerified: boolean;
  experience: number;
  serviceCount: number;
  previouslyUsed?: boolean;
}

function providerSubtitle(provider: Provider, fallback: string): string {
  const spec = provider.specializations?.find((s) => s.trim());
  return spec || fallback;
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
  const router = useRouter();

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
  const payVendorCardUi = shouldUseWapptPayVendorCardUi(category);
  const useWapptFeed = shouldUseWapptDiscoveryFeed(category);

  const feedEnabled = Boolean(userLocation);
  const marketplaceFeed = useDiscoverServicesFeed({
    phone,
    category,
    serviceStyle: 'at_home',
    // Walker hub: omit roleId so trainer_solo vendors with Dog Walker services still appear.
    roleId: serviceType === 'walker' ? undefined : config.roleId || category,
    enabled: feedEnabled && !useWapptFeed,
    pageSize: 3,
  });
  const wapptFeed = useWarmpawzAppointmentsByCategoryFeed({
    category,
    serviceStyle: 'at_home',
    enabled: feedEnabled && useWapptFeed,
    pageSize: 3,
  });
  const feedRows = useWapptFeed ? wapptFeed.vendors : marketplaceFeed.rows;
  const feedLoading = useWapptFeed ? wapptFeed.loading : marketplaceFeed.loading;
  const loadingMore = useWapptFeed ? wapptFeed.loadingMore : marketplaceFeed.loadingMore;
  const hasMore = useWapptFeed ? wapptFeed.hasMore : marketplaceFeed.hasMore;
  const loadMore = useWapptFeed ? wapptFeed.loadMore : marketplaceFeed.loadMore;

  const mapFeedRowToProvider = useCallback(
    (row: Record<string, unknown>): Provider => {
      const base = mapDiscoveryRowBaseFields(row);
      const canonicalId =
        pickCustomerVendorAccountId(row) || String(base.vendorId || base.providerId || '');
      return {
        id: canonicalId,
        vendorId: canonicalId,
        businessName: base.businessName || base.name,
        fullName: base.name,
        name: base.name,
        photo: base.photo || '',
        logo: base.photo || '',
        address:
          base.address || [base.city].filter(Boolean).join(', ') || 'Location not specified',
        phone: base.phone || '',
        distance: base.distance != null ? Number(base.distance) : 999,
        rating: Number(base.rating) || 0,
        reviewCount: base.reviewCount,
        specializations: base.specializations || [],
        amenities: [],
        nextAvailableSlot: base.nextAvailableSlot,
        consultationFee: base.priceMin ?? 0,
        price: base.priceMin ?? 199,
        isVerified: Boolean(base.isVerified),
        experience: base.experienceYears ?? 0,
        serviceCount: 1,
        previouslyUsed: false,
      };
    },
    []
  );

  // Get user location on mount (silent fallback when permission denied)
  useEffect(() => {
    const { getCurrentPositionSafe, DEFAULT_COORDS } = require('@/lib/geolocation-utils');
    getCurrentPositionSafe(
      (coords: { lat: number; lng: number }) => setUserLocation(coords),
      () => setUserLocation(DEFAULT_COORDS)
    );
  }, []);

  useEffect(() => {
    if (!feedEnabled) return;
    setProviders(feedRows.map(mapFeedRowToProvider));
    setLoading(feedLoading);
  }, [feedEnabled, feedRows, feedLoading, mapFeedRowToProvider]);

  // Apply filters whenever filter states change
  useEffect(() => {
    applyFilters();
  }, [providers, searchQuery, selectedProblems, maxDistance, minRating, sortBy, verifiedOnly]);

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
          filteredProviders.map((provider, index) => {
            const openProfile = (e: MouseEvent<HTMLButtonElement>) => {
              e.stopPropagation();
              onSelectProvider(provider);
            };
            const cardProps = mapDiscoveryProviderToVendorCardProps({
              provider: {
                name: provider.name,
                photo: provider.photo,
                isVerified: provider.isVerified,
                rating: provider.rating,
                reviewCount: provider.reviewCount,
                distance: provider.distance < 999 ? provider.distance : undefined,
                nextAvailableSlot: provider.nextAvailableSlot,
                experienceYears: provider.experience > 0 ? provider.experience : undefined,
                providerType: 'vendor',
              },
              subtitle: providerSubtitle(provider, config.displayName),
              address: provider.address,
              footerHint: provider.nextAvailableSlot
                ? `Next: ${provider.nextAvailableSlot}`
                : 'Tap to view profile & book',
              profileAriaLabel: `View profile: ${provider.name}`,
              verifiedAriaLabel: 'Verified provider',
              primaryActionClassName: 'text-orange-700 border-orange-300 hover:bg-orange-50',
              primaryLabel: onViewProviderServices ? 'View Services' : 'View Profile',
              onPrimary: (e) => {
                e.stopPropagation();
                if (onViewProviderServices) {
                  onViewProviderServices(provider);
                  return;
                }
                onSelectProvider(provider);
              },
              onProfileClick: openProfile,
              ...(payVendorCardUi
                ? {
                    secondaryLabel: 'Pay with Warmpawz',
                    onSecondary: (e: MouseEvent<HTMLButtonElement>) => {
                      e.stopPropagation();
                      const vendorId = String(provider.vendorId || provider.id || '').trim();
                      if (!vendorId) return;
                      launchWarmpawzPayServiceBooking({
                        router,
                        serviceKey: category,
                        category,
                        vendorId,
                      });
                    },
                  }
                : {}),
            });

            return (
              <motion.div
                key={provider.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <WarmpawzPayVendorCard
                  {...cardProps}
                  priceLabel={
                    provider.price > 0
                      ? `₹${provider.price}${config.priceUnit ? ` ${config.priceUnit}` : ''}`
                      : undefined
                  }
                />
              </motion.div>
            );
          })
        )}
        <DiscoveryVendorFeedSentinel
          hasMore={hasMore}
          loading={loading}
          loadingMore={loadingMore}
          onLoadMore={() => void loadMore()}
        />
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
