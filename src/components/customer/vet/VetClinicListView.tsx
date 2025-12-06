import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import { Card } from '../../ui/card';
import {
  ArrowLeft,
  Search,
  SlidersHorizontal,
  MapPin,
  Star,
  Clock,
  Award,
  Navigation,
  Stethoscope
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../../ui/sheet';

interface VetClinicListViewProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

interface VetClinicData {
  id: string;
  name: string;
  businessName: string;
  address: string;
  rating: number;
  reviews: number;
  distance: number;
  photos: string[];
  specialties: string[];
  vets: number;
  openNow: boolean;
  operatingHours: string;
  isPremium: boolean;
  serviceCount: number;
}

export function VetClinicListView({ phone, onBack, onNavigate }: VetClinicListViewProps) {
  const [loading, setLoading] = useState(true);
  const [clinics, setClinics] = useState<VetClinicData[]>([]);
  const [filteredClinics, setFilteredClinics] = useState<VetClinicData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Filter states
  const [maxDistance, setMaxDistance] = useState<number>(10);
  const [minRating, setMinRating] = useState<number>(0);
  const [premiumOnly, setPremiumOnly] = useState(false);
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'reviews'>('distance');

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadVetClinics();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [clinics, searchQuery, maxDistance, minRating, premiumOnly, openNowOnly, sortBy]);

  const loadVetClinics = async () => {
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

      console.log('📍 [VET-CLINIC-LIST] Loading vet clinics from services API');

      if (response.ok) {
        const data = await response.json();
        console.log('📦 [VET-CLINIC-LIST] Services response:', data);
        
        if (data.success && data.services) {
          const vetServices = data.services;
          console.log(`📦 [VET-CLINIC-LIST] Found ${vetServices.length} vet services`);
          
          // Group services by vendor to get unique clinics
          const vendorMap = new Map<string, any>();
          
          vetServices.forEach((service: any) => {
            const vendorId = service.vendorId;
            if (!vendorMap.has(vendorId)) {
              vendorMap.set(vendorId, {
                id: vendorId,
                name: service.vendorName || 'Unnamed Vet Clinic',
                businessName: service.vendorName,
                address: service.vendorLocation || 'Address not provided',
                rating: service.vendorRating || 4.5,
                reviews: service.vendorReviewCount || 0,
                distance: Math.random() * 8 + 0.5, // TODO: Calculate real distance
                photos: service.vendorProfileImage ? [service.vendorProfileImage] : [],
                specialties: ['Consultation', 'Vaccination', 'Surgery'],
                vets: 2,
                openNow: Math.random() > 0.3,
                operatingHours: 'Mon-Sat: 9AM-7PM',
                isPremium: false,
                serviceCount: 1
              });
            } else {
              const clinic = vendorMap.get(vendorId);
              clinic.serviceCount = (clinic.serviceCount || 1) + 1;
              clinic.isPremium = clinic.serviceCount > 5;
            }
          });
          
          const clinicsData: VetClinicData[] = Array.from(vendorMap.values());
          console.log(`✅ [VET-CLINIC-LIST] Found ${clinicsData.length} unique vet clinics`);
          
          setClinics(clinicsData);
        } else {
          console.warn('⚠️ [VET-CLINIC-LIST] No services found in response');
          setClinics([]);
        }
      } else {
        console.error('❌ [VET-CLINIC-LIST] Failed to fetch services:', response.status);
        setClinics([]);
      }
    } catch (error) {
      console.error('❌ [VET-CLINIC-LIST] Error loading vet clinics:', error);
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

    // Premium filter
    if (premiumOnly) {
      filtered = filtered.filter(clinic => clinic.isPremium);
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
      <div className="min-h-screen bg-white flex items-center justify-center max-w-[430px] mx-auto">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Finding nearby vet clinics...</p>
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
          
          <h1 className="text-2xl font-bold mb-2">Nearby Vet Clinics</h1>
          <p className="text-white/80 text-sm mb-4">
            {filteredClinics.length} clinic{filteredClinics.length !== 1 ? 's' : ''} found
          </p>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              placeholder="Search by name, area, or service..."
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
              sortBy === 'distance' ? 'bg-[#FF8C42] text-white hover:bg-[#FF7029]' : 'border-gray-300'
            }`}
          >
            <Navigation className="w-3 h-3 mr-1" />
            Nearest
          </Button>

          <Button
            onClick={() => setSortBy('rating')}
            variant={sortBy === 'rating' ? 'default' : 'outline'}
            className={`flex-shrink-0 h-9 text-xs ${
              sortBy === 'rating' ? 'bg-[#FF8C42] text-white hover:bg-[#FF7029]' : 'border-gray-300'
            }`}
          >
            <Star className="w-3 h-3 mr-1" />
            Top Rated
          </Button>

          <Button
            onClick={() => setOpenNowOnly(!openNowOnly)}
            variant={openNowOnly ? 'default' : 'outline'}
            className={`flex-shrink-0 h-9 text-xs ${
              openNowOnly ? 'bg-[#FF8C42] text-white hover:bg-[#FF7029]' : 'border-gray-300'
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
              <h3 className="font-semibold text-gray-900 mb-2">No vet clinics found</h3>
              <p className="text-sm text-gray-500 mb-4">
                Try adjusting your filters or search criteria
              </p>
              <Button onClick={clearFilters} variant="outline">
                Clear Filters
              </Button>
            </div>
          ) : (
            filteredClinics.map((clinic) => (
              <VetClinicCard
                key={clinic.id}
                clinic={clinic}
                onClick={() => onNavigate('center-details', clinic)}
              />
            ))
          )}
        </div>

        {/* Filters Sheet */}
        <Sheet open={showFilters} onOpenChange={setShowFilters}>
          <SheetContent side="bottom" className="max-w-[430px] mx-auto">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>Refine your vet clinic search</SheetDescription>
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
                      className={minRating === rating ? 'bg-[#FF8C42] hover:bg-[#FF7029]' : ''}
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
                  <span className="text-sm">Premium clinics only</span>
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
    </div>
  );
}

