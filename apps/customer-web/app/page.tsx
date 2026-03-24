'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CustomerApp } from '@/components/customer/CustomerApp';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { persistCustomerDatabaseId } from '@/lib/customer-id-storage';

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

    const storedPhone = localStorage.getItem('customerPhone');
    const storedToken = localStorage.getItem('authToken');
    const storedCustomer = localStorage.getItem('customerData');
    const storedOnboarding = localStorage.getItem('customerOnboardingComplete');
    const customerData = storedCustomer ? (() => { try { return JSON.parse(storedCustomer); } catch { return null; } })() : null;

    if (storedPhone && storedToken) {
      // Optimistic load: show app immediately with cached session so we don't block on API (slow from home / high RTT to ap-south-1).
      const cachedSession: CustomerSession = {
        phone: storedPhone,
        sessionToken: storedToken,
        verified: true,
        customer: customerData ?? undefined,
        hasCompletedOnboarding: storedOnboarding === 'true',
        hasPets: !!(customerData?.pets?.length),
        isNewUser: storedOnboarding !== 'true',
      };
      setSession(cachedSession);
      setIsLoading(false);

      // Refresh profile in background; update session when done.
      (async () => {
        try {
          const { apiClient } = require('@/lib/api-client');
          const profileResponse: any = await apiClient.get(`/customer/profile/unified/${storedPhone}`);
          if (profileResponse?.profile) {
            const data = profileResponse.profile;
            const onboardingStatus = data.onboarding_status || data.onboardingStatus;
            const profileCompleted = data.profile_completed || data.onboardingComplete;
            const name = data.name || data.full_name || '';
            const hasRealName = !!name && String(name).trim() !== '' && name !== `Customer ${(storedPhone || '').slice(-4)}`;
            const hasBookings = (data.bookings?.length || 0) > 0;
            const hasProfileId = !!data.id;
            const isOnboarded = onboardingStatus === 'COMPLETED' || profileCompleted ||
              (hasProfileId && hasRealName) || (hasProfileId && hasBookings);
            localStorage.setItem('customerData', JSON.stringify(data));
            persistCustomerDatabaseId(data);
            localStorage.setItem('customerOnboardingComplete', isOnboarded ? 'true' : 'false');
            setSession({
              phone: storedPhone,
              sessionToken: storedToken,
              verified: true,
              customer: data,
              hasCompletedOnboarding: isOnboarded,
              hasPets: !!(data.pets?.length),
              isNewUser: !isOnboarded && (onboardingStatus === 'INIT' || onboardingStatus === 'PHONE_VERIFIED'),
            });
          }
        } catch (apiError: any) {
          if (apiError?.code !== 'CORS_ERROR' && typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
            console.error('Error fetching customer profile (background):', apiError);
          }
        }
      })();
      return;
    }

    setIsLoading(false);
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
