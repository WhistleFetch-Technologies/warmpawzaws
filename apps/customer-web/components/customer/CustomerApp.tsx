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
import { resetHomeBootstrapForPhone } from '@/lib/customer-home-bootstrap';
import { prefetchCommerceSwitchConfigurationOnStartup } from '@/lib/commerce-switch-client';

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
    prefetchCommerceSwitchConfigurationOnStartup();
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
        initialScreen={initialScreen}
        petBoardingVendorId={petBoardingVendorId}
        petBoardingServiceSlug={petBoardingServiceSlug}
        initialBannerNavigation={initialBannerNavigation ?? undefined}
        onNavigate={handleLogoutNavigate}
      />
    </CustomerBookingMessagesModalProvider>
  );
}
