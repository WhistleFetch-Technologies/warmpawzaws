'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star, MapPin, Building2, Home, ChevronRight, Search, Loader2, Shield, SlidersHorizontal, X, Video, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
// Simple debounce implementation
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), wait);
  };
}

interface VendorListingByStyleProps {
  phone: string;
  serviceStyle: string; // 'at_home', 'at_center', 'tele'
  serviceTypeName?: string;
  category?: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

interface Vendor {
  id: string;
  name: string;
  type: 'vendor' | 'staff' | 'individual';
  rating: number;
  reviewCount: number;
  distance?: number | null;
  city?: string;
  address?: string;
  photo?: string;
  isVerified?: boolean;
  experienceYears?: number;
  qualifications?: string;
  vendorId?: string;
  vendorName?: string;
  specialization?: string;
  nextAvailable?: string;
  price?: number;
}

type FilterType = 'relevance' | 'rating' | 'distance' | 'price';
type DistanceRange = 'all' | '5' | '10' | '20' | '50';

export function VendorListingByStyle({ 
  phone, 
  serviceStyle, 
  serviceTypeName,
  category = 'grooming',
  onBack, 
  onNavigate 
}: VendorListingByStyleProps) {
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('relevance');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [distanceRange, setDistanceRange] = useState<DistanceRange>('all');
  const [minRating, setMinRating] = useState<number>(0);
  const [customerLocation, setCustomerLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Get customer location on mount
  useEffect(() => {
    try {
      const customerLat = localStorage.getItem('customer_latitude');
      const customerLng = localStorage.getItem('customer_longitude');
      if (customerLat && customerLng) {
        setCustomerLocation({ lat: parseFloat(customerLat), lng: parseFloat(customerLng) });
      }
    } catch (e) {
      console.log('Could not get customer location');
    }
  }, []);

  useEffect(() => {
    loadVendors();
  }, [serviceStyle, distanceRange, minRating]);

  // Debounced search using OpenSearch
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        loadVendors();
        return;
      }
      
      setIsSearching(true);
      try {
        // Try OpenSearch first
        const searchParams = new URLSearchParams({
          q: query,
          category: category,
          ...(customerLocation && { 
            latitude: customerLocation.lat.toString(),
            longitude: customerLocation.lng.toString() 
          }),
          ...(distanceRange !== 'all' && { distance: distanceRange }),
        });
        
        const response = await apiClient.get(`/search?${searchParams}`) as any;
        
        if (response.success || response.vendors) {
          const searchVendors = (response.vendors || []).map((v: any) => ({
            id: v.id,
            name: v.businessName || v.name,
            type: 'vendor' as const,
            rating: v.rating || 4.5,
            reviewCount: v.completedBookings || 0,
            distance: v.distance_km || null,
            city: v.city,
            isVerified: true,
            specialization: v.specialization,
          }));
          setVendors(searchVendors);
        }
      } catch (error) {
        console.warn('OpenSearch failed, using local filter:', error);
        // Fallback to local filtering
        loadVendors(query);
      } finally {
        setIsSearching(false);
      }
    }, 300),
    [category, customerLocation, distanceRange]
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    debouncedSearch(query);
  };

  const loadVendors = async (searchFilter?: string) => {
    try {
      setLoading(true);
      
      let locationParams = '';
      if (customerLocation) {
        locationParams = `&latitude=${customerLocation.lat}&longitude=${customerLocation.lng}`;
        if (distanceRange !== 'all') {
          locationParams += `&maxDistance=${distanceRange}`;
        }
      }
      
      const phoneParam = phone ? `&customerPhone=${encodeURIComponent(phone)}` : '';
      const response = await apiClient.get(
        `/customer/services/by-style?style=${serviceStyle}&category=${category}${locationParams}${phoneParam}`
      ) as any;

      if (response.success) {
        let providerData = response.providers || response.vendors || [];
        
        const vendorMap = new Map<string, Vendor>();
        
        providerData.forEach((item: any) => {
          const vendorId = item.providerId || item.vendorId || item.id;
          const providerType = item.providerType || 'vendor';
          
          if (!vendorMap.has(vendorId)) {
            vendorMap.set(vendorId, {
              id: vendorId,
              name: item.name || item.vendorName || item.businessName || 'Service Provider',
              type: providerType,
              rating: parseFloat(item.rating || '4.5'),
              reviewCount: parseInt(item.reviewCount || item.reviewsCount || '0', 10),
              distance: item.distance || null,
              city: item.city,
              address: item.address,
              photo: item.photo,
              isVerified: item.isVerified,
              experienceYears: item.experienceYears,
              qualifications: item.qualifications,
              vendorId: item.vendorId,
              vendorName: item.vendorName,
              specialization: item.specialization,
              nextAvailable: item.nextAvailable,
              price: item.price,
            });
          }
        });
        
        let vendorsList = Array.from(vendorMap.values());
        
        // Apply local filters
        if (searchFilter) {
          const lowerSearch = searchFilter.toLowerCase();
          vendorsList = vendorsList.filter(v => 
            v.name.toLowerCase().includes(lowerSearch) ||
            v.city?.toLowerCase().includes(lowerSearch) ||
            v.specialization?.toLowerCase().includes(lowerSearch)
          );
        }
        
        if (minRating > 0) {
          vendorsList = vendorsList.filter(v => v.rating >= minRating);
        }
        
        if (distanceRange !== 'all' && customerLocation) {
          const maxDist = parseInt(distanceRange);
          vendorsList = vendorsList.filter(v => 
            v.distance === null || v.distance === undefined || v.distance <= maxDist
          );
        }
        
        setVendors(vendorsList);
        console.log(`✅ [VendorListingByStyle] Loaded ${vendorsList.length} vendors for ${serviceStyle}`);
      } else {
        console.warn(`⚠️ [VendorListingByStyle] Primary endpoint returned success=false or no vendors`);
          setVendors([]);
      }
    } catch (error) {
      console.error('❌ [VendorListingByStyle] Error:', error);
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  const getStyleIcon = () => {
    switch (serviceStyle) {
      case 'at_home': return <Home className="w-5 h-5" />;
      case 'at_center': return <Building2 className="w-5 h-5" />;
      case 'tele': return <Video className="w-5 h-5" />;
      default: return <Building2 className="w-5 h-5" />;
    }
  };

  const getStyleLabel = () => {
    switch (serviceStyle) {
      case 'at_home': return 'Home Visit';
      case 'at_center': return 'At Center';
      case 'tele': return 'Tele Consultation';
      default: return serviceTypeName || 'Services';
    }
  };

  const handleViewVendor = (vendor: Vendor) => {
    onNavigate('grooming-vendor-profile', {
      vendorId: vendor.id,
      vendorType: vendor.type,
      serviceStyle,
      category,
      vendorName: vendor.name,
      vendorData: vendor
    });
  };

  const sortedVendors = [...vendors].sort((a, b) => {
    switch (selectedFilter) {
      case 'rating':
        return b.rating - a.rating;
      case 'distance':
        if (a.distance === null || a.distance === undefined) return 1;
        if (b.distance === null || b.distance === undefined) return -1;
        return a.distance - b.distance;
      case 'price':
        if (!a.price) return 1;
        if (!b.price) return -1;
        return a.price - b.price;
      case 'relevance':
      default:
        // Relevance: combination of rating and reviews
        const scoreA = (a.rating * 10) + (a.reviewCount * 0.1);
        const scoreB = (b.rating * 10) + (b.reviewCount * 0.1);
        return scoreB - scoreA;
    }
  });

  const activeFiltersCount = (distanceRange !== 'all' ? 1 : 0) + (minRating > 0 ? 1 : 0);

  if (loading && !isSearching) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#FF8C42] mx-auto mb-3" />
          <p className="text-gray-600">Finding providers...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header is provided by renderScreenWithLayout wrapper (StandardizedHeader) */}
      
      {/* Info section */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 bg-orange-100 rounded-2xl flex items-center justify-center">
            {getStyleIcon()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{getStyleLabel()}</h1>
            <p className="text-gray-600 text-sm">
              {vendors.length} provider{vendors.length !== 1 ? 's' : ''} available
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search by name, specialty, location..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-12 py-3 bg-white/95 backdrop-blur-sm rounded-xl border-0 focus:outline-none focus:ring-2 focus:ring-white/50 text-gray-900 placeholder-gray-500"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#FF8C42] animate-spin" />
          )}
        </div>
      </div>

      <div className="px-4 pb-24">
        {/* Filter Pills */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors border ${
              activeFiltersCount > 0
                ? 'bg-[#FF8C42] text-white border-[#FF8C42]'
                : 'bg-white text-gray-700 border-gray-200'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFiltersCount > 0 && (
              <span className="w-5 h-5 bg-white text-[#FF8C42] rounded-full text-xs flex items-center justify-center font-bold">
                {activeFiltersCount}
              </span>
            )}
          </button>
          
          {[
            { id: 'relevance' as FilterType, label: 'Relevance', icon: TrendingUp },
            { id: 'rating' as FilterType, label: 'Top Rated', icon: Star },
            { id: 'distance' as FilterType, label: 'Nearest', icon: MapPin },
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setSelectedFilter(filter.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors border ${
                selectedFilter === filter.id
                  ? 'bg-[#FF8C42] text-white border-[#FF8C42]'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#FF8C42]'
              }`}
            >
              <filter.icon className="w-3.5 h-3.5" />
              {filter.label}
            </button>
          ))}
        </div>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <Card className="p-4 mb-4 bg-orange-50 border-orange-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Advanced Filters</h3>
              <button 
                onClick={() => setShowFilters(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Distance Filter - show for at_center and at_home */}
            {(serviceStyle === 'at_center' || serviceStyle === 'at_home') && customerLocation && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Distance
                </label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { id: 'all' as DistanceRange, label: 'Any' },
                    { id: '5' as DistanceRange, label: '5 km' },
                    { id: '10' as DistanceRange, label: '10 km' },
                    { id: '20' as DistanceRange, label: '20 km' },
                    { id: '50' as DistanceRange, label: '50 km' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      onClick={() => setDistanceRange(option.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        distanceRange === option.id
                          ? 'bg-[#FF8C42] text-white'
                          : 'bg-white text-gray-600 border border-gray-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Rating Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Rating
              </label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: 0, label: 'All' },
                  { value: 3, label: '3+ ⭐' },
                  { value: 4, label: '4+ ⭐' },
                  { value: 4.5, label: '4.5+ ⭐' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setMinRating(option.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      minRating === option.value
                        ? 'bg-[#FF8C42] text-white'
                        : 'bg-white text-gray-600 border border-gray-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear Filters */}
            {activeFiltersCount > 0 && (
              <button
                onClick={() => {
                  setDistanceRange('all');
                  setMinRating(0);
                }}
                className="mt-4 text-sm text-[#FF8C42] font-medium hover:underline"
              >
                Clear all filters
              </button>
            )}
          </Card>
        )}

        {/* Vendor List */}
        {sortedVendors.length === 0 ? (
          <Card className="p-8 text-center bg-white border border-gray-100">
            <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
              {getStyleIcon()}
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">No Providers Found</h3>
            <p className="text-gray-500 text-sm mb-4">
              {searchQuery 
                ? `No results for "${searchQuery}"`
                : `No providers available for ${getStyleLabel()}`}
            </p>
            {(searchQuery || activeFiltersCount > 0) && (
              <Button 
                onClick={() => {
                  setSearchQuery('');
                  setDistanceRange('all');
                  setMinRating(0);
                  loadVendors();
                }} 
                variant="outline"
                className="border-[#FF8C42] text-[#FF8C42] hover:bg-orange-50"
              >
                Clear Filters
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {sortedVendors.map((vendor) => (
              <Card
                key={vendor.id}
                className="p-4 cursor-pointer hover:shadow-lg transition-all bg-white border border-gray-100 hover:border-[#FF8C42]/30"
                onClick={() => handleViewVendor(vendor)}
              >
                <div className="flex items-start gap-3">
                  {vendor.photo ? (
                    <img 
                      src={vendor.photo} 
                      alt={vendor.name}
                      className="w-16 h-16 rounded-xl object-cover border-2 border-[#FF8C42]"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gradient-to-br from-[#FF8C42] to-[#FF6B35] rounded-xl flex items-center justify-center text-white font-bold text-xl">
                      {vendor.name.charAt(0)}
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">{vendor.name}</h3>
                      {vendor.isVerified && (
                        <Shield className="w-4 h-4 text-green-500 flex-shrink-0" />
                      )}
                    </div>
                    
                    {vendor.type === 'staff' && vendor.vendorName && (
                      <p className="text-xs text-gray-500 mb-1">From {vendor.vendorName}</p>
                    )}
                    
                    {vendor.specialization && (
                      <p className="text-xs text-[#FF8C42] font-medium mb-1">{vendor.specialization}</p>
                    )}
                    
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium">{vendor.rating.toFixed(1)}</span>
                        <span className="text-gray-400">({vendor.reviewCount})</span>
                      </div>
                      
                      {vendor.distance !== null && vendor.distance !== undefined && (
                        <>
                          <span className="text-gray-300">•</span>
                          <div className="flex items-center gap-1 text-[#FF8C42] font-medium text-xs">
                            <MapPin className="w-3 h-3" />
                            {vendor.distance.toFixed(1)} km
                          </div>
                        </>
                      )}
                      
                      {vendor.city && !vendor.distance && (
                        <>
                          <span className="text-gray-300">•</span>
                          <span className="text-gray-500 text-xs">{vendor.city}</span>
                        </>
                      )}
                    </div>
                    
                    {vendor.experienceYears && vendor.type !== 'vendor' && (
                      <div className="text-xs text-gray-500 mt-1">
                        {vendor.experienceYears} years experience
                      </div>
                    )}

                    {vendor.price && (
                      <div className="text-sm font-bold text-[#FF8C42] mt-1">
                        From ₹{vendor.price}
                      </div>
                    )}
                  </div>
                  
                  <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
