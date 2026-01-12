import { useState, useEffect } from 'react';
import { TrainingServicesLanding } from './TrainingServicesLanding';
import { TrainingCenterListView } from './training/TrainingCenterListView';
import { TrainingCenterProfileView } from './training/TrainingCenterProfileView';
import { TrainingAtHome } from './TrainingAtHome';
import { ServicePackageSelector } from './grooming/ServicePackageSelector';
import { PetSelector } from './grooming/PetSelector';
import { TimeSlotSelector } from './grooming/TimeSlotSelector';
import { AddressSelector } from './grooming/AddressSelector';
import { PaymentPage } from './grooming/PaymentPage';
import { BookingConfirmation } from './grooming/BookingConfirmation';
import { ProblemGridSelector } from './ProblemGridSelector'; // ✅ NEW: Problem grid
import { VendorDiscoveryByProblem } from './VendorDiscoveryByProblem'; // ✅ NEW: Vendor discovery
import { projectId, publicAnonKey } from '../../utils/supabase/info';

type ViewType = 
  | 'landing'
  | 'training_center'
  | 'training_home'
  | 'center_profile'
  | 'select_service'
  | 'select_pet'
  | 'select_time'
  | 'select_address'
  | 'payment'
  | 'confirmation'
  | 'problem_grid' // ✅ NEW
  | 'problem_selected'; // ✅ NEW

interface TrainingServiceRouterProps {
  onBack: () => void;
  phone: string;
  onNavigate?: (screen: string, data?: any) => void;
  onViewBooking?: (bookingId: string, petId: string) => void;
  data?: any;
}

