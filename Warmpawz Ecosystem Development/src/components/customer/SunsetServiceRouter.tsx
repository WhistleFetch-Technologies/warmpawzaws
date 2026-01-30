import { useState, useEffect } from 'react';
import { SunsetServicesLanding } from './sunset/SunsetServicesLanding';
import { SunsetServiceListView } from './sunset/SunsetServiceListView';
import { SunsetServiceProfileView } from './sunset/SunsetServiceProfileView';
import { ServicePackageSelector } from './grooming/ServicePackageSelector';
import { PetSelector } from './grooming/PetSelector';
import { TimeSlotSelector } from './grooming/TimeSlotSelector';
import { AddressSelector } from './grooming/AddressSelector';
import { PaymentPage } from './grooming/PaymentPage';
import { BookingConfirmation } from './grooming/BookingConfirmation';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

type ViewType = 
  | 'landing'
  | 'service_list'
  | 'service_profile'
  | 'select_service'
  | 'select_pet'
  | 'select_time'
  | 'select_address'
  | 'payment'
  | 'confirmation';

interface SunsetServiceRouterProps {
  onBack: () => void;
  phone: string;
  onNavigate?: (screen: string, data?: any) => void;
  onViewBooking?: (bookingId: string, petId: string) => void;
}

export function SunsetServiceRouter({ onBack, phone, onNavigate, onViewBooking }: SunsetServiceRouterProps) {
  const [currentView, setCurrentView] = useState<ViewType>('landing');
  const [customerId, setCustomerId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  
  const [bookingFlow, setBookingFlow] = useState<any>({
    serviceType: null, // 'at_home' or 'at_center'
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

  const handleNavigateLocal = (screen: string, data?: any) => {
    if (screen === 'at_home') {
      resetBookingFlow();
      setBookingFlow((prev: any) => ({ ...prev, serviceType: 'at_home' }));
      setCurrentView('service_list');
    } else if (screen === 'at_center') {
      resetBookingFlow();
      setBookingFlow((prev: any) => ({ ...prev, serviceType: 'at_center' }));
      setCurrentView('service_list');
    } else if (screen === 'service-details') {
      setCurrentView('service_profile');
      setBookingFlow((prev: any) => ({ 
        ...prev, 
        vendorId: data?.id,
        vendorName: data?.businessName,
        vendorAddress: data?.address
      }));
    } else if (screen === 'select_service') {
      setCurrentView('select_service');
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
    if (bookingFlow.serviceType === 'at_home') {
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
        serviceType: 'sunset',
        serviceStyle: bookingFlow.serviceType === 'at_home' ? 'at_home' : 'at_center',
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
          vendorName: bookingFlow.vendorName || 'Sunset Care Provider',
          vendorAddress: bookingFlow.vendorAddress || '',
          petName: bookingFlow.pet?.name || 'Pet',
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
          vendorName: bookingFlow.vendorName || 'Sunset Care Provider',
          petName: bookingFlow.pet.name,
          date: bookingFlow.date,
          time: bookingFlow.time,
          addOns: bookingFlow.addOns
        }}
        phone={phone}
        onBack={() => bookingFlow.serviceType === 'at_home' ? setCurrentView('select_address') : setCurrentView('select_time')}
        onPaymentSuccess={handlePaymentSuccess}
      />
    );
  }

  if (currentView === 'select_address' && bookingFlow.serviceType === 'at_home') {
    return <AddressSelector phone={phone} onBack={() => setCurrentView('select_time')} onSelect={handleAddressSelected} />;
  }

  if (currentView === 'select_time' && bookingFlow.vendorId && bookingFlow.services.length > 0) {
    return (
      <TimeSlotSelector
        vendorId={bookingFlow.vendorId}
        serviceDuration={bookingFlow.services[0].duration || 60}
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
        vendorName={bookingFlow.vendorName || 'Sunset Care Provider'}
        serviceType={bookingFlow.serviceType || 'center'}
        onBack={() => setCurrentView('service_profile')}
        onSelect={handleServiceSelected}
      />
    );
  }

  if (currentView === 'service_profile' && bookingFlow.vendorId) {
    return (
      <SunsetServiceProfileView
        phone={phone}
        vendorId={bookingFlow.vendorId}
        onBack={() => setCurrentView('service_list')}
        onNavigate={handleNavigateLocal}
      />
    );
  }

  if (currentView === 'service_list') {
    return (
      <SunsetServiceListView
        phone={phone}
        serviceType={bookingFlow.serviceType}
        onBack={() => { resetBookingFlow(); setCurrentView('landing'); }}
        onNavigate={handleNavigateLocal}
      />
    );
  }

  return (
    <SunsetServicesLanding
      onBack={onBack}
      onNavigate={handleNavigateLocal}
      phone={phone}
    />
  );
}
