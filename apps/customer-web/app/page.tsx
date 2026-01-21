'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CustomerApp } from '@/components/customer/CustomerApp';
import { ErrorBoundary } from '@/components/ErrorBoundary';

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

export default function HomePage() {
  const router = useRouter();
  const [session, setSession] = useState<CustomerSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasRedirected = useRef(false);

  useEffect(() => {
    const { initializeSession } = require('@/lib/session-utils');
    initializeSession();
    
    const loadSession = async () => {
      try {
        const storedPhone = localStorage.getItem('customerPhone');
        const storedToken = localStorage.getItem('authToken');

        if (storedPhone && storedToken) {
          try {
            const { apiClient } = require('@/lib/api-client');
            const profileResponse: any = await apiClient.get(`/customer/profile/unified/${storedPhone}`);
            
            if (profileResponse.profile) {
              const customerData = profileResponse.profile;
              const onboardingStatus = customerData.onboarding_status || customerData.onboardingStatus;
              const profileCompleted = customerData.profile_completed || customerData.onboardingComplete;
              
              localStorage.setItem('customerData', JSON.stringify(customerData));
              localStorage.setItem('customerId', customerData.id);
              
              if (onboardingStatus === 'COMPLETED' || profileCompleted) {
                localStorage.setItem('customerOnboardingComplete', 'true');
              } else {
                localStorage.setItem('customerOnboardingComplete', 'false');
              }
              
              setSession({
                phone: storedPhone,
                sessionToken: storedToken,
                verified: true,
                customer: customerData,
                hasCompletedOnboarding: onboardingStatus === 'COMPLETED' || profileCompleted,
                hasPets: customerData.pets && customerData.pets.length > 0,
                isNewUser: onboardingStatus === 'INIT' || onboardingStatus === 'PHONE_VERIFIED'
              });
            } else {
              const storedCustomer = localStorage.getItem('customerData');
              const storedOnboarding = localStorage.getItem('customerOnboardingComplete');
              const customerData = storedCustomer ? JSON.parse(storedCustomer) : null;
              
              setSession({
                phone: storedPhone,
                sessionToken: storedToken,
                verified: true,
                customer: customerData,
                hasCompletedOnboarding: storedOnboarding === 'true',
                hasPets: false,
                isNewUser: !storedOnboarding
              });
            }
          } catch (apiError) {
            console.error('Error fetching customer profile:', apiError);
            const storedCustomer = localStorage.getItem('customerData');
            const storedOnboarding = localStorage.getItem('customerOnboardingComplete');
            const customerData = storedCustomer ? JSON.parse(storedCustomer) : null;
            
            setSession({
              phone: storedPhone,
              sessionToken: storedToken,
              verified: true,
              customer: customerData,
              hasCompletedOnboarding: storedOnboarding === 'true',
              hasPets: false,
              isNewUser: !storedOnboarding
            });
          }
        }
      } catch (error) {
        console.error('Error loading session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, []);

  useEffect(() => {
    if (!isLoading && !session && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace('/auth');
    }
  }, [isLoading, session, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null; 
  }

  return (
    <ErrorBoundary>
      <CustomerApp initialSession={session} />
    </ErrorBoundary>
  );
}
