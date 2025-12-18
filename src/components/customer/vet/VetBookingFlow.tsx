import { useState } from 'react';
// Brand color: #FF8C42
import { VetServiceBooking } from './VetServiceBooking';
import { VetTimeSlotSelection } from './VetTimeSlotSelection';
import { VetAddressSelector } from './VetAddressSelector';
import { VetPaymentScreen } from './VetPaymentScreen';
import { VetBookingSuccess } from './VetBookingSuccess';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

interface VetBookingFlowProps {
  phone: string;
  serviceType: string;
  vendorId?: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

type FlowStep = 'selection' | 'timeslot' | 'address' | 'payment' | 'success';

export function VetBookingFlow({ phone, serviceType, vendorId, onBack, onNavigate }: VetBookingFlowProps) {
  const [currentStep, setCurrentStep] = useState<FlowStep>('selection');
  const [bookingData, setBookingData] = useState<any>({});

  // Handle service selection completion
  const handleSelectionComplete = (data: {
    petId: string;
    petName: string;
    petType: string;
    vendorId: string;
    vendorName: string;
    serviceId: string;
    serviceName: string;
    servicePrice: number;
    serviceDuration: number;
  }) => {
    setBookingData(prev => ({ ...prev, ...data }));
    setCurrentStep('timeslot');
  };

  // Handle time slot selection
  const handleTimeSlotSelected = (date: string, time: string) => {
    setBookingData(prev => ({ ...prev, scheduledDate: date, scheduledTime: time }));
    
    if (serviceType === 'home') {
      setCurrentStep('address');
    } else {
      setCurrentStep('payment');
    }
  };

  const handleAddressSelected = (address: any) => {
    setBookingData(prev => ({ 
      ...prev, 
      address: `${address.fullAddress}, ${address.city} - ${address.pincode}` 
    }));
    setCurrentStep('payment');
  };

  // Handle payment completion
  const handlePaymentComplete = async (paymentMethod: string, transactionId: string) => {
    try {
      // Create booking with all collected data
      const bookingPayload = {
        phone,
        petId: bookingData.petId,
        vendorId: bookingData.vendorId,
        serviceId: bookingData.serviceId,
        serviceType,
        scheduledDate: bookingData.scheduledDate,
        scheduledTime: bookingData.scheduledTime,
        paymentMethod,
        transactionId,
        amount: calculateTotalAmount(bookingData.servicePrice)
      };

      console.log('🎯 Creating booking:', bookingPayload);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/customer/bookings/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify(bookingPayload),
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        // Move to success screen with booking details
        setBookingData(prev => ({
          ...prev,
          bookingId: result.booking.id,
          otp: result.booking.completionOTP,
          transactionId,
          paymentMethod
        }));
        setCurrentStep('success');
      } else {
        alert(`❌ Booking failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('❌ Booking error:', error);
      alert('Failed to create booking. Please try again.');
    }
  };

  const calculateTotalAmount = (servicePrice: number) => {
    const platformFee = Math.round(servicePrice * 0.05);
    const gst = Math.round((servicePrice + platformFee) * 0.18);
    return servicePrice + platformFee + gst;
  };

  const handleBackFromTimeSlot = () => {
    setCurrentStep('selection');
  };

  const handleBackFromAddress = () => {
    setCurrentStep('timeslot');
  };

  const handleBackFromPayment = () => {
    if (serviceType === 'home') {
      setCurrentStep('address');
    } else {
      setCurrentStep('timeslot');
    }
  };

  const handleGoHome = () => {
    // Navigate back to home screen by calling onBack twice
    // First onBack goes from vet-booking to vet landing
    // We need to go all the way to home
    onNavigate('home');
  };

  const handleViewBookings = () => {
    // Go back to home so user can click their profile
    onNavigate('home');
  };

  // Render current step
  if (currentStep === 'selection') {
    return (
      <VetServiceBooking
        phone={phone}
        serviceType={serviceType}
        vendorId={vendorId}
        onBack={onBack}
        onNavigate={onNavigate}
        onSelectionComplete={handleSelectionComplete}
      />
    );
  }

  if (currentStep === 'timeslot') {
    return (
      <VetTimeSlotSelection
        serviceType={serviceType}
        vendorName={bookingData.vendorName}
        vendorId={bookingData.vendorId}
        serviceStyle={serviceType}
        onBack={handleBackFromTimeSlot}
        onSelectSlot={handleTimeSlotSelected}
      />
    );
  }

  if (currentStep === 'address') {
    return (
      <VetAddressSelector
        phone={phone}
        onBack={handleBackFromAddress}
        onSelect={handleAddressSelected}
      />
    );
  }

  if (currentStep === 'payment') {
    return (
      <VetPaymentScreen
        bookingDetails={{
          petName: bookingData.petName,
          petType: bookingData.petType,
          vendorName: bookingData.vendorName,
          serviceName: bookingData.serviceName,
          servicePrice: bookingData.servicePrice,
          serviceDuration: bookingData.serviceDuration,
          serviceType,
          scheduledDate: bookingData.scheduledDate,
          scheduledTime: bookingData.scheduledTime,
          address: bookingData.address
        }}
        onBack={handleBackFromPayment}
        onPaymentComplete={handlePaymentComplete}
      />
    );
  }

  if (currentStep === 'success') {
    return (
      <VetBookingSuccess
        bookingData={{
          bookingId: bookingData.bookingId,
          otp: bookingData.otp,
          petName: bookingData.petName,
          vendorName: bookingData.vendorName,
          serviceName: bookingData.serviceName,
          serviceType,
          scheduledDate: bookingData.scheduledDate,
          scheduledTime: bookingData.scheduledTime,
          amount: calculateTotalAmount(bookingData.servicePrice),
          address: bookingData.address
        }}
        onGoHome={handleGoHome}
        onViewBookings={handleViewBookings}
      />
    );
  }

  return null;
}