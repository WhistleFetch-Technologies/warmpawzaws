'use client';

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Search, Filter, Star, MapPin, Clock, ChevronRight,
  Video, Home, Building2, Shield, Award, GraduationCap, X, Sliders,
  Phone, Calendar, Heart, Share2, Users, Stethoscope, Scissors,
  AlertCircle, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { SponsoredProviderCard, TopProvidersSection } from './SponsoredProviderCard';
import { ServiceDashboardHeader } from './ServiceDashboardHeader';
import { formatPriceWithSymbol } from '@/lib/booking-display-utils';
import { StarRating } from './StarRating';

// ============================================================================
// TYPES
// ============================================================================

interface Service {
  id: string;
  serviceId: string;
  name: string;
  price: number;
  duration: number;
  description?: string;
  serviceStyle: string;
}

interface Provider {
  providerId: string;
  providerType: 'vendor' | 'staff' | 'individual';
  vendorId?: string;
  vendorName?: string;
  roleId?: string | null;
  businessName?: string;
  staffId?: string;
  name: string;
  photo?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  role?: string;
  roleName?: string;
  roleDisplayName?: string;
  roleIcon?: string | null;
  roleImage?: string | null;
  specialization?: string;
  qualifications?: string;
  degree?: string;
  experienceYears?: number;
  rating: number;
  reviewCount: number;
  distance?: number | null;
  isVerified?: boolean;
  isOnline?: boolean;
  nextAvailableSlot?: string;
  services: Service[];
  servicesOffered?: any[];
  // Phase 2 enrichment
  bestForProblem?: string;
  photos?: string[];
  priceMin?: number;
  priceMax?: number;
  hasPackages?: boolean;
}

interface Problem {
  id: string;
  name: string;
  icon?: string;
}

interface UniversalServiceProviderListProps {
  phone: string;
  category: 'vet' | 'grooming' | 'training' | 'walking' | 'boarding' | 'nutritionist';
  roleId: string; // 'veterinarian' | 'pet_groomer' | 'pet_trainer' | 'dog_walker'
  serviceStyle: 'tele' | 'at_home' | 'at_center';
  title?: string;
  subtitle?: string;
  specialization?: string; // Filter by problem/specialization ID
  problemId?: string; // Alias for specialization
  problemTitle?: string; // Phase 2: "Best for [problem]" badge — passed to discover-services/by-style
  problems?: Problem[]; // ✅ NEW: List of problems to show as quick filters
  showProblemFilter?: boolean; // ✅ NEW: Whether to show the problem filter strip
  previousProviderIds?: string[]; // Phase 2: Vendor IDs for "Used before" badge
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  onSelectProvider: (provider: Provider) => void;
}

// ============================================================================
// FILTER MODAL
// ============================================================================

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterState;
  onApply: (filters: FilterState) => void;
  specializations: string[];
}

interface FilterState {
  rating: number | null;
  experienceMin: number | null;
  maxDistance: number | null;
  specialization: string | null;
  sortBy: 'rating' | 'distance' | 'price' | 'experience' | 'availability';
}

