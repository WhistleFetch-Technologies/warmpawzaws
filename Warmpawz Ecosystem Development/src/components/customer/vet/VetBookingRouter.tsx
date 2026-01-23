import { useState, useEffect } from 'react';
import { VetDoctorDetails } from './VetDoctorDetails';
import { PetSelector } from '../grooming/PetSelector';
import { SmartTimeSlotSelection } from './SmartTimeSlotSelection';
import { PaymentPage } from '../grooming/PaymentPage';
import { BookingConfirmation } from '../grooming/BookingConfirmation';
import { AddressSelector } from '../grooming/AddressSelector';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

type ViewType = 
  | 'doctor_details'
  | 'select_pet'
  | 'select_time'
  | 'select_address'
  | 'payment'
  | 'confirmation';

interface VetBookingRouterProps {
  phone: string;
  doctor?: any; // Doctor/staff details (optional, will load if doctorId provided)
  doctorId?: string; // Doctor ID to load details
  selectedService?: any; // Pre-selected service
  serviceType?: 'tele' | 'clinic' | 'home'; // Service style
  vendorId?: string; // Vendor/Clinic ID for clinic bookings
  clinicId?: string; // Clinic ID (alias for vendorId)
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onViewBooking?: (bookingId: string, petId: string) => void;
}

