"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Star, MapPin, Clock, Filter, Search, ChevronRight, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

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
    <>
      {/* Header is provided by renderScreenWithLayout wrapper (StandardizedHeader) */}
      
      {/* Content */}
      <div className="px-4 pb-24 pt-2 bg-white">
        {/* Search and Filters */}
        <div className="mb-4 space-y-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search clinics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          </div>

          {/* Filters */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {filters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setSelectedFilter(filter.id as any)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedFilter === filter.id
                    ? 'bg-[#FF8C42] text-white'
                    : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
          </div>
        ) : sortedClinics.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">🏥</div>
            <p className="text-gray-600">No clinics found</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your search</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">{sortedClinics.length} clinics found</p>
            
            {sortedClinics.map((clinic) => (
              <button
                key={clinic.id}
                onClick={() => handleViewClinic(clinic.id)}
                className="w-full bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow text-left"
              >
                <div className="flex gap-3">
                  {/* Clinic Photo or Icon */}
                  {clinic.photo ? (
                    <img 
                      src={clinic.photo} 
                      alt={clinic.name}
                      className="w-16 h-16 rounded-xl object-cover border-2 border-[#FF8C42] flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-orange-100 flex items-center justify-center text-2xl flex-shrink-0">
                      🏥
                    </div>
                  )}
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-900 truncate">{clinic.name}</h3>
                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                      <span className="font-medium text-sm">{clinic.rating}</span>
                      <span className="text-gray-400 text-sm">({clinic.review_count})</span>
                      <span className="text-gray-300">•</span>
                      <span className="text-sm text-gray-500">{clinic.distance}</span>
                    </div>
                    
                    <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="truncate">{clinic.address}</span>
                    </div>
                    
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-sm text-gray-500">{clinic.timing}</span>
                        {clinic.is_open !== undefined && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ml-1 ${
                            clinic.is_open ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {clinic.is_open ? 'Open' : 'Closed'}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-medium text-orange-600">{clinic.price_range}</span>
                    </div>

                    {/* Service Tags */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {clinic.services.slice(0, 3).map((service, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-600">
                          {service}
                        </span>
                      ))}
                      {clinic.services.length > 3 && (
                        <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-600">
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
    </>
  );
}
