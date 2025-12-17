import { useState } from 'react';
import { CustomerAuth } from './customer/CustomerAuth';
import { CustomerOnboarding } from './customer/CustomerOnboarding';
import { CustomerPlanningJourney } from './customer/CustomerPlanningJourney';
import { CustomerHavePetJourney } from './customer/CustomerHavePetJourney';
import { CustomerHomeWrapper } from './customer/CustomerHomeWrapper';
import { CustomerPetProfile } from './customer/CustomerPetProfile';
import { CustomerUserProfile } from './customer/CustomerUserProfile';

import { CartProvider } from '../context/CartContext';

export function CustomerApp() {
  const [session, setSession] = useState<any>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [journeyStage, setJourneyStage] = useState<string | null>(null);
  const [showJourney, setShowJourney] = useState(false);
  const [showPetProfile, setShowPetProfile] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<string>('home');
  const [onboardingData, setOnboardingData] = useState<any>(null);
  const [petData, setPetData] = useState<any[]>([]);

  const handleAuthSuccess = (authSession: any) => {
    console.log('🎯 CustomerApp: Auth success', authSession);
    console.log('🔍 CustomerApp: onboardingComplete =', authSession.customer?.onboardingComplete);
    console.log('🔍 CustomerApp: hasCompletedOnboarding =', authSession.hasCompletedOnboarding);
    setSession(authSession);
    
    // ✅ Check user state to determine flow
    // CRITICAL FIX: Check both hasCompletedOnboarding AND customer.onboardingComplete
    const isOnboardingComplete = authSession.hasCompletedOnboarding || authSession.customer?.onboardingComplete;
    
    if (isOnboardingComplete) {
      // User has completed full journey - go directly to home
      console.log('✅ Returning user with completed profile - going to home');
      setCurrentScreen('home');
      setShowOnboarding(false);
      setShowUserProfile(false);
      setShowPetProfile(false);
    } else if (!authSession.isNewUser && authSession.customer) {
      // Existing user but incomplete onboarding - check their progress
      console.log('⚠️ Existing user with incomplete onboarding:', authSession.customer);
      
      // If they have basic info, skip to appropriate step
      if (authSession.customer.name && authSession.customer.address) {
        // Has user profile, check for pets
        if (authSession.hasPets) {
          // Everything done, go home
          console.log('✅ User has profile and pets - going to home');
          setCurrentScreen('home');
        } else {
          // Need pet profile
          console.log('⚠️ User has profile but no pets - showing pet profile');
          setShowPetProfile(true);
        }
      } else {
        // Need user profile
        console.log('⚠️ User needs profile - showing user profile form');
        setShowUserProfile(true);
      }
    } else {
      // New user - show full onboarding
      console.log('🆕 New user - showing onboarding');
      setShowOnboarding(true);
    }
  };

  const handleOnboardingComplete = (stage: string) => {
    setJourneyStage(stage);
    setShowOnboarding(false);
    
    // Flow based on stage selection
    if (stage === 'planning') {
      // Planning: Go to Planning Journey → User Profile → Home
      setShowJourney(true);
    } else if (stage === 'have-pet') {
      // Already Have a Pet: Go to User Profile → Pet Profile → Home
      setShowUserProfile(true);
    } else if (stage === 'end-of-life') {
      // End of Life Care: Go to User Profile → Home (no pet required)
      setShowUserProfile(true);
    }
  };

  const handleJourneyComplete = () => {
    // After Planning Journey completes, go to User Profile
    setShowJourney(false);
    setShowUserProfile(true);
  };

  const handleUserProfileComplete = (profile: any) => {
    // After User Profile:
    // - "Already Have a Pet": Go to Pet Profile
    // - "End of Life Care": Go to Home (no pet required)
    // - "Planning": Go to Home
    setShowUserProfile(false);
    
    if (journeyStage === 'have-pet') {
      setShowPetProfile(true);
    } else {
      // For end-of-life and planning, go directly to home
      setCurrentScreen('home');
    }
  };

  const handlePetProfileComplete = (pets: any[]) => {
    // Save pet data and move to Home
    setPetData(pets);
    setShowPetProfile(false);
    setCurrentScreen('home');
  };

  const handleNavigate = (screen: string) => {
    setCurrentScreen(screen);
  };

  if (!session) {
    return <CustomerAuth onAuthSuccess={handleAuthSuccess} />;
  }

  if (showOnboarding) {
    return <CustomerOnboarding onComplete={handleOnboardingComplete} />;
  }

  if (showJourney) {
    if (journeyStage === 'planning') {
      return <CustomerPlanningJourney session={session} onComplete={handleJourneyComplete} />;
    }
  }

  if (showUserProfile) {
    return <CustomerUserProfile session={session} journeyStage={journeyStage} onComplete={handleUserProfileComplete} />;
  }

  if (showPetProfile) {
    return (
      <CustomerPetProfile 
        session={session} 
        prefillData={onboardingData}
        onComplete={handlePetProfileComplete}
      />
    );
  }

  // Show home screen after journey completion
  if (currentScreen === 'home') {
    return (
      <CartProvider>
        <CustomerHomeWrapper phone={session.phone} onNavigate={handleNavigate} />
      </CartProvider>
    );
  }

  // Fallback: redirect to home
  return (
    <CartProvider>
      <CustomerHomeWrapper phone={session.phone} onNavigate={handleNavigate} />
    </CartProvider>
  );
}