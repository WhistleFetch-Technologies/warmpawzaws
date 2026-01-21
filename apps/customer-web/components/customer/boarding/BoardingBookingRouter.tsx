"use client";

/**
 * BoardingBookingRouter - Complete Boarding Service Booking Flow
 * 
 * Based on VetBookingRouter pattern - complete booking lifecycle:
 * - Service selection (Overnight, Daycare)
 * - Date range selection (check-in/check-out)
 * - Pet selection
 * - Room selection (if available)
 * - Payment integration (UniversalPaymentPage)
 * - Confirmation
 */

import { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, Moon, Sun, Calendar, Clock, MapPin, User, 
  CheckCircle2, Package, Plus, X, Upload, Building2, Home, Dog, Cat
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { UniversalPaymentPage } from '../payment/UniversalPaymentPage';
import { BookingConfirmationPage } from '../payment/BookingConfirmationPage';
import { EnhancedAddPetModal } from '../EnhancedAddPetModal';

interface BoardingBookingRouterProps {
  phone: string;
  vendorId?: string;
  facility?: any;
  selectedService?: string;
  serviceType?: string;
  serviceId?: string;
  serviceName?: string;
  serviceStyle?: string;
  price?: number;
  duration?: number;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  onViewBooking?: (bookingId: string) => void;
}

type BookingStep = 'service' | 'datetime' | 'pet' | 'room' | 'payment' | 'confirmation';

interface TimeSlot {
  time: string;
  available: boolean;
}

interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string;
}

interface Room {
  id: string;
  name: string;
  description?: string;
  capacity: number;
  pricePerNight: number;
  available: boolean;
  amenities?: string[];
}

