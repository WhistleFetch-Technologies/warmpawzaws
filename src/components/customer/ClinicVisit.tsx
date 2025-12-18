import { useState } from 'react';
// Brand color: #FF8C42
import { ClinicListView } from './vet/ClinicListView';
import { ClinicProfileView } from './vet/ClinicProfileView';
import { VetServiceBooking } from './vet/VetServiceBooking';

interface ClinicVisitProps {
  onBack: () => void;
  customerId: string;
  petProfiles: any[];
}

type FlowStep = 'list' | 'profile' | 'booking';

export function ClinicVisit({ onBack, customerId, petProfiles }: ClinicVisitProps) {
  const [currentStep, setCurrentStep] = useState<FlowStep>('list');
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');

  const handleClinicSelect = (vendorId: string) => {
    setSelectedVendorId(vendorId);
    setCurrentStep('profile');
  };

  const handleBookNow = () => {
    setCurrentStep('booking');
  };

  const handleBackFromProfile = () => {
    setCurrentStep('list');
    setSelectedVendorId('');
  };

  const handleBackFromBooking = () => {
    setCurrentStep('profile');
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
        vendorId={selectedVendorId}
        onBack={handleBackFromProfile}
        onBookNow={handleBookNow}
      />
    );
  }

  // Step 3: Booking Flow (Service → Pet → Schedule)
  if (currentStep === 'booking' && selectedVendorId) {
    return (
      <VetServiceBooking
        phone={customerId}
        serviceType="clinic-visit"
        vendorId={selectedVendorId}
        onBack={handleBackFromBooking}
      />
    );
  }

  return null;
}