'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
// Removed SpecializedServiceRouter - now integrated into unified flow

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  service_style: string;
  vendor_id: string;
  vendor_name: string;
  vendor_address?: string;
}

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

interface Address {
  id: string;
  label: string;
  address: string;
  city: string;
  pincode: string;
}

interface BookingFlowProps {
  serviceId: string;
  customerPhone: string;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

// Specialized service types - now handled within unified flow
const SPECIALIZED_SERVICES = [
  'ambulance', 'emergency',
  'diagnostics', 'diagnostic', 'lab', 'laboratory',
  'pharmacy', 'medicine', 'medicine_delivery',
  'pet_cafe', 'cafe',
  'pet_resort', 'resort', 'boarding',
  'pet_walker', 'walker', 'walking',
  'adoption', 'breeder', 'breeding',
];

// Helper to determine specialized service type
const getSpecializedServiceType = (service: Service | null): string | null => {
  if (!service) return null;
  const serviceName = (service.name || '').toLowerCase();
  const serviceStyle = (service.service_style || '').toLowerCase();
  
  for (const type of SPECIALIZED_SERVICES) {
    if (serviceName.includes(type) || serviceStyle.includes(type)) {
      return type;
    }
  }
  return null;
};

export function BookingFlow({ serviceId, customerPhone }: BookingFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<'details' | 'datetime' | 'pet' | 'address' | 'payment' | 'confirmed'>('details');
  const [loading, setLoading] = useState(true);
  const [service, setService] = useState<Service | null>(null);
  const [specializedType, setSpecializedType] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPet, setSelectedPet] = useState<string>('');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [wallet, setWallet] = useState<{ balance: number } | null>(null);
  const [useWallet, setUseWallet] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  
  // Specialized service specific state
  const [specializedData, setSpecializedData] = useState<any>({});

  useEffect(() => {
    loadServiceDetails();
    loadCustomerData();
    loadRazorpayScript();
  }, [serviceId, customerPhone]);

  useEffect(() => {
    if (selectedDate && service) {
      loadTimeSlots();
    }
  }, [selectedDate, service]);

  useEffect(() => {
    if (selectedDate && selectedTime && service?.service_style === 'at_home' && selectedAddress) {
      loadAvailableStaff();
    }
  }, [selectedDate, selectedTime, selectedAddress, service]);

