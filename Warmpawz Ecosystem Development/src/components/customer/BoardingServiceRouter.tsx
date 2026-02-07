import { useState, useEffect } from 'react';
import { BoardingServicesLanding } from './BoardingServicesLanding';
import { BoardingCenterListView } from './boarding/BoardingCenterListView';
import { BoardingCenterProfileView } from './boarding/BoardingCenterProfileView';
import { ServicePackageSelector } from './grooming/ServicePackageSelector';
import { PetSelector } from './grooming/PetSelector';
import { TimeSlotSelector } from './grooming/TimeSlotSelector';
import { PaymentPage } from './grooming/PaymentPage';
import { BookingConfirmation } from './grooming/BookingConfirmation';
import { ProblemGridSelector } from './ProblemGridSelector'; // ✅ NEW: Problem grid
import { VendorDiscoveryByProblem } from './VendorDiscoveryByProblem'; // ✅ NEW: Vendor discovery
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

type ViewType = 
  | 'landing'
  | 'center_list'
  | 'center_profile'
  | 'select_service'
  | 'select_pet'
  | 'select_time'
  | 'payment'
  | 'confirmation'
  | 'problem_grid' // ✅ NEW
  | 'problem_selected'; // ✅ NEW

interface BoardingServiceRouterProps {
  onBack: () => void;
  phone: string;
  onNavigate?: (screen: string, data?: any) => void;
  onViewBooking?: (bookingId: string, petId: string) => void;
  data?: any;
}

export function BoardingServiceRouter({ onBack, phone, onNavigate, onViewBooking, data }: BoardingServiceRouterProps) {
  const [currentView, setCurrentView] = useState<ViewType>('landing');
  const [customerId, setCustomerId] = useState<string>('');
  const [customerData, setCustomerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // ✅ NEW: Problem grid state
  const [selectedProblem, setSelectedProblem] = useState<any>(null);
  
  const [bookingFlow, setBookingFlow] = useState<any>({
    serviceType: 'center',
    serviceCategory: null, // 'boarding' or 'daycare'
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

  const API_BASE = getApiBaseUrl();

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
      serviceType: 'center',
      serviceCategory: null, // 'boarding' or 'daycare'
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

  const handleNavigateLocal = (screen: string, data?: any) => {
    console.log('📍 [BOARDING-ROUTER] Navigating to:', screen, data);
    
    if (screen === 'boarding_overnight') {
      resetBookingFlow();
      setBookingFlow((prev: any) => ({ ...prev, serviceCategory: 'boarding' }));
      setCurrentView('center_list');
    } else if (screen === 'daycare') {
      resetBookingFlow();
      setBookingFlow((prev: any) => ({ ...prev, serviceCategory: 'daycare' }));
      setCurrentView('center_list');
    } else if (screen === 'boarding_center' || screen === 'center_list' || screen === 'boarding_facility') {
      resetBookingFlow();
      setCurrentView('center_list');
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
    } else if (screen === 'problem_grid') {
      // Navigate to problem grid selector
      setCurrentView('problem_grid');
    } else if (screen === 'problem_selected') {
      // Clicked from landing page - fetch problem from catalog
      const problemId = data?.problemId;
      if (problemId) {
        fetchProblemDetails(problemId);
      }
    }
  };

  const fetchProblemDetails = async (problemId: string) => {
    if (!problemId) return;
    
    try {
      console.log(`🎯 [BOARDING-ROUTER] Fetching problem details for: ${problemId}`);
      
      const response = await fetch(
        `${API_BASE}/customer/universal-problem-discovery?problemGridId=${problemId}&roleId=boarding_center`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const result = await response.json();
        console.log('✅ [BOARDING-ROUTER] Problem fetched successfully:', result);
        
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
        console.error('❌ [BOARDING-ROUTER] Failed to fetch problem details');
      }
    } catch (error) {
      console.error('Error fetching problem:', error);
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
        serviceType: 'boarding',
        serviceStyle: 'at_center',
        scheduledDate: bookingFlow.date,
        scheduledTime: bookingFlow.time,
        address: null,
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
          serviceType: 'center',
          vendorName: bookingFlow.vendorName || 'Boarding Facility',
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
          vendorName: bookingFlow.vendorName || 'Boarding Facility',
          petName: bookingFlow.pet.name,
          date: bookingFlow.date,
          time: bookingFlow.time,
          addOns: bookingFlow.addOns
        }}
        phone={phone}
        onBack={() => setCurrentView('select_time')}
        onPaymentSuccess={handlePaymentSuccess}
      />
    );
  }

  if (currentView === 'select_time' && bookingFlow.vendorId && bookingFlow.services.length > 0) {
    return (
      <TimeSlotSelector
        vendorId={bookingFlow.vendorId}
        serviceDuration={bookingFlow.services[0].duration || 60}
        serviceStyle="at_center" // ✅ Always 'at_center' for boarding bookings
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
        vendorName={bookingFlow.vendorName || 'Boarding Facility'}
        serviceType="center"
        onBack={() => setCurrentView('center_profile')}
        onSelect={handleServiceSelected}
      />
    );
  }

  if (currentView === 'center_profile' && bookingFlow.vendorId) {
    return (
      <BoardingCenterProfileView
        phone={phone}
        centerId={bookingFlow.vendorId}
        onBack={() => setCurrentView('center_list')}
        onNavigate={handleNavigateLocal}
      />
    );
  }

  if (currentView === 'center_list') {
    return (
      <BoardingCenterListView
        phone={phone}
        onBack={() => { resetBookingFlow(); setCurrentView('landing'); }}
        onNavigate={handleNavigateLocal}
      />
    );
  }

  if (currentView === 'problem_grid') {
    return (
      <ProblemGridSelector
        roleId="boarding_center"
        roleName="Boarding Center"
        onBack={() => setCurrentView('landing')}
        onProblemSelect={(problem) => {
          console.log('✅ [BOARDING-ROUTER] Problem selected from grid:', problem);
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
        roleId="boarding_center"
        roleName="Boarding Center"
        onBack={() => setCurrentView('problem_grid')}
        onVendorSelect={(vendor) => {
          console.log('✅ [BOARDING-ROUTER] Boarding center selected:', vendor);
          // Navigate to boarding center profile
          handleNavigateLocal('center-details', {
            id: vendor.vendorId || vendor.id,
            businessName: vendor.businessName || vendor.fullName,
            address: vendor.location?.address
          });
        }}
        customerId={customerId}
        phone={phone}
      />
    );
  }

  return (
    <BoardingServicesLanding
      onBack={onBack}
      onNavigate={handleNavigateLocal}
      customerId={customerId}
      phone={phone}
    />
  );
}