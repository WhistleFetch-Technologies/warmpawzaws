import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { ArrowLeft, Clock, ChevronDown, ChevronUp, Plus, Check } from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

interface ServicePackageSelectorProps {
  vendorId: string;
  vendorName: string;
  serviceType: 'center' | 'home';
  onBack: () => void;
  onSelect: (services: any[], addOns: any[]) => void;
}

export function ServicePackageSelector({ 
  vendorId, 
  vendorName, 
  serviceType,
  onBack, 
  onSelect 
}: ServicePackageSelectorProps) {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<any[]>([]);
  const [selectedServices, setSelectedServices] = useState<any[]>([]);
  const [selectedAddOns, setSelectedAddOns] = useState<any[]>([]);
  const [expandedService, setExpandedService] = useState<string | null>(null);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      setLoading(true);
      
      console.log('📦 [SERVICE-SELECTOR] Loading services for vendor:', vendorId);
      console.log('📦 [SERVICE-SELECTOR] Service type:', serviceType);
      
      // Get vendor's services
      const response = await fetch(
        `${API_BASE}/vendor/${vendorId}/services`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('📦 [SERVICE-SELECTOR] API Response:', data);
        
        // Handle the nested structure from vendor-service-management API
        let allServices = [];
        
        if (data.success && data.services) {
          // Extract services based on service type
          const styleKey = serviceType === 'home' ? 'at_home' : 'at_center';
          
          if (data.services[styleKey] && Array.isArray(data.services[styleKey].services)) {
            allServices = data.services[styleKey].services;
            console.log(`📦 [SERVICE-SELECTOR] Found ${allServices.length} services for ${styleKey}`);
          } else {
            console.warn(`⚠️ [SERVICE-SELECTOR] No services found for ${styleKey}`);
          }
        } else if (Array.isArray(data)) {
          // Fallback: Direct array response
          allServices = data;
        } else if (data.services && Array.isArray(data.services)) {
          // Fallback: Nested services array
          allServices = data.services;
        } else {
          console.warn('⚠️ [SERVICE-SELECTOR] Unexpected response format:', data);
        }
        
        console.log('📦 [SERVICE-SELECTOR] All services before filter:', allServices.length);
        
        // Filter only published services
        const publishedServices = allServices.filter((s: any) => 
          s.publishStatus === 'published' || s.isPublished === true
        );
        
        console.log('✅ [SERVICE-SELECTOR] Published services:', publishedServices.length);
        
        setServices(publishedServices);
      } else {
        console.error('❌ [SERVICE-SELECTOR] API Error:', response.status);
        const errorText = await response.text();
        console.error('❌ [SERVICE-SELECTOR] Error details:', errorText);
        setServices([]);
      }
    } catch (error) {
      console.error('❌ [SERVICE-SELECTOR] Error loading services:', error);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleService = (service: any) => {
    setSelectedServices(prev => {
      const exists = prev.find(s => 
        (s.id || s.serviceId) === (service.id || service.serviceId)
      );
      if (exists) {
        return prev.filter(s => 
          (s.id || s.serviceId) !== (service.id || service.serviceId)
        );
      } else {
        return [...prev, service];
      }
    });
    // Reset add-ons when changing service selection
    setSelectedAddOns([]);
  };

  const toggleAddOn = (addOn: any) => {
    setSelectedAddOns(prev => {
      const exists = prev.find(a => a.id === addOn.id);
      if (exists) {
        return prev.filter(a => a.id !== addOn.id);
      } else {
        return [...prev, addOn];
      }
    });
  };

  const getTotalPrice = () => {
    const servicesPrice = selectedServices.reduce((sum, service) => {
      const price = service.customPrice || service.price || 0;
      return sum + price;
    }, 0);
    const addOnsPrice = selectedAddOns.reduce((sum, addon) => sum + (addon.price || 0), 0);
    return servicesPrice + addOnsPrice;
  };

  const handleContinue = () => {
    if (selectedServices.length > 0) {
      onSelect(selectedServices, selectedAddOns);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FF8C42] max-w-md mx-auto pb-32">
      {/* Header */}
      <div className="bg-[#FF8C42] text-white px-6 pt-8 pb-8 sticky top-0 z-10">
        <button 
          onClick={onBack}
          className="mb-4 flex items-center gap-2 text-white/90 hover:text-white"
        >
          <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-white" />
          </div>
        </button>
        
        <h1 className="text-2xl font-bold mb-1">Select Service</h1>
        <p className="text-white/80 text-sm">{vendorName}</p>
      </div>

      {/* Content */}
      <div className="bg-white rounded-t-[32px] px-6 pt-8 pb-6 -mt-4 min-h-[calc(100vh-180px)]">
        {services.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No services available</p>
          </div>
        ) : (
          <>
            {/* Services List */}
            <div className="space-y-3 mb-6">
              {services.map((service, serviceIndex) => {
                const serviceId = service.id || service.serviceId || `service-${serviceIndex}`;
                const isSelected = selectedServices.some(s => 
                  (s.id || s.serviceId) === (service.id || service.serviceId)
                );
                const isExpanded = expandedService === serviceId;
                
                // Extract service data with fallbacks
                const serviceName = service.serviceName || service.name || 'Service';
                const servicePrice = service.customPrice || service.price || 0;
                const serviceDuration = service.customDuration || service.duration || 30;
                
                // ✅ FIXED: Dynamic description using category/subcategory instead of hardcoded fallback
                const serviceDescription = service.customDescription || 
                                          service.description || 
                                          (service.subCategoryName ? `${service.subCategoryName}` : 
                                           service.categoryName ? `${service.categoryName} Service` : 
                                           'Professional service');

                return (
                  <Card
                    key={serviceId}
                    className={`overflow-hidden transition-all ${
                      isSelected 
                        ? 'border-2 border-[#FF8C42] bg-orange-50' 
                        : 'border border-gray-200 bg-white'
                    }`}
                  >
                    <div 
                      className="p-4 cursor-pointer"
                      onClick={() => toggleService(service)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900">{serviceName}</h3>
                            {service.isPopular && (
                              <Badge className="bg-green-100 text-green-600 border-none text-xs">
                                Popular
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-2">
                            {serviceDescription}
                          </p>
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-[#FF8C42]">
                              ₹{servicePrice}
                            </span>
                            <div className="flex items-center gap-1 text-sm text-gray-500">
                              <Clock className="w-4 h-4" />
                              <span>{serviceDuration} mins</span>
                            </div>
                          </div>
                        </div>
                        
                        {isSelected && (
                          <div className="w-6 h-6 bg-[#FF8C42] rounded-full flex items-center justify-center flex-shrink-0 ml-2">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>

                      {/* What's Included */}
                      {service.includedItems && service.includedItems.length > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedService(isExpanded ? null : serviceId);
                          }}
                          className="flex items-center gap-2 text-sm text-[#FF8C42] hover:text-[#FF7029]"
                        >
                          <span>What's included</span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Expandable Content */}
                    {isExpanded && service.includedItems && (
                      <div className="px-4 pb-4 border-t border-gray-200 pt-3 bg-gray-50">
                        <ul className="space-y-2">
                          {service.includedItems.map((item: string, index: number) => (
                            <li key={`${serviceId}-item-${index}`} className="flex items-start gap-2 text-sm text-gray-700">
                              <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* Add-Ons Section */}
            {selectedServices.length > 0 && selectedServices.some(s => s.addOns && s.addOns.length > 0) && (
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Available Add-Ons</h3>
                <div className="space-y-2">
                  {selectedServices.flatMap(service => 
                    service.addOns || []
                  ).map((addOn: any, addOnIndex: number) => {
                    const addOnId = addOn.id || addOn.addOnId || `addon-${addOnIndex}`;
                    const isSelected = selectedAddOns.some(a => (a.id || a.addOnId) === addOnId);

                    return (
                      <Card
                        key={addOnId}
                        className={`p-3 cursor-pointer transition-all ${
                          isSelected 
                            ? 'border-2 border-[#FF8C42] bg-orange-50' 
                            : 'border border-gray-200 hover:border-[#FF8C42]'
                        }`}
                        onClick={() => toggleAddOn(addOn)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm">{addOn.name}</h4>
                            <p className="text-xs text-gray-500">{addOn.description}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#FF8C42]">+₹{addOn.price}</span>
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              isSelected 
                                ? 'bg-[#FF8C42] border-[#FF8C42]' 
                                : 'border-gray-300'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Fixed Bottom Bar */}
      {selectedServices.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 max-w-md mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm text-gray-600">Total Price</p>
              <p className="text-2xl font-bold text-[#FF8C42]">₹{getTotalPrice()}</p>
              {selectedServices.length > 1 && (
                <p className="text-xs text-gray-500">
                  {selectedServices.length} services selected
                </p>
              )}
              {selectedAddOns.length > 0 && (
                <p className="text-xs text-gray-500">
                  + {selectedAddOns.length} add-on{selectedAddOns.length > 1 ? 's' : ''}
                </p>
              )}
            </div>
            <Button
              className="bg-[#FF8C42] text-white hover:bg-[#FF7029]"
              onClick={handleContinue}
            >
              Continue
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}