export function VetBookingRouter({ 
  phone, 
  doctor, 
  doctorId,
  selectedService,
  serviceType,
  vendorId,
  clinicId,
  onBack, 
  onNavigate,
  onViewBooking 
}: VetBookingRouterProps) {
  // ✅ FIXED: For clinic bookings with service selected, check if doctor selection is needed
  // If service is pre-selected and doctor is provided, skip to pet selection
  // If service is pre-selected but no doctor, go to doctor selection first
  const initialView: ViewType = selectedService 
    ? (doctor || doctorId ? 'select_pet' : 'doctor_details')
    : 'doctor_details';
  
  console.log('🎯 [VET-BOOKING-ROUTER] Initializing with:');
  console.log('   - Doctor:', doctor);
  console.log('   - Doctor ID:', doctorId);
  console.log('   - Selected Service:', selectedService);
  console.log('   - Service Type:', serviceType);
  console.log('   - Initial View:', initialView);
  
  const [currentView, setCurrentView] = useState<ViewType>(initialView);
  const [customerId, setCustomerId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  
  // Booking flow state
  const [bookingFlow, setBookingFlow] = useState<{
    doctor: any;
    service: any | null;
    serviceType: 'tele' | 'clinic' | 'home';
    vendorId: string | null;
    clinicId: string | null;
    pet: any | null;
    date: string | null;
    time: string | null;
    slotData: any | null;
    address: any | null;
    payment: any | null;
    booking: any | null;
  }>({
    doctor: doctor,
    service: selectedService || null,
    serviceType: serviceType || 'clinic',
    vendorId: vendorId || clinicId || null,
    clinicId: clinicId || vendorId || null,
    pet: null,
    date: null,
    time: null,
    slotData: null,
    address: null,
    payment: null,
    booking: null
  });

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadCustomerData();
    
    // If doctorId is provided but doctor data is not, load doctor data
    if (doctorId && !doctor) {
      loadDoctorDetails();
    }
  }, [phone, doctorId]);

  const loadCustomerData = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/customer-by-phone/${phone}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );

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

  const loadDoctorDetails = async () => {
    try {
      console.log('🔍 [VET-BOOKING] Loading doctor details for ID:', doctorId);
      const response = await fetch(
        `${API_BASE}/customer/doctors/${doctorId}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ [VET-BOOKING] Doctor loaded:', data);
        if (data.success && data.doctor) {
          setBookingFlow(prev => ({ ...prev, doctor: data.doctor }));
        }
      }
    } catch (error) {
      console.error('❌ [VET-BOOKING] Error loading doctor data:', error);
    }
  };

  const handleServiceSelected = (service: any) => {
    console.log('✅ [VET-BOOKING] Service selected:', service);
    setBookingFlow(prev => ({ ...prev, service }));
    setCurrentView('select_pet');
  };

  const handlePetSelected = (pet: any) => {
    console.log('✅ [VET-BOOKING] Pet selected:', pet);
    setBookingFlow(prev => ({ ...prev, pet }));
    setCurrentView('select_time');
  };

  const handleTimeSelected = (date: string, time: string, slotData?: any) => {
    console.log('✅ [VET-BOOKING] Time selected:', date, time, slotData);
    setBookingFlow(prev => ({ ...prev, date, time, slotData }));
    
    // If home service, go to address selection, otherwise go to payment
    if (bookingFlow.serviceType === 'home') {
      setCurrentView('select_address');
    } else {
      setCurrentView('payment');
    }
  };

  const handleAddressSelected = (address: any) => {
    console.log('✅ [VET-BOOKING] Address selected:', address);
    setBookingFlow(prev => ({ ...prev, address }));
    setCurrentView('payment');
  };

  const handlePaymentSuccess = async (paymentData: any) => {
    console.log('✅ [VET-BOOKING] Payment successful:', paymentData);
    
    try {
      // Create booking
      const bookingPayload = {
        customerPhone: phone,
        petId: bookingFlow.pet?.id,
        petName: bookingFlow.pet?.name,
        petType: bookingFlow.pet?.type || bookingFlow.pet?.species || 'dog',
        
        // Vendor/Doctor info
        vendorId: bookingFlow.vendorId || bookingFlow.clinicId || bookingFlow.doctor?.clinicId || bookingFlow.doctor?.vendorId,
        vendorName: bookingFlow.doctor?.clinicName || bookingFlow.doctor?.vendorName || 'Vet Clinic',
        staffId: bookingFlow.slotData?.staffId || bookingFlow.doctor?.staffId || bookingFlow.doctor?.id,
        staffName: bookingFlow.slotData?.staffName || bookingFlow.doctor?.fullName || bookingFlow.doctor?.name,
        
        // Service info
        serviceId: bookingFlow.service?.serviceId || bookingFlow.service?.id,
        serviceName: bookingFlow.service?.serviceName || bookingFlow.service?.name,
        serviceType: 'veterinary',
        serviceStyle: bookingFlow.serviceType === 'home' ? 'at_home' : bookingFlow.serviceType === 'tele' ? 'tele' : 'at_center',
        serviceDuration: bookingFlow.slotData?.duration || bookingFlow.service?.duration || 30,
        
        // Scheduling
        scheduledDate: bookingFlow.date,
        scheduledTime: bookingFlow.time,
        
        // Location (for clinic bookings)
        locationId: bookingFlow.slotData?.locationId,
        locationName: bookingFlow.slotData?.locationName,
        
        // Address (for home service)
        address: bookingFlow.address,
        
        // Payment
        paymentMethod: paymentData.method,
        transactionId: paymentData.paymentId,
        amount: paymentData.amount,
        walletUsed: paymentData.walletUsed || 0,
        couponApplied: paymentData.couponApplied || null
      };

      console.log('📤 [VET-BOOKING] Creating booking:', bookingPayload);

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
        console.log('✅ [VET-BOOKING] Booking created:', bookingData);

        // OTP is already generated in the booking creation
        const otp = bookingData.otp || bookingData.booking?.completionOTP;
        console.log('✅ [VET-BOOKING] OTP from booking:', otp);

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
        console.error('❌ [VET-BOOKING] Booking creation failed');
        const errorText = await response.text();
        console.error('Error:', errorText);
        alert('Failed to create booking. Please try again.');
      }
    } catch (error) {
      console.error('❌ [VET-BOOKING] Error creating booking:', error);
      alert('An error occurred. Please try again.');
    }
  };

  const handleViewBooking = () => {
    if (onViewBooking && bookingFlow.booking) {
      onViewBooking(bookingFlow.booking.bookingId, bookingFlow.pet?.id);
    }
  };

  const handleBackToDashboard = () => {
    if (onNavigate) {
      onNavigate('home');
    } else {
      onBack();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center w-full max-w-[430px] mx-auto">
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
          serviceName: bookingFlow.service?.serviceName || bookingFlow.service?.name,
          serviceType: bookingFlow.serviceType === 'home' ? 'home' : 'center',
          vendorName: bookingFlow.doctor?.clinicName || bookingFlow.doctor?.fullName || 'Veterinary Clinic',
          vendorAddress: bookingFlow.slotData?.locationName || bookingFlow.doctor?.clinicAddress || '',
          petName: bookingFlow.pet?.name || 'Pet',
          petId: bookingFlow.pet?.id, // ✅ ADD: Pass pet ID for navigation
          date: bookingFlow.date || '',
          time: bookingFlow.time || '',
          amount: bookingFlow.payment?.amount || 0,
          paymentMethod: bookingFlow.payment?.method || 'upi',
          otp: bookingFlow.booking.otp
        }}
        onViewBooking={handleViewBooking}
        onBackToDashboard={handleBackToDashboard}
        onNavigate={onNavigate}
      />
    );
  }

  // Payment Page
  if (currentView === 'payment' && bookingFlow.service && bookingFlow.pet && bookingFlow.date && bookingFlow.time) {
    return (
      <PaymentPage
        bookingData={{
          services: [bookingFlow.service],
          vendorName: bookingFlow.doctor?.clinicName || bookingFlow.doctor?.fullName || 'Vet Service',
          petName: bookingFlow.pet.name,
          date: bookingFlow.date,
          time: bookingFlow.time,
          addOns: [],
          vendorId: bookingFlow.vendorId || bookingFlow.clinicId
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
        onNavigate={onNavigate}
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
  if (currentView === 'select_time' && bookingFlow.service && bookingFlow.pet) {
    return (
      <SmartTimeSlotSelection
        serviceType={bookingFlow.serviceType}
        vendorName={bookingFlow.doctor?.clinicName || bookingFlow.doctor?.fullName || bookingFlow.doctor?.name || 'Vet Clinic'}
        vendorId={bookingFlow.vendorId || bookingFlow.clinicId || bookingFlow.doctor?.clinicId || bookingFlow.doctor?.vendorId || ''}
        selectedService={bookingFlow.service}
        selectedStaffId={bookingFlow.doctor?.staffId || bookingFlow.doctor?.id}
        vendorRoleId={bookingFlow.doctor?.roleId || 'veterinarian'} // ✅ Pass vendor role
        onBack={() => setCurrentView('select_pet')}
        onSelectSlot={handleTimeSelected}
        onNavigate={onNavigate}
      />
    );
  }

  // Pet Selection
  if (currentView === 'select_pet' && bookingFlow.service) {
    return (
      <PetSelector
        phone={phone}
        onBack={() => setCurrentView('doctor_details')}
        onSelect={handlePetSelected}
        onNavigate={onNavigate}
      />
    );
  }

  // Doctor Details with Service Selection
  if (currentView === 'doctor_details') {
    return (
      <VetDoctorDetails
        phone={phone}
        doctor={bookingFlow.doctor}
        doctorId={doctorId}
        preSelectedService={bookingFlow.service}
        vendorId={bookingFlow.vendorId || bookingFlow.clinicId}
        clinicId={bookingFlow.clinicId || bookingFlow.vendorId}
        onBack={onBack}
        onNavigate={onNavigate}
        onBookService={handleServiceSelected}
      />
    );
  }

  return null;
}