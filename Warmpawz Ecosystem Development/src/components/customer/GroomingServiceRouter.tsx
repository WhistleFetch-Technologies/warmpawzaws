import { useState, useEffect } from 'react';
import { GroomingServicesLanding } from './GroomingServicesLanding';
import { GroomingCenterListView } from './grooming/GroomingCenterListView';
import { GroomingCenterProfileView } from './grooming/GroomingCenterProfileView';
import { ServicePackageSelector } from './grooming/ServicePackageSelector';
import { PetSelector } from './grooming/PetSelector';
import { TimeSlotSelector } from './grooming/TimeSlotSelector';
import { AddressSelector } from './grooming/AddressSelector';
import { PaymentPage } from './grooming/PaymentPage';
import { BookingConfirmation } from './grooming/BookingConfirmation';
import { GroomingAtHome } from './GroomingAtHome';
import { ProblemGridSelector } from './ProblemGridSelector'; // ✅ NEW
import { VendorDiscoveryByProblem } from './VendorDiscoveryByProblem'; // ✅ NEW
import { projectId, publicAnonKey } from '../../utils/supabase/info';

type ViewType = 
  | 'landing'
  | 'grooming_center'
  | 'grooming_home'
  | 'center_profile'
  | 'select_service'
  | 'select_pet'
  | 'select_time'
  | 'select_address'
  | 'payment'
  | 'confirmation'
  | 'problem_grid'        // ✅ NEW
  | 'problem_discovery';  // ✅ NEW

interface GroomingServiceRouterProps {
  onBack: () => void;
  phone: string;
  onNavigate?: (screen: string, data?: any) => void;
  onViewBooking?: (bookingId: string, petId: string) => void;
  onViewAppointment?: (appointmentId: string) => void; // ✅ NEW: Navigate to appointment details
  data?: any;
}

