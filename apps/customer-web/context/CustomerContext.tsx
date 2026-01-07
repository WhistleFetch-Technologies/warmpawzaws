'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

interface CustomerContextType {
  session: CustomerSession | null;
  setSession: (session: CustomerSession | null) => void;
  journeyStage: string | null;
  setJourneyStage: (stage: string | null) => void;
  currentScreen: string;
  setCurrentScreen: (screen: string) => void;
  petData: any[];
  setPetData: (pets: any[]) => void;
  logout: () => void;
  isLoading: boolean;
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined);

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<CustomerSession | null>(null);
  const [journeyStage, setJourneyStage] = useState<string | null>(null);
  const [currentScreen, setCurrentScreen] = useState<string>('auth');
  const [petData, setPetData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load session from localStorage on mount
  useEffect(() => {
    const loadSession = () => {
      if (typeof window !== 'undefined') {
        const storedPhone = localStorage.getItem('customerPhone');
        const storedToken = localStorage.getItem('authToken');
        const storedOnboarding = localStorage.getItem('customerOnboardingComplete');
        const storedJourney = localStorage.getItem('customerJourneyStage');
        const storedCustomer = localStorage.getItem('customerData');

        if (storedPhone && storedToken) {
          const customerData = storedCustomer ? JSON.parse(storedCustomer) : null;
          
          setSessionState({
            phone: storedPhone,
            sessionToken: storedToken,
            verified: true,
            hasCompletedOnboarding: storedOnboarding === 'true',
            customer: customerData,
            hasPets: customerData?.petIds?.length > 0 || false
          });

          if (storedJourney) {
            setJourneyStage(storedJourney);
          }

          // Determine initial screen
          if (storedOnboarding === 'true') {
            setCurrentScreen('home');
          } else if (storedJourney) {
            setCurrentScreen('user-profile');
          } else {
            setCurrentScreen('onboarding');
          }
        } else {
          setCurrentScreen('auth');
        }
      }
      setIsLoading(false);
    };

    loadSession();
  }, []);

  const setSession = (newSession: CustomerSession | null) => {
    setSessionState(newSession);
    
    if (newSession && typeof window !== 'undefined') {
      localStorage.setItem('customerPhone', newSession.phone);
      if (newSession.sessionToken) {
        localStorage.setItem('authToken', newSession.sessionToken);
      }
      if (newSession.customer) {
        localStorage.setItem('customerData', JSON.stringify(newSession.customer));
      }
      if (newSession.hasCompletedOnboarding) {
        localStorage.setItem('customerOnboardingComplete', 'true');
      }
    }
  };

  const logout = () => {
    setSessionState(null);
    setJourneyStage(null);
    setCurrentScreen('auth');
    setPetData([]);
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('customerPhone');
      localStorage.removeItem('authToken');
      localStorage.removeItem('customerData');
      localStorage.removeItem('customerOnboardingComplete');
      localStorage.removeItem('customerJourneyStage');
    }
  };

  // Save journey stage when it changes
  useEffect(() => {
    if (journeyStage && typeof window !== 'undefined') {
      localStorage.setItem('customerJourneyStage', journeyStage);
    }
  }, [journeyStage]);

  return (
    <CustomerContext.Provider
      value={{
        session,
        setSession,
        journeyStage,
        setJourneyStage,
        currentScreen,
        setCurrentScreen,
        petData,
        setPetData,
        logout,
        isLoading
      }}
    >
      {children}
    </CustomerContext.Provider>
  );
}

export function useCustomer() {
  const context = useContext(CustomerContext);
  if (context === undefined) {
    throw new Error('useCustomer must be used within a CustomerProvider');
  }
  return context;
}

