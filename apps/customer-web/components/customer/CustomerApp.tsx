'use client';

import { useState, useEffect } from 'react';
import { bootstrapPushNotifications, teardownPushNotifications } from '@/lib/push-bootstrap';
import { apiClient } from '@/lib/api-client';
import { CustomerHomeWrapper } from './wrappers/CustomerHomeWrapper';
import { CustomerBookingMessagesModalProvider } from './messaging/CustomerBookingMessagesModalProvider';
import { resetHomeBootstrapForPhone } from '@/lib/customer-home-bootstrap';

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

type CustomerInitialScreen =
  | 'home'
  | 'problem_grid'
  | 'pet-boarding-vendors'
  | 'pet-boarding-profile';

import type { InitialBannerNavigation } from '@/lib/banner-cta-navigation';

interface CustomerAppProps {
  initialSession: CustomerSession;
  /** When set (e.g. /services/all), refresh keeps this screen instead of resetting to home */
  initialScreen?: CustomerInitialScreen;
  /** Deep link: /pet-boarding/vendor/[id] */
  petBoardingVendorId?: string;
  /** Query param service= slug for boarding list/profile context */
  petBoardingServiceSlug?: string;
  /** Deep link: /vet/Vendor Name — resolved banner navigation */
  initialBannerNavigation?: InitialBannerNavigation | null;
}

export function CustomerApp({
  initialSession,
  initialScreen = 'home',
  petBoardingVendorId,
  petBoardingServiceSlug,
  initialBannerNavigation,
}: CustomerAppProps) {
  const [session, setSession] = useState<CustomerSession>(initialSession);

  useEffect(() => {
    setSession(initialSession);
  }, [initialSession]);

  useEffect(() => {
    const userId =
      session.customerId ||
      (typeof window !== 'undefined' ? (localStorage.getItem('customerId') ?? '') : '');
    if (!userId) return;
    void bootstrapPushNotifications({
      userId,
      userType: 'customer',
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      apiClient,
    });
  }, [session.customerId]);

  const handleLogoutNavigate = async (screen: string) => {
    if (screen === 'logout') {
      if (typeof window !== 'undefined') {
        const userId =
          session.customerId ||
          localStorage.getItem('customerId') ||
          '';
        if (userId) {
          await teardownPushNotifications({ userId, userType: 'customer' });
        }
        localStorage.removeItem('customerPhone');
        localStorage.removeItem('customerId');
        localStorage.removeItem('authToken');
        localStorage.removeItem('customerData');
        localStorage.removeItem('customerProfile');
        localStorage.removeItem('customerPets');
        localStorage.removeItem('customerOnboardingComplete');
        localStorage.removeItem('onboarding_completed');
        localStorage.removeItem('profile_completed');
        localStorage.removeItem('customerJourneyStage');
        localStorage.removeItem('cognitoAccessToken');
        localStorage.removeItem('cognitoIdToken');
        localStorage.removeItem('cognitoRefreshToken');
        localStorage.removeItem('cognitoTokenExpiry');
        localStorage.removeItem('cognitoUserInfo');
        resetHomeBootstrapForPhone(null);
        window.location.href = '/auth';
      }
    }
  };

  return (
    <CustomerBookingMessagesModalProvider phone={session.phone}>
      <CustomerHomeWrapper
        phone={session.phone}
        initialScreen={initialScreen}
        petBoardingVendorId={petBoardingVendorId}
        petBoardingServiceSlug={petBoardingServiceSlug}
        initialBannerNavigation={initialBannerNavigation ?? undefined}
        onNavigate={handleLogoutNavigate}
      />
    </CustomerBookingMessagesModalProvider>
  );
}
