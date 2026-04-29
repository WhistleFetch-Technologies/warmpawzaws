'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { getGoogleMapsBrowserApiKey } from '@/lib/google-maps-browser-key';
import { requestLocationPermission } from '@/lib/runtime-permissions';
import {
  buildSanitizedStandardRazorpayCheckoutOptions,
  fetchCheckoutEmailForPrefill,
} from '@/lib/razorpay/build-standard-checkout-options';
import { goBackOrHome } from '@/lib/go-back-or-replace';
import { formatLocalDateYYYYMMDD } from '@/lib/local-calendar-date';
import { X, Camera, Upload, MapPin, Plus, ArrowLeft } from 'lucide-react';
import { EnhancedAddPetModal } from './EnhancedAddPetModal';
import { ServiceDescriptionInline } from './shared/ServiceDescriptionInline';
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
  category?: string;
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
  type?: string;
  age?: string;
  gender?: string;
  weight?: string;
  color?: string;
  photo?: string;
}

interface Address {
  id: string;
  label: string;
  address: string;
  addressLine1?: string;
  addressLine2?: string;
  city: string;
  state?: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
  name?: string;
  phone?: string;
  landmark?: string;
}

interface BookingFlowProps {
  serviceId: string;
  customerPhone: string;
  onBack?: () => void;
  onComplete?: (bookingId: string) => void;
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

// Services that require pet profile selection
const PET_REQUIRED_SERVICES = [
  'veterinary', 'vet', 'grooming', 'groomer', 'training', 'trainer', 'behaviourist',
  'walking', 'walker', 'boarding', 'resort', 'daycare', 'pet_cafe', 'cafe',
  'nutritionist', 'insurance', 'vaccination', 'consultation', 'checkup',
  'diagnostics', 'lab', 'ambulance', 'emergency'
];

// Services that require address (home services, delivery, etc.)
const ADDRESS_REQUIRED_SERVICES = [
  'at_home', 'home_visit', 'delivery', 'medicine_delivery', 'pharmacy',
  'ambulance', 'emergency', 'walking', 'walker', 'training', 'trainer',
  'behaviourist', 'nutritionist', 'grooming_home'
];

// Helper to check if service requires pet
const requiresPetProfile = (service: Service | null): boolean => {
  if (!service) return false;
  const serviceName = (service.name || '').toLowerCase();
  const serviceStyle = (service.service_style || '').toLowerCase();
  const category = (service.category || '').toLowerCase();
  
  // Products don't require pet profile
  if (category.includes('product') || category.includes('shop') || category.includes('ecommerce')) {
    return false;
  }
  
  return PET_REQUIRED_SERVICES.some(type => 
    serviceName.includes(type) || serviceStyle.includes(type) || category.includes(type)
  ) || serviceStyle !== 'product';
};

// Helper to check if service requires address
const requiresAddress = (service: Service | null, specializedType: string | null): boolean => {
  if (!service) return false;
  const serviceName = (service.name || '').toLowerCase();
  const serviceStyle = (service.service_style || '').toLowerCase();
  
  // Home services always require address
  if (serviceStyle === 'at_home' || serviceStyle === 'home_visit') return true;
  
  // Delivery services require address
  if (serviceName.includes('delivery') || specializedType?.includes('delivery')) return true;
  
  // Ambulance/emergency require address
  if (specializedType === 'ambulance' || specializedType === 'emergency') return true;
  
  // Home-based specialized services
  return ADDRESS_REQUIRED_SERVICES.some(type => serviceName.includes(type) || serviceStyle.includes(type));
};

export function BookingFlow({ serviceId, customerPhone, onBack, onComplete }: BookingFlowProps) {
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
  
  // ✅ SUBSCRIPTION STATE - Check for active subscription for zero-payment booking
  const [subscriptionCoverage, setSubscriptionCoverage] = useState<{
    covered: boolean;
    subscriptionId: string | null;
    subscriptionName: string | null;
    isUnlimited: boolean;
    remainingCount: number | null;
    message: string;
  } | null>(null);
  const [checkingSubscription, setCheckingSubscription] = useState(false);
  
  // Specialized service specific state
  const [specializedData, setSpecializedData] = useState<any>({});
  
  // Modal states for adding pet/address inline
  const [showAddPetModal, setShowAddPetModal] = useState(false);
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);
  
  // Check if pet/address is needed
  const needsPet = requiresPetProfile(service);
  const needsAddress = requiresAddress(service, specializedType);

