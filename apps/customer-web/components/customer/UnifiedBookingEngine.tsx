/**
 * ============================================================================
 * UNIFIED BOOKING ENGINE
 * ============================================================================
 * 
 * Single source of truth for all booking flows:
 * - at_center: Center-based services
 * - at_home: Home visit services
 * - tele: Tele-consultation services
 * - delivery: Product delivery services
 * - package: Package/subscription bookings
 * - specialized: Specialized services (ambulance, diagnostics, etc.)
 * 
 * This component replaces all parallel booking flows to ensure:
 * - Consistent booking lifecycle
 * - Shared scheduling engine
 * - Unified payment processing
 * - Standardized refund & reschedule logic
 * 
 * Date: 2026-01-28
 * Phase: 3
 * ============================================================================
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

// ============================================================================
// TYPES
// ============================================================================

export type ServiceStyle = 'at_center' | 'at_home' | 'tele' | 'delivery' | 'package' | 'specialized';

export type BookingStep = 
  | 'service_selection'
  | 'service_style_selection'
  | 'staff_selection'
  | 'datetime_selection'
  | 'pet_selection'
  | 'address_selection'
  | 'payment'
  | 'confirmation';

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  service_style: ServiceStyle | string;
  vendor_id: string;
  vendor_name: string;
  vendor_address?: string;
  requires_staff?: boolean;
  requires_address?: boolean;
  requires_pet?: boolean;
}

interface Staff {
  id: string;
  name: string;
  specialization?: string;
  rating?: number;
  available?: boolean;
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
  latitude?: number;
  longitude?: number;
}

interface TimeSlot {
  time: string;
  available: boolean;
  staffId?: string;
}

interface UnifiedBookingEngineProps {
  serviceId?: string;
  vendorId?: string;
  customerPhone: string;
  initialServiceStyle?: ServiceStyle;
  onSuccess?: (bookingId: string) => void;
  onCancel?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function UnifiedBookingEngine({
  serviceId,
  vendorId,
  customerPhone,
  initialServiceStyle,
  onSuccess,
  onCancel,
}: UnifiedBookingEngineProps) {
  const router = useRouter();
  
  // State
  const [step, setStep] = useState<BookingStep>('service_selection');
  const [loading, setLoading] = useState(true);
  const [service, setService] = useState<Service | null>(null);
  const [selectedServiceStyle, setSelectedServiceStyle] = useState<ServiceStyle | null>(
    initialServiceStyle || null
  );
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [availableStaff, setAvailableStaff] = useState<Staff[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadInitialData();
  }, [serviceId, vendorId, customerPhone]);

  useEffect(() => {
    if (selectedDate && service) {
      loadTimeSlots();
    }
  }, [selectedDate, service, selectedServiceStyle, selectedStaff]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Load service if serviceId provided
      if (serviceId) {
        const serviceData: any = await apiClient.get(`/services/${serviceId}`);
        setService(serviceData);
        
        // Auto-set service style if available
        if (serviceData.service_style) {
          setSelectedServiceStyle(serviceData.service_style as ServiceStyle);
        }
      }

      // Load customer data
      const customer: any = await apiClient.get(`/customers/phone/${customerPhone}`);
      if (customer) {
        // Load pets
        const petsData: any = await apiClient.get(`/customers/${customer.id}/pets`);
        setPets(petsData || []);

        // Load addresses
        const addressesData: any = await apiClient.get(`/customers/${customer.id}/addresses`);
        setAddresses(addressesData || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadTimeSlots = async () => {
    if (!service || !selectedDate) return;

    try {
      const params = new URLSearchParams({
        vendorId: service.vendor_id,
        date: selectedDate,
        serviceId: service.id,
      });

      if (selectedServiceStyle) {
        params.append('serviceStyle', selectedServiceStyle);
      }

      if (selectedStaff) {
        params.append('staffId', selectedStaff.id);
      }

      const slots = await apiClient.get(`/bookings/available-slots?${params}`);
      setTimeSlots(slots || []);
    } catch (err: any) {
      console.error('Failed to load time slots:', err);
      setTimeSlots([]);
    }
  };

  const loadAvailableStaff = async () => {
    if (!service || !selectedDate || !selectedTime) return;

    try {
      const params = new URLSearchParams({
        vendorId: service.vendor_id,
        serviceId: service.id,
        date: selectedDate,
        time: selectedTime,
        serviceStyle: selectedServiceStyle || '',
      });

      const staff = await apiClient.get(`/vendors/${service.vendor_id}/staff/available?${params}`);
      setAvailableStaff(staff || []);
    } catch (err: any) {
      console.error('Failed to load staff:', err);
      setAvailableStaff([]);
    }
  };

  // ============================================================================
  // STEP NAVIGATION
  // ============================================================================

  const getNextStep = (): BookingStep | null => {
    if (!service) return null;

    switch (step) {
      case 'service_selection':
        // If service has multiple styles, show style selection
        if (service.service_style === 'hybrid' || !selectedServiceStyle) {
          return 'service_style_selection';
        }
        // Otherwise, check what's required
        if (service.requires_staff) {
          return 'staff_selection';
        }
        return 'datetime_selection';

      case 'service_style_selection':
        if (service.requires_staff) {
          return 'staff_selection';
        }
        return 'datetime_selection';

      case 'staff_selection':
        return 'datetime_selection';

      case 'datetime_selection':
        if (service.requires_pet && !selectedPet) {
          return 'pet_selection';
        }
        if ((selectedServiceStyle === 'at_home' || selectedServiceStyle === 'delivery') && !selectedAddress) {
          return 'address_selection';
        }
        return 'payment';

      case 'pet_selection':
        if ((selectedServiceStyle === 'at_home' || selectedServiceStyle === 'delivery') && !selectedAddress) {
          return 'address_selection';
        }
        return 'payment';

      case 'address_selection':
        return 'payment';

      case 'payment':
        return 'confirmation';

      default:
        return null;
    }
  };

  const handleNext = () => {
    const next = getNextStep();
    if (next) {
      setStep(next);
      setError(null);

      // Auto-load staff when entering datetime selection
      if (next === 'datetime_selection' && service?.requires_staff) {
        loadAvailableStaff();
      }
    }
  };

  const handleBack = () => {
    const stepOrder: BookingStep[] = [
      'service_selection',
      'service_style_selection',
      'staff_selection',
      'datetime_selection',
      'pet_selection',
      'address_selection',
      'payment',
      'confirmation',
    ];
    const currentIndex = stepOrder.indexOf(step);
    if (currentIndex > 0) {
      setStep(stepOrder[currentIndex - 1]);
      setError(null);
    }
  };

  // ============================================================================
  // BOOKING CREATION
  // ============================================================================

  const handleCreateBooking = async () => {
    if (!service || !selectedDate || !selectedTime) {
      setError('Please complete all required fields');
      return;
    }

    try {
      setProcessing(true);
      setError(null);

      const bookingData: any = {
        customerId: '', // Will be fetched from customerPhone
        vendorId: service.vendor_id,
        serviceId: service.id,
        bookingDate: selectedDate,
        bookingTime: selectedTime,
        serviceType: selectedServiceStyle === 'at_center' ? 'at_vendor' : 
                     selectedServiceStyle === 'at_home' ? 'at_home' : 
                     selectedServiceStyle === 'tele' ? 'online' : 'at_vendor',
        amount: service.price,
        idempotencyKey: crypto.randomUUID(),
      };

      if (selectedStaff) {
        bookingData.staffId = selectedStaff.id;
      }

      if (selectedPet) {
        bookingData.petId = selectedPet.id;
      }

      if (selectedAddress) {
        bookingData.address = selectedAddress.address;
        bookingData.city = selectedAddress.city;
        bookingData.pincode = selectedAddress.pincode;
        if (selectedAddress.latitude && selectedAddress.longitude) {
          bookingData.latitude = selectedAddress.latitude;
          bookingData.longitude = selectedAddress.longitude;
        }
      }

      if (notes) {
        bookingData.notes = notes;
      }

      // Get customer ID from phone
      const customer = await apiClient.get(`/customers/phone/${customerPhone}`);
      if (!customer) {
        throw new Error('Customer not found');
      }
      bookingData.customerId = customer.id;

      const result = await apiClient.post('/bookings/create', bookingData);

      if (result.bookingId) {
        if (onSuccess) {
          onSuccess(result.bookingId);
        } else {
          router.push(`/bookings/${result.bookingId}`);
        }
      } else {
        throw new Error('Failed to create booking');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create booking');
    } finally {
      setProcessing(false);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-0">
      {/* Progress Indicator */}
      <div className="mb-0">
        <div className="flex items-center justify-between mb-0">
          {['service_selection', 'service_style_selection', 'datetime_selection', 'payment', 'confirmation'].map((s, i) => (
            <div
              key={s}
              className={`flex-1 h-2 mx-0 rounded ${
                step === s || ['service_selection', 'service_style_selection', 'datetime_selection', 'payment', 'confirmation'].indexOf(step) > i
                  ? 'bg-primary'
                  : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-lg p-0">
        {step === 'service_selection' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Select Service</h2>
            {service ? (
              <div className="border rounded-lg p-4 mb-4">
                <h3 className="font-semibold">{service.name}</h3>
                <p className="text-gray-600">{service.description}</p>
                <p className="text-primary font-bold mt-0">₹{service.price}</p>
              </div>
            ) : (
              <p className="text-gray-600">Service selection not implemented in this view</p>
            )}
            <div className="flex justify-end gap-0 mt-4">
              <button
                onClick={onCancel}
                className="px-4 py-0 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleNext}
                className="px-4 py-0 bg-primary text-white rounded-lg hover:bg-primary/90"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 'service_style_selection' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Select Service Style</h2>
            <div className="grid grid-cols-2 gap-4">
              {(['at_center', 'at_home', 'tele', 'delivery'] as ServiceStyle[]).map((style) => (
                <button
                  key={style}
                  onClick={() => {
                    setSelectedServiceStyle(style);
                    handleNext();
                  }}
                  className={`p-4 border-2 rounded-lg text-left hover:border-primary ${
                    selectedServiceStyle === style ? 'border-primary bg-primary/10' : 'border-gray-200'
                  }`}
                >
                  <div className="font-semibold capitalize">{style.replace('_', ' ')}</div>
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-0 mt-4">
              <button
                onClick={handleBack}
                className="px-4 py-0 border rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {step === 'staff_selection' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Select Staff</h2>
            {availableStaff.length === 0 ? (
              <p className="text-gray-600 mb-4">Loading available staff...</p>
            ) : (
              <div className="space-y-2">
                {availableStaff.map((staff) => (
                  <button
                    key={staff.id}
                    onClick={() => {
                      setSelectedStaff(staff);
                      handleNext();
                    }}
                    className={`w-full p-4 border-2 rounded-lg text-left hover:border-primary ${
                      selectedStaff?.id === staff.id ? 'border-primary bg-primary/10' : 'border-gray-200'
                    }`}
                  >
                    <div className="font-semibold">{staff.name}</div>
                    {staff.specialization && (
                      <div className="text-sm text-gray-600">{staff.specialization}</div>
                    )}
                    {staff.rating && (
                      <div className="text-sm text-primary">⭐ {staff.rating}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-0 mt-4">
              <button
                onClick={handleBack}
                className="px-4 py-0 border rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {step === 'datetime_selection' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Select Date & Time</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-0">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full p-0 border rounded-lg"
              />
            </div>
            {selectedDate && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-0">Time</label>
                <div className="grid grid-cols-4 gap-0">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot.time}
                      onClick={() => setSelectedTime(slot.time)}
                      disabled={!slot.available}
                      className={`p-0 border rounded-lg text-sm ${
                        selectedTime === slot.time
                          ? 'bg-primary text-white border-primary'
                          : slot.available
                          ? 'border-gray-200 hover:border-primary'
                          : 'border-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-0 mt-4">
              <button
                onClick={handleBack}
                className="px-4 py-0 border rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handleNext}
                disabled={!selectedDate || !selectedTime}
                className="px-4 py-0 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 'pet_selection' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Select Pet</h2>
            <div className="space-y-2">
              {pets.map((pet) => (
                <button
                  key={pet.id}
                  onClick={() => {
                    setSelectedPet(pet);
                    handleNext();
                  }}
                  className={`w-full p-4 border-2 rounded-lg text-left hover:border-primary ${
                    selectedPet?.id === pet.id ? 'border-primary bg-primary/10' : 'border-gray-200'
                  }`}
                >
                  <div className="font-semibold">{pet.name}</div>
                  <div className="text-sm text-gray-600">{pet.species} - {pet.breed}</div>
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-0 mt-4">
              <button
                onClick={handleBack}
                className="px-4 py-0 border rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {step === 'address_selection' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Select Address</h2>
            <div className="space-y-2">
              {addresses.map((address) => (
                <button
                  key={address.id}
                  onClick={() => {
                    setSelectedAddress(address);
                    handleNext();
                  }}
                  className={`w-full p-4 border-2 rounded-lg text-left hover:border-primary ${
                    selectedAddress?.id === address.id ? 'border-primary bg-primary/10' : 'border-gray-200'
                  }`}
                >
                  <div className="font-semibold">{address.label}</div>
                  <div className="text-sm text-gray-600">{address.address}</div>
                  <div className="text-sm text-gray-500">{address.city} - {address.pincode}</div>
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-0 mt-4">
              <button
                onClick={handleBack}
                className="px-4 py-0 border rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {step === 'payment' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Payment</h2>
            <div className="border rounded-lg p-4 mb-4">
              <div className="flex justify-between mb-0">
                <span>Service</span>
                <span className="font-semibold">₹{service?.price || 0}</span>
              </div>
              <div className="border-t pt-0 mt-0 flex justify-between">
                <span className="font-bold">Total</span>
                <span className="font-bold text-primary">₹{service?.price || 0}</span>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-0">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-0 border rounded-lg"
                rows={3}
                placeholder="Any special instructions..."
              />
            </div>
            <div className="flex justify-end gap-0 mt-4">
              <button
                onClick={handleBack}
                className="px-4 py-0 border rounded-lg hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handleCreateBooking}
                disabled={processing}
                className="px-4 py-0 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {processing ? 'Processing...' : 'Confirm Booking'}
              </button>
            </div>
          </div>
        )}

        {step === 'confirmation' && (
          <div className="text-center">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-2xl font-bold mb-4">Booking Confirmed!</h2>
            <p className="text-gray-600 mb-0">Your booking has been successfully created.</p>
            <button
              onClick={() => router.push('/bookings')}
              className="px-0 py-0 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              View Bookings
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

