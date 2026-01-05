'use client';

import { useState } from 'react';
import { CustomerHomeComplete } from './CustomerHomeComplete';
import { ComingSoon } from './ComingSoon';

// Screen types - will expand as more components are implemented
type ScreenType = 
  | 'home' 
  | 'user-profile' 
  | 'customer-profile'
  | 'pet-profile'
  | 'pet-details' 
  | 'add-pet' 
  | 'walker' 
  | 'vet'
  | 'grooming'
  | 'training'
  | 'boarding'
  | 'adoption'
  | 'sunset'
  | 'insurance'
  | 'cafes'
  | 'shop'
  | 'photography'
  | 'breeder'
  | 'ambulance'
  | 'nutritionist'
  | 'relocation'
  | 'resort'
  | 'holiday'
  | 'my-bookings'
  | 'appointments'
  | 'coming-soon';

interface CustomerHomeWrapperProps {
  phone: string;
  initialScreen?: ScreenType;
}

export function CustomerHomeWrapper({ 
  phone, 
  initialScreen = 'home' 
}: CustomerHomeWrapperProps) {
  console.log('CustomerHomeWrapper: Rendering with phone:', phone);
  
  const [currentScreen, setCurrentScreen] = useState<ScreenType>(initialScreen);
  const [selectedService, setSelectedService] = useState<string>('');

  const handleNavigateToService = (service: string) => {
    console.log('Navigating to service:', service);
    
    // Map service names to screen types
    const serviceMap: Record<string, ScreenType> = {
      'walker': 'walker',
      'vet': 'vet',
      'veterinarian': 'vet',
      'grooming': 'grooming',
      'training': 'training',
      'boarding': 'boarding',
      'adoption': 'adoption',
      'sunset': 'sunset',
      'insurance': 'insurance',
      'cafes': 'cafes',
      'shop': 'shop',
      'photography': 'photography',
      'breeder': 'breeder',
      'ambulance': 'ambulance',
      'nutritionist': 'nutritionist',
      'relocation': 'relocation',
      'resort': 'resort',
      'holiday': 'holiday',
    };

    const screen = serviceMap[service.toLowerCase()];
    if (screen) {
      setCurrentScreen(screen);
    } else {
      setSelectedService(service);
      setCurrentScreen('coming-soon');
    }
  };

  const handleBack = () => {
    setCurrentScreen('home');
    setSelectedService('');
  };

  // RENDER LOGIC
  if (currentScreen === 'home') {
    return (
      <CustomerHomeComplete phone={phone} />
    );
  }

  // All other screens show "Coming Soon" for now
  // These will be replaced as Phase 2-9 components are implemented
  return (
    <ComingSoon 
      serviceName={currentScreen} 
      onBack={handleBack} 
    />
  );
}

