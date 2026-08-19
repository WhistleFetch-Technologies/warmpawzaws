'use client';

import { useState, useEffect } from 'react';
import {
  bootstrapPushNotifications,
  ensureCapacitorPushRegistrationPipeline,
} from '@/lib/push-bootstrap';
import { signOutCustomer } from '@/lib/session-utils';
import { apiClient } from '@/lib/api-client';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';
import { CustomerHomeWrapper } from './wrappers/CustomerHomeWrapper';
import { CustomerBookingMessagesModalProvider } from './messaging/CustomerBookingMessagesModalProvider';
import { resetHomeBootstrapForPhone, ensureCustomerProfileAndPets } from '@/lib/customer-home-bootstrap';
import {
  CUSTOMER_AUTH_COMPLETED_EVENT,
  readCustomerAuthSessionFromStorage,
} from '@/lib/customer-auth-session-event';

interface CustomerSession {
  phone: string;
  customerId?: string;
  customer?: any;
  sessionToken?: string;
  verified: boolean;
  isNewUser?: boolean;
  hasCompletedOnboarding?: boolean;
  hasPets?: boolean;
  isGuest?: boolean;
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
    const onAuthCompleted = () => {
      const next = readCustomerAuthSessionFromStorage();
      if (!next?.phone) return;
      resetHomeBootstrapForPhone(next.phone);
      setSession(next);
      void ensureCustomerProfileAndPets(next.phone).refreshPromise.then((result) => {
        const data = result.profile;
        if (!data) return;
        setSession((prev) => ({
          ...prev,
          phone: next.phone,
          isGuest: false,
          verified: true,
          customer: { ...data, pets: result.pets },
          hasCompletedOnboarding: prev.hasCompletedOnboarding,
          hasPets: result.pets.length > 0,
        }));
      });
    };
    window.addEventListener(CUSTOMER_AUTH_COMPLETED_EVENT, onAuthCompleted);
    return () => window.removeEventListener(CUSTOMER_AUTH_COMPLETED_EVENT, onAuthCompleted);
  }, []);

  useEffect(() => {
    const userId = getResolvedCustomerId();
    if (!userId) return;
    const pushOpts = {
      userId,
      userType: 'customer' as const,
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      apiClient,
    };
    void ensureCapacitorPushRegistrationPipeline(pushOpts).then(() =>
      bootstrapPushNotifications(pushOpts)
    );
  }, [session.customerId, session.phone]);

  const handleLogoutNavigate = async (screen: string) => {
    if (screen === 'logout') {
      if (typeof window !== 'undefined') {
        await signOutCustomer();
        resetHomeBootstrapForPhone(null);
        window.location.href = '/auth';
      }
    }
  };

  return (
    <CustomerBookingMessagesModalProvider phone={session.phone}>
      <CustomerHomeWrapper
        phone={session.phone}
        isGuest={session.isGuest === true}
        initialScreen={initialScreen}
        petBoardingVendorId={petBoardingVendorId}
        petBoardingServiceSlug={petBoardingServiceSlug}
        initialBannerNavigation={initialBannerNavigation ?? undefined}
        onNavigate={handleLogoutNavigate}
      />
    </CustomerBookingMessagesModalProvider>
  );
}