function VetClinicCard({ clinic, onClick }: { clinic: VetClinicData; onClick: () => void }) {
  return (
    <Card
      onClick={onClick}
      className="cursor-pointer hover:shadow-lg transition-all border border-gray-200"
    >
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          {/* Clinic Icon/Logo */}
          <div className="w-16 h-16 bg-gradient-to-br from-[#FF8C42] to-[#FF7029] rounded-xl flex items-center justify-center flex-shrink-0">
            {clinic.photos && clinic.photos.length > 0 ? (
              <img src={clinic.photos[0]} alt={clinic.name} className="w-full h-full object-cover rounded-xl" />
            ) : (
              <Stethoscope className="w-8 h-8 text-white" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-semibold text-gray-900 truncate">{clinic.name}</h3>
              {clinic.isPremium && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                  Premium
                </Badge>
              )}
            </div>
            
            <p className="text-xs text-gray-500 mb-2 line-clamp-1">{clinic.address}</p>
            
            {/* Specialties */}
            <div className="flex flex-wrap gap-1 mb-2">
              {clinic.specialties.slice(0, 2).map((specialty, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {specialty}
                </Badge>
              ))}
              {clinic.specialties.length > 2 && (
                <Badge variant="secondary" className="text-xs">
                  +{clinic.specialties.length - 2} more
                </Badge>
              )}
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1 text-amber-600">
                <Star className="w-3.5 h-3.5 fill-amber-600" />
                <span className="font-semibold">{clinic.rating.toFixed(1)}</span>
                <span className="text-gray-400">({clinic.reviews})</span>
              </div>
              
              <div className="flex items-center gap-1 text-gray-500">
                <MapPin className="w-3.5 h-3.5" />
                <span>{clinic.distance.toFixed(1)} km</span>
              </div>

              {clinic.openNow && (
                <Badge variant="outline" className="text-xs border-green-500 text-green-700">
                  Open Now
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}