export function GroomingServiceRouter({ onBack, phone, onNavigate, onViewBooking, onViewAppointment, data }: GroomingServiceRouterProps) {
  const [currentView, setCurrentView] = useState<ViewType>('landing');
  const [customerId, setCustomerId] = useState<string>('');
  const [customerData, setCustomerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // ✅ Problem grid state
  const [selectedProblem, setSelectedProblem] = useState<any>(null);
  
  // Booking flow state
  const [bookingFlow, setBookingFlow] = useState<{
    serviceType: 'center' | 'home' | null;
    vendorId: string | null;
    vendorName: string | null;
    vendorAddress: string | null;
    services: any[];
    addOns: any[];
    pet: any | null;
    date: string | null;
    time: string | null;
    address: any | null;
    payment: any | null;
    booking: any | null;
  }>({
    serviceType: null,
    vendorId: null,
    vendorName: null,
    vendorAddress: null,
    services: [],
    addOns: [],
    pet: null,
    date: null,
    time: null,
    address: null,
    payment: null,
    booking: null
  });

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadCustomerData();
  }, [phone]);

  const loadCustomerData = async () => {
    try {
      const customerIdKey = await fetch(
        `${API_BASE}/customer-by-phone/${phone}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );

      if (customerIdKey.ok) {
        const data = await customerIdKey.json();
        setCustomerId(data.customerId);
        setCustomerData(data.customer);
      }
    } catch (error) {
      console.error('Error loading customer data:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetBookingFlow = () => {
    setBookingFlow({
      serviceType: null,
      vendorId: null,
      vendorName: null,
      vendorAddress: null,
      services: [],
      addOns: [],
      pet: null,
      date: null,
      time: null,
      address: null,
      payment: null,
      booking: null
    });
  };

  const fetchProblemDetails = async (problemId: string) => {
    try {
      console.log(`🎯 [GROOMING-ROUTER] Fetching problem details for: ${problemId}`);
      console.log(`   API endpoint: ${API_BASE}/customer/universal-problem-discovery?problemGridId=${problemId}&roleId=pet_groomer`);
      
      const response = await fetch(
        `${API_BASE}/customer/universal-problem-discovery?problemGridId=${problemId}&roleId=pet_groomer`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );

      console.log(`   Response status: ${response.status}`);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ [GROOMING-ROUTER] Problem fetched successfully:', result);
        
        // Map the response to match expected structure
        const problemData = {
          id: result.problemGrid?.id || problemId,
          displayName: result.problemGrid?.displayName || problemId,
          description: result.problemGrid?.description || '',
          icon: result.problemGrid?.icon || '',
          specialists: result.specialists || [],
          totalCount: result.totalCount || 0
        };
        
        setSelectedProblem(problemData);
        setCurrentView('problem_discovery');
      } else {
        console.error('❌ [GROOMING-ROUTER] Failed to fetch problem details');
        alert('Failed to load grooming specialists. Please try again.');
      }
    } catch (error) {
      console.error('❌ [GROOMING-ROUTER] Error fetching problem:', error);
      alert('Network error. Please check your connection and try again.');
    }
  };

  const handleGroomingNavigate = (screen: string, data?: any) => {
    console.log('📍 [GROOMING-ROUTER] Navigating to:', screen, data);
    
    // ✅ Handle problem grid navigation
    if (screen === 'problem_grid') {
      setCurrentView('problem_grid');
      return;
    }
    
    // ✅ Handle problem selection
    if (screen === 'problem_selected') {
      const problemId = data?.problemId;
      if (problemId) {
        fetchProblemDetails(problemId);
      }
      return;
    }
    
    if (screen === 'grooming_center') {
      resetBookingFlow();
      setBookingFlow(prev => ({ ...prev, serviceType: 'center' }));
      setCurrentView('grooming_center');
    } else if (screen === 'grooming_home') {
      resetBookingFlow();
      setBookingFlow(prev => ({ ...prev, serviceType: 'home' }));
      setCurrentView('grooming_home');
    } else if (screen === 'center-details') {
      setCurrentView('center_profile');
      setBookingFlow(prev => ({ 
        ...prev, 
        vendorId: data?.id || null,
        vendorName: data?.businessName || null,
        vendorAddress: data?.address || null
      }));
    } else if (screen === 'select_service') {
      setCurrentView('select_service');
    } else if (screen === 'home_service_book') {
      // From GroomingAtHome - user clicked book on a service
      setBookingFlow(prev => ({
        ...prev,
        vendorId: data?.vendorId,
        vendorName: data?.vendorName,
        services: data?.service,
        serviceType: 'home'
      }));
      setCurrentView('select_pet');
    }
  };

  const handleServiceSelected = (services: any[], addOns: any[]) => {
    console.log('✅ [ROUTER] Services selected:', services);
    setBookingFlow(prev => ({ ...prev, services, addOns }));
    setCurrentView('select_pet');
  };

  const handlePetSelected = (pet: any) => {
    console.log('✅ [ROUTER] Pet selected:', pet);
    setBookingFlow(prev => ({ ...prev, pet }));
    setCurrentView('select_time');
  };

  const handleTimeSelected = (date: string, time: string) => {
    console.log('✅ [ROUTER] Time selected:', date, time);
    setBookingFlow(prev => ({ ...prev, date, time }));
    
    // If home service, go to address selection, otherwise go to payment
    if (bookingFlow.serviceType === 'home') {
      setCurrentView('select_address');
    } else {
      setCurrentView('payment');
    }
  };

  const handleAddressSelected = (address: any) => {
    console.log('✅ [ROUTER] Address selected:', address);
    setBookingFlow(prev => ({ ...prev, address }));
    setCurrentView('payment');
  };

  const handlePaymentSuccess = async (paymentData: any) => {
    console.log('✅ [ROUTER] Payment successful:', paymentData);
    
    try {
      // Create booking
      const bookingPayload = {
        customerPhone: phone,
        petId: bookingFlow.pet?.id,
        petName: bookingFlow.pet?.name,
        vendorId: bookingFlow.vendorId,
        vendorName: bookingFlow.vendorName,
        serviceId: bookingFlow.services[0]?.id,
        serviceName: bookingFlow.services[0]?.serviceName || bookingFlow.services[0]?.name,
        serviceType: 'grooming',
        serviceStyle: bookingFlow.serviceType === 'home' ? 'at_home' : 'at_center',
        scheduledDate: bookingFlow.date,
        scheduledTime: bookingFlow.time,
        address: bookingFlow.address,
        paymentMethod: paymentData.method,
        transactionId: paymentData.paymentId,
        amount: paymentData.amount,
        addOns: bookingFlow.addOns,
        walletUsed: paymentData.walletUsed || 0,
        couponApplied: paymentData.couponApplied || null
      };

      console.log('📤 [ROUTER] Creating booking:', bookingPayload);

      const response = await fetch(
        `${API_BASE}/customer/booking`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(bookingPayload)
        }
      );

      if (response.ok) {
        const bookingData = await response.json();
        console.log('✅ [ROUTER] Booking created:', bookingData);

        // OTP is already generated in the booking creation
        const otp = bookingData.otp || bookingData.booking.completionOTP;
        console.log('✅ [ROUTER] OTP from booking:', otp);

        // Update booking flow with booking data
        setBookingFlow(prev => ({
          ...prev,
          payment: paymentData,
          booking: {
            bookingId: bookingData.bookingId,
            ...bookingData.booking,
            otp
          }
        }));

        setCurrentView('confirmation');
      } else {
        console.error('❌ [ROUTER] Booking creation failed');
        alert('Failed to create booking. Please try again.');
      }
    } catch (error) {
      console.error('❌ [ROUTER] Error creating booking:', error);
      alert('An error occurred. Please try again.');
    }
  };

  const handleBackToLanding = () => {
    resetBookingFlow();
    setCurrentView('landing');
  };

  const handleViewBooking = () => {
    if (onViewBooking && bookingFlow.booking) {
      onViewBooking(bookingFlow.booking.bookingId, bookingFlow.pet?.id);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  // Booking Confirmation
  if (currentView === 'confirmation' && bookingFlow.booking) {
    return (
      <BookingConfirmation
        bookingData={{
          bookingId: bookingFlow.booking.bookingId,
          serviceName: bookingFlow.services[0]?.serviceName || bookingFlow.services[0]?.name,
          serviceType: bookingFlow.serviceType || 'center',
          vendorName: bookingFlow.vendorName || 'Grooming Service',
          vendorAddress: bookingFlow.vendorAddress || '',
          petName: bookingFlow.pet?.name || 'Pet',
          petId: bookingFlow.pet?.id, // ✅ ADD: Pass pet ID for navigation
          date: bookingFlow.date || '',
          time: bookingFlow.time || '',
          amount: bookingFlow.payment?.amount || 0,
          paymentMethod: bookingFlow.payment?.method || 'upi',
          otp: bookingFlow.booking.otp
        }}
        onViewBooking={handleViewBooking}
        onViewAppointment={onViewAppointment} // ✅ NEW: Pass appointment navigation
        onBackToDashboard={handleBackToLanding}
      />
    );
  }

  // Payment Page
  if (currentView === 'payment' && bookingFlow.services.length > 0 && bookingFlow.pet && bookingFlow.date && bookingFlow.time) {
    return (
      <PaymentPage
        bookingData={{
          services: bookingFlow.services,
          vendorName: bookingFlow.vendorName || 'Grooming Service',
          petName: bookingFlow.pet.name,
          date: bookingFlow.date,
          time: bookingFlow.time,
          addOns: bookingFlow.addOns
        }}
        phone={phone}
        onBack={() => {
          if (bookingFlow.serviceType === 'home') {
            setCurrentView('select_address');
          } else {
            setCurrentView('select_time');
          }
        }}
        onPaymentSuccess={handlePaymentSuccess}
      />
    );
  }

  // Address Selection (Home Service Only)
  if (currentView === 'select_address' && bookingFlow.serviceType === 'home') {
    return (
      <AddressSelector
        phone={phone}
        onBack={() => setCurrentView('select_time')}
        onSelect={handleAddressSelected}
      />
    );
  }

  // Time Slot Selection
  if (currentView === 'select_time' && bookingFlow.vendorId && bookingFlow.services.length > 0) {
    return (
      <TimeSlotSelector
        vendorId={bookingFlow.vendorId}
        vendorName={bookingFlow.vendorName || 'Grooming Center'} // ✅ Pass vendorName for scheduling policy display
        serviceDuration={bookingFlow.services[0].duration || 60}
        serviceStyle={bookingFlow.serviceType === 'home' ? 'at_home' : 'at_center'} // ✅ Pass serviceStyle for V2 slots
        onBack={() => setCurrentView('select_pet')}
        onSelect={handleTimeSelected}
      />
    );
  }

  // Pet Selection
  if (currentView === 'select_pet' && bookingFlow.services.length > 0) {
    return (
      <PetSelector
        phone={phone}
        onBack={() => setCurrentView('select_service')}
        onSelect={handlePetSelected}
      />
    );
  }

  // Service Package Selection
  if (currentView === 'select_service' && bookingFlow.vendorId) {
    return (
      <ServicePackageSelector
        vendorId={bookingFlow.vendorId}
        vendorName={bookingFlow.vendorName || 'Grooming Service'}
        serviceType={bookingFlow.serviceType || 'center'}
        onBack={() => setCurrentView('center_profile')}
        onSelect={handleServiceSelected}
      />
    );
  }

  // Center Profile View
  if (currentView === 'center_profile' && bookingFlow.vendorId) {
    return (
      <GroomingCenterProfileView
        phone={phone}
        centerId={bookingFlow.vendorId}
        onBack={() => setCurrentView('grooming_center')}
        onNavigate={handleGroomingNavigate}
      />
    );
  }

  // Grooming Center List View
  if (currentView === 'grooming_center') {
    return (
      <GroomingCenterListView
        phone={phone}
        onBack={handleBackToLanding}
        onNavigate={handleGroomingNavigate}
      />
    );
  }

  // At-Home Grooming Flow
  if (currentView === 'grooming_home') {
    return (
      <GroomingAtHome
        onBack={handleBackToLanding}
        customerId={customerId}
        customerData={customerData}
        phone={phone}
        onNavigate={handleGroomingNavigate}
      />
    );
  }

  // ✅ Problem Grid Selector
  if (currentView === 'problem_grid') {
    return (
      <ProblemGridSelector
        roleId="pet_groomer"
        roleName="Pet Groomer"
        onBack={handleBackToLanding}
        onProblemSelect={(problem) => {
          console.log('✅ [GROOMING-ROUTER] Problem selected from grid:', problem);
          setSelectedProblem(problem);
          setCurrentView('problem_discovery');
        }}
        customerId={customerId}
        phone={phone}
      />
    );
  }

  // ✅ Vendor Discovery by Problem
  if (currentView === 'problem_discovery' && selectedProblem) {
    return (
      <VendorDiscoveryByProblem
        roleId="pet_groomer"
        roleName="Pet Groomer"
        problem={selectedProblem}
        onBack={() => setCurrentView('problem_grid')}
        onVendorSelect={(vendor) => {
          console.log('✅ [GROOMING-ROUTER] Vendor selected:', vendor);
          // Navigate to grooming center profile or booking flow
          setBookingFlow(prev => ({
            ...prev,
            vendorId: vendor.vendorId || vendor.id,
            vendorName: vendor.vendorName || vendor.businessName,
            vendorAddress: vendor.location?.address,
            serviceType: 'center'
          }));
          setCurrentView('center_profile');
        }}
        customerId={customerId}
        phone={phone}
      />
    );
  }

  // Landing Dashboard
  return (
    <GroomingServicesLanding
      onBack={onBack}
      onNavigate={handleGroomingNavigate}
      customerId={customerId}
      phone={phone}
    />
  );
}