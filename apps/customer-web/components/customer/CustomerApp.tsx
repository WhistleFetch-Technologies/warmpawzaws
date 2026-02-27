'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CustomerOnboarding } from './CustomerOnboarding';
import { CustomerUserProfile } from './CustomerUserProfile';
import { CustomerPetProfile } from './CustomerPetProfile';
import { CustomerHomeWrapper } from './wrappers/CustomerHomeWrapper';
import { isUatMode } from '@/lib/api-client';

interface CustomerSession {
  phone: string;
  customerId?: string;
  customer?: any;
  sessionToken?: string;
  verified: boolean;
  isNewUser?: boolean;
  hasCompletedOnboarding?: boolean;
  hasPets?: boolean;
}

interface CustomerAppProps {
  initialSession: CustomerSession;
}

export function CustomerApp({ initialSession }: CustomerAppProps) {
  const router = useRouter();
  const [session, setSession] = useState<CustomerSession>(initialSession);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [journeyStage, setJourneyStage] = useState<string | null>(null);
  const [showJourney, setShowJourney] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showPetProfile, setShowPetProfile] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<string>('home');
  const [petData, setPetData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Determine initial flow state based on session
  useEffect(() => {
    const determineInitialState = () => {
      console.log('🎯 CustomerApp: Checking session state', session);
      
      const storedOnboarding = localStorage.getItem('customerOnboardingComplete') === 'true';
      const hasSessionOnboarded = session.hasCompletedOnboarding === true;
      const customer = session.customer;
      const hasCustomerWithName = !!(customer?.id && (customer?.name || customer?.full_name) && String(customer?.name || customer?.full_name).trim());
      const hasCustomerWithUsage = !!(customer?.id && ((customer?.bookings?.length || 0) > 0 || (customer?.orders?.all?.length || 0) > 0));
      const isOnboardingComplete = hasSessionOnboarded || storedOnboarding || hasCustomerWithName || hasCustomerWithUsage;
      const storedJourney = localStorage.getItem('customerJourneyStage');
      const storedProfile = localStorage.getItem('customerProfile');
      const storedPets = localStorage.getItem('customerPets');
      
      console.log('📊 State check:', {
        isOnboardingComplete,
        hasSessionOnboarded,
        storedOnboarding,
        hasCustomerWithName,
        hasCustomerWithUsage,
        storedJourney,
        hasProfile: !!storedProfile,
        hasPets: !!storedPets
      });
      
      if (isOnboardingComplete) {
        if (!storedOnboarding) localStorage.setItem('customerOnboardingComplete', 'true');
        console.log('✅ Returning user with completed profile - going to home');
        setCurrentScreen('home');
      } else if (storedProfile && !storedPets) {
        // Has user profile but no pets - show pet profile
        console.log('⚠️ User has profile but no pets - showing pet profile');
        setJourneyStage(storedJourney || 'have-pet');
        setShowPetProfile(true);
      } else if (storedJourney && !storedProfile) {
        // Has selected journey but no profile - show user profile
        console.log('⚠️ User selected journey but needs profile');
        setJourneyStage(storedJourney);
        setShowUserProfile(true);
      } else if (session.isNewUser || !storedJourney) {
        // New user - show onboarding
        console.log('🆕 New user - showing onboarding');
        setShowOnboarding(true);
      } else {
        // Default to home
        setCurrentScreen('home');
      }
      
      setIsLoading(false);
    };

    determineInitialState();
  }, [session]);

  const handleOnboardingComplete = (stage: string) => {
    console.log('📋 Journey stage selected:', stage);
    setJourneyStage(stage);
    localStorage.setItem('customerJourneyStage', stage);
    setShowOnboarding(false);
    
    // Flow based on stage selection
    if (stage === 'planning') {
      // Planning: Go to User Profile → Home (skip pet profile)
      setShowUserProfile(true);
    } else if (stage === 'have-pet') {
      // Already Have a Pet: Go to User Profile → Pet Profile → Home
      setShowUserProfile(true);
    } else if (stage === 'end-of-life') {
      // End of Life Care: Go to User Profile → Home (no pet required)
      setShowUserProfile(true);
    }
  };

  const handleUserProfileComplete = (profile: any) => {
    console.log('👤 User profile completed:', profile);
    setShowUserProfile(false);
    
    // After User Profile:
    // - "Already Have a Pet": Go to Pet Profile
    // - "End of Life Care": Go to Home (no pet required)
    // - "Planning": Go to Home
    if (journeyStage === 'have-pet') {
      setShowPetProfile(true);
    } else {
      // For end-of-life and planning, mark onboarding complete and go to home
      localStorage.setItem('customerOnboardingComplete', 'true');
      setCurrentScreen('home');
    }
  };

  const handlePetProfileComplete = (pets: any[]) => {
    console.log('🐾 Pet profiles completed:', pets);
    setPetData(pets);
    setShowPetProfile(false);
    localStorage.setItem('customerOnboardingComplete', 'true');
    setCurrentScreen('home');
  };

  const handleNavigate = (screen: string) => {
    if (screen === 'logout') {
      // Clear all session data and redirect immediately (no async - lands on customer auth)
      if (typeof window !== 'undefined') {
        localStorage.removeItem('customerPhone');
        localStorage.removeItem('customerId');
        localStorage.removeItem('authToken');
        localStorage.removeItem('customerData');
        localStorage.removeItem('customerProfile');
        localStorage.removeItem('customerPets');
        localStorage.removeItem('customerOnboardingComplete');
        localStorage.removeItem('customerJourneyStage');
        localStorage.removeItem('cognitoAccessToken');
        localStorage.removeItem('cognitoIdToken');
        localStorage.removeItem('cognitoRefreshToken');
        localStorage.removeItem('cognitoTokenExpiry');
        localStorage.removeItem('cognitoUserInfo');
        window.location.href = '/auth';
      }
      return;
    }
    setCurrentScreen(screen);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  // Onboarding flow
  if (showOnboarding) {
    return <CustomerOnboarding 
      onComplete={handleOnboardingComplete} 
      onBack={() => {
        // Go back to auth/login page
        if (typeof window !== 'undefined') {
          localStorage.removeItem('customerPhone');
          localStorage.removeItem('customerId');
          localStorage.removeItem('authToken');
          localStorage.removeItem('customerData');
          localStorage.removeItem('customerProfile');
          localStorage.removeItem('customerPets');
          localStorage.removeItem('customerOnboardingComplete');
          localStorage.removeItem('customerJourneyStage');
          window.location.href = '/auth';
        }
      }}
    />;
  }

  // User Profile form
  if (showUserProfile) {
    return (
      <CustomerUserProfile 
        session={session}
        journeyStage={journeyStage || undefined}
        onComplete={handleUserProfileComplete}
        onBack={() => {
          // Go back to stage selection
          setShowUserProfile(false);
          setJourneyStage(null);
          localStorage.removeItem('customerJourneyStage');
          setShowOnboarding(true);
        }}
      />
    );
  }

  // Pet Profile form
  if (showPetProfile) {
    return (
      <CustomerPetProfile 
        session={session}
        onComplete={handlePetProfileComplete}
        onBack={() => setShowUserProfile(true)}
      />
    );
  }

  // Home screen and all service screens - Use CustomerHomeWrapper which handles all navigation
  // CustomerHomeWrapper manages its own internal state for all service screens
  return (
    <CustomerHomeWrapper 
      phone={session.phone}
      initialScreen={currentScreen === 'home' ? 'home' : undefined}
      onNavigate={(screen: string) => {
        // Handle logout - clear all data and redirect immediately to customer auth
        if (screen === 'logout') {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('customerPhone');
            localStorage.removeItem('customerId');
            localStorage.removeItem('authToken');
            localStorage.removeItem('customerData');
            localStorage.removeItem('customerProfile');
            localStorage.removeItem('customerPets');
            localStorage.removeItem('customerOnboardingComplete');
            localStorage.removeItem('customerJourneyStage');
            localStorage.removeItem('cognitoAccessToken');
            localStorage.removeItem('cognitoIdToken');
            localStorage.removeItem('cognitoRefreshToken');
            localStorage.removeItem('cognitoTokenExpiry');
            localStorage.removeItem('cognitoUserInfo');
            window.location.href = '/auth';
          }
          return;
        }
        // All other navigation is handled internally by CustomerHomeWrapper
      }}
    />
  );
}

