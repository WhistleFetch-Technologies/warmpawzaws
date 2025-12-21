import { useState, useEffect } from 'react';
import { ClinicListView } from './vet/ClinicListView';
import { ClinicProfileView } from './vet/ClinicProfileView';
import { BookingFlowDispatcher } from './BookingFlowDispatcher';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface ClinicVisitProps {
  onBack: () => void;
  customerId: string;
  petProfiles: any[];
}

type FlowStep = 'list' | 'profile' | 'booking';

export function ClinicVisit({ onBack, customerId, petProfiles }: ClinicVisitProps) {
  const [currentStep, setCurrentStep] = useState<FlowStep>('list');
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [selectedVendorName, setSelectedVendorName] = useState<string>('');
  const [selectedVendorType, setSelectedVendorType] = useState<'solo' | 'center'>('center');
  const [selectedPet, setSelectedPet] = useState<any>(null);
  const [selectedService, setSelectedService] = useState<any>(null);

  // Load default pet if available
  useEffect(() => {
    if (petProfiles && petProfiles.length > 0 && !selectedPet) {
      setSelectedPet(petProfiles[0]);
    }
  }, [petProfiles, selectedPet]);

  const handleClinicSelect = (vendorId: string) => {
    setSelectedVendorId(vendorId);
    setCurrentStep('profile');
  };

  const handleBookNow = async (serviceData?: any) => {
    // Load vendor details if not already loaded
    if (!selectedVendorName && selectedVendorId) {
      try {
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${selectedVendorId}`,
          {
            headers: { Authorization: `Bearer ${publicAnonKey}` }
          }
        );
        if (response.ok) {
          const vendorData = await response.json();
          setSelectedVendorName(vendorData.name || vendorData.businessName || 'Clinic');
          setSelectedVendorType(vendorData.vendorType === 'solo' ? 'solo' : 'center');
        }
      } catch (error) {
        console.error('Error loading vendor:', error);
      }
    }
    
    if (serviceData) {
      setSelectedService(serviceData);
    }
    
    setCurrentStep('booking');
  };

  const handleBackFromProfile = () => {
    setCurrentStep('list');
    setSelectedVendorId('');
    setSelectedVendorName('');
  };

  const handleBackFromBooking = () => {
    setCurrentStep('profile');
  };

  const handleBookingComplete = (bookingId: string) => {
    // Navigate to booking success or back to profile
    setCurrentStep('profile');
    if (onBack) {
      // Small delay to show success message
      setTimeout(() => {
        onBack();
      }, 2000);
    }
  };

  // Step 1: Clinic List with Filters
  if (currentStep === 'list') {
    return (
      <ClinicListView
        phone={customerId}
        onBack={onBack}
        onClinicSelect={handleClinicSelect}
      />
    );
  }

  // Step 2: Full Clinic Profile (Zomato-style)
  if (currentStep === 'profile' && selectedVendorId) {
    return (
      <ClinicProfileView
        phone={customerId}
        clinicId={selectedVendorId}
        onBack={handleBackFromProfile}
        onNavigate={(screen, data) => {
          if (screen === 'appointment' || screen === 'booking') {
            handleBookNow(data?.service);
          }
        }}
      />
    );
  }

  // Step 3: Booking Flow using unified BookingFlowDispatcher
  if (currentStep === 'booking' && selectedVendorId) {
    return (
      <BookingFlowDispatcher
        serviceType="vet"
        serviceStyle="at_center"
        vendorId={selectedVendorId}
        vendorName={selectedVendorName || 'Clinic'}
        vendorType={selectedVendorType}
        selectedService={selectedService}
        customerId={customerId}
        customerPhone={customerId}
        petId={selectedPet?.id}
        petName={selectedPet?.name}
        customerName={selectedPet?.ownerName || ''}
        onBack={handleBackFromBooking}
        onNavigate={(screen, data) => {
          if (screen === 'home') {
            onBack();
          }
        }}
        onBookingComplete={handleBookingComplete}
      />
    );
  }

  return null;
}