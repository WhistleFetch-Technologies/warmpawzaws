'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  ArrowLeft, Home, MapPin, Clock, Star, User, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

import { UniversalServiceProviderList } from '../shared/UniversalServiceProviderList';
import { UniversalProviderProfile } from '../shared/UniversalProviderProfile';
import {
  saveHomeVisitWizardSnapshot,
  bookingFormFieldsFromProceed,
  type HomeVisitWizardSnapshot,
} from '@/lib/navigation/wizard-session-state';

// ============================================================================
// TYPES
// ============================================================================

interface Provider {
  providerId: string;
  providerType: 'vendor' | 'staff' | 'individual';
  vendorId?: string;
  vendorName?: string;
  staffId?: string;
  name: string;
  photo?: string;
  photos?: string[];
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  website?: string;
  role?: string;
  specialization?: string;
  qualifications?: string;
  degree?: string;
  bio?: string;
  experienceYears?: number;
  rating: number;
  reviewCount: number;
  distance?: number | null;
  isVerified?: boolean;
  isOnline?: boolean;
  nextAvailableSlot?: string;
  services: any[];
  amenities?: string[];
  languages?: string[];
  consultationFee?: number;
}

interface HomeVisitRouterProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  initialAddressFromBook?: any;
  onConsumeInitialAddress?: () => void;
  restoredSnapshot?: HomeVisitWizardSnapshot | null;
  onRestoredSnapshotConsumed?: () => void;
  /** Expose step-aware back for shell header / hardware back. */
  onInternalBackReady?: (handleBack: () => void) => void;
}

type FlowStep = 
  | 'provider-list'       // List of home visit providers
  | 'provider-profile'    // Provider profile + services
  | 'payment';            // Payment page

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function HomeVisitRouter({
  phone,
  onBack,
  onNavigate,
  initialAddressFromBook,
  onConsumeInitialAddress,
  restoredSnapshot,
  onRestoredSnapshotConsumed,
  onInternalBackReady,
}: HomeVisitRouterProps) {
  const restoredStep = restoredSnapshot?.step as FlowStep | undefined;
  const initialStep: FlowStep =
    restoredStep && restoredStep !== 'payment' ? restoredStep : 'provider-list';
  const [step, setStep] = useState<FlowStep>(initialStep);
  const providerProfileInternalBackRef = useRef<(() => void) | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(
    (restoredSnapshot?.selectedProvider as Provider | null) ?? null,
  );
  const [bookingFormRestore] = useState(() => ({
    showBookingForm: restoredSnapshot?.showBookingForm,
    selectedDate: restoredSnapshot?.selectedDate,
    selectedTime: restoredSnapshot?.selectedTime,
    selectedPetId: restoredSnapshot?.selectedPetId,
    selectedServiceIds: restoredSnapshot?.selectedServiceIds,
    selectedAddressId: restoredSnapshot?.selectedAddressId,
  }));

  useEffect(() => {
    if (restoredSnapshot) {
      onRestoredSnapshotConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- consume snapshot once on mount
  }, []);

  // Handlers
  const handleSelectProvider = (provider: Provider) => {
    setSelectedProvider(provider);
    setStep('provider-profile');
  };

  const handleProceedToPayment = (bookingData: any) => {
    saveHomeVisitWizardSnapshot({
      step: 'provider-profile',
      selectedProvider: (selectedProvider as Record<string, unknown> | null) ?? null,
      showBookingForm: true,
      ...bookingFormFieldsFromProceed(bookingData),
    });
    onNavigate('payment', {
      ...bookingData,
      serviceType: 'at_home',
      category: 'vet',
      flowType: 'home-visit',
    });
  };

  const handleProviderProfileStepBack = useCallback(() => {
    setSelectedProvider(null);
    setStep('provider-list');
  }, []);

  const handleBack = useCallback(() => {
    switch (step) {
      case 'provider-list':
        onBack();
        break;
      case 'provider-profile':
        if (providerProfileInternalBackRef.current) {
          providerProfileInternalBackRef.current();
        } else {
          handleProviderProfileStepBack();
        }
        break;
      default:
        onBack();
    }
  }, [step, onBack, handleProviderProfileStepBack]);

  useEffect(() => {
    if (step !== 'provider-profile') {
      providerProfileInternalBackRef.current = null;
    }
  }, [step]);

  useEffect(() => {
    onInternalBackReady?.(handleBack);
  }, [handleBack, onInternalBackReady]);

  // Render based on step
  switch (step) {
    case 'provider-list':
      return (
        <UniversalServiceProviderList
          phone={phone}
          category="vet"
          roleId="veterinarian"
          serviceStyle="at_home"
          title="Home Visit"
          subtitle="Vet comes to your doorstep"
          compactFilterSheet
          onBack={handleBack}
          onNavigate={onNavigate}
          onSelectProvider={handleSelectProvider}
        />
      );

    case 'provider-profile':
      if (!selectedProvider) {
        setStep('provider-list');
        return null;
      }
      return (
        <UniversalProviderProfile
          phone={phone}
          provider={selectedProvider}
          category="vet"
          serviceStyle="at_home"
          onBack={handleProviderProfileStepBack}
          onInternalBackReady={(fn) => { providerProfileInternalBackRef.current = fn; }}
          onNavigate={onNavigate}
          onProceedToPayment={handleProceedToPayment}
          initialSelectedAddress={initialAddressFromBook}
          onConsumeInitialAddress={onConsumeInitialAddress}
          initialShowBookingForm={bookingFormRestore.showBookingForm}
          initialSelectedDate={bookingFormRestore.selectedDate}
          initialSelectedTime={bookingFormRestore.selectedTime}
          initialSelectedPetId={bookingFormRestore.selectedPetId}
          initialSelectedServiceIds={bookingFormRestore.selectedServiceIds}
          initialSelectedAddressId={bookingFormRestore.selectedAddressId}
        />
      );

    default:
      return (
        <UniversalServiceProviderList
          phone={phone}
          category="vet"
          roleId="veterinarian"
          serviceStyle="at_home"
          title="Home Visit"
          subtitle="Vet comes to your doorstep"
          compactFilterSheet
          onBack={handleBack}
          onNavigate={onNavigate}
          onSelectProvider={handleSelectProvider}
        />
      );
  }
}

export default HomeVisitRouter;
