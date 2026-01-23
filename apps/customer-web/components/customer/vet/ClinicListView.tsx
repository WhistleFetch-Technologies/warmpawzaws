"use client";

import { useState, useEffect } from 'react';
import { Star, MapPin, Clock, Search, ChevronRight, Building2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { StandardizedHeader } from '../shared/StandardizedHeader';
import { StandardizedFooter } from '../shared/StandardizedFooter';

interface ClinicListViewProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

interface Clinic {
  id: string;
  name: string;
  address: string;
  rating: number;
  review_count: number;
  distance?: string;
  timing: string;
  services: string[];
  price_range: string;
  is_open?: boolean;
  photo?: string; // ✅ Added photo support
}

export function ClinicListView({ phone, onBack, onNavigate }: ClinicListViewProps) {
  const [loading, setLoading] = useState(true);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'rating' | 'distance' | 'price'>('all');
  
  // User profile data for header
  const [userName, setUserName] = useState('User');
  const [userProfilePhoto, setUserProfilePhoto] = useState<string | undefined>(undefined);
  
  useEffect(() => {
    loadUserProfile();
  }, [phone]);
  
  const loadUserProfile = async () => {
    try {
      const profileResponse = await apiClient.get(`/customer/profile?phone=${encodeURIComponent(phone)}`) as any;
      if (profileResponse?.profile || profileResponse) {
        const profile = profileResponse.profile || profileResponse;
        setUserName(profile.name || profile.fullName || 'User');
        setUserProfilePhoto(profile.profilePhoto || profile.profile_image_url || profile.photo);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  useEffect(() => {
    loadClinics();
  }, []);

  const loadClinics = async () => {
    try {
      setLoading(true);
      
      // Get customer location from localStorage for distance-based sorting
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
      
      // Try primary endpoint
      try {
        const response = await apiClient.get(`/customer/discover-services?category=vet&roleId=veterinarian&serviceStyle=at_center${locationParams}`) as any;
        console.log('📋 [CLINIC-LIST] API Response:', response);
        
        const servicesData = response.vendors || response.services || [];
        if (servicesData.length > 0) {
          // Group by vendor to get unique clinics
          const vendorMap = new Map();
          servicesData.forEach((service: any) => {
            const vendorId = service.vendorId || service.id;
            if (!vendorMap.has(vendorId)) {
              vendorMap.set(vendorId, {
                id: vendorId,
                name: service.vendorName || service.businessName || service.business_name || service.name || 'Unnamed Clinic',
                address: service.vendorLocation?.address || service.address || `${service.city || ''}${service.city ? ', ' : ''}${service.pincode || ''}`.trim() || 'Location available on booking',
                rating: parseFloat(service.vendorRating || service.rating || service.avgRating || '4.5'),
                review_count: parseInt(service.vendorReviewCount || service.reviewsCount || service.review_count || '0', 10),
                distance: service.distance ? `${Number(service.distance).toFixed(1)} km` : null,
                timing: service.businessHours || service.timing || '9 AM - 8 PM',
                services: service.services?.map((s: any) => typeof s === 'string' ? s : s.name) || [service.serviceName || 'General Consultation'].filter(Boolean),
                price_range: service.priceRange || service.price_range || (service.price ? `₹${service.price}` : '₹399 - ₹2999'),
                is_open: service.is_open !== undefined ? service.is_open : true,
                photo: service.vendorPhoto || service.photo || service.businessPhoto, // ✅ Added photo support
              });
            } else {
              // Add service to existing clinic
              const clinic = vendorMap.get(vendorId);
              if (service.serviceName && !clinic.services.includes(service.serviceName)) {
                clinic.services.push(service.serviceName);
              }
            }
          });
          
          const mappedClinics = Array.from(vendorMap.values());
          setClinics(mappedClinics);
          console.log(`✅ [CLINIC-LIST] Found ${mappedClinics.length} clinics from API`);
          return;
        } else {
          console.warn('⚠️ [CLINIC-LIST] No vendors in response');
        }
      } catch (err: any) {
        console.error('❌ [CLINIC-LIST] Primary API Error:', err);
        
        // Try fallback endpoint
        try {
          const fallbackResponse = await apiClient.get('/vendors?role=veterinarian') as any;
          if (fallbackResponse && fallbackResponse.vendors && fallbackResponse.vendors.length > 0) {
            const mappedClinics = fallbackResponse.vendors.map((v: any) => ({
              id: v.id,
              name: v.businessName || v.business_name || v.name || 'Unnamed Clinic',
              address: v.address || `${v.city || ''}${v.city ? ', ' : ''}${v.pincode || ''}`.trim() || 'Location available on booking',
              rating: parseFloat(v.rating || v.avgRating || '4.5'),
              review_count: parseInt(v.reviewCount || v.review_count || '0', 10),
              distance: v.distance || null,
              timing: v.timing || v.businessHours || '9 AM - 8 PM',
              services: v.services?.map((s: any) => typeof s === 'string' ? s : s.name) || ['General Consultation', 'Vaccination'],
              price_range: v.price_range || v.priceRange || '₹399 - ₹2999',
              is_open: v.is_open !== undefined ? v.is_open : true,
              photo: v.photo || v.businessPhoto || v.vendorPhoto, // ✅ Added photo support
            }));
            setClinics(mappedClinics);
            console.log(`✅ [CLINIC-LIST] Found ${mappedClinics.length} clinics from fallback endpoint`);
            return;
          }
        } catch (fallbackErr) {
          console.error('❌ [CLINIC-LIST] Fallback endpoint also failed:', fallbackErr);
        }
      }

      // No clinics found - will show empty state
      setClinics([]);
    } catch (error) {
      console.error('Error loading clinics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewClinic = (clinicId: string) => {
    onNavigate('clinic-profile', { clinicId });
  };

  const filteredClinics = clinics.filter(clinic =>
    clinic.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    clinic.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedClinics = [...filteredClinics].sort((a, b) => {
    switch (selectedFilter) {
      case 'rating':
        return b.rating - a.rating;
      case 'distance':
        return parseFloat(a.distance || '0') - parseFloat(b.distance || '0');
      case 'price':
        return parseInt(a.price_range.replace(/[^0-9]/g, '')) - parseInt(b.price_range.replace(/[^0-9]/g, ''));
      default:
        return 0;
    }
  });

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'rating', label: 'Top Rated' },
    { id: 'distance', label: 'Nearest' },
    { id: 'price', label: 'Price' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Standardized Header - matches customer home gradient */}
      <StandardizedHeader
        userName={userName}
        userProfilePhoto={userProfilePhoto}
        title="Clinics"
        subtitle="Find a veterinary clinic"
        showBackButton={true}
        showPets={false}
        onBack={onBack}
        onNavigate={onNavigate}
        onProfileClick={() => onNavigate('profile')}
        customerPhone={phone}
      />
      
      {/* Content - curved top matching customer home (rounded-t-[24px]) */}
      <div className="max-w-[430px] mx-auto rounded-t-[24px] -mt-1 bg-white min-h-[60vh] px-4 pt-6 pb-28 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        {/* Search - design system curves (rounded-2xl), soft bg */}
        <div className="relative mb-4">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search clinics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF8C42]/40 focus:border-[#FF8C42] transition-all"
          />
        </div>

        {/* Filters - pills matching home, primary orange when active */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mb-5">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setSelectedFilter(filter.id as any)}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                selectedFilter === filter.id
                  ? 'bg-[#FF8C42] text-white shadow-[0_2px_8px_rgba(255,140,66,0.35)]'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-[#FF8C42]/30 border-t-[#FF8C42]"></div>
            <p className="text-gray-500 text-sm mt-4">Finding clinics...</p>
          </div>
        ) : sortedClinics.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#FFF5EE] flex items-center justify-center text-3xl">🏥</div>
            <p className="text-gray-800 font-semibold">No clinics found</p>
            <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">{sortedClinics.length} clinics found</p>
            
            {sortedClinics.map((clinic) => (
              <button
                key={clinic.id}
                onClick={() => handleViewClinic(clinic.id)}
                className="w-full card card-interactive rounded-2xl p-4 text-left border border-gray-100 hover:border-orange-100 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] transition-all duration-200"
              >
                <div className="flex gap-3">
                  {/* Clinic Photo or Icon - rounded-2xl, soft orange tint */}
                  {clinic.photo ? (
                    <img 
                      src={clinic.photo} 
                      alt={clinic.name}
                      className="w-16 h-16 rounded-2xl object-cover ring-2 ring-[#FF8C42]/20 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FFF5EE] to-[#FFE8D6] flex items-center justify-center text-2xl flex-shrink-0 border border-orange-100/50">
                      <Building2 className="w-7 h-7 text-[#FF8C42]" />
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-gray-900 truncate">{clinic.name}</h3>
                      <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <span className="font-semibold text-sm text-gray-800">{clinic.rating}</span>
                      <span className="text-gray-400 text-sm">({clinic.review_count})</span>
                      {clinic.distance && (
                        <>
                          <span className="text-gray-300">•</span>
                          <span className="text-sm text-gray-500">{clinic.distance}</span>
                        </>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1.5 mt-1.5 text-sm text-gray-500">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{clinic.address}</span>
                    </div>
                    
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-sm text-gray-500">{clinic.timing}</span>
                        </div>
                        {clinic.is_open !== undefined && (
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                            clinic.is_open ? 'bg-[#EDFFEE] text-[#00C30C]' : 'bg-red-50 text-red-600'
                          }`}>
                            {clinic.is_open ? 'Open' : 'Closed'}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-bold text-[#FF8C42]">{clinic.price_range}</span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {clinic.services.slice(0, 3).map((service, idx) => (
                        <span key={idx} className="px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-medium text-gray-600">
                          {service}
                        </span>
                      ))}
                      {clinic.services.length > 3 && (
                        <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-medium text-gray-500">
                          +{clinic.services.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      
      <StandardizedFooter
        currentTab="bookings"
        onTabChange={(tab) => {
          if (tab === 'home') onBack();
          else if (tab === 'bookings') onNavigate('my-bookings');
          else if (tab === 'cart') onNavigate('cart');
          else if (tab === 'profile') onNavigate('profile');
        }}
        maxWidth="max-w-[430px]"
      />
    </div>
  );
}
