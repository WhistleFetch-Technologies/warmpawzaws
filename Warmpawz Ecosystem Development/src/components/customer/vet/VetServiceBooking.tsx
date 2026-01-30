import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import {
  ArrowLeft,
  Star,
  Clock,
  MapPin,
  Calendar,
  Video,
  Building2,
  Home as HomeIcon,
  FlaskConical,
  Pill,
  ChevronRight,
  Check,
  Package
} from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';
import { VetTimeSlotSelection } from './VetTimeSlotSelection';
import { VetPaymentScreen } from './VetPaymentScreen';
import { VetBookingSuccess } from './VetBookingSuccess';
import { FacilityView } from '../FacilityView';

interface VetServiceBookingProps {
  phone: string;
  serviceType: string; // 'tele', 'clinic', 'home', 'lab', 'medicine'
  vendorId?: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  onSelectionComplete?: (data: {
    petId: string;
    petName: string;
    petType: string;
    vendorId: string;
    vendorName: string;
    serviceId: string;
    serviceName: string;
    servicePrice: number;
    serviceDuration: number;
  }) => void;
}

type BookingStep = 'select' | 'timeslot' | 'payment' | 'success';

export function VetServiceBooking({ phone, serviceType, vendorId, onBack, onNavigate, onSelectionComplete }: VetServiceBookingProps) {
  const [currentStep, setCurrentStep] = useState<BookingStep>('select');
  const [loading, setLoading] = useState(true);
  const [pets, setPets] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [selectedPet, setSelectedPet] = useState<string>('');
  const [selectedVendor, setSelectedVendor] = useState<string>(vendorId || '');
  const [selectedService, setSelectedService] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [showFacilityView, setShowFacilityView] = useState(false);
  const [facilityVendorId, setFacilityVendorId] = useState<string>('');

  useEffect(() => {
    loadData();
  }, [serviceType]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load pets
      const petsRes = await fetch(
        `${getApiBaseUrl()}/customer/pets/${phone}`,
        { headers: { Authorization: (getAuthHeaders().Authorization || "") } }
      );
      if (petsRes.ok) {
        const petsData = await petsRes.json();
        setPets(petsData.pets?.pets || []);
      }

      // Load all services
      const servicesRes = await fetch(
        `${getApiBaseUrl()}/customer/services?roleId=veterinarian`,
        { headers: { Authorization: (getAuthHeaders().Authorization || "") } }
      );

      if (servicesRes.ok) {
        const servicesData = await servicesRes.json();
        console.log('📦 All services loaded:', servicesData);

        // Filter services based on service type ONLY (already filtered by roleId=veterinarian in API)
        const vetServices = servicesData.services?.filter((service: any) => {
          const serviceStyle = (service.serviceStyle || '').toLowerCase();
          const serviceName = (service.name || service.serviceName || '').toLowerCase();
          
          // Match service type
          let matchesType = false;
          if (serviceType === 'tele') {
            matchesType = serviceStyle.includes('tele') || 
                         serviceStyle.includes('video') ||
                         serviceName.includes('tele') ||
                         serviceName.includes('video') ||
                         serviceName.includes('online');
          } else if (serviceType === 'clinic') {
            matchesType = serviceStyle.includes('center') || 
                         serviceStyle.includes('clinic') ||
                         serviceName.includes('clinic') ||
                         serviceName.includes('center');
          } else if (serviceType === 'home') {
            matchesType = serviceStyle.includes('home') || 
                         serviceStyle.includes('doorstep') ||
                         serviceName.includes('home') ||
                         serviceName.includes('visit');
          } else if (serviceType === 'lab') {
            matchesType = serviceName.includes('lab') ||
                         serviceName.includes('test') ||
                         serviceName.includes('diagnostic');
          } else if (serviceType === 'medicine') {
            matchesType = serviceName.includes('medicine') ||
                         serviceName.includes('pharmacy') ||
                         serviceName.includes('medication');
          }
          
          return matchesType;
        }) || [];

        console.log(`🎯 Filtered ${vetServices.length} services for type: ${serviceType}`);
        setServices(vetServices);

        // Extract unique vendors
        const vendorMap = new Map();
        vetServices.forEach((service: any) => {
          if (!vendorMap.has(service.vendorId)) {
            vendorMap.set(service.vendorId, {
              id: service.vendorId,
              name: service.vendorName,
              rating: service.vendorRating || 4.5,
              reviews: service.vendorReviewCount || 0,
              location: service.vendorLocation,
              services: []
            });
          }
          vendorMap.get(service.vendorId).services.push(service);
        });

        const vendorsList = Array.from(vendorMap.values());
        console.log(`👨‍⚕️ Found ${vendorsList.length} vendors for ${serviceType}`);
        setVendors(vendorsList);

        // If vendorId was provided, auto-select it
        if (vendorId && vendorMap.has(vendorId)) {
          setSelectedVendor(vendorId);
        }
      }
    } catch (error) {
      console.error('❌ Error loading booking data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getServiceIcon = () => {
    switch (serviceType) {
      case 'tele': return Video;
      case 'clinic': return Building2;
      case 'home': return HomeIcon;
      case 'lab': return FlaskConical;
      case 'medicine': return Pill;
      default: return Video;
    }
  };

  const getServiceTitle = () => {
    switch (serviceType) {
      case 'tele': return 'Tele Consultation';
      case 'clinic': return 'Clinic Visit';
      case 'home': return 'Home Visit';
      case 'lab': return 'Lab Tests';
      case 'medicine': return 'Medicine Order';
      default: return 'Vet Service';
    }
  };

  const handleBooking = () => {
    if (!selectedPet || !selectedVendor || !selectedService) {
      alert('Please select a pet, vendor, and service');
      return;
    }

    // If onSelectionComplete callback is provided, use the new flow
    if (onSelectionComplete) {
      const selectedPetData = pets.find(p => p.id === selectedPet);
      const selectedServiceData = vendorServices.find((s: any) => s.id === selectedService);
      
      onSelectionComplete({
        petId: selectedPet,
        petName: selectedPetData?.name || 'Pet',
        petType: selectedPetData?.type || 'Pet',
        vendorId: selectedVendor,
        vendorName: selectedVendorData?.name || 'Vendor',
        serviceId: selectedService,
        serviceName: selectedServiceData?.serviceName || selectedServiceData?.name || 'Service',
        servicePrice: selectedServiceData?.price || selectedServiceData?.customPrice || 0,
        serviceDuration: selectedServiceData?.duration || selectedServiceData?.customDuration || 30
      });
      return;
    }

    // Otherwise, use old direct booking flow (backward compatibility)
    handleDirectBooking();
  };

  const handleDirectBooking = async () => {
    try {
      const bookingPayload = {
        phone,
        petId: selectedPet,
        vendorId: selectedVendor,
        serviceId: selectedService,
        serviceType,
        scheduledDate: selectedDate || new Date().toISOString().split('T')[0],
        scheduledTime: selectedTime || '10:00',
      };
      
      console.log('🎯 [CLIENT] Creating booking with payload:', bookingPayload);
      
      // Create booking
      const response = await fetch(
        `${getApiBaseUrl()}/customer/bookings/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: (getAuthHeaders().Authorization || ""),
          },
          body: JSON.stringify(bookingPayload),
        }
      );

      const result = await response.json();
      
      console.log('📥 [CLIENT] Booking response:', result);
      
      if (response.ok && result.success) {
        console.log('✅ [CLIENT] Booking confirmed:', result.booking.id);
        alert(`✅ ${result.message || 'Booking confirmed!'}\n\nBooking ID: ${result.booking.id}`);
        onBack();
      } else {
        const errorMsg = result.error || 'Unknown error';
        console.error('Booking error:', result);
        alert(`❌ Booking failed: ${errorMsg}`);
      }
    } catch (error) {
      console.error('❌ Booking error:', error);
      alert('Failed to create booking. Please try again.');
    }
  };

  const ServiceIcon = getServiceIcon();

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  if (vendors.length === 0) {
    return (
      <div className="min-h-screen bg-white max-w-md mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#FF8C42] to-[#FF7029] text-white px-6 pt-8 pb-16 relative">
          <button onClick={onBack} className="mb-4 flex items-center gap-2">
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              <ServiceIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{getServiceTitle()}</h1>
              <p className="text-white/80 text-sm">Book a service</p>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-white" 
               style={{
                 borderTopLeftRadius: '50% 100%',
                 borderTopRightRadius: '50% 100%',
               }}
          />
        </div>

        {/* Empty State */}
        <div className="px-6 py-12 text-center">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <ServiceIcon className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No Services Available</h3>
          <p className="text-gray-600 mb-6">
            There are no {getServiceTitle().toLowerCase()} services available at the moment.
          </p>
          <Button onClick={onBack} className="bg-[#FF8C42] hover:bg-[#FF7029]">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const selectedVendorData = vendors.find(v => v.id === selectedVendor);
  const vendorServices = selectedVendorData?.services || [];

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#FF8C42] to-[#FF7029] text-white px-6 pt-8 pb-16 relative">
        <button onClick={onBack} className="mb-4 flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            <ServiceIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{getServiceTitle()}</h1>
            <p className="text-white/80 text-sm">Book a service</p>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-white" 
             style={{
               borderTopLeftRadius: '50% 100%',
               borderTopRightRadius: '50% 100%',
             }}
        />
      </div>

      {/* Booking Form */}
      <div className="px-6 space-y-6">
        {/* Step 1: Select Pet */}
        <div>
          <h2 className="text-lg font-semibold mb-3">1. Select Your Pet</h2>
          {pets.length === 0 ? (
            <Card className="p-4 bg-orange-50 border-orange-200">
              <p className="text-sm text-orange-800">No pets found. Please add a pet first.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {pets.map((pet) => (
                <Card
                  key={pet.id}
                  className={`p-4 cursor-pointer transition-all ${
                    selectedPet === pet.id
                      ? 'border-2 border-[#FF8C42] bg-orange-50'
                      : 'border border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedPet(pet.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-xl">{pet.type === 'Dog' ? '🐕' : '🐈'}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{pet.name}</h3>
                      <p className="text-sm text-gray-600">{pet.breed} • {pet.type}</p>
                    </div>
                    {selectedPet === pet.id && (
                      <Check className="w-5 h-5 text-[#FF8C42]" />
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Step 2: Select Vendor */}
        <div>
          <h2 className="text-lg font-semibold mb-3">2. Choose Provider</h2>
          <div className="space-y-3">
            {vendors.map((vendor) => (
              <Card
                key={vendor.id}
                className={`p-4 cursor-pointer transition-all ${
                  selectedVendor === vendor.id
                    ? 'border-2 border-[#FF8C42] bg-orange-50'
                    : 'border border-gray-200 hover:shadow-md'
                }`}
                onClick={() => {
                  setSelectedVendor(vendor.id);
                  setSelectedService(''); // Reset service selection
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-gradient-to-br from-[#FF8C42] to-[#FF7029] rounded-xl flex items-center justify-center text-white text-lg font-bold">
                    {vendor.name?.charAt(0) || 'V'}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{vendor.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1 text-amber-500 text-xs">
                        <Star className="w-3 h-3 fill-current" />
                        <span>{vendor.rating}</span>
                        <span className="text-gray-400">({vendor.reviews})</span>
                      </div>
                      {vendor.location && (
                        <div className="flex items-center gap-1 text-gray-500 text-xs">
                          <MapPin className="w-3 h-3" />
                          <span>{vendor.location}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-gray-500">{vendor.services.length} services available</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Open facility view modal
                          setFacilityVendorId(vendor.id);
                          setShowFacilityView(true);
                        }}
                        className="text-xs text-[#FF8C42] hover:text-[#FF7029] font-medium flex items-center gap-1"
                      >
                        View Facility
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  {selectedVendor === vendor.id && (
                    <Check className="w-5 h-5 text-[#FF8C42]" />
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Step 3: Select Service */}
        {selectedVendor && vendorServices.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3">3. Choose Service</h2>
            <div className="space-y-3">
              {vendorServices.map((service: any) => {
                const serviceName = service.serviceName || service.name || 'Service';
                const serviceDesc = service.description || service.customDescription || '';
                const serviceDuration = service.duration || service.customDuration || 30;
                const servicePrice = service.price || service.customPrice || 0;
                const isPackage = service.isPackage || false;
                
                return (
                  <Card
                    key={service.id}
                    className={`p-3 cursor-pointer transition-all border-l-4 ${
                      selectedService === service.id
                        ? 'border-l-[#FF8C42] bg-orange-50 shadow-md'
                        : 'border-l-gray-300 hover:border-l-[#FF8C42] hover:shadow-sm'
                    }`}
                    onClick={() => setSelectedService(service.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Service Name */}
                        <div className="flex items-start gap-2 mb-1">
                          <h3 className="font-semibold text-sm leading-tight">
                            {serviceName}
                          </h3>
                          {isPackage && (
                            <Badge className="bg-purple-100 text-purple-700 text-xs px-1.5 py-0 h-5">
                              Package
                            </Badge>
                          )}
                        </div>
                        
                        {/* Duration */}
                        <div className="flex items-center gap-1 text-gray-500 text-xs mb-1">
                          <Clock className="w-3 h-3" />
                          <span>{serviceDuration} mins</span>
                        </div>
                        
                        {/* Location - if at_center */}
                        {selectedVendorData?.location && serviceType === 'clinic' && (
                          <div className="flex items-center gap-1 text-gray-500 text-xs truncate">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{selectedVendorData.location}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Price */}
                      <div className="text-right flex-shrink-0 ml-2">
                        <div className="text-base font-bold text-[#FF8C42]">
                          ₹{servicePrice}
                        </div>
                        {selectedService === service.id && (
                          <Check className="w-4 h-4 text-[#FF8C42] ml-auto mt-1" />
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Booking Button */}
        {selectedPet && selectedVendor && selectedService && (
          <div className="sticky bottom-0 bg-white pt-4 pb-6 -mx-6 px-6 border-t">
            <Button
              onClick={handleBooking}
              className="w-full bg-[#FF8C42] hover:bg-[#FF7029] h-12 text-base"
            >
              Confirm Booking
            </Button>
          </div>
        )}
      </div>

      {/* Facility View Modal */}
      {showFacilityView && (
        <FacilityView
          vendorId={facilityVendorId}
          onClose={() => setShowFacilityView(false)}
        />
      )}
    </div>
  );
}