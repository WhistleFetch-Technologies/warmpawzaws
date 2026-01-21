'use client';

import React, { useState } from 'react';
import {
  ArrowLeft, Home, MapPin, Clock, Star, User, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

import { UniversalServiceProviderList } from '../shared/UniversalServiceProviderList';
import { UniversalProviderProfile } from '../shared/UniversalProviderProfile';

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
}

type FlowStep = 
  | 'provider-list'       // List of home visit providers
  | 'provider-profile'    // Provider profile + services
  | 'payment';            // Payment page

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function HomeVisitRouter({ phone, onBack, onNavigate }: HomeVisitRouterProps) {
  const [step, setStep] = useState<FlowStep>('provider-list');
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);

  // Handlers
  const handleSelectProvider = (provider: Provider) => {
    setSelectedProvider(provider);
    setStep('provider-profile');
  };

  const handleProceedToPayment = (bookingData: any) => {
    // Navigate to universal payment page
    onNavigate('payment', {
      ...bookingData,
      serviceType: 'at_home',
      category: 'vet',
      flowType: 'home-visit',
    });
  };

  const handleBack = () => {
    switch (step) {
      case 'provider-list':
        onBack();
        break;
      case 'provider-profile':
        setSelectedProvider(null);
        setStep('provider-list');
        break;
      default:
        onBack();
    }
  };

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
          onBack={handleBack}
          onNavigate={onNavigate}
          onProceedToPayment={handleProceedToPayment}
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
          onBack={handleBack}
          onNavigate={onNavigate}
          onSelectProvider={handleSelectProvider}
        />
      );
  }
}

export default HomeVisitRouter;
