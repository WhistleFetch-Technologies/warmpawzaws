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
  Stethoscope,
  X,
  Loader2,
  UserCircle2,
  Building2
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../../ui/sheet';
import { toast } from 'sonner';

interface VetClinicListViewProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

interface DoctorData {
  id: string;
  name: string;
  photo: string | null;
  specialization: string;
  degree: string;
  experience: number;
  consultationFee: number;
  gender: string;
  languages: string[];
  rating: number;
  reviewCount: number;
  clinicId: string;
  clinicName: string;
  clinicAddress: string;
  clinicLatitude?: number;
  clinicLongitude?: number;
  distance?: number; // ✅ Distance in km
  nextAvailable: {
    date: string;
    time: string;
    isToday: boolean;
  } | null;
  isAvailableToday: boolean;
  // ✅ CRITICAL FIX: Include clinic's services for each doctor
  services: any[];
  bio: string;
}

interface ClinicData {
  id: string;
  name: string;
  businessName: string;
  address: string;
  phone: string;
  rating: number;
  reviewCount: number;
  doctorCount: number;
  serviceCount: number;
  isPremium: boolean;
  isVerified: boolean;
  latitude?: number;
  longitude?: number;
  distance?: number; // ✅ Distance in km
  doctors: Array<{
    id: string;
    name: string;
    specialization: string;
    photo: string | null;
  }>;
}

type SearchType = 'clinics' | 'doctors';

