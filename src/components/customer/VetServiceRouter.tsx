import { useState, useEffect } from 'react';
import { VetServicesLanding } from './VetServicesLanding';
import { VetClinicListViewEnhanced } from './vet/VetClinicListViewEnhanced'; // ✅ UPDATED: Use enhanced version with doctor search
import { VetCenterProfileView } from './vet/VetCenterProfileView';
import { VetAtHome } from './VetAtHome';
import { ServicePackageSelector } from './grooming/ServicePackageSelector';
import { PetSelector } from './grooming/PetSelector';
import { TimeSlotSelector } from './grooming/TimeSlotSelector';
import { AddressSelector } from './grooming/AddressSelector';
import { PaymentPage } from './grooming/PaymentPage';
import { BookingConfirmation } from './grooming/BookingConfirmation';
import { FollowUpSelection } from './vet/FollowUpSelection';
import { FollowUpChat } from './vet/FollowUpChat';
import { VetBookingRouter } from './vet/VetBookingRouter'; // ✅ NEW: Complete booking flow
import { VetDoctorDetails } from './vet/VetDoctorDetails'; // ✅ NEW: Doctor details
import { ProblemGridSelector } from './ProblemGridSelector'; // ✅ NEW: Problem grid
import { VendorDiscoveryByProblem } from './VendorDiscoveryByProblem'; // ✅ NEW: Vendor discovery
import { BookingFlowDispatcher, determineServiceStyle } from './BookingFlowDispatcher'; // ✅ MIGRATION: Use unified dispatcher
import { projectId, publicAnonKey } from '../../utils/supabase/info';

type ViewType = 
  | 'landing'
  | 'problem_grid'
  | 'vendor_discovery'
  | 'vet_center'
  | 'vet_home'
  | 'center_profile'
  | 'doctor_details'
  | 'doctor_booking'
  | 'vet_booking'
  | 'select_service'
  | 'select_pet'
  | 'select_time'
  | 'select_address'
  | 'payment'
  | 'confirmation'
  | 'followup_selection'
  | 'followup_chat'
  | 'booking_dispatcher'; // ✅ MIGRATION: New view for unified booking flow

interface VetServiceRouterProps {
  onBack: () => void;
  phone: string;
  onNavigate?: (screen: string, data?: any) => void;
  onViewBooking?: (bookingId: string, petId: string) => void;
  data?: any;
}

