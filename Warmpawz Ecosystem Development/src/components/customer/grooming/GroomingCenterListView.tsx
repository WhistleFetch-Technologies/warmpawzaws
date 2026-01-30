import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import {
  ArrowLeft,
  Search,
  SlidersHorizontal,
  MapPin,
  Star,
  Navigation,
  Scissors,
  Home,
  CalendarDays,
  ShoppingBag,
  User
} from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../../ui/sheet';
import { Card } from '../../ui/card';
import { toast } from 'sonner@2.0.3';

interface GroomingCenterListViewProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

interface GroomingCenterData {
  id: string;
  name: string;
  businessName: string;
  address: string;
  rating: number;
  reviews: number;
  distance: number;
  photos: string[];
  specialties: string[];
  groomers: number;
  openNow: boolean;
  operatingHours: string;
  isPremium: boolean;
  serviceCount: number;
  // ✅ NEW: Amenities for preview display
  amenities?: string[];
  petTypes?: string[];
}

export function GroomingCenterListView({ phone, onBack, onNavigate }: GroomingCenterListViewProps) {
  const [loading, setLoading] = useState(true);
  const [centers, setCenters] = useState<GroomingCenterData[]>([]);
  const [filteredCenters, setFilteredCenters] = useState<GroomingCenterData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter states
  const [maxDistance, setMaxDistance] = useState<number>(10);
  const [minRating, setMinRating] = useState<number>(0);
  const [premiumOnly, setPremiumOnly] = useState(false);
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'reviews'>('distance');

  const API_BASE = getApiBaseUrl();

  useEffect(() => {
    loadGroomingCenters();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [centers, searchQuery, maxDistance, minRating, premiumOnly, openNowOnly, sortBy]);

  const loadGroomingCenters = async () => {
    try {
      setLoading(true);
      
      // ✅ USE UNIVERSAL SEARCH API - Returns CENTERS for at_center services
      const response = await fetch(
        `${API_BASE}/universal/search?serviceCategory=grooming_services&serviceStyle=at_center&limit=50`,
        {
          headers: {
            ...getAuthHeaders()
          }
        }
      );

      console.log('📍 [GROOMING-LIST] Loading grooming centers from universal search API');

      if (response.ok) {
        const data = await response.json();
        console.log('📦 [GROOMING-LIST] Search response:', data);
        console.log('📦 [GROOMING-LIST] Result type:', data.resultType);
        
        if (data.success && data.results) {
          // ✅ FIXED: Universal search now returns CENTER objects directly for at_center
          const centersList = data.results.map((center: any) => ({
            id: center.id || center.vendorId,
            name: center.name || center.businessName || 'Grooming Center',
            businessName: center.businessName || center.name,
            address: center.address || 'Address not provided',
            city: center.city || '',
            phone: center.phone || '',
            rating: center.rating || 0,
            reviews: center.reviewCount || 0,
            distance: Math.random() * 8 + 0.5, // TODO: Calculate real distance based on location
            photos: center.photo ? [center.photo] : [],
            specialties: ['Professional Grooming', 'Bath & Spa', 'Styling'],
            groomers: center.staffCount || 0,
            staff: center.staff || [],
            openNow: center.isAvailableToday || true,
            operatingHours: 'Mon-Sat: 9AM-7PM', // TODO: Get from vendor data
            isPremium: false,
            serviceCount: center.serviceCount || 0
          }));
          
          console.log(`✅ [GROOMING-LIST] Found ${centersList.length} unique grooming centers`);
          setCenters(centersList);
        } else {
          console.error('❌ [GROOMING-LIST] No results or API error:', data.error);
          setCenters([]);
        }
      } else {
        console.error('❌ [GROOMING-LIST] HTTP error:', response.status);
        setCenters([]);
      }
    } catch (error) {
      console.error('❌ [GROOMING-LIST] Exception:', error);
      toast.error('Failed to load grooming centers');
      setCenters([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...centers];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(center =>
        center.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        center.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        center.specialties.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Distance filter
    filtered = filtered.filter(center => center.distance <= maxDistance);

    // Rating filter
    if (minRating > 0) {
      filtered = filtered.filter(center => center.rating >= minRating);
    }

    // Premium filter
    if (premiumOnly) {
      filtered = filtered.filter(center => center.isPremium);
    }

    // Open now filter
    if (openNowOnly) {
      filtered = filtered.filter(center => center.openNow);
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'distance') return a.distance - b.distance;
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'reviews') return b.reviews - a.reviews;
      return 0;
    });

    setFilteredCenters(filtered);
  };

  const clearFilters = () => {
    setMaxDistance(10);
    setMinRating(0);
    setPremiumOnly(false);
    setOpenNowOnly(false);
    setSortBy('distance');
    setSearchQuery('');
  };

  const activeFiltersCount = 
    (maxDistance < 10 ? 1 : 0) +
    (minRating > 0 ? 1 : 0) +
    (premiumOnly ? 1 : 0) +
    (openNowOnly ? 1 : 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Finding nearby grooming centers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FF8C42] max-w-md mx-auto">
      {/* Header */}
      <div className="bg-[#FF8C42] text-white px-6 pt-12 pb-8 sticky top-0 z-10">
        <button onClick={onBack} className="mb-4 flex items-center gap-2">
          <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </div>
        </button>
        
        <h1 className="text-2xl font-bold mb-1 text-white">Nearby Grooming Centers</h1>
        <p className="text-white/80 text-sm mb-6">
          {filteredCenters.length} center{filteredCenters.length !== 1 ? 's' : ''} found
        </p>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/60" />
          <Input
            placeholder="Search by name, area, or service..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 pr-4 h-12 bg-white/20 border-white/20 text-white placeholder:text-white/60 rounded-xl focus:bg-white/30 transition-all"
          />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-t-[32px] border-b border-gray-100 px-6 py-4 -mt-4 sticky top-[180px] z-10 flex items-center gap-2 overflow-x-auto scrollbar-hide">
        <Button
          onClick={() => setShowFilters(true)}
          variant="outline"
          className="flex-shrink-0 border-gray-200 h-9 rounded-lg"
        >
          <SlidersHorizontal className="w-4 h-4 mr-2" />
          Filters
          {activeFiltersCount > 0 && (
            <Badge className="ml-2 bg-[#FF8C42] text-white px-1.5 py-0 h-5 text-xs">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>

        {/* Quick Filters */}
        <Button
          onClick={() => setSortBy('distance')}
          variant={sortBy === 'distance' ? 'default' : 'outline'}
          className={`flex-shrink-0 h-9 text-xs rounded-lg ${
            sortBy === 'distance' ? 'bg-[#FF8C42] text-white hover:bg-[#FF7029]' : 'border-gray-200'
          }`}
        >
          <Navigation className="w-3 h-3 mr-1" />
          Nearest
        </Button>

        <Button
          onClick={() => setSortBy('rating')}
          variant={sortBy === 'rating' ? 'default' : 'outline'}
          className={`flex-shrink-0 h-9 text-xs rounded-lg ${
            sortBy === 'rating' ? 'bg-[#FF8C42] text-white hover:bg-[#FF7029]' : 'border-gray-200'
          }`}
        >
          <Star className="w-3 h-3 mr-1" />
          Top Rated
        </Button>

        <Button
          onClick={() => setOpenNowOnly(!openNowOnly)}
          variant={openNowOnly ? 'default' : 'outline'}
          className={`flex-shrink-0 h-9 text-xs rounded-lg ${
            openNowOnly ? 'bg-[#FF8C42] text-white hover:bg-[#FF7029]' : 'border-gray-200'
          }`}
        >
          Open Now
        </Button>
      </div>

      {/* Centers List */}
      <div className="bg-white px-6 pt-2 pb-24 min-h-[calc(100vh-280px)]">
        {filteredCenters.length === 0 ? (
          <div className="text-center py-12">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-900 mb-2">No grooming centers found</h3>
            <p className="text-sm text-gray-500 mb-4">
              Try adjusting your filters or search criteria
            </p>
            <Button onClick={clearFilters} variant="outline">
              Clear Filters
            </Button>
          </div>
        ) : (
          filteredCenters.map((center) => (
            <GroomingCenterCard
              key={center.id}
              center={center}
              onClick={() => onNavigate('center-details', center)}
            />
          ))
        )}
      </div>

      {/* ✅ Fixed Bottom Navigation - Design Consistency */}
      <div className="fixed bottom-0 left-0 right-0 z-40 max-w-md mx-auto">
        <div className="bg-white border-t border-gray-100 shadow-lg px-2 py-2">
          <div className="flex items-center justify-around">
            <button
              onClick={() => onNavigate('home')}
              className="flex flex-col items-center gap-1 p-2 text-gray-400 hover:text-[#FF8C42] transition-colors"
            >
              <Home className="w-5 h-5" />
              <span className="text-[10px]">Home</span>
            </button>
            
            <button
              className="flex flex-col items-center gap-1 p-2 text-[#FF8C42]"
            >
              <Search className="w-5 h-5" />
              <span className="text-[10px] font-medium">Search</span>
            </button>
            
            <button
              onClick={() => onNavigate('my-bookings')}
              className="flex flex-col items-center gap-1 p-2 text-gray-400 hover:text-[#FF8C42] transition-colors"
            >
              <CalendarDays className="w-5 h-5" />
              <span className="text-[10px]">Bookings</span>
            </button>
            
            <button
              onClick={() => onNavigate('shop')}
              className="flex flex-col items-center gap-1 p-2 text-gray-400 hover:text-[#FF8C42] transition-colors"
            >
              <ShoppingBag className="w-5 h-5" />
              <span className="text-[10px]">Shop</span>
            </button>
            
            <button
              onClick={() => onNavigate('customer-profile')}
              className="flex flex-col items-center gap-1 p-2 text-gray-400 hover:text-[#FF8C42] transition-colors"
            >
              <User className="w-5 h-5" />
              <span className="text-[10px]">Profile</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters Sheet */}
      <Sheet open={showFilters} onOpenChange={setShowFilters}>
        <SheetContent side="bottom" className="max-w-[430px] mx-auto">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>Refine your grooming center search</SheetDescription>
          </SheetHeader>
          
          <div className="py-6 space-y-6">
            {/* Distance Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Maximum Distance: {maxDistance} km
              </label>
              <input
                type="range"
                min="1"
                max="20"
                value={maxDistance}
                onChange={(e) => setMaxDistance(Number(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Rating Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Minimum Rating
              </label>
              <div className="flex gap-2">
                {[0, 3, 4, 4.5].map((rating) => (
                  <Button
                    key={rating}
                    onClick={() => setMinRating(rating)}
                    variant={minRating === rating ? 'default' : 'outline'}
                    size="sm"
                    className={minRating === rating ? 'bg-[#FF8C42]' : ''}
                  >
                    {rating === 0 ? 'Any' : `${rating}+ ⭐`}
                  </Button>
                ))}
              </div>
            </div>

            {/* Special Filters */}
            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={premiumOnly}
                  onChange={(e) => setPremiumOnly(e.target.checked)}
                  className="w-4 h-4 text-[#FF8C42] rounded"
                />
                <span className="text-sm">Premium centers only</span>
              </label>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={openNowOnly}
                  onChange={(e) => setOpenNowOnly(e.target.checked)}
                  className="w-4 h-4 text-[#FF8C42] rounded"
                />
                <span className="text-sm">Open now</span>
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={clearFilters}
                variant="outline"
                className="flex-1"
              >
                Clear All
              </Button>
              <Button
                onClick={() => setShowFilters(false)}
                className="flex-1 bg-[#FF8C42] hover:bg-[#FF7029]"
              >
                Apply Filters
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function GroomingCenterCard({ center, onClick }: { center: GroomingCenterData; onClick: () => void }) {
  return (
    <Card
      onClick={onClick}
      className="cursor-pointer hover:shadow-lg transition-all border border-gray-200 mb-4"
    >
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          {/* Center Icon/Logo */}
          <div className="w-16 h-16 bg-gradient-to-br from-[#FF8C42] to-[#FF7029] rounded-xl flex items-center justify-center flex-shrink-0">
            {center.photos && center.photos.length > 0 ? (
              <img src={center.photos[0]} alt={center.name} className="w-full h-full object-cover rounded-xl" />
            ) : (
              <Scissors className="w-8 h-8 text-white" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-semibold text-gray-900 truncate">{center.name}</h3>
              {center.isPremium && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                  Premium
                </Badge>
              )}
            </div>
            
            <p className="text-xs text-gray-500 mb-2 line-clamp-1">{center.address}</p>
            
            {/* Specialties */}
            <div className="flex flex-wrap gap-1 mb-2">
              {center.specialties.slice(0, 2).map((specialty, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {specialty}
                </Badge>
              ))}
              {center.specialties.length > 2 && (
                <Badge variant="secondary" className="text-xs">
                  +{center.specialties.length - 2} more
                </Badge>
              )}
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1 text-amber-600">
                <Star className="w-3.5 h-3.5 fill-amber-600" />
                <span className="font-semibold">{center.rating.toFixed(1)}</span>
                <span className="text-gray-400">({center.reviews})</span>
              </div>
              
              <div className="flex items-center gap-1 text-gray-600">
                <MapPin className="w-3.5 h-3.5" />
                <span>{center.distance.toFixed(1)} km</span>
              </div>
              
              {center.openNow && (
                <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                  Open Now
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* ✅ Amenities Preview Row */}
        {center.amenities && center.amenities.length > 0 && (
          <div className="pt-3 mt-3 border-t border-gray-100">
            <div className="flex flex-wrap gap-1.5">
              {center.amenities.slice(0, 4).map((amenity, idx) => {
                const amenityIcons: Record<string, string> = {
                  'parking': '🅿️',
                  'ac': '❄️',
                  'wifi': '📶',
                  'spa': '🧖',
                  'pickup': '🚗',
                  'boarding': '🏠',
                  'organic': '🌿',
                  'pet_friendly': '🐕'
                };
                const icon = amenityIcons[amenity.toLowerCase()] || '✓';
                return (
                  <span key={idx} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                    {icon} {amenity}
                  </span>
                );
              })}
              {center.amenities.length > 4 && (
                <span className="text-xs text-gray-400">+{center.amenities.length - 4} more</span>
              )}
            </div>
          </div>
        )}

        {/* Pet Types Served */}
        {center.petTypes && center.petTypes.length > 0 && (
          <div className="pt-2">
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <span>Serves:</span>
              {center.petTypes.map((type, idx) => (
                <span key={idx} className="text-gray-600">
                  {type === 'dog' ? '🐕' : type === 'cat' ? '🐱' : '🐾'} {type}
                  {idx < center.petTypes!.length - 1 && ','}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