export function BoardingBookingRouter({ 
  phone, 
  vendorId, 
  facility, 
  selectedService, 
  serviceType,
  serviceId,
  serviceName,
  serviceStyle,
  price,
  duration,
  onBack, 
  onNavigate, 
  onViewBooking 
}: BoardingBookingRouterProps) {
  // Service context logic
  const hasServiceContext = (serviceType || serviceStyle) && (serviceId || selectedService);
  const initialStep: BookingStep = hasServiceContext ? 'datetime' : 'service';
  const [step, setStep] = useState<BookingStep>(initialStep);
  
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current && hasServiceContext && step === 'service') {
      setStep('datetime');
      initializedRef.current = true;
    }
  }, [serviceId, serviceType, serviceStyle, step, hasServiceContext]);

  const [loading, setLoading] = useState(false);
  const [selectedServiceType, setSelectedServiceType] = useState(serviceStyle || serviceType || 'overnight');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [checkInTime, setCheckInTime] = useState('10:00');
  const [checkOutTime, setCheckOutTime] = useState('10:00');
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [paymentBookingId, setPaymentBookingId] = useState<string | null>(null);
  const [vendorServices, setVendorServices] = useState<any[]>([]);
  const [selectedVendorService, setSelectedVendorService] = useState<any>(
    serviceId ? {
      id: serviceId,
      serviceId: serviceId,
      name: serviceName,
      price: price,
      duration: duration,
      serviceStyle: serviceStyle || serviceType
    } : null
  );
  
  // Package awareness
  const [activePackage, setActivePackage] = useState<any>(null);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [usePackageSession, setUsePackageSession] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [bookingIdempotencyKey, setBookingIdempotencyKey] = useState<string | null>(null);
  
  // Modal states
  const [showAddPetModal, setShowAddPetModal] = useState(false);

  // Default boarding service options
  const defaultServiceTypeOptions = [
    { id: 'overnight', name: 'Overnight Stay', icon: Moon, price: 999, duration: 1440, desc: 'Full night accommodation', color: 'indigo' },
    { id: 'daycare', name: 'Day Care', icon: Sun, price: 499, duration: 480, desc: 'Daily care & supervision', color: 'orange' },
  ];

  const serviceOptions = vendorServices.length > 0 
    ? vendorServices.map(s => ({
        id: s.id || s.serviceId,
        serviceId: s.serviceId || s.service_id,
        name: s.serviceName || s.service_name || s.name,
        price: s.price || 0,
        duration: s.duration || 1440,
        desc: s.description || '',
        serviceStyle: s.serviceStyle || s.service_style,
        icon: s.serviceStyle === 'overnight' ? Moon : Sun,
        color: s.serviceStyle === 'overnight' ? 'indigo' : 'orange',
      }))
    : defaultServiceTypeOptions;

  const generateDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push({
        date: date.toISOString().split('T')[0],
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: date.getDate(),
        month: date.toLocaleDateString('en-US', { month: 'short' }),
      });
    }
    return dates;
  };

  const [dates] = useState(generateDates());

  useEffect(() => {
    loadCustomerData();
    if (vendorId) {
      loadVendorServices();
      loadRooms();
    }
  }, [phone, vendorId]);

  const loadVendorServices = async () => {
    if (!vendorId) return;
    
    try {
      setLoading(true);
      const servicesResponse = await apiClient.get(`/customer/vendor/${vendorId}/services?category=boarding`) as any;
      if (servicesResponse.success && servicesResponse.services) {
        setVendorServices(servicesResponse.services);
      }
    } catch (error) {
      console.error('Error loading vendor services:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRooms = async () => {
    if (!vendorId) return;
    
    try {
      const roomsResponse = await apiClient.get(`/vendor/${vendorId}/rooms`) as any;
      if (roomsResponse.success && roomsResponse.rooms) {
        setRooms(roomsResponse.rooms.map((r: any) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          capacity: r.capacity || 1,
          pricePerNight: r.pricePerNight || r.price_per_night || 0,
          available: r.isAvailable ?? true,
          amenities: r.amenities || [],
        })));
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
      // Use default rooms
      setRooms([
        { id: 'standard', name: 'Standard Room', capacity: 1, pricePerNight: 800, available: true },
        { id: 'deluxe', name: 'Deluxe Suite', capacity: 2, pricePerNight: 1500, available: true },
      ]);
    }
  };

  const loadCustomerData = async () => {
    try {
      const petsResponse = await apiClient.get(`/customer/pets/${phone}`) as any;
      if (petsResponse.pets && petsResponse.pets.length > 0) {
        setPets(petsResponse.pets.map((p: any) => ({
          id: p.id,
          name: p.name,
          species: p.species || p.type,
          breed: p.breed,
        })));
      }
      
      try {
        const profileResponse = await apiClient.get(`/customer/profile?phone=${encodeURIComponent(phone)}`) as any;
        if (profileResponse?.profile?.id || profileResponse?.id) {
          setCustomerId(profileResponse?.profile?.id || profileResponse?.id);
        }
      } catch (profileErr) {
        console.log('Could not get customer ID');
      }
    } catch (error) {
      console.error('Error loading customer data:', error);
      setPets([]);
    }
  };
  
  const refreshPets = async () => {
    try {
      const petsResponse = await apiClient.get(`/customer/pets/${phone}`) as any;
      if (petsResponse.pets && petsResponse.pets.length > 0) {
        const mappedPets = petsResponse.pets.map((p: any) => ({
          id: p.id,
          name: p.name,
          species: p.species || p.type,
          breed: p.breed,
        }));
        setPets(mappedPets);
        if (mappedPets.length > 0) {
          setSelectedPet(mappedPets[mappedPets.length - 1]);
        }
      }
    } catch (err) {
      console.error('Error refreshing pets:', err);
    }
  };

  const checkForActivePackages = async () => {
    if (!customerId || !vendorId) return;
    
    try {
      const response = await apiClient.get<any>(
        `/packages/check-for-booking?customerId=${customerId}&vendorId=${vendorId}&serviceType=boarding`
      );

      if (response?.hasActivePackage && response?.package) {
        setActivePackage(response.package);
        setShowPackageModal(true);
      }
    } catch (error: any) {
      console.log('No active packages found');
    }
  };

  useEffect(() => {
    if (customerId && vendorId && step === 'service') {
      checkForActivePackages();
    }
  }, [customerId, vendorId, step]);

  const handleUsePackageSession = async () => {
    if (!activePackage) return;
    setUsePackageSession(true);
    setShowPackageModal(false);
    toast.success('Using package session - No payment required!');
    setStep('datetime');
  };

  const handleBookNew = () => {
    setShowPackageModal(false);
    setUsePackageSession(false);
  };

  const calculateNights = () => {
    if (!checkInDate || !checkOutDate) return 0;
    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const calculateTotalPrice = () => {
    const nights = calculateNights();
    const basePrice = selectedRoom?.pricePerNight || price || 0;
    return nights * basePrice;
  };

  const handleNext = () => {
    const steps: BookingStep[] = ['service', 'datetime', 'pet', 'room', 'payment', 'confirmation'];
    const currentIdx = steps.indexOf(step);
    
    // Skip room selection if no rooms available
    if (step === 'pet' && rooms.length === 0) {
      handleCreateBookingForPayment();
      return;
    }
    
    if (step === 'room') {
      handleCreateBookingForPayment();
      return;
    }
    
    if (currentIdx < steps.length - 1) {
      setStep(steps[currentIdx + 1]);
    }
  };

  const handleCreateBookingForPayment = async () => {
    if (processing) return;
    
    if (!selectedPet || !checkInDate || !checkOutDate) {
      toast.error('Please complete all required fields');
      return;
    }

    if (!customerId) {
      toast.error('Customer ID not found. Please try again.');
      return;
    }

    if (!vendorId) {
      toast.error('Vendor ID is required');
      return;
    }

    setProcessing(true);
    try {
      const selectedServiceOption = serviceOptions.find(s => s.id === selectedServiceType);
      let serviceIdValue = (selectedServiceOption as any)?.serviceId || 
                          selectedVendorService?.serviceId || 
                          serviceId;

      // UUID validation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      if (!serviceIdValue || !uuidRegex.test(serviceIdValue)) {
        toast.error('Service ID is required. Please select a boarding option.');
        setProcessing(false);
        return;
      }

      const totalAmount = calculateTotalPrice();
      
      // Generate idempotency key
      let idempotencyKey = bookingIdempotencyKey;
      if (!idempotencyKey) {
        idempotencyKey = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
        setBookingIdempotencyKey(idempotencyKey);
      }

      const bookingData: any = {
        customerId: customerId,
        vendorId: vendorId,
        serviceId: serviceIdValue,
        bookingDate: checkInDate,
        bookingTime: checkInTime,
        serviceType: selectedServiceType,
        petId: selectedPet?.id,
        notes: notes || undefined,
        idempotencyKey,
        // Boarding-specific fields
        checkInDate,
        checkOutDate,
        checkInTime,
        checkOutTime,
        roomId: selectedRoom?.id,
        numberOfNights: calculateNights(),
      };

      if (!usePackageSession && totalAmount > 0) {
        bookingData.amount = totalAmount;
      }

      console.log('📤 Creating boarding booking:', bookingData);

      const endpoints = ['/bookings/create', '/booking/create'];
      let response: any;
      let lastError: any = null;

      for (const endpoint of endpoints) {
        try {
          response = await apiClient.post(endpoint, bookingData) as any;
          break;
        } catch (error: any) {
          lastError = error;
          if (error?.statusCode !== 404) throw error;
        }
      }

      if (!response) {
        throw lastError || new Error('Booking creation failed');
      }

      const newBookingId = response.data?.bookingId || response.bookingId || response.booking?.id || 'BK-' + Date.now();
      setPaymentBookingId(newBookingId);
      setBookingIdempotencyKey(null);
      setStep('payment');
    } catch (err: any) {
      console.error('Error creating booking:', err);
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to create booking';
      toast.error(errorMessage);
      setBookingIdempotencyKey(null);
    } finally {
      setProcessing(false);
    }
  };

  const handleBack = () => {
    const steps: BookingStep[] = ['service', 'datetime', 'pet', 'room', 'payment', 'confirmation'];
    const currentIdx = steps.indexOf(step);
    
    if (currentIdx > 0) {
      setStep(steps[currentIdx - 1]);
    } else {
      onBack();
    }
  };

  const handlePaymentSuccess = (paidBookingId: string) => {
    setBookingId(paidBookingId);
    setStep('confirmation');
    toast.success('Boarding booked successfully!');
  };

  const selectedServiceOption = serviceOptions.find(s => s.id === selectedServiceType);

  const renderStepIndicator = () => {
    const stepLabels = rooms.length > 0 
      ? ['Service', 'Dates', 'Pet', 'Room', 'Payment']
      : ['Service', 'Dates', 'Pet', 'Payment'];
    const currentStepMap: Record<BookingStep, number> = {
      service: 0, datetime: 1, pet: 2, room: 3, payment: rooms.length > 0 ? 4 : 3, confirmation: 5
    };
    const currentIdx = currentStepMap[step];

    return (
      <div className="flex items-center justify-center gap-2 mb-6">
        {stepLabels.map((s, idx) => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              idx <= currentIdx ? 'bg-[#FF8C42] text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {idx < currentIdx ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
            </div>
            {idx < stepLabels.length - 1 && (
              <div className={`w-8 h-0.5 ${idx < currentIdx ? 'bg-[#FF8C42]' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  // Payment step - use UniversalPaymentPage
  if (step === 'payment' && paymentBookingId) {
    return (
      <UniversalPaymentPage
        type="booking"
        customerPhone={phone}
        customerId={phone}
        bookingId={paymentBookingId}
        baseAmount={calculateTotalPrice()}
        serviceName={selectedServiceOption?.name || 'Boarding Service'}
        vendorId={vendorId || ''}
        vendorName={'Boarding Provider'}
        onBack={handleBack}
        onSuccess={handlePaymentSuccess}
      />
    );
  }

  // Confirmation step
  if (step === 'confirmation' && bookingId) {
    return (
      <BookingConfirmationPage
        bookingId={bookingId}
        type="booking"
        serviceName={selectedServiceOption?.name || 'Boarding'}
        vendorName={'Boarding Provider'}
        serviceStyle={selectedServiceType as 'at_home' | 'at_center' | 'tele'}
        bookingDate={checkInDate}
        bookingTime={checkInTime}
        petName={selectedPet?.name || ''}
        totalAmount={calculateTotalPrice()}
        onViewDetails={() => onViewBooking?.(bookingId)}
        onBackToHome={onBack}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto">
      <div className="px-4 py-6">
        {step !== 'confirmation' && renderStepIndicator()}

        {/* Service Selection */}
        {step === 'service' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Select Boarding Type</h2>
            <div className="space-y-3">
              {serviceOptions.map((service) => {
                const Icon = service.icon;
                const isSelected = selectedServiceType === service.id;
                return (
                  <button
                    key={service.id}
                    onClick={() => setSelectedServiceType(service.id)}
                    className={`w-full p-4 rounded-xl border-2 transition-all ${
                      isSelected 
                        ? 'border-[#FF8C42] bg-orange-50' 
                        : 'border-gray-200 bg-white hover:border-[#FF8C42]/50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                        service.color === 'indigo' ? 'bg-indigo-100 text-indigo-600' :
                        'bg-orange-100 text-orange-600'
                      }`}>
                        <Icon className="w-7 h-7" />
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="font-semibold text-gray-900">{service.name}</h3>
                        <p className="text-sm text-gray-500">{service.desc}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg text-gray-900">₹{service.price}</p>
                        <p className="text-xs text-gray-500">/night</p>
                        {isSelected && (
                          <CheckCircle2 className="w-6 h-6 text-orange-500 mt-1 ml-auto" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <Button 
              onClick={handleNext} 
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A35] mt-4"
              disabled={!selectedServiceType}
            >
              Continue
            </Button>
          </div>
        )}

        {/* Date Selection */}
        {step === 'datetime' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-3">Check-in Date</h2>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {dates.map((d) => (
                  <button
                    key={d.date}
                    onClick={() => {
                      setCheckInDate(d.date);
                      if (!checkOutDate || new Date(d.date) >= new Date(checkOutDate)) {
                        const nextDay = new Date(d.date);
                        nextDay.setDate(nextDay.getDate() + 1);
                        setCheckOutDate(nextDay.toISOString().split('T')[0]);
                      }
                    }}
                    className={`flex-shrink-0 w-16 p-3 rounded-xl text-center transition-all ${
                      checkInDate === d.date 
                        ? 'bg-orange-500 text-white' 
                        : 'bg-white border border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    <p className="text-xs opacity-75">{d.day}</p>
                    <p className="text-xl font-bold">{d.dayNum}</p>
                    <p className="text-xs opacity-75">{d.month}</p>
                  </button>
                ))}
              </div>
            </div>

            {checkInDate && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-3">Check-out Date</h2>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {dates.filter(d => new Date(d.date) > new Date(checkInDate)).map((d) => (
                    <button
                      key={d.date}
                      onClick={() => setCheckOutDate(d.date)}
                      className={`flex-shrink-0 w-16 p-3 rounded-xl text-center transition-all ${
                        checkOutDate === d.date 
                          ? 'bg-orange-500 text-white' 
                          : 'bg-white border border-gray-200 hover:border-orange-300'
                      }`}
                    >
                      <p className="text-xs opacity-75">{d.day}</p>
                      <p className="text-xl font-bold">{d.dayNum}</p>
                      <p className="text-xs opacity-75">{d.month}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {checkInDate && checkOutDate && (
              <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-600">Duration</p>
                    <p className="font-bold text-lg text-gray-900">{calculateNights()} night(s)</p>
                  </div>
                  <Calendar className="w-8 h-8 text-orange-500" />
                </div>
              </div>
            )}

            <Button 
              onClick={handleNext} 
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A35]"
              disabled={!checkInDate || !checkOutDate}
            >
              Continue
            </Button>
          </div>
        )}

        {/* Pet Selection */}
        {step === 'pet' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Select Your Pet</h2>
              <button
                onClick={() => setShowAddPetModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-orange-100 text-orange-600 rounded-lg text-sm font-medium hover:bg-orange-200 transition"
              >
                <Plus className="w-4 h-4" />
                Add Pet
              </button>
            </div>
            
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
              <Dog className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                A pet profile is required for boarding services.
              </p>
            </div>
            
            <div className="space-y-3">
              {pets.length > 0 ? (
                pets.map((pet) => (
                  <button
                    key={pet.id}
                    onClick={() => setSelectedPet(pet)}
                    className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                      selectedPet?.id === pet.id 
                        ? 'border-[#FF8C42] bg-orange-50' 
                        : 'border-gray-200 bg-white hover:border-[#FF8C42]/50'
                    }`}
                  >
                    <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center">
                      {pet.species === 'dog' || (pet.species || '').toLowerCase().includes('dog') ? (
                        <Dog className="w-7 h-7 text-orange-600" />
                      ) : pet.species === 'cat' || (pet.species || '').toLowerCase().includes('cat') ? (
                        <Cat className="w-7 h-7 text-orange-600" />
                      ) : (
                        <User className="w-7 h-7 text-orange-600" />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-semibold text-gray-900">{pet.name}</h3>
                      <p className="text-sm text-gray-500 capitalize">{pet.breed}</p>
                    </div>
                    {selectedPet?.id === pet.id && (
                      <CheckCircle2 className="w-6 h-6 text-orange-500" />
                    )}
                  </button>
                ))
              ) : (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                  <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                    <Dog className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-600 font-medium mb-2">No pets added yet</p>
                  <button
                    onClick={() => setShowAddPetModal(true)}
                    className="px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition"
                  >
                    + Add Your First Pet
                  </button>
                </div>
              )}
            </div>
            <Button 
              onClick={handleNext} 
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A35]"
              disabled={!selectedPet}
            >
              {selectedPet ? 'Continue' : 'Select a Pet to Continue'}
            </Button>
          </div>
        )}

        {/* Room Selection */}
        {step === 'room' && rooms.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Select Room</h2>
            <div className="space-y-3">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => room.available && setSelectedRoom(room)}
                  disabled={!room.available}
                  className={`w-full p-4 rounded-xl border-2 transition-all ${
                    selectedRoom?.id === room.id 
                      ? 'border-[#FF8C42] bg-orange-50' 
                      : room.available
                        ? 'border-gray-200 bg-white hover:border-[#FF8C42]/50'
                        : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-orange-100 flex items-center justify-center">
                      <Building2 className="w-7 h-7 text-orange-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-semibold text-gray-900">{room.name}</h3>
                      <p className="text-sm text-gray-500">{room.description || `Capacity: ${room.capacity} pet(s)`}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-gray-900">₹{room.pricePerNight}</p>
                      <p className="text-xs text-gray-500">/night</p>
                      {selectedRoom?.id === room.id && (
                        <CheckCircle2 className="w-6 h-6 text-orange-500 mt-1 ml-auto" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <Button 
              onClick={handleNext} 
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A35]"
              disabled={!selectedRoom && rooms.some(r => r.available)}
            >
              Continue to Payment
            </Button>
          </div>
        )}

        {/* Package Modal */}
        {showPackageModal && activePackage && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Package className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Active Package Found!</h2>
                  <p className="text-sm text-gray-500">You have sessions available</p>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <h3 className="font-semibold mb-2">{activePackage.packageName}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Sessions Remaining</span>
                    <span className="font-medium text-green-600">
                      {activePackage.isUnlimited ? 'Unlimited' : `${activePackage.remainingSessions} of ${activePackage.totalSessions}`}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <Button 
                  onClick={handleUsePackageSession}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  Use Package Session (Free)
                </Button>
                <Button 
                  onClick={handleBookNew}
                  variant="outline"
                  className="w-full"
                >
                  Book New (Pay ₹{calculateTotalPrice()})
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Add Pet Modal - Enhanced with Photo & Vaccinations */}
        <EnhancedAddPetModal
          phone={phone}
          isOpen={showAddPetModal}
          onClose={() => setShowAddPetModal(false)}
          onSuccess={() => {
            refreshPets();
            setShowAddPetModal(false);
          }}
        />
      </div>
    </div>
  );
}

// Inline Add Pet Modal Component
function AddPetModalInline({ phone, onClose, onSuccess }: { phone: string; onClose: () => void; onSuccess: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  
  const [petData, setPetData] = useState({
    id: `pet_${Date.now()}`,
    name: '',
    type: 'Dog',
    breed: '',
    age: '',
    gender: '',
    weight: '',
    color: '',
    photo: '',
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
        setPetData({ ...petData, photo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSavePet = async () => {
    if (!petData.name || !petData.type || !petData.breed || !petData.age) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setLoading(true);
    try {
      const getPetsData = await apiClient.get(`/customer/pets/${phone}`) as any;
      let existingPets = [];
      if (Array.isArray(getPetsData.pets)) {
        existingPets = getPetsData.pets;
      }
      
      const updatedPets = [...existingPets, petData];
      
      await apiClient.post('/customer/pets', {
        phone: phone,
        pets: updatedPets
      });
      
      toast.success(`${petData.name} added successfully!`);
      onSuccess();
    } catch (error) {
      console.error('Error saving pet:', error);
      toast.error('Failed to save pet. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={onClose}>
      <div 
        className="bg-white rounded-t-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-4 rounded-t-3xl sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Dog className="w-5 h-5 text-white" />
              <h3 className="text-lg font-bold text-white">Add New Pet</h3>
            </div>
            <button onClick={onClose} className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
        
        <div className="p-5 space-y-4">
          <div className="flex flex-col items-center">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-20 h-20 bg-orange-100 rounded-full overflow-hidden flex items-center justify-center cursor-pointer hover:opacity-80 border-4 border-white shadow-lg"
            >
              {photoPreview ? (
                <img src={photoPreview} alt="Pet" className="w-full h-full object-cover" />
              ) : (
                <Upload className="w-8 h-8 text-orange-500" />
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
            <p className="text-xs text-gray-500 mt-1">Upload photo (Optional)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pet Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={petData.name}
              onChange={(e) => setPetData({ ...petData, name: e.target.value })}
              placeholder="e.g., Oreo, Max, Bella"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pet Type <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-3 gap-2">
              {['Dog', 'Cat', 'Other'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPetData({ ...petData, type })}
                  className={`py-2.5 px-3 border-2 rounded-xl transition font-medium text-sm ${
                    petData.type === type ? 'border-[#FF8C42] bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-700'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {type === 'Dog' ? <Dog className="w-4 h-4" /> : type === 'Cat' ? <Cat className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    {type}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Breed <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={petData.breed}
              onChange={(e) => setPetData({ ...petData, breed: e.target.value })}
              placeholder="e.g., Golden Retriever"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Age (years) <span className="text-red-500">*</span></label>
              <input
                type="number"
                value={petData.age}
                onChange={(e) => setPetData({ ...petData, age: e.target.value })}
                placeholder="e.g., 3"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select
                value={petData.gender}
                onChange={(e) => setPetData({ ...petData, gender: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
              >
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 border-2 border-gray-300 rounded-xl font-medium text-gray-700"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleSavePet}
              disabled={loading}
              className="flex-1 py-3 bg-[#FF8C42] hover:bg-[#FF7A35] rounded-xl text-white font-medium disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Add Pet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