export function VetServiceRouter({ onBack, phone, onNavigate, onViewBooking, data }: VetServiceRouterProps) {
  const [currentView, setCurrentView] = useState<ViewType>('landing');
  const [customerId, setCustomerId] = useState<string>('');
  const [customerData, setCustomerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
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
    followUpBooking: any | null;
    doctorId: string | null;
    selectedService: any | null;
    doctor: any | null;
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
    booking: null,
    followUpBooking: null,
    doctorId: null,
    selectedService: null,
    doctor: null
  });

  // ✅ NEW: Problem grid state
  const [selectedProblem, setSelectedProblem] = useState<any>(null);

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
      booking: null,
      followUpBooking: null,
      doctorId: null,
      selectedService: null,
      doctor: null
    });
  };

  const handleVetNavigate = (screen: string, data?: any) => {
    console.log('📍 [VET-ROUTER] Navigating to:', screen, data);
    
    if (screen === 'problem_grid') {
      // Navigate to problem grid selector
      setCurrentView('problem_grid');
    } else if (screen === 'problem_selected') {
      // User selected a problem, fetch full problem object from backend
      const problemId = data?.problemId;
      if (problemId) {
        fetchProblemDetails(problemId);
      }
    } else if (screen === 'vet_center' || screen === 'clinic_visit') {
      resetBookingFlow();
      setBookingFlow(prev => ({ ...prev, serviceType: 'center' }));
      setCurrentView('vet_center');
    } else if (screen === 'vet_home' || screen === 'home_visit') {
      resetBookingFlow();
      setBookingFlow(prev => ({ ...prev, serviceType: 'home' }));
      setCurrentView('vet_home');
    } else if (screen === 'tele_consultation') {
      // Navigate to tele consultation - to be implemented
      alert('Tele Consultation - Coming Soon!');
    } else if (screen === 'lab_collection') {
      // Navigate to lab collection - to be implemented
      alert('Lab Sample Collection - Coming Soon!');
    } else if (screen === 'medicine_delivery') {
      // Navigate to medicine delivery - to be implemented
      alert('Medicine Delivery - Coming Soon!');
    } else if (screen === 'followup') {
      // Navigate to follow-up consultation selection
      setCurrentView('followup_selection');
    } else if (screen === 'followup_chat') {
      // Navigate to follow-up chat
      setBookingFlow(prev => ({ ...prev, followUpBooking: data?.booking || null }));
      setCurrentView('followup_chat');
    } else if (screen === 'select_service') {
      // ✅ MIGRATION: Route to booking_dispatcher if vendor is selected, otherwise show service selector
      if (data?.vendorId) {
        setBookingFlow(prev => ({
          ...prev,
          vendorId: data?.vendorId,
          vendorName: data?.vendorName,
          selectedService: data?.service,
          serviceType: data?.serviceType || 'center'
        }));
        setCurrentView('booking_dispatcher');
      } else {
        setCurrentView('select_service');
      }
    } else if (screen === 'home_service_book') {
      // ✅ MIGRATION: Use BookingFlowDispatcher instead of legacy multi-step flow
      setBookingFlow(prev => ({
        ...prev,
        vendorId: data?.vendorId,
        vendorName: data?.vendorName,
        selectedService: data?.service,
        serviceType: 'home',
        pet: data?.pet || null
      }));
      setCurrentView('booking_dispatcher');
    } else if (screen === 'doctor_details' || screen === 'doctor-details') {
      console.log('✅ [VET-ROUTER] Navigating to doctor details with data:', data);
      setCurrentView('doctor_details');
      setBookingFlow(prev => ({
        ...prev,
        vendorId: data?.doctorId || data?.id,
        vendorName: data?.doctor?.name || data?.doctor?.fullName || data?.name,
        vendorAddress: data?.doctor?.clinicAddress || data?.address,
        doctor: data?.doctor || data || null  // ✅ Check data?.doctor first, then data itself
      }));
    } else if (screen === 'vet-booking' || screen === 'booking-dispatcher') {
      // ✅ MIGRATION: Use BookingFlowDispatcher for unified booking flow
      console.log('✅ [VET-ROUTER] Starting unified booking flow with:', data);
      setCurrentView('booking_dispatcher');
      setBookingFlow(prev => ({
        ...prev,
        vendorId: data?.vendorId || data?.doctorId || data?.clinicId,
        vendorName: data?.vendorName || data?.doctor?.name || data?.name,
        selectedService: data?.service || data?.selectedService,
        serviceType: data?.serviceType || data?.serviceStyle || 'center',
        doctorId: data?.doctorId || data?.staffId,
        doctor: data?.doctor || null
      }));
    } else if (screen === 'clinic-profile' || screen === 'clinic_profile') {
      setCurrentView('center_profile');
      setBookingFlow(prev => ({ 
        ...prev, 
        vendorId: data?.clinicId || data?.id || null,
        vendorName: data?.name || data?.businessName || null,
        vendorAddress: data?.address || null
      }));
    } else if (screen === 'doctor_booking') {
      setCurrentView('doctor_booking');
      setBookingFlow(prev => ({
        ...prev,
        vendorId: data?.doctorId || data?.id,
        vendorName: data?.doctor?.name || data?.doctor?.fullName || data?.name,
        vendorAddress: data?.doctor?.clinicAddress || data?.address
      }));
    }
  };

  const fetchProblemDetails = async (problemId: string) => {
    try {
      console.log(`🎯 [VET-ROUTER] Fetching problem details for: ${problemId}`);
      console.log(`   API endpoint: ${API_BASE}/customer/universal-problem-discovery?problemGridId=${problemId}&roleId=veterinarian`);
      
      const response = await fetch(
        `${API_BASE}/customer/universal-problem-discovery?problemGridId=${problemId}&roleId=veterinarian`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );

      console.log(`   Response status: ${response.status}`);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ [VET-ROUTER] Problem fetched successfully:', result);
        
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
        setCurrentView('vendor_discovery');
      } else {
        const errorText = await response.text();
        console.error('❌ [VET-ROUTER] Failed to fetch problem details:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        alert('Failed to fetch problem details. Please try again.');
      }
    } catch (error) {
      console.error('❌ [VET-ROUTER] Error fetching problem details:', error);
      alert('An error occurred. Please try again.');
    }
  };

  const handleServiceSelected = (services: any[], addOns: any[]) => {
    console.log('✅ [VET-ROUTER] Services selected:', services);
    setBookingFlow(prev => ({ ...prev, services, addOns }));
    setCurrentView('select_pet');
  };

  const handlePetSelected = (pet: any) => {
    console.log('✅ [VET-ROUTER] Pet selected:', pet);
    setBookingFlow(prev => ({ ...prev, pet }));
    setCurrentView('select_time');
  };

  const handleTimeSelected = (date: string, time: string) => {
    console.log('✅ [VET-ROUTER] Time selected:', date, time);
    setBookingFlow(prev => ({ ...prev, date, time }));
    
    if (bookingFlow.serviceType === 'home') {
      setCurrentView('select_address');
    } else {
      setCurrentView('payment');
    }
  };

  const handleAddressSelected = (address: any) => {
    console.log('✅ [VET-ROUTER] Address selected:', address);
    setBookingFlow(prev => ({ ...prev, address }));
    setCurrentView('payment');
  };

  const handlePaymentSuccess = async (paymentData: any) => {
    // ✅ MIGRATION: Booking creation now handled by BookingFlowDispatcher
    // This function is kept for backward compatibility but booking flows should use dispatcher
    console.log('✅ [VET-ROUTER] Payment successful (legacy flow):', paymentData);
    
    try {
      const bookingPayload = {
        customerPhone: phone,
        petId: bookingFlow.pet?.id,
        petName: bookingFlow.pet?.name,
        vendorId: bookingFlow.vendorId,
        vendorName: bookingFlow.vendorName,
        serviceId: bookingFlow.services[0]?.id,
        serviceName: bookingFlow.services[0]?.serviceName || bookingFlow.services[0]?.name,
        serviceType: 'vet',
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

      console.log('📤 [VET-ROUTER] Creating booking:', bookingPayload);

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
        console.log('✅ [VET-ROUTER] Booking created:', bookingData);

        const otp = bookingData.otp || bookingData.booking.completionOTP;
        console.log('✅ [VET-ROUTER] OTP from booking:', otp);

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
        console.error('❌ [VET-ROUTER] Booking creation failed');
        alert('Failed to create booking. Please try again.');
      }
    } catch (error) {
      console.error('❌ [VET-ROUTER] Error creating booking:', error);
      alert('An error occurred. Please try again.');
    }
  };

  const handleBookingComplete = (bookingId: string) => {
    console.log('✅ [VET-ROUTER] Booking completed:', bookingId);
    if (onViewBooking) {
      // Get petId from booking flow if available
      onViewBooking(bookingId, bookingFlow.pet?.id || '');
    }
    // Navigate to confirmation or back to landing
    setCurrentView('confirmation');
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

  if (currentView === 'confirmation' && bookingFlow.booking) {
    return (
      <BookingConfirmation
        bookingData={{
          bookingId: bookingFlow.booking.bookingId,
          serviceName: bookingFlow.services[0]?.serviceName || bookingFlow.services[0]?.name,
          serviceType: bookingFlow.serviceType || 'center',
          vendorName: bookingFlow.vendorName || 'Vet Clinic',
          vendorAddress: bookingFlow.vendorAddress || '',
          petName: bookingFlow.pet?.name || 'Pet',
          date: bookingFlow.date || '',
          time: bookingFlow.time || '',
          amount: bookingFlow.payment?.amount || 0,
          paymentMethod: bookingFlow.payment?.method || 'upi',
          otp: bookingFlow.booking.otp
        }}
        onViewBooking={handleViewBooking}
        onBackToDashboard={handleBackToLanding}
      />
    );
  }

  // ✅ MIGRATION: Legacy payment view - now handled by BookingFlowDispatcher
  // Keeping for backward compatibility but should not be reached in normal flow
  if (currentView === 'payment' && bookingFlow.services.length > 0 && bookingFlow.pet && bookingFlow.date && bookingFlow.time) {
    console.warn('⚠️ [VET-ROUTER] Legacy payment view reached - should use BookingFlowDispatcher');
    return (
      <PaymentPage
        bookingData={{
          services: bookingFlow.services,
          vendorName: bookingFlow.vendorName || 'Vet Clinic',
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

  // ✅ MIGRATION: Legacy select_address view - now handled by BookingFlowDispatcher
  // Keeping for backward compatibility but should not be reached in normal flow
  if (currentView === 'select_address' && bookingFlow.serviceType === 'home') {
    return (
      <AddressSelector
        phone={phone}
        onBack={() => setCurrentView('select_time')}
        onSelect={(address) => {
          // Update booking flow - address selection is now handled by dispatcher
          setBookingFlow(prev => ({ ...prev, address }));
          // Note: Address selection is handled within BookingFlowDispatcher
          // This view should rarely be reached
          console.warn('⚠️ [VET-ROUTER] Legacy select_address view reached - should use BookingFlowDispatcher');
        }}
      />
    );
  }

  // ✅ MIGRATION: Legacy select_time view - now handled by BookingFlowDispatcher
  // Keeping for backward compatibility but should not be reached in normal flow
  if (currentView === 'select_time' && bookingFlow.vendorId && bookingFlow.services.length > 0) {
    return (
      <TimeSlotSelector
        vendorId={bookingFlow.vendorId}
        serviceDuration={bookingFlow.services[0].duration || 60}
        onBack={() => setCurrentView('select_pet')}
        onSelect={(date, time) => {
          // Update booking flow - time selection is now handled by dispatcher
          setBookingFlow(prev => ({ ...prev, date, time }));
          // Note: Time selection is handled within BookingFlowDispatcher
          // This view should rarely be reached
          console.warn('⚠️ [VET-ROUTER] Legacy select_time view reached - should use BookingFlowDispatcher');
        }}
      />
    );
  }

  // ✅ MIGRATION: Legacy select_pet view - now handled by BookingFlowDispatcher
  // Keeping for backward compatibility but should not be reached in normal flow
  if (currentView === 'select_pet' && bookingFlow.services.length > 0) {
    return (
      <PetSelector
        phone={phone}
        onBack={() => setCurrentView('select_service')}
        onSelect={(pet) => {
          // Update booking flow and route to dispatcher
          setBookingFlow(prev => ({ ...prev, pet }));
          setCurrentView('booking_dispatcher');
        }}
      />
    );
  }

  if (currentView === 'select_service' && bookingFlow.vendorId) {
    // ✅ MIGRATION: Service selection now routes to BookingFlowDispatcher after selection
    return (
      <ServicePackageSelector
        vendorId={bookingFlow.vendorId}
        vendorName={bookingFlow.vendorName || 'Vet Clinic'}
        serviceType={bookingFlow.serviceType || 'center'}
        onBack={() => setCurrentView('center_profile')}
        onSelect={(services, addOns) => {
          // Update booking flow with selected services
          setBookingFlow(prev => ({
            ...prev,
            services,
            addOns,
            selectedService: services[0] || null
          }));
          // Route to BookingFlowDispatcher instead of legacy multi-step flow
          setCurrentView('booking_dispatcher');
        }}
      />
    );
  }

  if (currentView === 'center_profile' && bookingFlow.vendorId) {
    return (
      <VetCenterProfileView
        phone={phone}
        centerId={bookingFlow.vendorId}
        onBack={() => setCurrentView('vet_center')}
        onNavigate={handleVetNavigate}
      />
    );
  }

  if (currentView === 'vet_center') {
    return (
      <VetClinicListViewEnhanced
        phone={phone}
        onBack={handleBackToLanding}
        onNavigate={handleVetNavigate}
      />
    );
  }

  if (currentView === 'vet_home') {
    return (
      <VetAtHome
        onBack={handleBackToLanding}
        customerId={customerId}
        customerData={customerData}
        phone={phone}
        onNavigate={handleVetNavigate}
      />
    );
  }

  if (currentView === 'followup_selection') {
    return (
      <FollowUpSelection
        phone={phone}
        onBack={handleBackToLanding}
        onNavigate={handleVetNavigate}
      />
    );
  }

  if (currentView === 'followup_chat' && bookingFlow.followUpBooking) {
    const booking = bookingFlow.followUpBooking;
    return (
      <FollowUpChat
        bookingId={booking.bookingId}
        vendorId={booking.vendorId}
        vendorName={booking.vendorName}
        customerPhone={phone}
        onBack={() => setCurrentView('followup_selection')}
      />
    );
  }

  if (currentView === 'doctor_details' && bookingFlow.vendorId) {
    console.log('🎯 [VET-ROUTER] Rendering VetDoctorDetails with:', {
      vendorId: bookingFlow.vendorId,
      doctor: bookingFlow.doctor
    });
    
    return (
      <VetDoctorDetails
        phone={phone}
        doctor={bookingFlow.doctor}
        doctorId={bookingFlow.vendorId}
        onBack={() => setCurrentView('vet_center')}
        onNavigate={handleVetNavigate}
      />
    );
  }

  if (currentView === 'doctor_booking' && bookingFlow.vendorId) {
    return (
      <VetBookingRouter
        phone={phone}
        doctorId={bookingFlow.vendorId}
        onBack={() => setCurrentView('vet_center')}
        onNavigate={handleVetNavigate}
      />
    );
  }

  // ✅ MIGRATION: Use BookingFlowDispatcher for unified booking flow
  if (currentView === 'booking_dispatcher' && bookingFlow.vendorId) {
    console.log('🎯 [VET-ROUTER] Rendering BookingFlowDispatcher with:', {
      vendorId: bookingFlow.vendorId,
      serviceType: 'vet',
      serviceStyle: bookingFlow.serviceType === 'home' ? 'at_home' : 
                   bookingFlow.serviceType === 'tele' ? 'tele' : 'at_center',
      staffId: bookingFlow.doctorId,
      selectedService: bookingFlow.selectedService
    });
    
    // Determine service style
    const serviceStyle = bookingFlow.serviceType === 'home' ? 'at_home' : 
                        bookingFlow.serviceType === 'tele' ? 'tele' : 'at_center';
    
    return (
      <BookingFlowDispatcher
        serviceType="vet"
        serviceStyle={serviceStyle}
        vendorId={bookingFlow.vendorId}
        vendorName={bookingFlow.vendorName || undefined}
        staffId={bookingFlow.doctorId || undefined}
        selectedService={bookingFlow.selectedService || undefined}
        customerId={customerId}
        customerPhone={phone}
        petId={bookingFlow.pet?.id}
        petName={bookingFlow.pet?.name}
        onBack={() => {
          // Go back to previous view (doctor details or center profile)
          if (bookingFlow.doctorId) {
            setCurrentView('doctor_details');
          } else {
            setCurrentView('center_profile');
          }
        }}
        onNavigate={handleVetNavigate}
        onBookingComplete={handleBookingComplete}
      />
    );
  }

  // ✅ MIGRATION: Legacy vet_booking view now uses BookingFlowDispatcher
  if (currentView === 'vet_booking' && bookingFlow.vendorId) {
    console.log('🎯 [VET-ROUTER] Migrating legacy vet_booking to BookingFlowDispatcher');
    // Redirect to booking_dispatcher
    const serviceStyle = bookingFlow.serviceType === 'home' ? 'at_home' : 
                         bookingFlow.serviceType === 'tele' ? 'tele' : 'at_center';
    
    return (
      <BookingFlowDispatcher
        serviceType="vet"
        serviceStyle={serviceStyle}
        vendorId={bookingFlow.vendorId}
        vendorName={bookingFlow.vendorName || undefined}
        staffId={bookingFlow.doctorId || undefined}
        selectedService={bookingFlow.selectedService || undefined}
        customerId={customerId}
        customerPhone={phone}
        petId={bookingFlow.pet?.id}
        petName={bookingFlow.pet?.name}
        onBack={() => {
          if (bookingFlow.doctorId) {
            setCurrentView('doctor_details');
          } else {
            setCurrentView('vet_center');
          }
        }}
        onNavigate={handleVetNavigate}
        onBookingComplete={handleBookingComplete}
      />
    );
  }

  if (currentView === 'problem_grid') {
    return (
      <ProblemGridSelector
        roleId="veterinarian"
        roleName="Veterinarian"
        onBack={handleBackToLanding}
        onProblemSelect={(problem) => {
          setSelectedProblem(problem);
          setCurrentView('vendor_discovery');
        }}
        customerId={customerId}
        phone={phone}
      />
    );
  }

  if (currentView === 'vendor_discovery' && selectedProblem) {
    // ✅ Validate selectedProblem before rendering
    if (!selectedProblem.id) {
      console.error('❌ Invalid selectedProblem:', selectedProblem);
      setCurrentView('problem_grid');
      return null;
    }
    
    return (
      <VendorDiscoveryByProblem
        roleId="veterinarian"
        roleName="Veterinarian"
        problem={selectedProblem}
        onBack={() => setCurrentView('problem_grid')}
        onVendorSelect={(vendor, serviceStyle) => {
          console.log('✅ [VET-ROUTER] Vendor selected:', vendor, serviceStyle);
          // Navigate to vet center profile or doctor details
          if (vendor.specialists && vendor.specialists.length > 0) {
            // Navigate to doctor details for the first specialist
            handleVetNavigate('doctor_details', {
              doctorId: vendor.specialists[0].id,
              doctor: vendor.specialists[0]
            });
          } else {
            // Navigate to center profile
            handleVetNavigate('clinic_profile', {
              clinicId: vendor.vendorId,
              name: vendor.businessName,
              address: vendor.location?.address
            });
          }
        }}
        customerId={customerId}
        phone={phone}
      />
    );
  }

  return (
    <VetServicesLanding
      onBack={onBack}
      onNavigate={handleVetNavigate}
      customerId={customerId}
      phone={phone}
    />
  );
}