function FilterModal({ isOpen, onClose, filters, onApply, specializations }: FilterModalProps) {
  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div
        className="bg-white w-full max-w-lg rounded-t-3xl max-h-[calc(80vh-3.5rem)] mb-14 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white p-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-bold">Filters</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Rating Filter */}
          <div>
            <h3 className="font-medium mb-3">Minimum Rating</h3>
            <div className="flex gap-2">
              {[null, 4.5, 4.0, 3.5, 3.0].map((rating) => (
                <button
                  key={rating ?? 'all'}
                  onClick={() => setLocalFilters(f => ({ ...f, rating }))}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${localFilters.rating === rating
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {rating ? `${rating}+ ⭐` : 'All'}
                </button>
              ))}
            </div>
          </div>

          {/* Experience Filter */}
          <div>
            <h3 className="font-medium mb-3">Minimum Experience</h3>
            <div className="flex gap-2 flex-wrap">
              {[null, 1, 3, 5, 10].map((years) => (
                <button
                  key={years ?? 'all'}
                  onClick={() => setLocalFilters(f => ({ ...f, experienceMin: years }))}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${localFilters.experienceMin === years
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {years ? `${years}+ years` : 'Any'}
                </button>
              ))}
            </div>
          </div>

          {/* Distance Filter */}
          <div>
            <h3 className="font-medium mb-3">Maximum Distance</h3>
            <div className="flex gap-2 flex-wrap">
              {[null, 5, 10, 20, 50].map((km) => (
                <button
                  key={km ?? 'all'}
                  onClick={() => setLocalFilters(f => ({ ...f, maxDistance: km }))}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${localFilters.maxDistance === km
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {km ? `${km} km` : 'Any'}
                </button>
              ))}
            </div>
          </div>

          {/* Specialization Filter */}
          {specializations.length > 0 && (
            <div>
              <h3 className="font-medium mb-3">Specialization</h3>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setLocalFilters(f => ({ ...f, specialization: null }))}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${localFilters.specialization === null
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  All
                </button>
                {specializations.map((spec) => (
                  <button
                    key={spec}
                    onClick={() => setLocalFilters(f => ({ ...f, specialization: spec }))}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition ${localFilters.specialization === spec
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                  >
                    {spec}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sort By */}
          <div>
            <h3 className="font-medium mb-3">Sort By</h3>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: 'rating', label: 'Rating' },
                { value: 'distance', label: 'Nearest' },
                { value: 'experience', label: 'Experience' },
                { value: 'availability', label: 'Availability' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setLocalFilters(f => ({ ...f, sortBy: option.value as any }))}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${localFilters.sortBy === option.value
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="sticky bottom-3 bg-white p-4 border-t flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              setLocalFilters({
                rating: null,
                experienceMin: null,
                maxDistance: null,
                specialization: null,
                sortBy: 'rating',
              });
            }}
          >
            Clear All
          </Button>
          <Button
            className="flex-1 bg-orange-500 hover:bg-orange-600"
            onClick={() => {
              onApply(localFilters);
              onClose();
            }}
          >
            Apply Filters
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PROVIDER CARD
// ============================================================================

interface ProviderCardProps {
  provider: Provider;
  serviceStyle: string;
  isPreviousProvider?: boolean;
  onClick: () => void;
}

function ProviderCard({ provider, serviceStyle, isPreviousProvider, onClick }: ProviderCardProps) {
  const getServiceStyleIcon = () => {
    switch (serviceStyle) {
      case 'tele': return <Video className="w-4 h-4" />;
      case 'at_home': return <Home className="w-4 h-4" />;
      case 'at_center': return <Building2 className="w-4 h-4" />;
      default: return null;
    }
  };

  const getServiceStyleLabel = () => {
    switch (serviceStyle) {
      case 'tele': return 'Video Consultation';
      case 'at_home': return 'Home Visit';
      case 'at_center': return 'Center Visit';
      default: return '';
    }
  };

  // Get price display: "Starts at ₹XX" from least service fee (sanitized, no NaN)
  const getPriceDisplay = () => {
    if (provider.priceMin != null && provider.priceMax != null && provider.priceMin !== provider.priceMax) {
      const min = Number(provider.priceMin) || 0;
      const max = Number(provider.priceMax) || 0;
      if (!Number.isNaN(min) && !Number.isNaN(max)) {
        return `${formatPriceWithSymbol(min)} – ${formatPriceWithSymbol(max)}`;
      }
    }
    const prices = provider.services?.length > 0
      ? provider.services.map(s => Number(s.price) || 0).filter(p => p > 0)
      : [];
    const lowestPrice = prices.length > 0 ? Math.min(...prices) : (Number((provider as any).price ?? (provider as any).consultationFee) || 0);
    return lowestPrice > 0 ? `Starts at ${formatPriceWithSymbol(lowestPrice)}` : null;
  };

  return (
    <Card
      className="p-4 cursor-pointer hover:shadow-lg transition-all border border-gray-100 bg-white"
      onClick={onClick}
    >
      <div className="flex gap-4">
        {/* Photo or Gallery (Phase 2) */}
        <div className="relative flex-shrink-0">
          <div className="w-20 h-20 rounded-xl overflow-hidden bg-gradient-to-br from-orange-100 to-amber-100">
            {provider.photos && provider.photos.length > 1 ? (
              <div className="flex h-full">
                {provider.photos.slice(0, 3).map((url, i) => (
                  <img key={i} src={url} alt="" className="w-1/3 h-full object-cover" />
                ))}
              </div>
            ) : provider.photo ? (
              <img
                src={provider.photo}
                alt={provider.name}
                className="w-full h-full object-cover"
              />
            ) : (

              <div>
                <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-orange-500">
                  {provider.name.charAt(0)}
                </div>

              </div>

            )}
          </div>
          {provider.isVerified && (
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
              <Shield className="w-3 h-3 text-white" />
            </div>
          )}
          {provider.isOnline && (
            <div className="absolute top-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-1">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-bold text-gray-900 truncate">{provider.name}</h3>
                {(provider.roleDisplayName || provider.role) && (
                  <div className="mt-0.5 text-xs">
                    <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                      {provider.roleDisplayName || provider.role}
                    </Badge>
                  </div>
                )}
              </div>

              {provider.businessName && provider.businessName !== provider.name && (
                <p className="text-xs text-gray-500 truncate">{provider.businessName}</p>
              )}

              {provider.qualifications && (
                <p className="text-xs text-gray-500 truncate">{provider.qualifications}</p>
              )}
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" />
          </div>

          {/* Best for [problem] and Used before (Phase 2) */}
          <div className="flex flex-wrap gap-1 mb-2">
            {provider.bestForProblem && (
              <Badge className="bg-orange-100 text-orange-700 text-xs">
                Best for {provider.bestForProblem}
              </Badge>
            )}
            {isPreviousProvider && (
              <Badge className="bg-green-100 text-green-700 text-xs">
                Used before
              </Badge>
            )}
            {provider.hasPackages && (
              <Badge className="bg-blue-100 text-blue-700 text-xs">
                Package available
              </Badge>
            )}
            {provider.specialization && !provider.bestForProblem && (
              <Badge className="bg-purple-100 text-purple-700 text-xs">
                {provider.specialization}
              </Badge>
            )}
          </div>

          {/* Stats Row */}
          <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
            <StarRating
              rating={provider.rating}
              reviewCount={provider.reviewCount}
              starsClassName="w-3 h-3"
              textClassName="text-xs text-gray-500"
            />
            {provider.experienceYears && (
              <div className="flex items-center gap-1">
                <Award className="w-3 h-3 text-gray-400" />
                <span>{provider.experienceYears}+ yrs</span>
              </div>
            )}
            {provider.distance != null && serviceStyle === 'at_center' && (
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-gray-400" />
                <span>{Number(provider.distance || 0).toFixed(1)} km</span>
              </div>
            )}
          </div>

          {/* Next Available */}
          {provider.nextAvailableSlot && (
            <div className="flex items-center gap-1 text-xs text-green-600 mb-2">
              <Clock className="w-3 h-3" />
              <span>Next: {provider.nextAvailableSlot}</span>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-gray-500">
              {getServiceStyleIcon()}
              <span>{getServiceStyleLabel()}</span>
            </div>
            {getPriceDisplay() && (
              <div className="text-right">
                <span className="font-bold text-orange-600">{getPriceDisplay()}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Clean provider name by removing trailing IDs, numbers, or unwanted suffixes
 * Examples:
 * - "Test Veterinary Clinic 1768333216818" → "Test Veterinary Clinic"
 * - "Clinic Name 12345" → "Clinic Name"
 * - "Provider Name" → "Provider Name" (no change)
 */
function cleanProviderName(name: string): string {
  if (!name) return 'Provider';

  // Remove trailing numbers/IDs (common pattern: name followed by long number)
  // Match: space followed by 10+ digits at the end
  const cleaned = name.replace(/\s+\d{10,}$/, '').trim();

  // Also remove any trailing UUID-like patterns (with or without dashes)
  const cleaned2 = cleaned.replace(/\s+[a-f0-9]{8,}(-[a-f0-9]{4,}){0,}$/i, '').trim();

  return cleaned2 || name || 'Provider';
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

// ✅ Default problems for different categories
const DEFAULT_PROBLEMS: Record<string, Problem[]> = {
  vet: [
    { id: 'vomiting', name: 'Vomiting', icon: '🤮' },
    { id: 'diarrhea', name: 'Diarrhea', icon: '💩' },
    { id: 'skin-issues', name: 'Skin Issues', icon: '🔴' },
    { id: 'not-eating', name: 'Not Eating', icon: '🍽️' },
    { id: 'limping', name: 'Limping', icon: '🦵' },
    { id: 'vaccination', name: 'Vaccination', icon: '💉' },
    { id: 'general-checkup', name: 'General Checkup', icon: '🩺' },
  ],
  nutritionist: [
    { id: 'weight-loss', name: 'Weight Loss', icon: '⚖️' },
    { id: 'weight-gain', name: 'Weight Gain', icon: '📈' },
    { id: 'allergies', name: 'Allergies', icon: '🤧' },
    { id: 'digestive', name: 'Digestive Issues', icon: '🥣' },
    { id: 'senior-diet', name: 'Senior Diet', icon: '👴' },
    { id: 'puppy-diet', name: 'Puppy Diet', icon: '🐕' },
  ],
  grooming: [
    { id: 'full-grooming', name: 'Full Grooming', icon: '✨' },
    { id: 'bath-only', name: 'Bath Only', icon: '🛁' },
    { id: 'nail-trim', name: 'Nail Trim', icon: '💅' },
    { id: 'hair-cut', name: 'Hair Cut', icon: '✂️' },
    { id: 'de-shedding', name: 'De-shedding', icon: '🧹' },
  ],
  training: [
    { id: 'basic-obedience', name: 'Basic Obedience', icon: '🎓' },
    { id: 'potty-training', name: 'Potty Training', icon: '🚽' },
    { id: 'aggression', name: 'Aggression', icon: '😠' },
    { id: 'anxiety', name: 'Anxiety', icon: '😰' },
    { id: 'leash-training', name: 'Leash Training', icon: '🦮' },
  ],
};

export function UniversalServiceProviderList({
  phone,
  category,
  roleId,
  serviceStyle,
  title,
  subtitle,
  specialization,
  problemId,
  problemTitle,
  problems,
  showProblemFilter = true,
  previousProviderIds = [],
  onBack,
  onNavigate,
  onSelectProvider,
}: UniversalServiceProviderListProps) {
  // Use problemId as alias for specialization if provided
  const specializationFilter = specialization || problemId;

  // ✅ NEW: Get problems for this category
  const categoryProblems = problems || DEFAULT_PROBLEMS[category] || [];
  const [selectedProblem, setSelectedProblem] = useState<string | null>(specializationFilter || null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [sponsoredProviders, setSponsoredProviders] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    rating: null,
    experienceMin: null,
    maxDistance: null,
    specialization: specializationFilter || null, // Pre-set specialization filter
    sortBy: 'rating',
  });

  // Extract unique specializations from providers
  const specializations = [...new Set(
    providers
      .map(p => p.specialization)
      .filter(Boolean)
  )] as string[];

  // Load providers on mount
  useEffect(() => {
    loadProviders();
    loadSponsoredProviders();
  }, [category, roleId, serviceStyle, specializationFilter, problemTitle]);

  // Load sponsored providers (ads)
  const loadSponsoredProviders = async () => {
    try {
      const res = await apiClient.get<any>(`/ads/sponsored-providers?category=${category}&serviceStyle=${serviceStyle}&limit=2`);
      if (res?.providers) {
        setSponsoredProviders(res.providers);
      }
    } catch (error) {
      // Silent fail - sponsored ads are not critical
      console.debug('Error loading sponsored providers:', error);
    }
  };

  const loadProviders = async () => {
    try {
      setLoading(true);

      // Get customer location for distance-based sorting
      let locationParams = '';
      try {
        const customerLat = localStorage.getItem('customer_latitude');
        const customerLng = localStorage.getItem('customer_longitude');
        if (customerLat && customerLng) {
          locationParams = `&latitude=${customerLat}&longitude=${customerLng}`;
        }
      } catch (e) {
        console.log('Could not get customer location');
      }

      // Build specialization filter param
      const specializationParam = specializationFilter
        ? `&specialization=${encodeURIComponent(specializationFilter)}`
        : '';
      const problemTitleParam = problemTitle
        ? `&problemTitle=${encodeURIComponent(problemTitle)}`
        : '';

      // Fetch providers for this service style and category
      const phoneParam = phone ? `&customerPhone=${encodeURIComponent(phone)}` : '';
      const response = await apiClient.get(
        `/customer/services/by-style?style=${serviceStyle}&category=${category}&roleId=${roleId}${locationParams}${specializationParam}${problemTitleParam}${phoneParam}`
      ) as any;

      if (response.success) {
        let providerData = response.providers || response.vendors || [];

        // ✅ FIX: Backend now correctly returns business/clinic vendors with at_home services
        // No need to filter them out - clinics can offer at_home services (e.g., vaccinations at home)

        // Clean provider names to remove trailing IDs and map nextAvailable to nextAvailableSlot
        const cleanedProviders = providerData.map((p: any) => ({
          ...p,
          isOnline: p.isOnline ?? p.is_online,
          name: cleanProviderName(p.name || p.vendorName || p.businessName || 'Provider'),
          vendorName: p.vendorName ? cleanProviderName(p.vendorName) : undefined,
          businessName: p.businessName ? cleanProviderName(p.businessName) : undefined,
          providerId: p.providerId || p.vendorId || p.id,
          vendorId: p.vendorId || p.id,
          // Normalize role fields for UI badges/subtitles
          role: p.role || p.roleDisplayName || p.roleName,
          roleDisplayName: p.roleDisplayName || p.roleName || p.role,
          roleName: p.roleName || p.role,
          roleId: p.roleId || p.role_id || null,
          roleIcon: p.roleIcon || null,
          roleImage: p.roleImage || null,
          // ✅ FIX: Map nextAvailable object to nextAvailableSlot string for display
          nextAvailableSlot: (() => {
            if (typeof p.nextAvailableSlot === 'string') return p.nextAvailableSlot;
            if (p.nextAvailableSlot && typeof p.nextAvailableSlot === 'object') {
              return p.nextAvailableSlot.formattedDisplay || p.nextAvailableSlot.display || undefined;
            }
            if (typeof p.nextAvailability === 'string') return p.nextAvailability;
            if (p.nextAvailable && typeof p.nextAvailable === 'object') {
              return p.nextAvailable.display || p.nextAvailable.formattedDisplay || undefined;
            }
            return undefined;
          })(),
        }));

        // Set providers from primary endpoint
        setProviders(cleanedProviders);
        console.log(`✅ Loaded ${cleanedProviders.length} providers for ${category}/${serviceStyle}`);
      } else {
        console.warn(`⚠️ Primary endpoint returned success=false or no providers for ${category}/${serviceStyle}`);
        setProviders([]);
      }
    } catch (error: any) {
      console.error('Error loading providers:', error);
      const errorMessage = error?.message || error?.response?.data?.error || 'Failed to load service providers. Please try again.';
      setError(errorMessage);
      toast.error('Failed to load service providers');
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort providers
  const filteredProviders = providers.filter(p => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = p.name.toLowerCase().includes(query);
      const matchesSpec = p.specialization?.toLowerCase().includes(query);
      const matchesCity = p.city?.toLowerCase().includes(query);
      if (!matchesName && !matchesSpec && !matchesCity) return false;
    }

    // Rating filter
    if (filters.rating && p.rating < filters.rating) return false;

    // Experience filter
    if (filters.experienceMin && (p.experienceYears || 0) < filters.experienceMin) return false;

    // Distance filter
    if (
      filters.maxDistance &&
      p.distance !== null &&
      p.distance !== undefined &&
      p.distance > filters.maxDistance
    ) return false;

    // Specialization filter
    if (filters.specialization && p.specialization !== filters.specialization) return false;

    return true;
  }).sort((a, b) => {
    const aPrice = a.services.length > 0 ? Math.min(...a.services.map(s => s.price)) : (a as any).price ?? (a as any).consultationFee ?? 999999;
    const bPrice = b.services.length > 0 ? Math.min(...b.services.map(s => s.price)) : (b as any).price ?? (b as any).consultationFee ?? 999999;
    switch (filters.sortBy) {
      case 'rating':
        return b.rating - a.rating;
      case 'distance':
        return (a.distance || 999) - (b.distance || 999);
      case 'price':
        return aPrice - bPrice;
      case 'experience':
        return (b.experienceYears || 0) - (a.experienceYears || 0);
      case 'availability':
        if (a.nextAvailableSlot && !b.nextAvailableSlot) return -1;
        if (!a.nextAvailableSlot && b.nextAvailableSlot) return 1;
        return 0;
      default:
        return 0;
    }
  });

  // Get service style config
  const getStyleConfig = (): { icon: typeof Video; color: string; bgGradient: string; label: string } => {
    if (serviceStyle === 'tele') {
      return { icon: Video, color: 'blue', bgGradient: 'from-blue-500 to-indigo-600', label: 'Tele Consultation' };
    }
    if (serviceStyle === 'at_home') {
      return { icon: Home, color: 'orange', bgGradient: 'from-orange-500 to-amber-500', label: 'Home Visit' };
    }
    if (serviceStyle === 'at_center') {
      return { icon: Building2, color: 'green', bgGradient: 'from-green-500 to-emerald-600', label: 'Center Visit' };
    }
    return { icon: Users, color: 'gray', bgGradient: 'from-gray-500 to-gray-600', label: 'Services' };
  };

  const styleConfig = getStyleConfig();
  const StyleIcon = styleConfig.icon;

  // Active filters count
  const activeFiltersCount = [
    filters.rating,
    filters.experienceMin,
    filters.maxDistance,
    filters.specialization,
  ].filter(Boolean).length;

  // ✅ FIX: Get icon based on category
  const getCategoryIcon = () => {
    switch (category) {
      case 'vet': return Stethoscope;
      case 'grooming': return Scissors;
      case 'training': return GraduationCap;
      default: return StyleIcon;
    }
  };
  const CategoryIcon = getCategoryIcon();

  // ✅ FIX: Prepare stats for ServiceDashboardHeader
  const dashboardStats = [
    { value: `${filteredProviders.length}+`, label: category === 'vet' ? 'Vets' : 'Providers', icon: <CategoryIcon className="w-4 h-4" /> },
    { value: '1K+', label: 'Bookings' },
    { value: '4.8', label: 'Rating', icon: <Star className="w-4 h-4 fill-white" /> }
  ];

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      {/*HEADER SECTION*/}
      <ServiceDashboardHeader
        serviceName={title || styleConfig.label}
        serviceSubtitle={subtitle}
        serviceIcon={getCategoryIcon()}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-[#FF8C42]"
      />

      {/*MAIN CONTENT SECTION*/}
      <div className="px-4 pt-2 pb-8">
        {/*FILTER SECTION STARTS*/}
        {showProblemFilter && categoryProblems.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">What's the concern?</p>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
              <button
                onClick={() => {
                  setSelectedProblem(null);
                  setFilters(data => ({ ...data, specialization: null }));
                }}
                className={`flex-shrink-0 px-3 py-2 rounded-full text-sm font-medium transition-all ${!selectedProblem
                  ? 'bg-[#FF8C42] text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                All
              </button>
              {categoryProblems.map((problem) => (
                <button
                  key={problem.id}
                  onClick={() => {
                    setSelectedProblem(problem.id);
                    setFilters(f => ({ ...f, specialization: problem.name }));
                  }}
                  className={`flex-shrink-0 px-3 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${selectedProblem === problem.id
                    ? 'bg-[#FF8C42] text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {problem.icon && <span>{problem.icon}</span>}
                  {problem.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {/*FILTER SECTION ENDS*/}

        {/*SEARCH BAR SECTION STARTS*/}
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, specialization, city..."
            className="w-full pl-12 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent text-slate-900 placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          )}
        </div>
        {/*SEARCH BAR SECTION ENDS*/}

        {/* Filters Row */}
        <div className="mb-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(true)}
              className={`flex-shrink-0 gap-2 ${activeFiltersCount > 0 ? 'border-orange-500 text-orange-600' : ''}`}
            >
              <Sliders className="w-4 h-4" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge className="bg-orange-500 text-white text-xs px-1.5">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>

            {/* Quick Filter Chips */}
            {['Top Rated', 'Nearest', 'Available Now'].map((chip) => (
              <button
                key={chip}
                onClick={() => {
                  if (chip === 'Top Rated') setFilters(f => ({ ...f, sortBy: 'rating', rating: 4.5 }));
                  if (chip === 'Nearest') setFilters(f => ({ ...f, sortBy: 'distance' }));
                  if (chip === 'Available Now') setFilters(f => ({ ...f, sortBy: 'availability' }));
                }}
                className="flex-shrink-0 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:border-orange-300"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* Results Count */}
        <p className="text-sm text-slate-500 mb-4">
          {loading ? 'Loading...' : `${filteredProviders.length} ${filteredProviders.length === 1 ? 'provider' : 'providers'} found`}
        </p>

        {/* Provider List */}
        <div className="mt-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-slate-500">Finding service providers...</p>
            </div>
          ) : error ? (
            // ✅ FIX: Show error state with retry button
            <div className="flex flex-col items-center justify-center py-20 px-4">
              <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Failed to Load Providers</h3>
              <p className="text-sm text-gray-600 text-center mb-4">{error}</p>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setError(null);
                    loadProviders();
                  }}
                  className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
                <Button
                  variant="outline"
                  onClick={onBack}
                  className="border-gray-300"
                >
                  Go Back
                </Button>
              </div>
            </div>
          ) : filteredProviders.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <StyleIcon className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">No Providers Found</h3>
              <p className="text-slate-500 text-sm mb-4">
                {searchQuery
                  ? `No results for "${searchQuery}"`
                  : 'No service providers available in your area for this service type.'
                }
              </p>
              {(searchQuery || activeFiltersCount > 0) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearchQuery('');
                    setFilters({
                      rating: null,
                      experienceMin: null,
                      maxDistance: null,
                      specialization: null,
                      sortBy: 'rating',
                    });
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* 🎯 Sponsored Providers at Top */}
              {sponsoredProviders.length > 0 && (
                <div className="mb-4">
                  {sponsoredProviders.map((sp, idx) => (
                    <div key={sp.id || idx} className="mb-2">
                      <SponsoredProviderCard
                        provider={sp}
                        category={category}
                        position={idx}
                        variant={idx === 0 ? 'banner' : 'card'}
                        onClick={(provider) => {
                          onSelectProvider({
                            providerId: provider.vendorId,
                            providerType: 'vendor',
                            vendorId: provider.vendorId,
                            name: provider.name,
                            businessName: provider.businessName,
                            photo: provider.photo,
                            rating: provider.rating,
                            reviewCount: provider.reviewCount,
                            specialization: provider.specialization,
                            isVerified: provider.isVerified,
                            experienceYears: 0,
                            services: [],
                          });
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* 🌟 Top Rated Section (Non-Sponsored) */}
              {!searchQuery && filteredProviders.length > 5 && (
                <div className="mb-4">
                  <TopProvidersSection
                    category={category}
                    serviceStyle={serviceStyle}
                    limit={5}
                    onSelectProvider={(provider) => {
                      onSelectProvider({
                        providerId: provider.providerId,
                        providerType: 'vendor',
                        vendorId: provider.vendorId,
                        name: provider.name,
                        businessName: provider.businessName,
                        photo: provider.photo,
                        rating: provider.rating,
                        reviewCount: provider.reviewCount,
                        specialization: provider.specialization,
                        isVerified: provider.isVerified,
                        experienceYears: 0,
                        services: [],
                      });
                    }}
                  />
                </div>
              )}

              {/* Regular Provider List */}
              {filteredProviders.map((provider) => (
                <ProviderCard
                  key={provider.providerId}
                  provider={provider}
                  serviceStyle={serviceStyle}
                  isPreviousProvider={previousProviderIds.some(id => id === (provider.vendorId || provider.providerId))}
                  onClick={() => onSelectProvider(provider)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filter Modal */}
      <FilterModal
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onApply={setFilters}
        specializations={specializations}
      />
    </div>
  );
}

export default UniversalServiceProviderList;
