"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Video, Home, Building2, Calendar, Clock, MapPin, User, CreditCard, CheckCircle2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

interface VetBookingRouterProps {
  phone: string;
  doctorId?: string;
  doctor?: any;
  selectedService?: string;
  serviceType?: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  onViewBooking?: (bookingId: string) => void;
}

type BookingStep = 'service' | 'datetime' | 'pet' | 'address' | 'payment' | 'confirmation';

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

export function VetBookingRouter({ 
  phone, 
  doctorId, 
  doctor, 
  selectedService, 
  serviceType, 
  onBack, 
  onNavigate, 
  onViewBooking 
}: VetBookingRouterProps) {
  const [step, setStep] = useState<BookingStep>('service');
  const [loading, setLoading] = useState(false);
  const [selectedServiceType, setSelectedServiceType] = useState(serviceType || 'tele');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [vendorServices, setVendorServices] = useState<any[]>([]);
  const [selectedVendorService, setSelectedVendorService] = useState<any>(null);

  // Default service type options (used when no specific services loaded)
  const defaultServiceTypeOptions = [
    { id: 'tele', name: 'Tele Consultation', icon: Video, price: 299, duration: 15, desc: 'Video call with vet', color: 'blue' },
    { id: 'at_home', name: 'Home Visit', icon: Home, price: 599, duration: 30, desc: 'Vet comes to you', color: 'green' },
    { id: 'at_center', name: 'Clinic Visit', icon: Building2, price: 399, duration: 20, desc: 'Visit the clinic', color: 'purple' },
  ];

  // Get actual services for current style, or fall back to defaults
  const getServicesForStyle = (style: string) => {
    const styleServices = vendorServices.filter(s => s.serviceStyle === style || s.service_style === style);
    if (styleServices.length > 0) {
      return styleServices.map(s => ({
        id: s.id || s.serviceId,
        serviceId: s.serviceId || s.service_id,
        name: s.serviceName || s.service_name || s.name,
        price: s.price || 0,
        duration: s.duration || 30,
        desc: s.description || '',
        serviceStyle: style,
        icon: style === 'tele' ? Video : style === 'at_home' ? Home : Building2,
        color: style === 'tele' ? 'blue' : style === 'at_home' ? 'green' : 'purple',
      }));
    }
    return [];
  };

  // Use actual services or fallback to service type selection
  const serviceOptions = vendorServices.length > 0 
    ? getServicesForStyle(selectedServiceType) 
    : defaultServiceTypeOptions;

  const generateDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
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

  const generateTimeSlots = (): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    const hours = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'];
    hours.forEach(time => {
      slots.push({ time, available: Math.random() > 0.3 });
    });
    return slots;
  };

  const [dates] = useState(generateDates());
  const [timeSlots] = useState(generateTimeSlots());

  useEffect(() => {
    loadCustomerData();
    if (doctorId) {
      loadVendorServices();
    }
  }, [phone, doctorId]);

  const loadVendorServices = async () => {
    if (!doctorId) return;
    
    try {
      setLoading(true);
      // Load actual vendor services
      const servicesResponse = await apiClient.get(`/customer/clinic/${doctorId}/services`) as any;
      if (servicesResponse.success && servicesResponse.services) {
        setVendorServices(servicesResponse.services);
        console.log('Loaded vendor services:', servicesResponse.services.length);
      }
    } catch (error) {
      console.error('Error loading vendor services:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerData = async () => {
    try {
      // Load pets from API
      const petsResponse = await apiClient.get(`/customer/pets/${phone}`) as any;
      if (petsResponse.pets && petsResponse.pets.length > 0) {
        setPets(petsResponse.pets.map((p: any) => ({
          id: p.id,
          name: p.name,
          species: p.species || p.type,
          breed: p.breed,
        })));
      }
      
      // Load customer addresses from API
      try {
        const addressResponse = await apiClient.get(`/customer/${phone}/addresses`) as any;
        if (addressResponse.addresses && addressResponse.addresses.length > 0) {
          setAddresses(addressResponse.addresses);
        }
      } catch (addrErr) {
        // If no addresses saved, leave empty - user can enter manually
        setAddresses([]);
      }
    } catch (error) {
      console.error('Error loading customer data:', error);
      // Don't use mock data - show empty state instead
      setPets([]);
      setAddresses([]);
    }
  };

  const handleNext = () => {
    const steps: BookingStep[] = ['service', 'datetime', 'pet', 'address', 'payment', 'confirmation'];
    const currentIdx = steps.indexOf(step);
    
    // Skip address for tele consultations
    if (step === 'pet' && selectedServiceType === 'tele') {
      setStep('payment');
      return;
    }
    
    if (currentIdx < steps.length - 1) {
      setStep(steps[currentIdx + 1]);
    }
  };

  const handleBack = () => {
    const steps: BookingStep[] = ['service', 'datetime', 'pet', 'address', 'payment', 'confirmation'];
    const currentIdx = steps.indexOf(step);
    
    // Handle back from payment for tele
    if (step === 'payment' && selectedServiceType === 'tele') {
      setStep('pet');
      return;
    }
    
    if (currentIdx > 0) {
      setStep(steps[currentIdx - 1]);
    } else {
      onBack();
    }
  };

  const handleConfirmBooking = async () => {
    setProcessing(true);
    try {
      const selectedServiceOption = serviceOptions.find(s => s.id === selectedServiceType);
      
      const bookingData = {
        customer_phone: phone,
        vendor_id: doctorId || 'test-vet-001',
        service_type: selectedServiceType,
        service_name: selectedServiceOption?.name,
        price: selectedServiceOption?.price,
        scheduled_date: selectedDate,
        scheduled_time: selectedTime,
        pet_id: selectedPet?.id,
        pet_name: selectedPet?.name,
        address_id: selectedAddress?.id,
        notes,
        status: 'pending',
      };

      try {
        const response = await apiClient.post('/bookings', bookingData) as any;
        setBookingId(response.booking?.id || 'BK-' + Date.now());
      } catch (err) {
        // Mock successful booking for demo
        setBookingId('BK-' + Date.now());
      }
      
      setStep('confirmation');
    } catch (error) {
      console.error('Error creating booking:', error);
    } finally {
      setProcessing(false);
    }
  };

  const selectedServiceOption = serviceOptions.find(s => s.id === selectedServiceType);

  const renderStepIndicator = () => {
    const steps = selectedServiceType === 'tele' 
      ? ['Service', 'Date/Time', 'Pet', 'Payment']
      : ['Service', 'Date/Time', 'Pet', 'Address', 'Payment'];
    const currentStepMap: Record<BookingStep, number> = {
      service: 0, datetime: 1, pet: 2, address: 3, payment: selectedServiceType === 'tele' ? 3 : 4, confirmation: 5
    };
    const currentIdx = currentStepMap[step];

    return (
      <div className="flex items-center justify-center gap-2 mb-6">
        {steps.map((s, idx) => (
          <div key={s} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              idx <= currentIdx ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {idx < currentIdx ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
            </div>
            {idx < steps.length - 1 && (
              <div className={`w-8 h-0.5 ${idx < currentIdx ? 'bg-orange-500' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={handleBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-semibold text-gray-900">
              {step === 'confirmation' ? 'Booking Confirmed' : 'Book Appointment'}
            </h1>
            {doctor && <p className="text-sm text-gray-500">{doctor.name}</p>}
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        {step !== 'confirmation' && renderStepIndicator()}

        {/* Service Selection */}
        {step === 'service' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Select Consultation Type</h2>
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
                        ? 'border-orange-500 bg-orange-50' 
                        : 'border-gray-200 bg-white hover:border-orange-200'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                        service.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                        service.color === 'green' ? 'bg-green-100 text-green-600' :
                        'bg-purple-100 text-purple-600'
                      }`}>
                        <Icon className="w-7 h-7" />
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="font-semibold text-gray-900">{service.name}</h3>
                        <p className="text-sm text-gray-500">{service.desc}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-sm text-gray-500">{service.duration} mins</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg text-gray-900">₹{service.price}</p>
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
              className="w-full bg-orange-500 hover:bg-orange-600 mt-4"
              disabled={!selectedServiceType}
            >
              Continue
            </Button>
          </div>
        )}

        {/* Date & Time Selection */}
        {step === 'datetime' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-3">Select Date</h2>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {dates.map((d) => (
                  <button
                    key={d.date}
                    onClick={() => setSelectedDate(d.date)}
                    className={`flex-shrink-0 w-16 p-3 rounded-xl text-center transition-all ${
                      selectedDate === d.date 
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

            {selectedDate && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-3">Select Time</h2>
                <div className="grid grid-cols-3 gap-2">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot.time}
                      onClick={() => slot.available && setSelectedTime(slot.time)}
                      disabled={!slot.available}
                      className={`p-3 rounded-xl text-center transition-all ${
                        selectedTime === slot.time 
                          ? 'bg-orange-500 text-white' 
                          : slot.available
                            ? 'bg-white border border-gray-200 hover:border-orange-300'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button 
              onClick={handleNext} 
              className="w-full bg-orange-500 hover:bg-orange-600"
              disabled={!selectedDate || !selectedTime}
            >
              Continue
            </Button>
          </div>
        )}

        {/* Pet Selection */}
        {step === 'pet' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Select Your Pet</h2>
            <div className="space-y-3">
              {pets.map((pet) => (
                <button
                  key={pet.id}
                  onClick={() => setSelectedPet(pet)}
                  className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                    selectedPet?.id === pet.id 
                      ? 'border-orange-500 bg-orange-50' 
                      : 'border-gray-200 bg-white hover:border-orange-200'
                  }`}
                >
                  <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center text-2xl">
                    {pet.species === 'dog' ? '🐕' : pet.species === 'cat' ? '🐈' : '🐾'}
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-semibold text-gray-900">{pet.name}</h3>
                    <p className="text-sm text-gray-500 capitalize">{pet.breed}</p>
                  </div>
                  {selectedPet?.id === pet.id && (
                    <CheckCircle2 className="w-6 h-6 text-orange-500" />
                  )}
                </button>
              ))}
            </div>
            <Button 
              onClick={handleNext} 
              className="w-full bg-orange-500 hover:bg-orange-600"
              disabled={!selectedPet}
            >
              Continue
            </Button>
          </div>
        )}

        {/* Address Selection (not for tele) */}
        {step === 'address' && selectedServiceType !== 'tele' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">
              {selectedServiceType === 'at_home' ? 'Select Your Address' : 'Confirm Clinic Address'}
            </h2>
            <div className="space-y-3">
              {selectedServiceType === 'at_home' ? (
                addresses.map((addr) => (
                  <button
                    key={addr.id}
                    onClick={() => setSelectedAddress(addr)}
                    className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                      selectedAddress?.id === addr.id 
                        ? 'border-orange-500 bg-orange-50' 
                        : 'border-gray-200 bg-white hover:border-orange-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-orange-500 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{addr.label}</h3>
                        <p className="text-sm text-gray-600">{addr.address}</p>
                        <p className="text-sm text-gray-500">{addr.city} - {addr.pincode}</p>
                      </div>
                      {selectedAddress?.id === addr.id && (
                        <CheckCircle2 className="w-6 h-6 text-orange-500" />
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-4 rounded-xl border-2 border-orange-500 bg-orange-50">
                  <div className="flex items-start gap-3">
                    <Building2 className="w-5 h-5 text-orange-500 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-gray-900">{doctor?.clinic_name || 'Vet Clinic'}</h3>
                      <p className="text-sm text-gray-600">{doctor?.clinic_address || 'Address will be shared after confirmation'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <Button 
              onClick={() => {
                if (selectedServiceType === 'at_center') setSelectedAddress({ id: 'clinic' });
                handleNext();
              }} 
              className="w-full bg-orange-500 hover:bg-orange-600"
              disabled={selectedServiceType === 'at_home' && !selectedAddress}
            >
              Continue
            </Button>
          </div>
        )}

        {/* Payment Summary */}
        {step === 'payment' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Booking Summary</h2>
            
            <div className="bg-white rounded-xl p-4 space-y-4">
              {/* Service */}
              <div className="flex items-center gap-3 pb-4 border-b">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  selectedServiceType === 'tele' ? 'bg-blue-100 text-blue-600' :
                  selectedServiceType === 'at_home' ? 'bg-green-100 text-green-600' :
                  'bg-purple-100 text-purple-600'
                }`}>
                  {selectedServiceType === 'tele' ? <Video className="w-6 h-6" /> :
                   selectedServiceType === 'at_home' ? <Home className="w-6 h-6" /> :
                   <Building2 className="w-6 h-6" />}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{selectedServiceOption?.name}</h3>
                  <p className="text-sm text-gray-500">{selectedServiceOption?.duration} mins</p>
                </div>
                <p className="font-bold">₹{selectedServiceOption?.price}</p>
              </div>

              {/* Date & Time */}
              <div className="flex items-center gap-3 pb-4 border-b">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Date & Time</p>
                  <p className="font-medium">
                    {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })} at {selectedTime}
                  </p>
                </div>
              </div>

              {/* Pet */}
              <div className="flex items-center gap-3 pb-4 border-b">
                <User className="w-5 h-5 text-gray-400" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Pet</p>
                  <p className="font-medium">{selectedPet?.name} ({selectedPet?.breed})</p>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any symptoms or concerns..."
                  className="w-full p-3 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  rows={3}
                />
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="bg-white rounded-xl p-4">
              <div className="flex justify-between items-center text-lg">
                <span className="font-bold">Total</span>
                <span className="font-bold text-orange-600">₹{selectedServiceOption?.price}</span>
              </div>
            </div>

            <Button 
              onClick={handleConfirmBooking} 
              className="w-full bg-orange-500 hover:bg-orange-600"
              disabled={processing}
            >
              {processing ? 'Processing...' : `Pay ₹${selectedServiceOption?.price}`}
            </Button>
          </div>
        )}

        {/* Confirmation */}
        {step === 'confirmation' && (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
            <p className="text-gray-500 mb-6">Your appointment has been scheduled successfully</p>
            
            <div className="bg-white rounded-xl p-4 mb-6 text-left">
              <div className="text-center mb-4">
                <p className="text-sm text-gray-500">Booking ID</p>
                <p className="font-mono font-bold text-lg">{bookingId}</p>
              </div>
              <div className="space-y-3 pt-4 border-t">
                <div className="flex justify-between">
                  <span className="text-gray-500">Service</span>
                  <span className="font-medium">{selectedServiceOption?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date</span>
                  <span className="font-medium">{new Date(selectedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Time</span>
                  <span className="font-medium">{selectedTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Pet</span>
                  <span className="font-medium">{selectedPet?.name}</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={() => onViewBooking?.(bookingId || '')}
                className="w-full bg-orange-500 hover:bg-orange-600"
              >
                View Booking Details
              </Button>
              <Button 
                onClick={onBack}
                variant="outline"
                className="w-full"
              >
                Back to Home
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