  const loadRazorpayScript = () => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
  };

  const loadServiceDetails = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/services/${serviceId}`);
      if (response.service) {
        setService(response.service);
        
        // Determine specialized service type (if any)
        const specialized = getSpecializedServiceType(response.service);
        setSpecializedType(specialized);
        
        // Load specialized service data if needed
        if (specialized) {
          await loadSpecializedServiceData(specialized, response.service.vendor_id);
        }
      }
    } catch (err) {
      console.error('Error loading service:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSpecializedServiceData = async (type: string, vendorId: string) => {
    try {
      // Load specialized service-specific data (tables, rooms, vehicles, tests, etc.)
      switch (type) {
        case 'pet_cafe':
        case 'cafe':
          const cafeRes = await apiClient.get<any>(`/vendor/${vendorId}/cafe/tables`);
          if (cafeRes.success && cafeRes.tables) {
            setSpecializedData({ tables: cafeRes.tables });
          }
          break;
        case 'pet_resort':
        case 'resort':
        case 'boarding':
          const resortRes = await apiClient.get<any>(`/vendor/${vendorId}/resort/rooms`);
          if (resortRes.success && resortRes.rooms) {
            setSpecializedData({ rooms: resortRes.rooms });
          }
          break;
        case 'ambulance':
        case 'emergency':
          const ambulanceRes = await apiClient.get<any>(`/vendor/${vendorId}/ambulance/vehicles`);
          if (ambulanceRes.success && ambulanceRes.vehicles) {
            setSpecializedData({ vehicles: ambulanceRes.vehicles.filter((v: any) => v.is_available) });
          }
          break;
        case 'diagnostics':
        case 'diagnostic':
        case 'lab':
        case 'laboratory':
          const diagnosticsRes = await apiClient.get<any>(`/vendor/${vendorId}/diagnostics/tests`);
          if (diagnosticsRes.success && diagnosticsRes.tests) {
            setSpecializedData({ tests: diagnosticsRes.tests.filter((t: any) => t.is_available) });
          }
          break;
      }
    } catch (err) {
      console.error('Error loading specialized service data:', err);
    }
  };

  const loadCustomerData = async () => {
    try {
      const [petsRes, addressRes, walletRes] = await Promise.all([
        apiClient.get<any>(`/customer/pets?phone=${encodeURIComponent(customerPhone)}`),
        apiClient.get<any>(`/customer/addresses?phone=${encodeURIComponent(customerPhone)}`),
        apiClient.get<any>(`/customer/wallet?phone=${encodeURIComponent(customerPhone)}`),
      ]);
      if (petsRes.pets) setPets(petsRes.pets);
      if (addressRes.addresses) setAddresses(addressRes.addresses);
      if (walletRes.wallet) setWallet(walletRes.wallet);
    } catch (err) {
      console.error('Error loading customer data:', err);
    }
  };

  const [availableStaff, setAvailableStaff] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [commuteInfo, setCommuteInfo] = useState<{ time: number; distance: number; arrival: string } | null>(null);

  const loadTimeSlots = async () => {
    try {
      const response = await apiClient.get<any>(
        `/vendors/${service?.vendor_id}/availability?date=${selectedDate}&service_id=${serviceId}`
      );
      if (response.slots) {
        setTimeSlots(response.slots);
      }
      
      // For home services, also load available staff with commute time
      if (service?.service_style === 'at_home' && selectedDate && selectedTime) {
        await loadAvailableStaff();
      }
    } catch (err) {
      console.error('Error loading time slots:', err);
    }
  };

  const loadAvailableStaff = async () => {
    if (!service || !selectedDate || !selectedTime || !selectedAddress) return;
    
    try {
      // Get address coordinates
      const address = addresses.find(a => a.id === selectedAddress);
      if (!address) return;
      
      // Get customer ID for previous provider prioritization
      const customerRes = await apiClient.get<any>(`/customer/by-phone?phone=${encodeURIComponent(customerPhone)}`);
      const customerId = customerRes.customer?.id;
      
      const params = new URLSearchParams({
        serviceId: serviceId,
        serviceStyle: 'at_home',
        date: selectedDate,
        time: selectedTime,
        ...(customerId && { customerId }),
      });
      
      // If address has coordinates, add them
      if (address.latitude && address.longitude) {
        params.append('latitude', address.latitude.toString());
        params.append('longitude', address.longitude.toString());
      }
      
      const staffRes = await apiClient.get<any>(`/customer/discover-staff?${params}`);
      
      if (staffRes.staff) {
        setAvailableStaff(staffRes.staff);
        // Auto-select first staff (which will be previous provider if available)
        if (staffRes.staff.length > 0 && !selectedStaff) {
          setSelectedStaff(staffRes.staff[0].id);
          // Set commute info
          if (staffRes.staff[0].commuteTime) {
            setCommuteInfo({
              time: staffRes.staff[0].commuteTime,
              distance: staffRes.staff[0].distance || 0,
              arrival: staffRes.staff[0].estimatedArrival || '',
            });
          }
        }
      }
    } catch (err) {
      console.error('Error loading available staff:', err);
    }
  };

  const getNextDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      days.push({
        date: date.toISOString().split('T')[0],
        label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
      });
    }
    return days;
  };

  const calculateTotal = () => {
    if (!service) return 0;
    let total = service.price;
    if (useWallet && wallet) {
      total = Math.max(0, total - wallet.balance);
    }
    return total;
  };

  const handleCreateBooking = async () => {
    if (!service) return;
    
    setProcessing(true);
    try {
      // Build booking data with specialized service support
      const bookingData: any = {
        service_id: serviceId,
        vendor_id: service.vendor_id,
        customer_phone: customerPhone,
        pet_id: selectedPet || undefined,
        address_id: (service.service_style === 'at_home' || specializedType) ? selectedAddress : undefined,
        booking_date: selectedDate || new Date().toISOString().split('T')[0],
        booking_time: selectedTime || new Date().toTimeString().split(' ')[0].substring(0, 5),
        notes: notes || '',
        total_amount: calculateTotal(),
        use_wallet: useWallet,
      };

      // Add specialized service-specific data
      if (specializedType) {
        bookingData.service_type = specializedType;
        bookingData.specialized_data = JSON.stringify({
          ...specializedData,
          type: specializedType,
        });
      }

      // Create booking
      const bookingRes = await apiClient.post<any>('/bookings', bookingData);

      if (!bookingRes.booking_id) {
        throw new Error('Failed to create booking');
      }

      const newBookingId = bookingRes.booking_id;
      setBookingId(newBookingId);

      const amountToPay = calculateTotal();

      if (amountToPay === 0) {
        // Fully paid with wallet
        setStep('confirmed');
        return;
      }

      // Create Razorpay order
      const orderRes = await apiClient.post<any>('/payments/create-order', {
        booking_id: newBookingId,
        amount: amountToPay,
      });

      if (!orderRes.order_id) {
        throw new Error('Failed to create payment order');
      }

      // Open Razorpay checkout
      const options = {
        key: orderRes.razorpay_key || process.env.NEXT_PUBLIC_RAZORPAY_KEY,
        amount: amountToPay * 100,
        currency: 'INR',
        name: 'Warmpawz',
        description: `Booking: ${service.name}`,
        order_id: orderRes.order_id,
        handler: async (response: any) => {
          try {
            // Verify payment
            await apiClient.post('/payments/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              booking_id: newBookingId,
            });
            setStep('confirmed');
          } catch (err) {
            console.error('Payment verification failed:', err);
            alert('Payment verification failed. Please contact support.');
          }
        },
        prefill: {
          contact: customerPhone,
        },
        theme: {
          color: colors.primary, // Using design token primary color
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
          },
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err: any) {
      console.error('Booking error:', err);
      alert(err.message || 'Failed to create booking');
    } finally {
      setProcessing(false);
    }
  };

  // Specialized services are now handled within the unified flow
  // No parallel routing - all services go through the same flow

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <span className="text-6xl">😿</span>
          <h2 className="mt-4 text-xl font-semibold">Service not found</h2>
          <a href="/" className="mt-4 inline-block px-0 py-0 bg-orange-500 text-white rounded-full">
            Go Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => step === 'details' ? router.back() : setStep('details')} className="text-2xl">←</button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">{service.name}</h1>
            <p className="text-sm text-gray-500">{service.vendor_name}</p>
          </div>
          <span className="text-lg font-bold text-orange-600">₹{service.price}</span>
        </div>
      </header>

      {/* Progress */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <div className="flex items-center gap-0">
          {['details', 'datetime', 'pet', service.service_style === 'at_home' ? 'address' : null, 'payment'].filter(Boolean).map((s, i, arr) => (
            <React.Fragment key={s}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s ? 'bg-orange-500 text-white' :
                arr.indexOf(step) > i ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {arr.indexOf(step) > i ? '✓' : i + 1}
              </div>
              {i < arr.length - 1 && (
                <div className={`flex-1 h-1 ${arr.indexOf(step) > i ? 'bg-green-500' : 'bg-gray-200'}`}></div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 pb-32">
        {step === 'details' && (
          <div className="bg-white rounded-2xl p-0 shadow-sm">
            <h2 className="text-xl font-bold mb-4">Service Details</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-orange-100 rounded-xl flex items-center justify-center text-3xl">
                  {service.service_style === 'at_vendor' ? '🏥' : service.service_style === 'at_home' ? '🏠' : '💻'}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{service.name}</h3>
                  <p className="text-sm text-gray-500">{service.vendor_name}</p>
                  {service.vendor_address && (
                    <p className="text-xs text-gray-400">{service.vendor_address}</p>
                  )}
                </div>
              </div>
              <p className="text-gray-600">{service.description}</p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>⏱️ {service.duration} mins</span>
                <span>💰 ₹{service.price}</span>
              </div>
            </div>
            <button
              onClick={() => setStep('datetime')}
              className="w-full mt-0 py-0 bg-orange-500 text-white rounded-xl font-medium"
            >
              Continue
            </button>
          </div>
        )}

        {step === 'datetime' && (
          <div className="bg-white rounded-2xl p-0 shadow-sm">
            <h2 className="text-xl font-bold mb-4">Select Date & Time</h2>
            
            {/* Date Selection */}
            <div className="mb-0">
              <h3 className="font-medium text-gray-700 mb-0">Select Date</h3>
              <div className="flex gap-0 overflow-x-auto pb-0">
                {getNextDays().map((day) => (
                  <button
                    key={day.date}
                    onClick={() => {
                      setSelectedDate(day.date);
                      setSelectedTime('');
                    }}
                    className={`flex-shrink-0 px-4 py-0 rounded-xl text-center min-w-[80px] ${
                      selectedDate === day.date
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <p className="text-sm font-medium">{day.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Time Selection */}
            {selectedDate && (
              <div>
                <h3 className="font-medium text-gray-700 mb-0">Select Time</h3>
                <div className="grid grid-cols-4 gap-0">
                  {timeSlots.length > 0 ? (
                    timeSlots.map((slot) => (
                      <button
                        key={slot.time}
                        onClick={() => slot.available && setSelectedTime(slot.time)}
                        disabled={!slot.available}
                        className={`px-0 py-0 rounded-lg text-sm ${
                          selectedTime === slot.time
                            ? 'bg-orange-500 text-white'
                            : slot.available
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            : 'bg-gray-50 text-gray-300 cursor-not-allowed'
                        }`}
                      >
                        {slot.time}
                      </button>
                    ))
                  ) : (
                    <p className="col-span-4 text-gray-500 text-center py-4">Select a date to see available slots</p>
                  )}
                </div>
                
                {/* Previous Providers & Available Staff (for home services) */}
                {selectedTime && service?.service_style === 'at_home' && availableStaff.length > 0 && (
                  <div className="mt-4 p-0 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-gray-700 mb-0">Available Service Providers</h4>
                    <div className="space-y-2">
                      {availableStaff.slice(0, 5).map((staff: any) => (
                        <button
                          key={staff.id}
                          onClick={() => {
                            setSelectedStaff(staff.id);
                            setCommuteInfo({
                              time: staff.commuteTime || 0,
                              distance: staff.distance || 0,
                              arrival: staff.estimatedArrival || '',
                            });
                          }}
                          className={`w-full text-left p-0 rounded-lg border-2 transition ${
                            selectedStaff === staff.id
                              ? 'border-orange-500 bg-orange-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900">
                                {staff.name}
                                {staff.isPreviousProvider && (
                                  <span className="ml-0 text-xs bg-green-100 text-green-700 px-0 py-0.5 rounded">Previous</span>
                                )}
                              </p>
                              {staff.commuteTime && (
                                <p className="text-xs text-gray-500">
                                  {staff.commuteTime} min commute • {staff.distance?.toFixed(1)} km away
                                </p>
                              )}
                            </div>
                            {selectedStaff === staff.id && (
                              <span className="text-orange-500">✓</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                    {commuteInfo && selectedStaff && (
                      <div className="mt-0 p-0 bg-white rounded border border-orange-200">
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Staff will arrive at:</span> {commuteInfo.arrival || 'Calculating...'}
                        </p>
                        <p className="text-xs text-gray-500 mt-0">
                          Includes {commuteInfo.time} min commute time
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setStep('pet')}
              disabled={!selectedDate || !selectedTime}
              className="w-full mt-0 py-0 bg-orange-500 text-white rounded-xl font-medium disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        )}

        {step === 'pet' && (
          <div className="bg-white rounded-2xl p-0 shadow-sm">
            <h2 className="text-xl font-bold mb-4">Select Pet (Optional)</h2>
            <div className="space-y-3">
              {pets.length > 0 ? (
                <>
                  {pets.map((pet) => (
                    <button
                      key={pet.id}
                      onClick={() => setSelectedPet(pet.id === selectedPet ? '' : pet.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition ${
                        selectedPet === pet.id ? 'border-orange-500 bg-orange-50' : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-2xl">
                        {pet.species === 'dog' ? '🐕' : pet.species === 'cat' ? '🐈' : '🐾'}
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-gray-900">{pet.name}</p>
                        <p className="text-sm text-gray-500">{pet.breed}</p>
                      </div>
                      {selectedPet === pet.id && (
                        <span className="ml-auto text-orange-500 text-xl">✓</span>
                      )}
                    </button>
                  ))}
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No pets added yet</p>
                  <a href="/pets/add" className="text-orange-500 font-medium">+ Add Pet</a>
                </div>
              )}
            </div>
            <button
              onClick={() => setStep(service.service_style === 'at_home' ? 'address' : 'payment')}
              className="w-full mt-0 py-0 bg-orange-500 text-white rounded-xl font-medium"
            >
              {selectedPet ? 'Continue' : 'Skip'}
            </button>
          </div>
        )}

        {step === 'address' && service.service_style === 'at_home' && (
          <div className="bg-white rounded-2xl p-0 shadow-sm">
            <h2 className="text-xl font-bold mb-4">Select Address</h2>
            <div className="space-y-3">
              {addresses.length > 0 ? (
                addresses.map((addr) => (
                  <button
                    key={addr.id}
                    onClick={() => setSelectedAddress(addr.id)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition ${
                      selectedAddress === addr.id ? 'border-orange-500 bg-orange-50' : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <p className="font-medium text-gray-900">{addr.label}</p>
                    <p className="text-sm text-gray-500">{addr.address}</p>
                    <p className="text-sm text-gray-400">{addr.city} - {addr.pincode}</p>
                  </button>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No addresses saved</p>
                  <a href="/addresses/add" className="text-orange-500 font-medium">+ Add Address</a>
                </div>
              )}
            </div>
            <button
              onClick={() => setStep('payment')}
              disabled={!selectedAddress}
              className="w-full mt-0 py-0 bg-orange-500 text-white rounded-xl font-medium disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        )}

        {step === 'payment' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-0 shadow-sm">
              <h2 className="text-xl font-bold mb-4">Review Booking</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Service</span>
                  <span className="font-medium">{service.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date</span>
                  <span className="font-medium">{new Date(selectedDate).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Time</span>
                  <span className="font-medium">{selectedTime}</span>
                </div>
                {selectedPet && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Pet</span>
                    <span className="font-medium">{pets.find(p => p.id === selectedPet)?.name}</span>
                  </div>
                )}
              </div>
              <textarea
                value={notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                placeholder="Add notes for the provider (optional)"
                rows={2}
                className="w-full mt-4 px-4 py-0 border rounded-xl focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="bg-white rounded-2xl p-1 shadow-sm">
              <h2 className="text-xl font-bold mb-4">Payment</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Service Fee</span>
                  <span className="font-medium">₹{service.price}</span>
                </div>
                
                {wallet && wallet.balance > 0 && (
                  <button
                    onClick={() => setUseWallet(!useWallet)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border-2 ${
                      useWallet ? 'border-green-500 bg-green-50' : 'border-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-0">
                      <span className="text-2xl">💰</span>
                      <div className="text-left">
                        <p className="font-medium">Use Wallet Balance</p>
                        <p className="text-sm text-gray-500">Available: ₹{wallet.balance}</p>
                      </div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      useWallet ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300'
                    }`}>
                      {useWallet && '✓'}
                    </div>
                  </button>
                )}

                {useWallet && wallet && (
                  <div className="flex justify-between text-green-600">
                    <span>Wallet Discount</span>
                    <span>-₹{Math.min(wallet.balance, service.price)}</span>
                  </div>
                )}

                <div className="flex justify-between text-lg font-bold border-t pt-0">
                  <span>Total</span>
                  <span className="text-orange-600">₹{calculateTotal()}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'confirmed' && (
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-4xl mx-auto">
              ✅
            </div>
            <h2 className="text-2xl font-bold mt-0 text-gray-900">Booking Confirmed!</h2>
            <p className="text-gray-500 mt-0">Your booking has been successfully placed</p>
            
            <div className="mt-0 p-4 bg-gray-50 rounded-xl text-left">
              <div className="flex justify-between mb-0">
                <span className="text-gray-500">Service</span>
                <span className="font-medium">{service.name}</span>
              </div>
              <div className="flex justify-between mb-0">
                <span className="text-gray-500">Date</span>
                <span className="font-medium">{new Date(selectedDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Time</span>
                <span className="font-medium">{selectedTime}</span>
              </div>
            </div>

            <div className="flex gap-0 mt-0">
              <a href="/bookings" className="flex-1 py-0 border rounded-xl font-medium">
                View Bookings
              </a>
              <a href="/" className="flex-1 py-0 bg-orange-500 text-white rounded-xl font-medium">
                Go Home
              </a>
            </div>
          </div>
        )}
      </main>

      {/* Fixed Bottom Button */}
      {step === 'payment' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={handleCreateBooking}
              disabled={processing}
              className="w-full py-4 bg-orange-500 text-white rounded-xl font-bold text-lg disabled:opacity-50"
            >
              {processing ? 'Processing...' : `Pay ₹${calculateTotal()}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

