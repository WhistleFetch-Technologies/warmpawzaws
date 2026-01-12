import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { ArrowLeft, Home, MapPin, Star, User, Clock, ChevronRight, Phone, Search, X } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface VetAtHomeProps {
  onBack: () => void;
  customerId: string;
  customerData: any;
  phone: string;
  onNavigate: (screen: string, data?: any) => void;
}

export function VetAtHome({ onBack, customerId, customerData, phone, onNavigate }: VetAtHomeProps) {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadHomeVets();
  }, []);

  const loadHomeVets = async () => {
    try {
      // Get customer location if available
      const customerLocation = customerData?.address;
      const latitude = customerLocation?.latitude;
      const longitude = customerLocation?.longitude;
      
      // Build query params
      const params = new URLSearchParams({
        roleId: 'veterinarian',
        serviceStyle: 'at_home'
      });
      
      // Add location if available
      if (latitude && longitude) {
        params.append('latitude', latitude.toString());
        params.append('longitude', longitude.toString());
      }
      
      console.log('🔍 [VET-AT-HOME] Discovering vets with home services enabled...');
      console.log('   Customer location:', { latitude, longitude });
      console.log('   API URL:', `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/discover-staff?${params}`);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/discover-staff?${params}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );

      console.log('   Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ [VET-AT-HOME] Discovered home visit vets:', data);
        console.log('   Total staff found:', data.staff?.length || 0);
        
        // Map staff to vendor-like format for display
        const staffVendors = (data.staff || []).map((staff: any) => ({
          id: staff.id,
          staffId: staff.id,
          vendorId: staff.vendorId,
          businessName: staff.vendorName,
          fullName: staff.fullName,
          photo: staff.photo,
          rating: staff.rating,
          reviewCount: staff.reviewCount,
          services: staff.services,
          servicesCount: staff.servicesCount,
          distance: staff.distance,
          location: staff.vendorLocation,
          roleType: staff.roleType,
          roleName: staff.roleName,
          specializations: staff.specializations,
          isOnline: staff.isOnline
        }));
        
        setVendors(staffVendors);
        console.log(`✅ [VET-AT-HOME] Found ${staffVendors.length} vets available for home visits`);
      } else {
        const error = await response.json();
        console.error('❌ [VET-AT-HOME] Error:', error);
      }
    } catch (error) {
      console.error('❌ [VET-AT-HOME] Error loading home vet services:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBookVet = (vendor: any) => {
    onNavigate('home_service_book', {
      vendorId: vendor.vendorId,
      staffId: vendor.staffId,
      staffName: vendor.fullName,
      vendorName: vendor.businessName,
      services: vendor.services,
      serviceStyle: 'at_home'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white max-w-[430px] mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  // Filter vendors based on search
  const filteredVendors = vendors.filter(vendor => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      vendor.fullName?.toLowerCase().includes(query) ||
      vendor.businessName?.toLowerCase().includes(query) ||
      vendor.specializations?.some((s: string) => s.toLowerCase().includes(query)) ||
      vendor.services?.some((s: any) => s.serviceName?.toLowerCase().includes(query))
    );
  });

  return (
    <div className="min-h-screen bg-[#FF8C42] max-w-md mx-auto">
      {/* Header */}
      <div className="bg-[#FF8C42] px-6 pt-12 pb-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onBack}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center transition-colors hover:bg-white/30"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-white text-2xl font-bold">Home Visit</h1>
            <p className="text-white/90 text-sm">Vets come to your home</p>
          </div>
        </div>
        
        {/* Search Bar */}
        {vendors.length > 0 && (
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
            <input
              type="text"
              placeholder="Search vets or services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-12 py-3 rounded-xl bg-white/20 backdrop-blur-sm text-white placeholder-white/70 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2"
              >
                <X className="w-5 h-5 text-white/70" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-6 -mt-4 bg-white rounded-t-[32px] pt-8 pb-24 min-h-[calc(100vh-180px)]">
        {filteredVendors.length === 0 && vendors.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Home className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Home Visit Vets Available</h3>
            <p className="text-sm text-gray-600 mb-4">
              No vets have enabled home services in your area yet.
            </p>
            {!customerData?.address?.latitude && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3 max-w-sm mx-auto">
                <p className="text-xs text-yellow-800">
                  💡 Tip: Add your location in profile for distance-based filtering
                </p>
              </div>
            )}
            <p className="text-xs text-gray-500">
              Try booking a clinic visit or check back later.
            </p>
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Search className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Results Found</h3>
            <p className="text-sm text-gray-600 mb-4">
              No vets match "{searchQuery}"
            </p>
            <Button
              onClick={() => setSearchQuery('')}
              className="bg-[#FF8C42] hover:bg-[#ff7a28]"
            >
              Clear Search
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                {searchQuery ? 'Search Results' : 'Available Vets'}
              </h2>
              <p className="text-sm text-gray-600">
                {filteredVendors.length} vet{filteredVendors.length !== 1 ? 's' : ''} {searchQuery ? 'found' : 'available for home visit'}
              </p>
            </div>

            <div className="space-y-3">
              {filteredVendors.map((vendor, index) => (
                <Card key={index} className="p-4 border-gray-200 hover:border-[#FF8C42]/30 transition-all">
                  <div className="flex items-start gap-4">
                    {vendor.photo ? (
                      <img
                        src={vendor.photo}
                        alt={vendor.fullName}
                        className="w-16 h-16 rounded-2xl object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                        <User className="w-8 h-8 text-white" />
                      </div>
                    )}

                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{vendor.fullName}</h3>
                      
                      {vendor.specializations && vendor.specializations.length > 0 && (
                        <p className="text-xs text-gray-500 mb-1">
                          {vendor.specializations.join(', ')}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                        <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        <span>{vendor.rating || '4.5'}</span>
                        <span>•</span>
                        <span>{vendor.reviewCount || '0'} reviews</span>
                      </div>
                      
                      {vendor.distance && (
                        <div className="flex items-center gap-1 text-xs text-green-600 mb-2">
                          <MapPin className="w-3 h-3" />
                          <span>{vendor.distance.toFixed(1)} km away</span>
                        </div>
                      )}
                      
                      {vendor.businessName && (
                        <div className="flex items-start gap-1 text-xs text-gray-500 mb-2">
                          <Home className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-1">{vendor.businessName}</span>
                        </div>
                      )}
                      
                      {/* Services Preview */}
                      {vendor.services && vendor.services.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs text-gray-500 mb-1">{vendor.servicesCount} services available</p>
                          <div className="flex flex-wrap gap-1">
                            {vendor.services.slice(0, 3).map((service: any, idx: number) => (
                              <span
                                key={idx}
                                className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full"
                              >
                                {service.serviceName}
                              </span>
                            ))}
                            {vendor.services.length > 3 && (
                              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                                +{vendor.services.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div>
                          {vendor.services && vendor.services.length > 0 && (
                            <div>
                              <p className="text-xs text-gray-500">Starting from</p>
                              <p className="text-sm text-gray-900 font-semibold">
                                ₹{vendor.services[0].price || '500'}
                              </p>
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleBookVet(vendor)}
                          className="bg-gradient-to-r from-green-500 to-green-600 hover:shadow-lg"
                        >
                          Book Now
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