export function TrainingServiceRouter({ onBack, phone, onNavigate, onViewBooking, data }: TrainingServiceRouterProps) {
  const [currentView, setCurrentView] = useState<ViewType>('landing');
  const [customerId, setCustomerId] = useState<string>('');
  const [customerData, setCustomerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // ✅ NEW: Problem grid state
  const [selectedProblem, setSelectedProblem] = useState<any>(null);
  
  const [bookingFlow, setBookingFlow] = useState<any>({
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
      const response = await fetch(`${API_BASE}/customer-by-phone/${phone}`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` }
      });
      if (response.ok) {
        const data = await response.json();
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
      console.log(`🎯 [TRAINING-ROUTER] Fetching problem details for: ${problemId}`);
      
      const response = await fetch(
        `${API_BASE}/customer/universal-problem-discovery?problemGridId=${problemId}&roleId=pet_trainer`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const result = await response.json();
        console.log('✅ [TRAINING-ROUTER] Problem fetched successfully:', result);
        
        const problemData = {
          id: result.problemGrid?.id || problemId,
          displayName: result.problemGrid?.displayName || problemId,
          description: result.problemGrid?.description || '',
          icon: result.problemGrid?.icon || '',
          specialists: result.specialists || [],
          totalCount: result.totalCount || 0
        };
        
        setSelectedProblem(problemData);
        setCurrentView('problem_selected');
      } else {
        console.error('❌ [TRAINING-ROUTER] Failed to fetch problem details');
      }
    } catch (error) {
      console.error('❌ [TRAINING-ROUTER] Error fetching problem:', error);
    }
  };

  const handleNavigateLocal = (screen: string, data?: any) => {
    console.log('📍 [TRAINING-ROUTER] Navigating to:', screen, data);
    
    if (screen === 'training_center') {
      resetBookingFlow();
      setBookingFlow((prev: any) => ({ ...prev, serviceType: 'center' }));
      setCurrentView('training_center');
    } else if (screen === 'training_home') {
      resetBookingFlow();
      setBookingFlow((prev: any) => ({ ...prev, serviceType: 'home' }));
      setCurrentView('training_home');
    } else if (screen === 'center-details') {
      setCurrentView('center_profile');
      setBookingFlow((prev: any) => ({ 
        ...prev, 
        vendorId: data?.id,
        vendorName: data?.businessName,
        vendorAddress: data?.address
      }));
    } else if (screen === 'select_service') {
      setCurrentView('select_service');
    } else if (screen === 'home_service_book') {
      setBookingFlow((prev: any) => ({
        ...prev,
        vendorId: data?.vendorId,
        vendorName: data?.vendorName,
        services: data?.service,
        serviceType: 'home'
      }));
      setCurrentView('select_pet');
    } else if (screen === 'problem_grid') {
      // Navigate to problem grid selector
      setCurrentView('problem_grid');
    } else if (screen === 'problem_selected') {
      // User selected a problem from landing page
      const problemId = data?.problemId;
      if (problemId) {
        fetchProblemDetails(problemId);
      }
    }
  };

  const handleServiceSelected = (services: any[], addOns: any[]) => {
    setBookingFlow((prev: any) => ({ ...prev, services, addOns }));
    setCurrentView('select_pet');
  };

  const handlePetSelected = (pet: any) => {
    setBookingFlow((prev: any) => ({ ...prev, pet }));
    setCurrentView('select_time');
  };

  const handleTimeSelected = (date: string, time: string) => {
    setBookingFlow((prev: any) => ({ ...prev, date, time }));
    if (bookingFlow.serviceType === 'home') {
      setCurrentView('select_address');
    } else {
      setCurrentView('payment');
    }
  };

  const handleAddressSelected = (address: any) => {
    setBookingFlow((prev: any) => ({ ...prev, address }));
    setCurrentView('payment');
  };

  const handlePaymentSuccess = async (paymentData: any) => {
    try {
      const bookingPayload = {
        customerPhone: phone,
        petId: bookingFlow.pet?.id,
        petName: bookingFlow.pet?.name,
        vendorId: bookingFlow.vendorId,
        vendorName: bookingFlow.vendorName,
        serviceId: bookingFlow.services[0]?.id,
        serviceName: bookingFlow.services[0]?.serviceName || bookingFlow.services[0]?.name,
        serviceType: 'training',
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

      const response = await fetch(`${API_BASE}/customer/booking`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bookingPayload)
      });

      if (response.ok) {
        const bookingData = await response.json();
        const otp = bookingData.otp || bookingData.booking.completionOTP;
        setBookingFlow((prev: any) => ({
          ...prev,
          payment: paymentData,
          booking: { bookingId: bookingData.bookingId, ...bookingData.booking, otp }
        }));
        setCurrentView('confirmation');
      } else {
        alert('Failed to create booking. Please try again.');
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      alert('An error occurred. Please try again.');
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
          vendorName: bookingFlow.vendorName || 'Training Center',
          vendorAddress: bookingFlow.vendorAddress || '',
          petName: bookingFlow.pet?.name || 'Pet',
          petId: bookingFlow.pet?.id, // ✅ ADD: Pass pet ID for navigation
          date: bookingFlow.date || '',
          time: bookingFlow.time || '',
          amount: bookingFlow.payment?.amount || 0,
          paymentMethod: bookingFlow.payment?.method || 'upi',
          otp: bookingFlow.booking.otp
        }}
        onViewBooking={() => onViewBooking?.(bookingFlow.booking.bookingId, bookingFlow.pet?.id)}
        onBackToDashboard={() => { resetBookingFlow(); setCurrentView('landing'); }}
      />
    );
  }

  if (currentView === 'payment' && bookingFlow.services.length > 0 && bookingFlow.pet && bookingFlow.date && bookingFlow.time) {
    return (
      <PaymentPage
        bookingData={{
          services: bookingFlow.services,
          vendorName: bookingFlow.vendorName || 'Training Center',
          petName: bookingFlow.pet.name,
          date: bookingFlow.date,
          time: bookingFlow.time,
          addOns: bookingFlow.addOns
        }}
        phone={phone}
        onBack={() => bookingFlow.serviceType === 'home' ? setCurrentView('select_address') : setCurrentView('select_time')}
        onPaymentSuccess={handlePaymentSuccess}
      />
    );
  }

  if (currentView === 'select_address' && bookingFlow.serviceType === 'home') {
    return <AddressSelector phone={phone} onBack={() => setCurrentView('select_time')} onSelect={handleAddressSelected} />;
  }

  if (currentView === 'select_time' && bookingFlow.vendorId && bookingFlow.services.length > 0) {
    return (
      <TimeSlotSelector
        vendorId={bookingFlow.vendorId}
        serviceDuration={bookingFlow.services[0].duration || 60}
        serviceStyle={bookingFlow.serviceType === 'home' ? 'at_home' : 'at_center'} // ✅ Pass serviceStyle for V2 slots
        onBack={() => setCurrentView('select_pet')}
        onSelect={handleTimeSelected}
      />
    );
  }

  if (currentView === 'select_pet' && bookingFlow.services.length > 0) {
    return <PetSelector phone={phone} onBack={() => setCurrentView('select_service')} onSelect={handlePetSelected} />;
  }

  if (currentView === 'select_service' && bookingFlow.vendorId) {
    return (
      <ServicePackageSelector
        vendorId={bookingFlow.vendorId}
        vendorName={bookingFlow.vendorName || 'Training Center'}
        serviceType={bookingFlow.serviceType || 'center'}
        onBack={() => setCurrentView('center_profile')}
        onSelect={handleServiceSelected}
      />
    );
  }

  if (currentView === 'center_profile' && bookingFlow.vendorId) {
    return (
      <TrainingCenterProfileView
        phone={phone}
        centerId={bookingFlow.vendorId}
        onBack={() => setCurrentView('training_center')}
        onNavigate={handleNavigateLocal}
      />
    );
  }

  if (currentView === 'training_center') {
    return (
      <TrainingCenterListView
        phone={phone}
        onBack={() => { resetBookingFlow(); setCurrentView('landing'); }}
        onNavigate={handleNavigateLocal}
      />
    );
  }

  if (currentView === 'training_home') {
    return (
      <TrainingAtHome
        onBack={() => { resetBookingFlow(); setCurrentView('landing'); }}
        customerId={customerId}
        customerData={customerData}
        phone={phone}
        onNavigate={handleNavigateLocal}
      />
    );
  }

  if (currentView === 'problem_grid') {
    return (
      <ProblemGridSelector
        roleId="pet_trainer"
        roleName="Pet Trainer"
        onBack={() => setCurrentView('landing')}
        onProblemSelect={(problem) => {
          console.log('✅ [TRAINING-ROUTER] Problem selected from grid:', problem);
          setSelectedProblem(problem);
          setCurrentView('problem_selected');
        }}
        customerId={customerId}
        phone={phone}
      />
    );
  }

  if (currentView === 'problem_selected' && selectedProblem) {
    return (
      <VendorDiscoveryByProblem
        problem={selectedProblem}
        roleId="pet_trainer"
        roleName="Pet Trainer"
        onBack={() => setCurrentView('problem_grid')}
        onVendorSelect={(vendor) => {
          console.log('✅ [TRAINING-ROUTER] Vendor selected:', vendor);
          setBookingFlow((prev: any) => ({
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

  return (
    <TrainingServicesLanding
      onBack={onBack}
      onNavigate={handleNavigateLocal}
      customerId={customerId}
      phone={phone}
    />
  );
}