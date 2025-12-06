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
  Users,
  Clock,
  Award,
  X,
  Navigation
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../../ui/sheet';

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
  distance: number; // in km
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
  
  // Filter states
  const [maxDistance, setMaxDistance] = useState<number>(10);
  const [minRating, setMinRating] = useState<number>(0);
  const [multispecialtyOnly, setMultispecialtyOnly] = useState(false);
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'reviews'>('distance');

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadClinics();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [clinics, searchQuery, maxDistance, minRating, multispecialtyOnly, openNowOnly, sortBy]);

  const loadClinics = async () => {
    try {
      setLoading(true);
      
      // Fetch all services with at_center style AND veterinarian role ONLY
      const response = await fetch(
        `${API_BASE}/customer/services?serviceStyle=at_center&roleId=veterinarian`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      console.log('📍 [CLINIC-LIST] Loading clinics from services API');

      if (response.ok) {
        const data = await response.json();
        console.log('📦 [CLINIC-LIST] Services response:', data);
        
        if (data.success && data.services) {
          // Group services by vendor to get unique clinics
          const vendorMap = new Map<string, any>();
          
          data.services.forEach((service: any) => {
            const vendorId = service.vendorId;
            if (!vendorMap.has(vendorId)) {
              vendorMap.set(vendorId, {
                id: vendorId,
                name: service.vendorName || 'Unnamed Clinic',
                businessName: service.vendorName,
                address: service.vendorLocation || 'Address not provided',
                rating: service.vendorRating || 4.5,
                reviews: service.vendorReviewCount || 0,
                distance: Math.random() * 8 + 0.5, // TODO: Calculate real distance based on user location
                photos: service.vendorProfileImage ? [service.vendorProfileImage] : [],
                specialties: [], // Will be enriched from facility data if needed
                doctors: 3, // Default value
                openNow: Math.random() > 0.3, // TODO: Calculate based on actual hours
                operatingHours: 'Mon-Sat: 9AM-7PM', // Default
                isMultispecialty: false, // Will be determined by services count
                serviceCount: 1
              });
            } else {
              // Increment service count for this vendor
              const clinic = vendorMap.get(vendorId);
              clinic.serviceCount = (clinic.serviceCount || 1) + 1;
              clinic.isMultispecialty = clinic.serviceCount > 3;
            }
          });
          
          const clinicsData: ClinicData[] = Array.from(vendorMap.values());
          console.log(`✅ [CLINIC-LIST] Found ${clinicsData.length} unique clinics`);
          
          setClinics(clinicsData);
        } else {
          console.warn('⚠️ [CLINIC-LIST] No services found in response');
          setClinics([]);
        }
      } else {
        console.error('❌ [CLINIC-LIST] Failed to fetch services:', response.status);
        setClinics([]);
      }
    } catch (error) {
      console.error('❌ [CLINIC-LIST] Error loading clinics:', error);
      setClinics([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...clinics];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(clinic =>
        clinic.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        clinic.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        clinic.specialties.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Distance filter
    filtered = filtered.filter(clinic => clinic.distance <= maxDistance);

    // Rating filter
    if (minRating > 0) {
      filtered = filtered.filter(clinic => clinic.rating >= minRating);
    }

    // Multispecialty filter
    if (multispecialtyOnly) {
      filtered = filtered.filter(clinic => clinic.isMultispecialty);
    }

    // Open now filter
    if (openNowOnly) {
      filtered = filtered.filter(clinic => clinic.openNow);
    }

    // Sort
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Finding nearby clinics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[430px] mx-auto bg-white min-h-screen">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#FF8C42] to-[#FF7029] text-white px-4 pt-8 pb-6 sticky top-0 z-10">
          <button onClick={onBack} className="mb-4 flex items-center gap-2">
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          
          <h1 className="text-2xl font-bold mb-2">Nearby Veterinary Clinics</h1>
          <p className="text-white/80 text-sm mb-4">
            {filteredClinics.length} clinic{filteredClinics.length !== 1 ? 's' : ''} found
          </p>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Search by name, area, or specialty..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 h-12 bg-white border-0 text-gray-900"
            />
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-[160px] z-10 flex items-center gap-2 overflow-x-auto">
          <Button
            onClick={() => setShowFilters(true)}
            variant="outline"
            className="flex-shrink-0 border-gray-300 h-9"
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
            className={`flex-shrink-0 h-9 text-xs ${
              sortBy === 'distance' ? 'bg-[#FF8C42] text-white' : 'border-gray-300'
            }`}
          >
            <Navigation className="w-3 h-3 mr-1" />
            Nearest
          </Button>

          <Button
            onClick={() => setSortBy('rating')}
            variant={sortBy === 'rating' ? 'default' : 'outline'}
            className={`flex-shrink-0 h-9 text-xs ${
              sortBy === 'rating' ? 'bg-[#FF8C42] text-white' : 'border-gray-300'
            }`}
          >
            <Star className="w-3 h-3 mr-1" />
            Top Rated
          </Button>

          <Button
            onClick={() => setOpenNowOnly(!openNowOnly)}
            variant={openNowOnly ? 'default' : 'outline'}
            className={`flex-shrink-0 h-9 text-xs ${
              openNowOnly ? 'bg-[#FF8C42] text-white' : 'border-gray-300'
            }`}
          >
            Open Now
          </Button>
        </div>

        {/* Clinics List */}
        <div className="p-4 space-y-4 pb-6">
          {filteredClinics.length === 0 ? (
            <div className="text-center py-12">
              <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">No clinics found</h3>
              <p className="text-sm text-gray-500 mb-4">
                Try adjusting your filters or search criteria
              </p>
              <Button onClick={clearFilters} variant="outline">
                Clear Filters
              </Button>
            </div>
          ) : (
            filteredClinics.map((clinic) => (
              <ClinicCard
                key={clinic.id}
                clinic={clinic}
                onClick={() => onNavigate('clinic-details', clinic)}
              />
            ))
          )}
        </div>

        {/* Filters Sheet */}
        <Sheet open={showFilters} onOpenChange={setShowFilters}>
          <SheetContent side="bottom" className="h-[80vh] max-w-[430px] mx-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center justify-between">
                <span>Filters</span>
                <Button
                  onClick={clearFilters}
                  variant="ghost"
                  className="text-[#FF8C42] h-auto p-0 hover:bg-transparent"
                >
                  Clear All
                </Button>
              </SheetTitle>
              <SheetDescription className="text-sm text-gray-500">
                Adjust your search criteria to find the best clinics for you.
              </SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {/* Distance Filter */}
              <div>
                <label className="text-sm font-medium text-gray-900 mb-3 block">
                  Maximum Distance: {maxDistance} km
                </label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={maxDistance}
                  onChange={(e) => setMaxDistance(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#FF8C42]"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>1 km</span>
                  <span>20 km</span>
                </div>
              </div>

              {/* Rating Filter */}
              <div>
                <label className="text-sm font-medium text-gray-900 mb-3 block">
                  Minimum Rating
                </label>
                <div className="flex gap-2">
                  {[0, 3, 3.5, 4, 4.5].map((rating) => (
                    <Button
                      key={rating}
                      onClick={() => setMinRating(rating)}
                      variant={minRating === rating ? 'default' : 'outline'}
                      className={`flex-1 ${
                        minRating === rating
                          ? 'bg-[#FF8C42] text-white'
                          : 'border-gray-300'
                      }`}
                    >
                      {rating === 0 ? 'Any' : `${rating}+`}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Sort By */}
              <div>
                <label className="text-sm font-medium text-gray-900 mb-3 block">
                  Sort By
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'distance', label: 'Distance', icon: Navigation },
                    { value: 'rating', label: 'Rating', icon: Star },
                    { value: 'reviews', label: 'Most Reviewed', icon: Users }
                  ].map((option) => (
                    <Button
                      key={option.value}
                      onClick={() => setSortBy(option.value as any)}
                      variant={sortBy === option.value ? 'default' : 'outline'}
                      className={`w-full justify-start ${
                        sortBy === option.value
                          ? 'bg-[#FF8C42] text-white'
                          : 'border-gray-300'
                      }`}
                    >
                      <option.icon className="w-4 h-4 mr-2" />
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Toggle Filters */}
              <div className="space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Award className="w-5 h-5 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">
                      Multispecialty Only
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={multispecialtyOnly}
                    onChange={(e) => setMultispecialtyOnly(e.target.checked)}
                    className="w-5 h-5 accent-[#FF8C42]"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900">
                      Open Now
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={openNowOnly}
                    onChange={(e) => setOpenNowOnly(e.target.checked)}
                    className="w-5 h-5 accent-[#FF8C42]"
                  />
                </label>
              </div>
            </div>

            {/* Apply Button */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200">
              <Button
                onClick={() => setShowFilters(false)}
                className="w-full bg-[#FF8C42] hover:bg-[#FF7A2F] text-white h-12"
              >
                Show {filteredClinics.length} Clinic{filteredClinics.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

function ClinicCard({ clinic, onClick }: { clinic: ClinicData; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg transition-all cursor-pointer"
    >
      {/* Photo */}
      <div className="relative h-40 bg-gradient-to-br from-orange-100 to-orange-50">
        {clinic.photos.length > 0 ? (
          <img
            src={clinic.photos[0]}
            alt={clinic.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 className="w-12 h-12 text-gray-300" />
          </div>
        )}
        
        {/* Status Badge */}
        <div className="absolute top-3 right-3">
          <Badge
            className={`${
              clinic.openNow
                ? 'bg-green-500 text-white'
                : 'bg-gray-500 text-white'
            } shadow-lg`}
          >
            {clinic.openNow ? 'Open Now' : 'Closed'}
          </Badge>
        </div>

        {/* Distance Badge */}
        <div className="absolute bottom-3 left-3">
          <Badge className="bg-white/95 backdrop-blur-sm text-gray-900 shadow-md">
            <Navigation className="w-3 h-3 mr-1" />
            {clinic.distance.toFixed(1)} km
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-1">{clinic.name}</h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <span className="font-semibold text-sm">{clinic.rating.toFixed(1)}</span>
                <span className="text-sm text-gray-500">({clinic.reviews})</span>
              </div>
              {clinic.isMultispecialty && (
                <Badge variant="outline" className="text-xs border-[#FF8C42] text-[#FF8C42]">
                  Multispecialty
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{clinic.address}</span>
          </div>

          <div className="flex items-center gap-2 text-gray-600">
            <Users className="w-4 h-4 flex-shrink-0" />
            <span>{clinic.doctors} Doctor{clinic.doctors !== 1 ? 's' : ''}</span>
          </div>

          <div className="flex items-center gap-2 text-gray-600">
            <Clock className="w-4 h-4 flex-shrink-0" />
            <span>{clinic.operatingHours}</span>
          </div>
        </div>

        {/* Specialties */}
        {clinic.specialties.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {clinic.specialties.slice(0, 3).map((specialty, index) => (
              <Badge key={index} variant="secondary" className="text-xs bg-orange-50 text-orange-700">
                {specialty}
              </Badge>
            ))}
            {clinic.specialties.length > 3 && (
              <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-600">
                +{clinic.specialties.length - 3} more
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Building2({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4" />
      <path d="M10 10h4" />
      <path d="M10 14h4" />
      <path d="M10 18h4" />
    </svg>
  );
}