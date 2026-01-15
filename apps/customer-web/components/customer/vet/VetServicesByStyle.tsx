'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Star, MapPin, Clock, Video, Home, Building2, ChevronRight, Filter, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';

interface VetServicesByStyleProps {
  phone: string;
  serviceStyle: string; // 'tele', 'at_home', 'at_center'
  serviceTypeName?: string;
  category?: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

interface VendorWithServices {
  vendorId: string;
  vendorName: string;
  phone: string;
  address: string;
  city: string;
  role: string;
  rating: string;
  reviewCount: number;
  services: {
    id: string;
    serviceId: string;
    name: string;
    price: number;
    duration: number;
    description: string;
    category: string;
  }[];
}

export function VetServicesByStyle({ 
  phone, 
  serviceStyle, 
  serviceTypeName,
  category = 'vet',
  onBack, 
  onNavigate 
}: VetServicesByStyleProps) {
  const [loading, setLoading] = useState(true);
  const [vendors, setVendors] = useState<VendorWithServices[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);

  useEffect(() => {
    loadServicesByStyle();
  }, [serviceStyle]);

  const loadServicesByStyle = async () => {
    try {
      setLoading(true);
      
      const response = await apiClient.get(
        `/customer/services/by-style?style=${serviceStyle}&category=${category}`
      ) as any;

      if (response.success && response.vendors) {
        setVendors(response.vendors);
        console.log(`Loaded ${response.vendors.length} vendors with ${serviceStyle} services`);
      } else {
        setVendors([]);
      }
    } catch (error) {
      console.error('Error loading services by style:', error);
      setVendors([]);
    } finally {
      setLoading(false);
    }
  };

  const getStyleIcon = () => {
    switch (serviceStyle) {
      case 'tele': return <Video className="w-5 h-5" />;
      case 'at_home': return <Home className="w-5 h-5" />;
      case 'at_center': return <Building2 className="w-5 h-5" />;
      default: return <Video className="w-5 h-5" />;
    }
  };

  const getStyleColor = () => {
    switch (serviceStyle) {
      case 'tele': return 'from-blue-500 to-blue-600';
      case 'at_home': return 'from-orange-500 to-orange-600';
      case 'at_center': return 'from-green-500 to-green-600';
      default: return 'from-blue-500 to-blue-600';
    }
  };

  const handleSelectService = (vendor: VendorWithServices, service: any) => {
    onNavigate('vet-booking', {
      vendorId: vendor.vendorId,
      vendorName: vendor.vendorName,
      serviceId: service.id,
      serviceName: service.name,
      serviceStyle,
      price: service.price,
      duration: service.duration,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#FF8C42] mx-auto mb-3" />
          <p className="text-gray-600">Loading available services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      {/* Header */}
      <div className={`bg-gradient-to-br ${getStyleColor()} text-white px-6 pt-8 pb-12 relative`}>
        <button 
          onClick={onBack}
          className="mb-4 flex items-center gap-2 text-white/90 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            {getStyleIcon()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{serviceTypeName || 'Services'}</h1>
            <p className="text-white/80 text-sm">
              {vendors.length} provider{vendors.length !== 1 ? 's' : ''} available
            </p>
          </div>
        </div>
        
        {/* Curved bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gray-50" 
             style={{
               borderTopLeftRadius: '50% 100%',
               borderTopRightRadius: '50% 100%',
             }}
        />
      </div>

      {/* Content */}
      <div className="px-4 pb-24 -mt-2">
        {vendors.length === 0 ? (
          <Card className="p-8 text-center bg-white">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              {getStyleIcon()}
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">No Services Available</h3>
            <p className="text-gray-500 text-sm mb-4">
              No {serviceTypeName?.toLowerCase() || 'services'} are currently available in your area.
            </p>
            <Button 
              onClick={onBack}
              variant="outline"
            >
              Try Other Services
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {vendors.map((vendor) => (
              <Card key={vendor.vendorId} className="bg-white overflow-hidden">
                {/* Vendor Header */}
                <div 
                  className="p-4 border-b cursor-pointer hover:bg-gray-50"
                  onClick={() => setSelectedVendor(
                    selectedVendor === vendor.vendorId ? null : vendor.vendorId
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-[#FF8C42] rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {vendor.vendorName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{vendor.vendorName}</h3>
                        <p className="text-gray-500 text-sm">{vendor.role}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-sm font-medium">{vendor.rating}</span>
                            <span className="text-gray-400 text-sm">({vendor.reviewCount})</span>
                          </div>
                          {vendor.city && (
                            <div className="flex items-center gap-1 text-gray-500 text-sm">
                              <MapPin className="w-3 h-3" />
                              {vendor.city}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${
                      selectedVendor === vendor.vendorId ? 'rotate-90' : ''
                    }`} />
                  </div>
                </div>

                {/* Services List - Expanded */}
                {selectedVendor === vendor.vendorId && (
                  <div className="bg-gray-50 p-4 space-y-3">
                    <h4 className="text-sm font-medium text-gray-600 mb-2">
                      Available Services ({vendor.services.length})
                    </h4>
                    {vendor.services.map((service) => (
                      <div 
                        key={service.id}
                        className="bg-white rounded-lg p-4 shadow-sm border border-gray-100"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h5 className="font-medium text-gray-900">{service.name}</h5>
                            {service.description && (
                              <p className="text-gray-500 text-sm mt-1 line-clamp-2">
                                {service.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              <Badge variant="outline" className="text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                {service.duration} mins
                              </Badge>
                              {service.category && (
                                <Badge variant="secondary" className="text-xs">
                                  {service.category}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <div className="text-lg font-bold text-gray-900">
                              ₹{service.price}
                            </div>
                            <Button
                              size="sm"
                              className="mt-2 bg-[#FF8C42] hover:bg-[#E67A35] text-white"
                              onClick={() => handleSelectService(vendor, service)}
                            >
                              Book
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick Book - when not expanded */}
                {selectedVendor !== vendor.vendorId && vendor.services.length > 0 && (
                  <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      {vendor.services.length} service{vendor.services.length !== 1 ? 's' : ''} available
                      {vendor.services[0] && (
                        <span className="text-gray-900 font-medium"> from ₹{
                          Math.min(...vendor.services.map(s => s.price))
                        }</span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[#FF8C42] border-[#FF8C42] hover:bg-[#FF8C42]/10"
                      onClick={() => setSelectedVendor(vendor.vendorId)}
                    >
                      View Services
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