  useEffect(() => {
    loadServiceDetails();
    loadCustomerData();
    // Razorpay script is now pre-loaded via separate useEffect
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

  // ✅ FIX: Pre-load Razorpay script on component mount so it's ready when user clicks payment
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.Razorpay) {
      console.log('🔄 [RAZORPAY] Pre-loading Razorpay script on component mount...');
      loadRazorpayScript().catch((error) => {
        console.warn('⚠️ [RAZORPAY] Failed to pre-load script (will retry on payment):', error.message);
        // Don't show error to user - will retry when payment button is clicked
      });
    } else if (window.Razorpay) {
      console.log('✅ [RAZORPAY] Razorpay script already loaded');
    }
  }, []); // Only run once on mount

  const loadRazorpayScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        reject(new Error('Window is not available'));
        return;
      }
      
      // If already loaded, resolve immediately
      if (window.Razorpay) {
        resolve();
        return;
      }
      
      // Check if script is already being loaded
      const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (existingScript) {
        // Wait for existing script to load
        existingScript.addEventListener('load', () => {
          if (window.Razorpay) {
            resolve();
          } else {
            reject(new Error('Razorpay script loaded but window.Razorpay is not available'));
          }
        });
        existingScript.addEventListener('error', () => {
          reject(new Error('Failed to load Razorpay script'));
        });
        return;
      }
      
      // Create and load new script
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      
      script.onload = () => {
        // Wait a bit for Razorpay to initialize
        setTimeout(() => {
          if (window.Razorpay) {
            resolve();
          } else {
            reject(new Error('Razorpay script loaded but window.Razorpay is not available'));
          }
        }, 100);
      };
      
      script.onerror = () => {
        reject(new Error('Failed to load Razorpay script'));
      };
      
      document.body.appendChild(script);
    });
  };

  const loadServiceDetails = async () => {
    if (!serviceId?.trim() || serviceId === 'placeholder') {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/services/${encodeURIComponent(serviceId)}`);
      
      // ✅ FIX: Handle both response formats (service object or flat structure)
      const serviceData = response.service || response;
      
      if (serviceData && (serviceData.id || serviceData.serviceId)) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[BookingFlow loadServiceDetails]', {
            urlServiceId: serviceId,
            resolvedId: String(serviceData.id ?? serviceData.serviceId ?? ''),
          });
        }
        setService(serviceData);
        
        // Determine specialized service type (if any)
        const specialized = getSpecializedServiceType(serviceData);
        setSpecializedType(specialized);
        
        // Load specialized service data if needed
        if (specialized && serviceData.vendor_id) {
          await loadSpecializedServiceData(specialized, serviceData.vendor_id);
        }
      } else {
        console.error('Invalid service response:', response);
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
      
      // Handle pets response
      if (petsRes.pets) {
        setPets(petsRes.pets);
        // Auto-select first pet if only one exists
        if (petsRes.pets.length === 1) {
          setSelectedPet(petsRes.pets[0].id);
        }
      }
      
      // Handle addresses response
      if (addressRes.addresses) {
        setAddresses(addressRes.addresses);
        // Auto-select default address if available
        const defaultAddr = addressRes.addresses.find((a: Address) => a.isDefault);
        if (defaultAddr) {
          setSelectedAddress(defaultAddr.id);
        } else if (addressRes.addresses.length === 1) {
          // Auto-select if only one address
          setSelectedAddress(addressRes.addresses[0].id);
        }
      }
      
      if (walletRes.wallet) setWallet(walletRes.wallet);
      
      // ✅ Check subscription coverage for zero-payment bookings
      // Get customer ID first
      try {
        const customerRes = await apiClient.get<any>(`/customer/by-phone?phone=${encodeURIComponent(customerPhone)}`);
        if (customerRes.customer?.id) {
          await checkSubscriptionCoverage(customerRes.customer.id);
        }
      } catch (subErr) {
        console.log('Subscription check skipped');
      }
    } catch (err) {
      console.error('Error loading customer data:', err);
    }
  };
  
  // Refresh pets after adding new one
  const refreshPets = async () => {
    try {
      const petsRes = await apiClient.get<any>(`/customer/pets?phone=${encodeURIComponent(customerPhone)}`);
      if (petsRes.pets) {
        setPets(petsRes.pets);
        // Auto-select newly added pet (last one)
        if (petsRes.pets.length > 0) {
          setSelectedPet(petsRes.pets[petsRes.pets.length - 1].id);
        }
      }
    } catch (err) {
      console.error('Error refreshing pets:', err);
    }
  };
  
  // Refresh addresses after adding new one
  const refreshAddresses = async () => {
    try {
      const addressRes = await apiClient.get<any>(`/customer/addresses?phone=${encodeURIComponent(customerPhone)}`);
      if (addressRes.addresses) {
        setAddresses(addressRes.addresses);
        // Auto-select newly added address (last one) or default
        const defaultAddr = addressRes.addresses.find((a: Address) => a.isDefault);
        if (defaultAddr) {
          setSelectedAddress(defaultAddr.id);
        } else if (addressRes.addresses.length > 0) {
          setSelectedAddress(addressRes.addresses[addressRes.addresses.length - 1].id);
        }
      }
    } catch (err) {
      console.error('Error refreshing addresses:', err);
    }
  };

  const [availableStaff, setAvailableStaff] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [commuteInfo, setCommuteInfo] = useState<{ time: number; distance: number; arrival: string; bufferTime?: number; totalTime?: number } | null>(null);

  const loadTimeSlots = async () => {
    if (!service?.vendor_id || !selectedDate) return;
    try {
      // Normalize legacy styles: online/at_vendor → canonical (tele, at_center)
      const rawStyle = (service?.service_style || 'at_center').toLowerCase();
      const serviceStyle =
        rawStyle === 'at_home'
          ? 'at_home'
          : rawStyle === 'tele' || rawStyle === 'online' || rawStyle === 'video_consultation'
            ? 'tele'
            : rawStyle === 'at_vendor'
              ? 'at_center'
              : 'at_center';
      const totalDuration = Math.max(15, service?.duration ?? 30);
      const params = new URLSearchParams({
        date: selectedDate,
        serviceStyle,
        totalDuration: String(totalDuration),
      });
      const response = await apiClient.get<any>(
        `/customer/vendor/${service.vendor_id}/available-slots?${params}`
      );
      const slots = response?.slots ?? [];
      setTimeSlots(Array.isArray(slots) ? slots : []);

      // For home services, also load available staff with commute time
      if (service?.service_style === 'at_home' && selectedDate && selectedTime) {
        await loadAvailableStaff();
      }
    } catch (err) {
      console.error('Error loading time slots:', err);
      setTimeSlots([]);
    }
  };

  const loadAvailableStaff = async () => {
    if (!service || !selectedDate || !selectedTime || !selectedAddress) return;
    // Staff decommissioned: at_home/tele use solo providers from discover-services; no separate staff list.
    setAvailableStaff([]);
  };

  const getNextDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      days.push({
        date: formatLocalDateYYYYMMDD(date),
        label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
      });
    }
    return days;
  };

  const calculateTotal = () => {
    if (!service) return 0;
    
    // ✅ If covered by subscription, total is 0
    if (subscriptionCoverage?.covered) {
      return 0;
    }
    
    let total = service.price;
    if (useWallet && wallet) {
      total = Math.max(0, total - wallet.balance);
    }
    return total;
  };

  // ✅ CHECK SUBSCRIPTION COVERAGE - For unlimited subscription zero-payment bookings
  const checkSubscriptionCoverage = async (customerId: string) => {
    if (!service) return;
    
    setCheckingSubscription(true);
    try {
      const res = await apiClient.post<any>('/subscriptions/check-coverage', {
        customerId,
        serviceId,
        vendorId: service.vendor_id,
        serviceStyle: service.service_style,
      });
      
      if (res.covered) {
        setSubscriptionCoverage({
          covered: true,
          subscriptionId: res.subscriptionId,
          subscriptionName: res.subscriptionName,
          isUnlimited: res.isUnlimited,
          remainingCount: res.remainingCount,
          message: res.message,
        });
      } else {
        setSubscriptionCoverage(null);
      }
    } catch (err) {
      console.log('No active subscription or check failed');
      setSubscriptionCoverage(null);
      toast.info('Subscription check unavailable; you can continue to pay normally.');
    } finally {
      setCheckingSubscription(false);
    }
  };

  const handleCreateBooking = async () => {
    if (!service) return;
    
    setProcessing(true);
    try {
      // ✅ FIX GAP 3.1: Get customer ID first for proper API contract compliance
      let customerId: string | undefined;
      try {
        const customerRes = await apiClient.get<any>(`/customer/by-phone?phone=${encodeURIComponent(customerPhone)}`);
        customerId = customerRes.customer?.id;
      } catch (err) {
        console.warn('Could not fetch customer ID, will use phone number');
      }

      // Get selected address details for the booking
      const selectedAddressData = selectedAddress ? addresses.find(a => a.id === selectedAddress) : undefined;

      /** Full list price on the booking row — never the net-after-wallet amount (server debits wallet against gross). */
      const listPriceRupee = Math.round((Number(service?.price) || 0) * 100) / 100;
      const walletAmountToApply =
        useWallet && wallet && !subscriptionCoverage?.covered
          ? Math.round(Math.min(Number(wallet.balance) || 0, listPriceRupee) * 100) / 100
          : 0;

      // ✅ FIX GAP 3.1: Build booking data with camelCase to match backend Zod schema
      // Backend expects: customerId, vendorId, serviceId, bookingDate, bookingTime, serviceType, etc.
      const bookingData: any = {
        // Required fields - camelCase to match CreateBookingRequestSchema
        customerId: customerId,
        vendorId: service.vendor_id,
        serviceId: serviceId,
        bookingDate: selectedDate || formatLocalDateYYYYMMDD(new Date()),
        bookingTime: selectedTime || new Date().toTimeString().split(' ')[0].substring(0, 5),
        serviceType: service.service_style || 'at_center',
        
        // Optional fields - camelCase
        petId: selectedPet || undefined,
        amount: subscriptionCoverage?.covered ? 0 : listPriceRupee,
        notes: notes || '',
        
        // Address fields for home services
        ...(selectedAddressData && {
          address: selectedAddressData.address || selectedAddressData.addressLine1,
          city: selectedAddressData.city,
          state: selectedAddressData.state,
          pincode: selectedAddressData.pincode,
          latitude: selectedAddressData.latitude,
          longitude: selectedAddressData.longitude,
        }),
        
        // Wallet usage (walletAmount required so server can debit even when list price equals wallet balance)
        useWallet: useWallet && !subscriptionCoverage?.covered,
        ...(walletAmountToApply > 0 ? { walletAmount: walletAmountToApply } : {}),
        
        // Legacy snake_case for backward compatibility with older endpoints
        customer_phone: customerPhone,
      };

      // ✅ CRITICAL: Add staffId for home/tele services (camelCase)
      // This ensures the correct verified staff member is assigned to the booking
      if ((service.service_style === 'at_home' || service.service_style === 'tele') && selectedStaff) {
        bookingData.staffId = selectedStaff;
        
        // Add commute info if available
        if (commuteInfo) {
          bookingData.estimatedArrivalTime = commuteInfo.arrival;
          bookingData.commuteTimeMinutes = commuteInfo.time;
          bookingData.bufferTimeMinutes = commuteInfo.bufferTime;
        }
      }

      // Add specialized service-specific data
      if (specializedType) {
        bookingData.specializedServiceType = specializedType;
        bookingData.specializedData = JSON.stringify({
          ...specializedData,
          type: specializedType,
        });
      }

      // Create booking - use /bookings/create endpoint for proper Zod validation
      const bookingRes = await apiClient.post<any>('/bookings/create', bookingData);

      // P2: Treat 200-with-error as failure (resilient parsing)
      if (bookingRes?.error || bookingRes?.success === false) {
        const errMsg = typeof bookingRes?.error === 'string' ? bookingRes.error : (bookingRes?.error?.message ?? bookingRes?.error ?? 'Booking creation failed');
        throw new Error(errMsg);
      }
      // ✅ FIX: Handle both response formats (new camelCase and legacy snake_case)
      const newBookingId = bookingRes.data?.bookingId || bookingRes.bookingId || bookingRes.booking_id || bookingRes.data?.id || bookingRes.booking?.id;
      if (!newBookingId) {
        throw new Error(bookingRes.error || 'Failed to create booking');
      }
      setBookingId(newBookingId);

      const amountToPay = calculateTotal();

      // ✅ Check if covered by subscription - create zero-payment booking
      if (subscriptionCoverage?.covered && subscriptionCoverage.subscriptionId) {
        try {
          const subBookingRes = await apiClient.post<any>('/subscriptions/create-booking', {
            customerId: bookingData.customer_id || (await apiClient.get<any>(`/customer/by-phone?phone=${encodeURIComponent(customerPhone)}`)).customer?.id,
            subscriptionId: subscriptionCoverage.subscriptionId,
            serviceId: serviceId,
            vendorId: service.vendor_id,
            staffId: selectedStaff || undefined,
            bookingDate: selectedDate || formatLocalDateYYYYMMDD(new Date()),
            bookingTime: selectedTime || new Date().toTimeString().split(' ')[0].substring(0, 5),
            serviceStyle: service.service_style,
            petId: selectedPet || undefined,
            address: selectedAddress ? addresses.find(a => a.id === selectedAddress)?.address : undefined,
            notes: notes || '',
          });
          
          if (subBookingRes.success) {
            setBookingId(subBookingRes.bookingId);
            setStep('confirmed');
            return;
          }
        } catch (subErr) {
          console.error('Subscription booking failed, proceeding with regular payment:', subErr);
        }
      }

      if (amountToPay === 0) {
        // Fully paid with wallet
        setStep('confirmed');
        return;
      }

      // ✅ FIX: Use /razorpay/create-order instead of /payments/create-order
      // /payments/create-order creates a payment record but doesn't return Razorpay orderId
      // /razorpay/create-order creates the actual Razorpay order and returns orderId + keyId
      console.log('🔄 [PAYMENT] Creating Razorpay order...', {
        bookingId: newBookingId,
        amount: amountToPay,
      });
      
      let orderRes: any;
      try {
        orderRes = await apiClient.post<any>('/razorpay/create-order', {
          bookingId: newBookingId,
          amount: amountToPay,
          useWallet: useWallet && !subscriptionCoverage?.covered,
          walletAmount: walletAmountToApply,
        }, undefined, 45000); // ✅ FIX: 45 second timeout for payment operations
      } catch (orderError: any) {
        console.error('❌ [PAYMENT] Razorpay create-order API call failed:', {
          error: orderError.message,
          status: orderError.status,
          statusCode: orderError.statusCode,
          response: orderError.response,
          responseData: orderError.responseData,
        });
        // Re-throw with better error message
        const errorMsg = orderError.responseData?.error || orderError.response?.error || orderError.message || 'Failed to create payment order';
        throw new Error(`Failed to create payment order: ${errorMsg}`);
      }
      
      console.log('✅ [PAYMENT] Razorpay order response (raw):', JSON.stringify(orderRes, null, 2));
      console.log('✅ [PAYMENT] Response type:', typeof orderRes);
      console.log('✅ [PAYMENT] Response keys:', orderRes ? Object.keys(orderRes) : 'null/undefined');
      console.log('✅ [PAYMENT] Is array?', Array.isArray(orderRes));
      
      // ✅ FIX: Handle ALL possible response structures
      // Backend returns: { orderId, keyId, amount, currency } directly via this.success()
      // But could also be wrapped in: { success: true, data: { ... } } or { data: { ... } }
      // Or error response: { error: "..." } or { success: false, error: "..." }
      
      // Check for error response first
      if (orderRes?.error || (orderRes?.success === false)) {
        const errorMsg = typeof orderRes.error === 'string' 
          ? orderRes.error 
          : orderRes.error?.message || 'Failed to create payment order';
        console.error('❌ [PAYMENT] Error in response:', errorMsg);
        throw new Error(errorMsg);
      }
      
      // ✅ FIX: Try to extract orderId from all possible locations, including nested structures
      let razorpayOrderId: string | undefined = undefined;
      let keyId: string | undefined = undefined;
      let orderAmount: number | undefined = undefined;
      
      // Strategy 1: Direct fields
      if (orderRes?.orderId) razorpayOrderId = orderRes.orderId;
      if (orderRes?.keyId) keyId = orderRes.keyId;
      if (orderRes?.amount != null) orderAmount = typeof orderRes.amount === 'number' ? orderRes.amount : parseFloat(orderRes.amount);
      
      // Strategy 2: Wrapped in data
      if (!razorpayOrderId && orderRes?.data) {
        if (orderRes.data.orderId) razorpayOrderId = orderRes.data.orderId;
        if (orderRes.data.keyId) keyId = orderRes.data.keyId;
        if (orderRes.data.amount != null) orderAmount = typeof orderRes.data.amount === 'number' ? orderRes.data.amount : parseFloat(orderRes.data.amount);
      }
      
      // Strategy 3: Wrapped in success.data
      if (!razorpayOrderId && orderRes?.success?.data) {
        if (orderRes.success.data.orderId) razorpayOrderId = orderRes.success.data.orderId;
        if (orderRes.success.data.keyId) keyId = orderRes.success.data.keyId;
        if (orderRes.success.data.amount != null) orderAmount = typeof orderRes.success.data.amount === 'number' ? orderRes.success.data.amount : parseFloat(orderRes.success.data.amount);
      }
      
      // Strategy 4: Alternative field names
      if (!razorpayOrderId) {
        razorpayOrderId = orderRes?.razorpay_order_id || orderRes?.razorpayOrderId || orderRes?.id;
      }
      if (!keyId) {
        keyId = orderRes?.key || orderRes?.razorpayKey || orderRes?.razorpay_key;
      }
      
      // Strategy 5: Fallback to environment variable for keyId
      if (!keyId) {
        keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY;
      }
      
      console.log('🔍 [PAYMENT] Extracted values:', { 
        razorpayOrderId: razorpayOrderId ? `${razorpayOrderId.substring(0, 20)}...` : 'MISSING',
        keyId: keyId ? `${keyId.substring(0, 8)}...` : 'missing',
        orderAmount,
        hasData: !!orderRes?.data,
        hasSuccess: !!orderRes?.success,
        responseKeys: orderRes ? Object.keys(orderRes) : [],
        // Deep inspection
        orderIdType: orderRes?.orderId ? typeof orderRes.orderId : 'not found',
        dataOrderIdType: orderRes?.data?.orderId ? typeof orderRes.data.orderId : 'not found',
      });
      
      if (!razorpayOrderId) {
        // ✅ ENHANCED: Log the entire response structure for debugging
        console.error('❌ [PAYMENT] No orderId found in response. Full response structure:', {
          response: orderRes,
          stringified: JSON.stringify(orderRes, null, 2),
          type: typeof orderRes,
          isArray: Array.isArray(orderRes),
          keys: orderRes ? Object.keys(orderRes) : [],
          hasOrderId: !!orderRes?.orderId,
          hasData: !!orderRes?.data,
          dataKeys: orderRes?.data ? Object.keys(orderRes.data) : [],
          hasSuccess: !!orderRes?.success,
          successKeys: orderRes?.success ? Object.keys(orderRes.success) : [],
          // Check all possible nested paths
          nestedPaths: {
            'orderRes.orderId': orderRes?.orderId,
            'orderRes.data.orderId': orderRes?.data?.orderId,
            'orderRes.success.data.orderId': orderRes?.success?.data?.orderId,
            'orderRes.razorpay_order_id': orderRes?.razorpay_order_id,
            'orderRes.id': orderRes?.id,
          }
        });
        throw new Error('Failed to create payment order: No order ID received from server. Please check the response structure.');
      }
      
      if (!keyId) {
        console.error('❌ [PAYMENT] No keyId in response and NEXT_PUBLIC_RAZORPAY_KEY not set');
        throw new Error('Payment gateway configuration error: Razorpay key not found');
      }
      
      console.log('✅ [PAYMENT] Razorpay order created successfully:', { razorpayOrderId, keyId: keyId ? `${keyId.substring(0, 8)}...` : 'missing', amount: orderAmount });
      
      // ✅ FIX: Wait for Razorpay script to load before opening checkout
      if (typeof window !== 'undefined' && !window.Razorpay) {
        console.log('⏳ [PAYMENT] Waiting for Razorpay script to load...');
        try {
          await loadRazorpayScript();
          console.log('✅ [PAYMENT] Razorpay script loaded successfully');
        } catch (scriptError: any) {
          console.error('❌ [PAYMENT] Failed to load Razorpay script:', scriptError);
          throw new Error('Payment gateway script failed to load. Please refresh the page and try again.');
        }
      }

      const checkoutEmail = await fetchCheckoutEmailForPrefill(customerPhone);
      const options = buildSanitizedStandardRazorpayCheckoutOptions({
        key: (keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY) as string,
        amountPaise: Math.max(1, Math.round(Number(amountToPay) * 100)),
        currency: 'INR',
        name: 'Warmpawz',
        description: `Booking: ${service.name}`,
        order_id: razorpayOrderId,
        customerPhone,
        customerEmail: checkoutEmail,
        includeInstrumentBlocks: true,
        handler: async (response: any) => {
          try {
            console.log('✅ [RAZORPAY] Payment response received:', {
              order_id: response.razorpay_order_id,
              payment_id: response.razorpay_payment_id,
              has_signature: !!response.razorpay_signature,
            });

            // ✅ FIX: Use /razorpay/verify-payment endpoint with retry
            console.log('🔄 [RAZORPAY] Verifying payment...');
            const MAX_RETRIES = 3;
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
              try {
                await apiClient.post('/razorpay/verify-payment', {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }, undefined, 30000);
                console.log(`✅ [RAZORPAY] Payment verified on attempt ${attempt}`);
                break;
              } catch (verifyErr: any) {
                console.error(`❌ [VERIFY] Attempt ${attempt}/${MAX_RETRIES} failed:`, verifyErr?.message);
                if (attempt === MAX_RETRIES) throw verifyErr;
                await new Promise((r) => setTimeout(r, attempt * 1000));
              }
            }
            setStep('confirmed');
          } catch (err: any) {
            console.error('❌ [PAYMENT] Verification failed:', err);
            const errorMessage = err?.response?.data?.error || err?.message || 'Payment verification failed';
            alert(`${errorMessage}. Please contact support with order ID: ${response.razorpay_order_id}`);
          }
        },
        theme: {
          color: '#F97316', // Orange primary color
        },
        modal: {
          ondismiss: () => {
            console.log('ℹ️ [RAZORPAY] Checkout dismissed by user');
            setProcessing(false);
          },
        },
      });
      
      // ✅ FIX: Double-check Razorpay is available before opening
      if (!window.Razorpay) {
        console.error('❌ [PAYMENT] Razorpay not available after script load');
        throw new Error('Payment gateway not loaded. Please refresh the page and try again.');
      }
      
      console.log('🚀 [PAYMENT] Opening Razorpay checkout...', {
        razorpayOrderId,
        amount: amountToPay,
        keyId: keyId ? `${keyId.substring(0, 8)}...` : 'missing'
      });
      
      try {
        const razorpay = new window.Razorpay(options);
        // ✅ Listen for payment failures (these don't trigger the handler callback)
        razorpay.on('payment.failed', (resp: any) => {
          console.error('❌ [RAZORPAY] Payment failed event:', {
            code: resp?.error?.code,
            description: resp?.error?.description,
            source: resp?.error?.source,
            step: resp?.error?.step,
            reason: resp?.error?.reason,
            orderId: resp?.error?.metadata?.order_id,
            paymentId: resp?.error?.metadata?.payment_id,
          });
          alert(`Payment failed: ${resp?.error?.description || 'Unknown error'}. Please try again.`);
          setProcessing(false);
        });
        razorpay.open();
        console.log('✅ [PAYMENT] Razorpay checkout opened successfully');
      } catch (openError: any) {
        console.error('❌ [PAYMENT] Failed to open Razorpay checkout:', openError);
        throw new Error(`Failed to open payment gateway: ${openError.message || 'Unknown error'}`);
      }
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
      <div className="min-h-screen min-h-[100dvh] w-full max-w-customer mx-auto flex items-center justify-center bg-stone-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen min-h-[100dvh] w-full max-w-customer mx-auto flex items-center justify-center bg-stone-100 px-4">
        <div className="text-center">
          <span className="text-6xl">😿</span>
          <h2 className="mt-4 text-xl font-semibold">Service not found</h2>
          <a
            href="/"
            className="mt-6 inline-flex items-center justify-center min-h-[48px] px-8 py-3 bg-orange-500 text-white rounded-full font-medium"
          >
            Go Home
          </a>
        </div>
      </div>
    );
  }

  const stepOrder: string[] = (() => {
    const steps: string[] = ['details', 'datetime'];
    if (needsPet) steps.push('pet');
    if (needsAddress) steps.push('address');
    steps.push('payment');
    return steps;
  })();

  const stepLabelByKey: Record<string, string> = {
    details: 'Details',
    datetime: 'Schedule',
    pet: 'Pet',
    address: 'Address',
    payment: 'Payment',
  };

  const activeStepIndex =
    step === 'confirmed' ? stepOrder.length : Math.max(0, stepOrder.indexOf(step));
  const progressFraction =
    step === 'confirmed' ? 1 : (activeStepIndex + 1) / stepOrder.length;

  return (
    <div className="min-h-screen min-h-[100dvh] w-full max-w-customer mx-auto flex flex-col bg-stone-100">
      {/* Mobile app shell: safe areas + capped column like rest of customer app */}
      <header className="sticky top-0 z-40 shrink-0 bg-gradient-to-br from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] text-white shadow-sm">
        <div className="cw-header-safe-top cw-header-safe-x flex min-h-[56px] items-center gap-3 py-2 pb-3">
          <button
            type="button"
            onClick={() =>
              step === 'details' ? (onBack ? onBack() : goBackOrHome(router)) : setStep('details')
            }
            className="relative z-30 flex h-11 w-11 min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-transform active:scale-95 pointer-events-auto touch-manipulation"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-white leading-tight truncate">{service.name}</h1>
            <p className="text-xs sm:text-sm text-white/85 truncate mt-0.5">{service.vendor_name}</p>
          </div>
          <span className="text-sm sm:text-base font-bold text-white tabular-nums flex-shrink-0 pl-1">
            ₹{service.price}
          </span>
        </div>
      </header>

      {/* Compact progress: bar + step count (fits narrow phones; labels align with real steps) */}
      {step !== 'confirmed' && (
        <div className="shrink-0 bg-white border-b border-stone-200/80 px-4 py-3 pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {stepLabelByKey[step] ?? 'Booking'}
            </p>
            <p className="text-xs text-gray-500 tabular-nums flex-shrink-0">
              {activeStepIndex + 1} / {stepOrder.length}
            </p>
          </div>
          <div className="h-2 rounded-full bg-stone-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] transition-[width] duration-300 ease-out"
              style={{ width: `${progressFraction * 100}%` }}
            />
          </div>
          <div className="flex gap-1 mt-2.5" role="list" aria-label="Booking steps">
            {stepOrder.map((key, i) => (
              <div
                key={key}
                role="listitem"
                className={`h-1 flex-1 min-w-0 rounded-full transition-colors ${
                  i <= activeStepIndex ? 'bg-orange-500' : 'bg-stone-200'
                }`}
                title={stepLabelByKey[key]}
              />
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 w-full px-3 sm:px-4 pb-[max(8rem,calc(5rem+env(safe-area-inset-bottom,0px)))] overflow-x-hidden">
        {step === 'details' && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-stone-100 overflow-hidden mt-3">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Service Details</h2>
            <div className="space-y-4">
              <div className="flex gap-3 items-start">
                <div className="w-14 h-14 sm:w-16 sm:h-16 flex-shrink-0 bg-orange-100 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl">
                  {service.service_style === 'at_vendor' ? '🏥' : service.service_style === 'at_home' ? '🏠' : '💻'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 leading-snug">{service.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{service.vendor_name}</p>
                  {service.vendor_address && (
                    <p className="text-xs text-gray-500 mt-1.5 leading-relaxed break-words">
                      {service.vendor_address}
                    </p>
                  )}
                </div>
              </div>
              {service.description?.trim() ? (
                <ServiceDescriptionInline
                  description={service.description}
                  title={service.name}
                  className="m-0 text-sm leading-relaxed text-gray-600"
                />
              ) : null}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-600">
                <span className="inline-flex items-center gap-1.5">⏱️ {service.duration} mins</span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-gray-900">💰 ₹{service.price}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setStep('datetime')}
              className="w-full mt-5 min-h-[48px] py-3.5 bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white rounded-2xl font-semibold text-base shadow-md active:opacity-90 transition-opacity"
            >
              Continue
            </button>
          </div>
        )}

        {step === 'datetime' && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-stone-100 overflow-hidden mt-3">
            <h2 className="text-lg font-bold mb-4 text-gray-900">Select Date & Time</h2>
            
            {/* Date Selection */}
            <div className="mb-6">
              <h3 className="font-medium text-gray-700 mb-3">Select Date</h3>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                {getNextDays().map((day) => (
                  <button
                    key={day.date}
                    onClick={() => {
                      setSelectedDate(day.date);
                      setSelectedTime('');
                    }}
                    className={`flex-shrink-0 px-4 py-3 rounded-xl text-center min-w-[80px] ${
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
              <div className="mt-6">
                <h3 className="font-medium text-gray-700 mb-3">Select Time</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3 overflow-hidden">
                  {timeSlots.length > 0 ? (
                    timeSlots.map((slot) => (
                      <button
                        key={slot.time}
                        type="button"
                        onClick={() => slot.available && setSelectedTime(slot.time)}
                        disabled={!slot.available}
                        className={`min-h-[44px] px-2 py-2 rounded-xl text-sm font-medium ${
                          selectedTime === slot.time
                            ? 'bg-orange-500 text-white shadow-sm'
                            : slot.available
                            ? 'bg-stone-100 text-gray-800 active:scale-[0.98]'
                            : 'bg-stone-50 text-gray-300 cursor-not-allowed'
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
                              arrival: staff.estimatedArrivalWithBuffer || staff.estimatedArrival || '',
                              bufferTime: staff.bufferTime || 0,
                              totalTime: staff.totalTime || staff.commuteTime || 0,
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
                                  <span className="ml-2 text-xs bg-green-100 text-green-700 px-0 py-0.5 rounded">Previous</span>
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
                          <span className="font-medium">Staff will arrive at:</span> {commuteInfo.arrival ? new Date(commuteInfo.arrival).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Calculating...'}
                        </p>
                        <p className="text-xs text-gray-500 mt-0">
                          {commuteInfo.totalTime ? `${commuteInfo.totalTime} min total` : `${commuteInfo.time} min commute`}
                          {commuteInfo.bufferTime && commuteInfo.bufferTime > 0 && ` (${commuteInfo.time} min commute + ${commuteInfo.bufferTime} min buffer)`}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                // Navigate to next required step
                if (needsPet) {
                  setStep('pet');
                } else if (needsAddress) {
                  setStep('address');
                } else {
                  setStep('payment');
                }
              }}
              disabled={!selectedDate || !selectedTime}
              className="w-full mt-6 min-h-[48px] py-3.5 bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white rounded-2xl font-semibold disabled:opacity-50 active:opacity-90 transition-opacity"
            >
              Continue
            </button>
          </div>
        )}

        {step === 'pet' && needsPet && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-stone-100 mt-3">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="text-lg font-bold text-gray-900">Select Your Pet</h2>
              <button
                onClick={() => setShowAddPetModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-orange-100 text-orange-600 rounded-lg text-sm font-medium hover:bg-orange-200 transition"
              >
                <Plus className="w-4 h-4" />
                Add Pet
              </button>
            </div>
            
            {/* Required notice */}
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                🐾 A pet profile is required for this service to provide the best care.
              </p>
            </div>
            
            <div className="space-y-3">
              {pets.length > 0 ? (
                <>
                  {pets.map((pet) => (
                    <button
                      key={pet.id}
                      onClick={() => setSelectedPet(pet.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition ${
                        selectedPet === pet.id ? 'border-orange-500 bg-orange-50' : 'border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center text-2xl overflow-hidden">
                        {pet.photo ? (
                          <img src={pet.photo} alt={pet.name} className="w-full h-full object-cover" />
                        ) : (
                          (pet.species || pet.type || '').toLowerCase().includes('dog') ? '🐕' : 
                          (pet.species || pet.type || '').toLowerCase().includes('cat') ? '🐈' : '🐾'
                        )}
                      </div>
                      <div className="text-left flex-1">
                        <p className="font-medium text-gray-900">{pet.name}</p>
                        <p className="text-sm text-gray-500">{pet.breed}</p>
                        {pet.age && <p className="text-xs text-gray-400">{pet.age} years old</p>}
                      </div>
                      {selectedPet === pet.id && (
                        <span className="text-orange-500 text-xl">✓</span>
                      )}
                    </button>
                  ))}
                </>
              ) : (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                  <div className="text-5xl mb-3">🐾</div>
                  <p className="text-gray-600 font-medium mb-2">No pets added yet</p>
                  <p className="text-sm text-gray-500 mb-4">Add your pet to continue with the booking</p>
                  <button
                    onClick={() => setShowAddPetModal(true)}
                    className="px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition"
                  >
                    + Add Your First Pet
                  </button>
                </div>
              )}
            </div>
            
            <button
              type="button"
              onClick={() => setStep(needsAddress ? 'address' : 'payment')}
              disabled={!selectedPet}
              className="w-full mt-6 min-h-[48px] py-3.5 bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white rounded-2xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:opacity-90 transition-opacity"
            >
              {selectedPet ? 'Continue' : 'Select a Pet to Continue'}
            </button>
          </div>
        )}

        {step === 'address' && needsAddress && (
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-stone-100 mt-3">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="text-lg font-bold text-gray-900">Select Delivery Address</h2>
              <button
                onClick={() => setShowAddAddressModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-orange-100 text-orange-600 rounded-lg text-sm font-medium hover:bg-orange-200 transition"
              >
                <Plus className="w-4 h-4" />
                Add Address
              </button>
            </div>
            
            {/* Required notice */}
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                📍 An address is required for {service?.service_style === 'at_home' ? 'home service delivery' : 'this service'}.
              </p>
            </div>
            
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
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-lg flex-shrink-0">
                            {addr.label?.toLowerCase() === 'home' ? '🏠' : 
                             addr.label?.toLowerCase() === 'work' ? '🏢' : '📍'}
                          </span>
                          <p className="font-medium text-gray-900 truncate">{addr.label || 'Address'}</p>
                          {addr.isDefault && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full flex-shrink-0">Default</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2 break-words">
                          {addr.addressLine1 || addr.address}
                          {addr.addressLine2 && `, ${addr.addressLine2}`}
                        </p>
                        <p className="text-sm text-gray-500 line-clamp-1 break-words">{addr.city}{addr.state && `, ${addr.state}`} - {addr.pincode}</p>
                        {addr.landmark && <p className="text-xs text-gray-400 truncate">Near: {addr.landmark}</p>}
                      </div>
                      {selectedAddress === addr.id && (
                        <span className="text-orange-500 text-xl ml-2">✓</span>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                  <div className="text-5xl mb-3">📍</div>
                  <p className="text-gray-600 font-medium mb-2">No addresses saved</p>
                  <p className="text-sm text-gray-500 mb-4">Add an address to continue with the booking</p>
                  <button
                    onClick={() => setShowAddAddressModal(true)}
                    className="px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition"
                  >
                    + Add Your Address
                  </button>
                </div>
              )}
            </div>
            
            {/* Confirm selected address */}
            {selectedAddress && addresses.length > 0 && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800 font-medium">
                  ✓ Service will be delivered to: {addresses.find(a => a.id === selectedAddress)?.label || 'Selected Address'}
                </p>
              </div>
            )}
            
            <button
              type="button"
              onClick={() => setStep('payment')}
              disabled={!selectedAddress}
              className="w-full mt-6 min-h-[48px] py-3.5 bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white rounded-2xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:opacity-90 transition-opacity"
            >
              {selectedAddress ? 'Continue to Payment' : 'Select an Address to Continue'}
            </button>
          </div>
        )}

        {step === 'payment' && (
          <div className="space-y-3 mt-3">
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-stone-100 overflow-hidden">
              <h2 className="text-lg font-bold mb-4 text-gray-900">Review Booking</h2>
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
                className="w-full mt-4 px-4 py-3 border rounded-xl focus:ring-2 focus:ring-orange-500 resize-none overflow-hidden"
              />
            </div>

            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-stone-100 overflow-hidden">
              <h2 className="text-lg font-bold mb-4 text-gray-900">Payment</h2>
              <div className="space-y-3">
                {/* ✅ SUBSCRIPTION COVERAGE BADGE */}
                {subscriptionCoverage?.covered && (
                  <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🎉</span>
                      <div>
                        <p className="font-bold">Covered by Subscription!</p>
                        <p className="text-sm text-green-100">{subscriptionCoverage.subscriptionName}</p>
                        {subscriptionCoverage.remainingCount !== null && (
                          <p className="text-xs text-green-100 mt-1">
                            {subscriptionCoverage.remainingCount} visits remaining
                          </p>
                        )}
                        {subscriptionCoverage.isUnlimited && (
                          <p className="text-xs text-green-100 mt-1">Unlimited visits</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-gray-500">Service Fee</span>
                  <span className={`font-medium ${subscriptionCoverage?.covered ? 'line-through text-gray-400' : ''}`}>
                    ₹{service.price}
                  </span>
                </div>

                {subscriptionCoverage?.covered && (
                  <div className="flex justify-between text-green-600">
                    <span>Subscription Discount</span>
                    <span>-₹{service.price}</span>
                  </div>
                )}
                
                {!subscriptionCoverage?.covered && wallet && wallet.balance > 0 && (
                  <button
                    onClick={() => setUseWallet(!useWallet)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border-2 ${
                      useWallet ? 'border-green-500 bg-green-50' : 'border-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
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

                {!subscriptionCoverage?.covered && useWallet && wallet && (
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
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-stone-100 text-center mt-3">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center text-3xl sm:text-4xl mx-auto">
              ✅
            </div>
            <h2 className="text-xl sm:text-2xl font-bold mt-4 text-gray-900">Booking Confirmed!</h2>
            <p className="text-sm text-gray-500 mt-2">Your booking has been successfully placed</p>

            <div className="mt-5 p-4 bg-stone-50 rounded-xl text-left space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-gray-500 shrink-0">Service</span>
                <span className="font-medium text-right min-w-0 break-words">{service.name}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Date</span>
                <span className="font-medium">{new Date(selectedDate).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Time</span>
                <span className="font-medium">{selectedTime}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-6">
              {onComplete ? (
                <>
                  <button
                    type="button"
                    onClick={() => onComplete(bookingId || '')}
                    className="flex-1 min-h-[48px] py-3 border border-stone-200 rounded-xl font-semibold text-gray-800 active:bg-stone-50"
                  >
                    View Bookings
                  </button>
                  <button
                    type="button"
                    onClick={() => onComplete(bookingId || '')}
                    className="flex-1 min-h-[48px] py-3 bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white rounded-xl font-semibold shadow-md"
                  >
                    Done
                  </button>
                </>
              ) : (
                <>
                  <a
                    href="/bookings"
                    className="flex-1 min-h-[48px] inline-flex items-center justify-center py-3 border border-stone-200 rounded-xl font-semibold text-gray-800"
                  >
                    View Bookings
                  </a>
                  <a
                    href="/"
                    className="flex-1 min-h-[48px] inline-flex items-center justify-center py-3 bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white rounded-xl font-semibold shadow-md"
                  >
                    Go Home
                  </a>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Fixed Bottom Button */}
      {step === 'payment' && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-stone-200 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-3 px-4">
          <div className="w-full max-w-customer mx-auto">
            <button
              type="button"
              onClick={handleCreateBooking}
              disabled={processing}
              className="w-full min-h-[52px] py-3.5 bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white rounded-2xl font-bold text-base disabled:opacity-50 active:opacity-90 transition-opacity"
            >
              {processing ? 'Processing...' : subscriptionCoverage?.covered ? 'Confirm Booking (₹0)' : `Pay ₹${calculateTotal()}`}
            </button>
          </div>
        </div>
      )}
      
      {/* Add Pet Modal - Enhanced with Photo & Vaccinations */}
      <EnhancedAddPetModal
        phone={customerPhone}
        isOpen={showAddPetModal}
        onClose={() => setShowAddPetModal(false)}
        onSuccess={() => {
          refreshPets();
          setShowAddPetModal(false);
        }}
      />
      
      {/* Add Address Modal */}
      {showAddAddressModal && (
        <AddAddressModalInline
          phone={customerPhone}
          onClose={() => setShowAddAddressModal(false)}
          onSuccess={() => {
            refreshAddresses();
            setShowAddAddressModal(false);
          }}
        />
      )}
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
        alert('Image size should be less than 5MB');
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
      alert('Please fill in all required fields (Name, Type, Breed, Age)');
      return;
    }
    
    setLoading(true);
    try {
      // Get existing pets
      const getPetsData = await apiClient.get(`/customer/pets/${phone}`) as any;
      let existingPets = [];
      if (Array.isArray(getPetsData)) {
        existingPets = getPetsData;
      } else if (Array.isArray(getPetsData.pets)) {
        existingPets = getPetsData.pets;
      } else if (getPetsData.pets?.pets && Array.isArray(getPetsData.pets.pets)) {
        existingPets = getPetsData.pets.pets;
      }
      
      const updatedPets = [...existingPets, petData];
      
      await apiClient.post('/customer/pets', {
        phone: phone,
        pets: updatedPets
      });
      
      onSuccess();
    } catch (error) {
      console.error('Error saving pet:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to save pet. Please try again.'}`);
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
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-4 rounded-t-3xl sticky top-0">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Add New Pet 🐾</h3>
            <button onClick={onClose} className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
        
        <div className="p-5 space-y-4">
          {/* Photo Upload */}
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

          {/* Pet Name */}
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

          {/* Pet Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pet Type <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-3 gap-2">
              {['Dog', 'Cat', 'Other'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPetData({ ...petData, type })}
                  className={`py-2.5 px-3 border-2 rounded-xl transition font-medium text-sm ${
                    petData.type === type ? 'border-orange-500 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-700'
                  }`}
                >
                  {type === 'Dog' ? '🐕' : type === 'Cat' ? '🐈' : '🐾'} {type}
                </button>
              ))}
            </div>
          </div>

          {/* Breed */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Breed <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={petData.breed}
              onChange={(e) => setPetData({ ...petData, breed: e.target.value })}
              placeholder="e.g., Golden Retriever, Persian"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
            />
          </div>

          {/* Age and Gender */}
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

          {/* Weight and Color */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
              <input
                type="number"
                step="0.1"
                value={petData.weight}
                onChange={(e) => setPetData({ ...petData, weight: e.target.value })}
                placeholder="e.g., 12.5"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <input
                type="text"
                value={petData.color}
                onChange={(e) => setPetData({ ...petData, color: e.target.value })}
                placeholder="e.g., Golden"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
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
              className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 rounded-xl text-white font-medium disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Add Pet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Inline Add Address Modal Component
function AddAddressModalInline({ phone, onClose, onSuccess }: { phone: string; onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  
  const [formData, setFormData] = useState({
    id: `addr_${Date.now()}`,
    label: 'Home',
    name: '',
    phone: phone,
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    landmark: '',
    isDefault: true,
    latitude: 0,
    longitude: 0,
    flatNo: '',
    houseNo: '',
    floor: '',
    streetName: '',
    apartmentName: '',
  });

  const detectCurrentLocation = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    const permission = await requestLocationPermission();
    if (permission === 'denied') {
      alert('Location permission denied. Please allow location access and try again.');
      return;
    }

    setDetectingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setFormData(prev => ({ ...prev, latitude, longitude }));
        
        // Try reverse geocoding
        try {
          const apiKey =
            (await getGoogleMapsBrowserApiKey()) ||
            process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
            '';
          const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
          );
          const data = await response.json();

          if (data.results && data.results[0]) {
            const addressComponents = data.results[0].address_components;
            let street = '', city = '', state = '', pincode = '';

            addressComponents.forEach((component: any) => {
              if (component.types.includes('street_number') || component.types.includes('route')) {
                street += component.long_name + ' ';
              }
              if (component.types.includes('locality') || component.types.includes('administrative_area_level_2')) {
                city = component.long_name;
              }
              if (component.types.includes('administrative_area_level_1')) {
                state = component.long_name;
              }
              if (component.types.includes('postal_code')) {
                pincode = component.long_name;
              }
            });

            setFormData(prev => ({
              ...prev,
              addressLine1: street.trim(),
              city,
              state,
              pincode
            }));
          }
        } catch (error) {
          console.error('Error reverse geocoding:', error);
        } finally {
          setDetectingLocation(false);
        }
      },
      () => {
        setDetectingLocation(false);
        alert('Unable to get location. Please enter address manually.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveAddress = async () => {
    if (!formData.addressLine1 || !formData.city || !formData.pincode) {
      alert('Please fill in required fields (Address, City, Pincode)');
      return;
    }
    
    setLoading(true);
    try {
      // Get existing addresses
      const getAddressData = await apiClient.get(`/customer/addresses?phone=${encodeURIComponent(phone)}`) as any;
      let existingAddresses = [];
      if (Array.isArray(getAddressData)) {
        existingAddresses = getAddressData;
      } else if (Array.isArray(getAddressData.addresses)) {
        existingAddresses = getAddressData.addresses;
      }
      
      // If this is default, unset other defaults
      if (formData.isDefault) {
        existingAddresses = existingAddresses.map((a: any) => ({ ...a, isDefault: false }));
      }
      
      const updatedAddresses = [...existingAddresses, {
        ...formData,
        address: formData.addressLine1 + (formData.addressLine2 ? ', ' + formData.addressLine2 : ''),
        flatNo: formData.flatNo || undefined,
        houseNo: formData.houseNo || undefined,
        floor: formData.floor || undefined,
        streetName: formData.streetName || undefined,
        apartmentName: formData.apartmentName || undefined,
      }];
      
      await apiClient.post('/customer/addresses', {
        phone: phone,
        addresses: updatedAddresses
      });
      
      onSuccess();
    } catch (error) {
      console.error('Error saving address:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to save address. Please try again.'}`);
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
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 rounded-t-3xl sticky top-0">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Add New Address 📍</h3>
            <button onClick={onClose} className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
        
        <div className="p-5 space-y-4">
          {/* Detect Location Button */}
          <button
            type="button"
            onClick={detectCurrentLocation}
            disabled={detectingLocation}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {detectingLocation ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Detecting Location...
              </>
            ) : (
              <>
                <MapPin className="w-5 h-5" />
                Detect My Current Location
              </>
            )}
          </button>

          <div className="relative">
            <div className="absolute inset-x-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-sm text-gray-500">or enter manually</span>
            </div>
          </div>

          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
            <select
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
            >
              <option value="Home">🏠 Home</option>
              <option value="Work">🏢 Work</option>
              <option value="Other">📍 Other</option>
            </select>
          </div>

          {/* Address Line 1 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1 <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={formData.addressLine1}
              onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
              placeholder="House/Flat No., Building Name, Street"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Address Line 2 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
            <input
              type="text"
              value={formData.addressLine2}
              onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
              placeholder="Area, Locality (Optional)"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Optional: Flat, House, Floor, Street, Apartment */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Flat / Unit no.</label>
              <input
                type="text"
                value={formData.flatNo}
                onChange={(e) => setFormData({ ...formData, flatNo: e.target.value })}
                placeholder="e.g. 401"
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">House / Building no.</label>
              <input
                type="text"
                value={formData.houseNo}
                onChange={(e) => setFormData({ ...formData, houseNo: e.target.value })}
                placeholder="e.g. 12"
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Floor</label>
              <input
                type="text"
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                placeholder="e.g. 4th"
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Street name</label>
              <input
                type="text"
                value={formData.streetName}
                onChange={(e) => setFormData({ ...formData, streetName: e.target.value })}
                placeholder="Street name"
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Apartment / Building / Society name</label>
            <input
              type="text"
              value={formData.apartmentName}
              onChange={(e) => setFormData({ ...formData, apartmentName: e.target.value })}
              placeholder="e.g. Green Valley Apartments"
              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-sm"
            />
          </div>

          {/* City and Pincode */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="e.g., Mumbai"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pincode <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={formData.pincode}
                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                placeholder="e.g., 400001"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* State */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
            <input
              type="text"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              placeholder="e.g., Maharashtra"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Landmark */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Landmark</label>
            <input
              type="text"
              value={formData.landmark}
              onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
              placeholder="Near..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* Default Address Toggle */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <input
              type="checkbox"
              id="isDefault"
              checked={formData.isDefault}
              onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
              className="w-5 h-5 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
            />
            <label htmlFor="isDefault" className="text-sm font-medium text-gray-700">Set as default address</label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 border-2 border-gray-300 rounded-xl font-medium text-gray-700"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAddress}
              disabled={loading}
              className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 rounded-xl text-white font-medium disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Add Address'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