export function VetClinicListViewEnhanced({ phone, onBack, onNavigate }: VetClinicListViewProps) {
  // Search state
  const [searchType, setSearchType] = useState<SearchType>('doctors');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Results
  const [doctors, setDoctors] = useState<DoctorData[]>([]);
  const [clinics, setClinics] = useState<ClinicData[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  
  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [feeRange, setFeeRange] = useState<[number, number]>([0, 2000]);
  const [experienceRange, setExperienceRange] = useState<string[]>([]);
  const [gender, setGender] = useState<string>('any');
  const [availableToday, setAvailableToday] = useState(false);
  const [sortBy, setSortBy] = useState<string>('relevance');
  
  // ✅ NEW: User location for distance calculation
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  // ✅ Get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude
          });
          console.log('📍 User location:', position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          // Silently handle location denial - app works fine without it
          if (error.code === 1) {
            console.log('💡 Location access denied by user - continuing without distance calculation');
          } else if (error.code === 2) {
            console.log('💡 Location unavailable - continuing without distance calculation');
          } else if (error.code === 3) {
            console.log('💡 Location request timeout - continuing without distance calculation');
          }
          // App continues normally, distance just won't be shown
        }
      );
    }
  }, []);

  // Load initial results
  useEffect(() => {
    loadResults();
  }, [searchType]);

  // Search when query changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      loadResults();
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, feeRange, experienceRange, gender, availableToday, sortBy]);

  const loadResults = async () => {
    try {
      setLoading(true);

      if (searchType === 'doctors') {
        await loadDoctors();
      } else {
        await loadClinics();
      }
    } catch (error) {
      console.error('[VET-SEARCH] Error loading results:', error);
      toast.error('Failed to load results. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadDoctors = async () => {
    try {
      console.log('🔍 [VET-SEARCH] Searching doctors...');
      console.log('Query:', searchQuery);
      console.log('Filters:', { feeRange, experienceRange, gender, availableToday, sortBy });

      // ✅ CRITICAL FIX: For "Doctors" tab in at_center flow, we need to:
      // 1. Get all CENTERS (at_center clinics)
      // 2. Extract all STAFF from those centers
      // 3. Display them as individual doctor cards
      
      const params = new URLSearchParams({
        serviceCategory: 'veterinary_services',
        serviceStyle: 'at_center', // ✅ FIXED: Changed from at_home to at_center
        query: searchQuery,
        feeMin: feeRange[0].toString(),
        feeMax: feeRange[1].toString(),
        sortBy
      });

      // ✅ Add user location if available
      if (userLocation) {
        params.append('lat', userLocation.lat.toString());
        params.append('lon', userLocation.lon.toString());
      }

      if (gender !== 'any') {
        params.append('gender', gender);
      }

      if (availableToday) {
        params.append('availableToday', 'true');
      }

      // Experience range filter
      if (experienceRange.length > 0) {
        const minExp = Math.min(...experienceRange.map(r => {
          if (r === '0-5 years') return 0;
          if (r === '5-10 years') return 5;
          if (r === '10-15 years') return 10;
          if (r === '15+ years') return 15;
          return 0;
        }));
        
        const maxExp = Math.max(...experienceRange.map(r => {
          if (r === '0-5 years') return 5;
          if (r === '5-10 years') return 10;
          if (r === '10-15 years') return 15;
          if (r === '15+ years') return 999;
          return 999;
        }));

        params.append('experienceMin', minExp.toString());
        params.append('experienceMax', maxExp.toString());
      }

      // ✅ FIXED: Use universal search endpoint
      const response = await fetch(
        `${API_BASE}/universal/search?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ [VET-SEARCH] Centers loaded:', data.total);
        console.log('📦 [VET-SEARCH] Result type:', data.resultType);
        
        if (data.success) {
          // ✅ CRITICAL FIX: Extract all STAFF from all CENTERS
          const centers = data.results || [];
          const allDoctors: DoctorData[] = [];
          
          centers.forEach((center: any) => {
            const centerStaff = center.staff || [];
            
            centerStaff.forEach((staff: any) => {
              // Apply additional filters
              const matchesFee = staff.consultationFee >= feeRange[0] && staff.consultationFee <= feeRange[1];
              const matchesGender = gender === 'any' || staff.gender === gender;
              
              // Experience filter
              let matchesExperience = true;
              if (experienceRange.length > 0) {
                const exp = staff.experience || 0;
                matchesExperience = experienceRange.some(range => {
                  if (range === '0-5 years') return exp >= 0 && exp < 5;
                  if (range === '5-10 years') return exp >= 5 && exp < 10;
                  if (range === '10-15 years') return exp >= 10 && exp < 15;
                  if (range === '15+ years') return exp >= 15;
                  return false;
                });
              }
              
              if (matchesFee && matchesGender && matchesExperience) {
                allDoctors.push({
                  id: staff.id,
                  name: staff.name || staff.fullName,
                  photo: staff.photo,
                  specialization: staff.specialization, // ✅ FIXED: Backend now returns mapped specialization
                  degree: staff.degree || '',
                  experience: staff.experience || 0,
                  consultationFee: staff.consultationFee || 0,
                  gender: staff.gender || 'not_specified',
                  languages: staff.languages || [],
                  rating: staff.rating || 0,
                  reviewCount: staff.reviewCount || 0,
                  clinicId: center.id,
                  clinicName: center.name || center.businessName,
                  clinicAddress: center.address,
                  clinicLatitude: center.latitude, // ✅ Add coordinates
                  clinicLongitude: center.longitude,
                  distance: center.distance, // ✅ Distance from backend
                  nextAvailable: staff.nextAvailable || null,
                  isAvailableToday: staff.isAvailableToday || false,
                  // ✅ CRITICAL FIX: Include clinic's services for each doctor
                  // Normalize service fields to match VetDoctorDetails expectations
                  services: (center.services || []).map((service: any) => ({
                    id: service.serviceId || service.id,
                    serviceId: service.serviceId || service.id,
                    name: service.serviceName || service.name,
                    serviceName: service.serviceName || service.name,
                    description: service.description || service.customDescription || '',
                    price: service.customPrice || service.price || 0,
                    duration: service.customDuration || service.duration || 30,
                    serviceStyle: service.serviceStyle || 'at_center',
                    category: service.category,
                    categoryName: service.categoryName,
                    subCategoryName: service.subCategoryName,
                    isEnabled: service.isEnabled,
                    publishStatus: service.publishStatus,
                    isCustomService: service.isCustomService || false
                  })),
                  bio: staff.bio || `Experienced veterinarian specialized in pet healthcare and wellness.`
                });
              }
            });
          });
          
          console.log(`✅ [VET-SEARCH] Extracted ${allDoctors.length} doctors from ${centers.length} centers`);
          
          // Deduplicate doctors by ID to prevent key warnings
          const uniqueDoctors = Array.from(new Map(allDoctors.map(item => [item.id, item])).values());
          console.log(`✅ [VET-SEARCH] Unique doctors: ${uniqueDoctors.length} (removed ${allDoctors.length - uniqueDoctors.length} duplicates)`);
          
          setDoctors(uniqueDoctors);
          setTotalResults(uniqueDoctors.length);
        } else {
          console.error('❌ [VET-SEARCH] API returned error:', data.error);
          setDoctors([]);
          setTotalResults(0);
        }
      } else {
        console.error('❌ [VET-SEARCH] HTTP error:', response.status);
        setDoctors([]);
        setTotalResults(0);
      }
    } catch (error) {
      console.error('❌ [VET-SEARCH] Exception:', error);
      setDoctors([]);
      setTotalResults(0);
    }
  };

  const loadClinics = async () => {
    try {
      console.log('🏥 [VET-SEARCH] Searching clinics...');
      console.log('Query:', searchQuery);

      // ✅ FIXED: Use universal search with at_center style
      const params = new URLSearchParams({
        serviceCategory: 'veterinary_services',
        serviceStyle: 'at_center', // Clinics provide at_center services
        query: searchQuery
      });

      // ✅ Add user location if available
      if (userLocation) {
        params.append('lat', userLocation.lat.toString());
        params.append('lon', userLocation.lon.toString());
      }

      // ✅ FIXED: Use universal search endpoint
      const response = await fetch(
        `${API_BASE}/universal/search?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ [VET-SEARCH] Clinics loaded:', data.total);
        console.log('📦 [VET-SEARCH] Result type:', data.resultType);
        
        if (data.success) {
          // Universal API returns 'results' array with CENTER objects
          const centers = data.results || [];
          
          // Map center objects to clinic format for backward compatibility
          const mappedClinics = centers.map((center: any) => ({
            id: center.id,
            name: center.name || center.businessName,
            businessName: center.businessName || center.name,
            address: center.address,
            phone: center.phone,
            rating: center.rating,
            reviewCount: center.reviewCount,
            doctorCount: center.staffCount || 0,
            serviceCount: center.serviceCount || 0,
            isPremium: false,
            isVerified: center.status === 'approved',
            latitude: center.latitude, // ✅ Add coordinates
            longitude: center.longitude,
            distance: center.distance, // ✅ Distance from backend
            doctors: (center.staff || []).map((s: any) => ({
              id: s.id,
              name: s.name,
              specialization: s.specialization,
              photo: s.photo
            }))
          }));
          
          setClinics(mappedClinics);
          setTotalResults(data.total || 0);
        } else {
          console.error('❌ [VET-SEARCH] API returned error:', data.error);
          setClinics([]);
          setTotalResults(0);
        }
      } else {
        console.error('❌ [VET-SEARCH] HTTP error:', response.status);
        setClinics([]);
        setTotalResults(0);
      }
    } catch (error) {
      console.error('❌ [VET-SEARCH] Exception:', error);
      setClinics([]);
      setTotalResults(0);
    }
  };

  const clearFilters = () => {
    setFeeRange([0, 2000]);
    setExperienceRange([]);
    setGender('any');
    setAvailableToday(false);
    setSortBy('relevance');
    setSearchQuery('');
  };

  const activeFiltersCount = 
    (feeRange[0] > 0 || feeRange[1] < 2000 ? 1 : 0) +
    (experienceRange.length > 0 ? 1 : 0) +
    (gender !== 'any' ? 1 : 0) +
    (availableToday ? 1 : 0);

  const handleDoctorClick = (doctor: DoctorData) => {
    onNavigate('doctor-details', { doctorId: doctor.id, doctor });
  };

  const handleClinicClick = (clinic: ClinicData) => {
    onNavigate('clinic-profile', { clinicId: clinic.id });
  };

  return (
    <div className="min-h-screen bg-[#FF8C42] max-w-md mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#FF8C42] text-white px-6 pt-12 pb-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={onBack} className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">Find Veterinarians</h1>
            <p className="text-sm text-white/90">
              {totalResults} {searchType === 'doctors' ? 'doctors' : 'clinics'} available
            </p>
          </div>
        </div>

        {/* Search Type Toggle */}
        <div className="flex gap-2 mb-4 p-1 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
          <button
            onClick={() => setSearchType('doctors')}
            className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all ${
              searchType === 'doctors'
                ? 'bg-white text-[#FF8C42] shadow-sm'
                : 'text-white hover:bg-white/10'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <UserCircle2 className="w-4 h-4" />
              <span>Doctors</span>
            </div>
          </button>
          <button
            onClick={() => setSearchType('clinics')}
            className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all ${
              searchType === 'clinics'
                ? 'bg-white text-[#FF8C42] shadow-sm'
                : 'text-white hover:bg-white/10'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <Building2 className="w-4 h-4" />
              <span>Clinics</span>
            </div>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-3">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
          <Input
            type="text"
            placeholder={searchType === 'doctors' ? 'Search doctor name, specialization...' : 'Search clinic name...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-10 py-3 h-12 rounded-xl bg-white/20 border-white/20 text-white placeholder:text-white/60 focus:bg-white/30 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Filter Button (only for doctors) */}
        {searchType === 'doctors' && (
          <button
            onClick={() => setShowFilters(true)}
            className="w-full py-2.5 px-4 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-colors flex items-center justify-center gap-2 border border-white/10"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFiltersCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-white text-[#FF8C42] text-xs rounded-full font-bold">
                {activeFiltersCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Results */}
      <div className="bg-white rounded-t-[32px] px-6 pt-8 pb-6 -mt-4 min-h-[calc(100vh-300px)]">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#FF8C42] animate-spin" />
          </div>
        ) : (
          <>
            {searchType === 'doctors' ? (
              // Doctor Results
              <div className="space-y-4">
                {doctors.length === 0 ? (
                  <div className="text-center py-12">
                    <Stethoscope className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-600">No doctors found</p>
                    <p className="text-sm text-gray-500 mt-2">
                      Try adjusting your filters or search query
                    </p>
                  </div>
                ) : (
                  doctors.map((doctor) => (
                    <Card
                      key={doctor.id}
                      onClick={() => handleDoctorClick(doctor)}
                      className="p-4 border-2 border-gray-200 hover:border-[#FF8C42] hover:shadow-lg transition-all cursor-pointer"
                    >
                      <div className="flex gap-3">
                        {/* Doctor Photo */}
                        <div className="flex-shrink-0">
                          {doctor.photo ? (
                            <img
                              src={doctor.photo}
                              alt={doctor.name}
                              className="w-16 h-16 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center">
                              <UserCircle2 className="w-10 h-10 text-[#FF8C42]" />
                            </div>
                          )}
                        </div>

                        {/* Doctor Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900 truncate">
                            Dr. {doctor.name}
                          </h3>
                          <p className="text-sm text-gray-600 truncate">
                            {doctor.specialization}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {doctor.degree} • {doctor.experience} years exp
                          </p>

                          {/* Rating */}
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 fill-[#FF8C42] text-[#FF8C42]" />
                              <span className="text-sm font-medium">{doctor.rating}</span>
                            </div>
                            <span className="text-xs text-gray-500">
                              ({doctor.reviewCount} reviews)
                            </span>
                          </div>

                          {/* Clinic & Distance */}
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1 flex-1 min-w-0">
                              <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                              <span className="text-xs text-gray-600 truncate">
                                {doctor.clinicName}
                              </span>
                            </div>
                            {doctor.distance && (
                              <span className="text-xs font-medium text-[#FF8C42] whitespace-nowrap">
                                {doctor.distance} km
                              </span>
                            )}
                          </div>
                          
                          {/* Get Directions */}
                          {doctor.clinicLatitude && doctor.clinicLongitude && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const url = `https://www.google.com/maps/dir/?api=1&destination=${doctor.clinicLatitude},${doctor.clinicLongitude}`;
                                window.open(url, '_blank');
                              }}
                              className="flex items-center gap-1 mt-1 text-xs text-blue-600 hover:text-blue-700"
                            >
                              <Navigation className="w-3 h-3" />
                              Get Directions
                            </button>
                          )}

                          {/* Next Available */}
                          {doctor.nextAvailable && (
                            <div className="mt-2">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                                  doctor.nextAvailable.isToday
                                    ? 'bg-[#FF8C42] text-white'
                                    : 'bg-orange-50 text-[#FF8C42]'
                                }`}
                              >
                                <Clock className="w-3 h-3" />
                                Next: {doctor.nextAvailable.isToday ? 'Today' : 'Tomorrow'}{' '}
                                {doctor.nextAvailable.time}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Fee */}
                        <div className="flex flex-col items-end justify-between">
                          <div className="text-right">
                            <div className="text-lg font-bold text-[#FF8C42]">
                              ₹{doctor.consultationFee}
                            </div>
                            <div className="text-xs text-gray-500">Consultation</div>
                          </div>

                          <Button
                            size="sm"
                            className="bg-[#FF8C42] hover:bg-[#FF7A29] text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDoctorClick(doctor);
                            }}
                          >
                            Book
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            ) : (
              // Clinic Results
              <div className="space-y-4">
                {clinics.length === 0 ? (
                  <div className="text-center py-12">
                    <Building2 className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-600">No clinics found</p>
                    <p className="text-sm text-gray-500 mt-2">
                      Try adjusting your search query
                    </p>
                  </div>
                ) : (
                  clinics.map((clinic) => (
                    <Card
                      key={clinic.id}
                      onClick={() => handleClinicClick(clinic)}
                      className="p-4 border-2 border-gray-200 hover:border-[#FF8C42] hover:shadow-lg transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900">{clinic.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 fill-[#FF8C42] text-[#FF8C42]" />
                              <span className="text-sm font-medium">{clinic.rating}</span>
                            </div>
                            <span className="text-xs text-gray-500">
                              ({clinic.reviewCount} reviews)
                            </span>
                          </div>
                        </div>
                        {clinic.isPremium && (
                          <Badge className="bg-[#FF8C42] text-white">Premium</Badge>
                        )}
                      </div>

                      <div className="flex items-start gap-1 mb-2">
                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <span className="text-sm text-gray-600">{clinic.address}</span>
                          {clinic.distance && (
                            <span className="ml-2 text-sm font-medium text-[#FF8C42]">
                              ({clinic.distance} km)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-4">
                          <span>🩺 {clinic.doctorCount} doctors</span>
                          <span>📋 {clinic.serviceCount} services</span>
                        </div>
                        {clinic.latitude && clinic.longitude && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const url = `https://www.google.com/maps/dir/?api=1&destination=${clinic.latitude},${clinic.longitude}`;
                              window.open(url, '_blank');
                            }}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                          >
                            <Navigation className="w-3 h-3" />
                            Directions
                          </button>
                        )}
                      </div>

                      {clinic.doctors.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs text-gray-500 mb-2">Doctors at this clinic:</p>
                          <div className="flex items-center gap-2 overflow-x-auto">
                            {clinic.doctors.map((doc) => (
                              <div key={doc.id} className="flex items-center gap-2 bg-gray-50 rounded-full px-2 py-1 whitespace-nowrap">
                                {doc.photo ? (
                                  <img
                                    src={doc.photo}
                                    alt={doc.name}
                                    className="w-6 h-6 rounded-full"
                                  />
                                ) : (
                                  <UserCircle2 className="w-6 h-6 text-gray-400" />
                                )}
                                <span className="text-xs">Dr. {doc.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </Card>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Filter Sheet */}
      <Sheet open={showFilters} onOpenChange={setShowFilters}>
        <SheetContent side="bottom" className="max-w-[430px] mx-auto">
          <SheetHeader>
            <SheetTitle>Filter Doctors</SheetTitle>
            <SheetDescription>
              Refine your search to find the perfect veterinarian
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6 max-h-[60vh] overflow-y-auto">
            {/* Fee Range */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Consultation Fee
              </label>
              <input
                type="range"
                min="0"
                max="2000"
                step="100"
                value={feeRange[1]}
                onChange={(e) => setFeeRange([0, parseInt(e.target.value)])}
                className="w-full accent-[#FF8C42]"
              />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>₹0</span>
                <span className="font-medium text-[#FF8C42]">₹{feeRange[1]}</span>
              </div>
            </div>

            {/* Experience */}
            <div>
              <label className="block text-sm font-medium mb-2">Experience</label>
              {['0-5 years', '5-10 years', '10-15 years', '15+ years'].map((range) => (
                <label key={range} className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={experienceRange.includes(range)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setExperienceRange([...experienceRange, range]);
                      } else {
                        setExperienceRange(experienceRange.filter((r) => r !== range));
                      }
                    }}
                    className="accent-[#FF8C42]"
                  />
                  <span className="text-sm">{range}</span>
                </label>
              ))}
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm font-medium mb-2">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="any">Any</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            {/* Available Today */}
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={availableToday}
                  onChange={(e) => setAvailableToday(e.target.checked)}
                  className="accent-[#FF8C42]"
                />
                <span className="text-sm font-medium">Available Today</span>
              </label>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="relevance">Relevance</option>
                <option value="fee_low">Fee: Low to High</option>
                <option value="fee_high">Fee: High to Low</option>
                <option value="experience">Experience</option>
                <option value="rating">Rating</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mt-6 pt-4 border-t">
            <button
              onClick={clearFilters}
              className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Clear All
            </button>
            <button
              onClick={() => setShowFilters(false)}
              className="flex-1 px-4 py-3 bg-[#FF8C42] text-white rounded-lg font-medium hover:bg-[#FF7A29] transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}