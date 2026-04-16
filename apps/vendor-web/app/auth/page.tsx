'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef } from 'react';
import { VendorAuth } from '@/components/vendor/VendorAuth';
import { VendorPublicAppShell } from '@/components/vendor/layout/VendorPublicChrome';
import { isTokenExpired, clearVendorSession, isStaleTempVendorSession } from '@/lib/session-utils';
import {
  applyVendorPortalSessionFromVerifyPayload,
  guessCountryCodeFromPhone,
  isVendorPortalActiveStatus,
} from '@/lib/vendor-session-from-api';

export default function AuthPage() {
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Clear redirect flag when we're on auth page
    sessionStorage.removeItem('_vendor_redirected_to_auth');

    const finish = () => setIsCheckingSession(false);

    const storedPhone = localStorage.getItem('vendorPhone');
    const storedToken = localStorage.getItem('authToken') || localStorage.getItem('vendorSessionToken');

    if (!storedPhone || !storedToken || storedToken.length < 10) {
      finish();
      return;
    }

    if (isTokenExpired(storedToken)) {
      clearVendorSession();
      finish();
      return;
    }

    if (isStaleTempVendorSession(storedToken)) {
      clearVendorSession();
      finish();
      return;
    }

    let vendorData: Record<string, unknown> | null = null;
    try {
      const storedVendor = localStorage.getItem('vendorData');
      vendorData = storedVendor ? (JSON.parse(storedVendor) as Record<string, unknown>) : null;
    } catch {
      vendorData = null;
    }

    const onboardingStatus =
      (vendorData?.onboarding_status as string | undefined) ||
      (vendorData?.onboardingStatus as string | undefined) ||
      localStorage.getItem('vendorApplicationStatus');

    const isActiveVendor = isVendorPortalActiveStatus(onboardingStatus);
    // Do not use a "hasChecked" early-return: React Strict Mode runs effects twice; skipping the second
    // run left isCheckingSession true forever ("Checking session..." with no redirect).
    window.location.replace(isActiveVendor ? '/' : '/onboarding');
  }, []);

  const handleAuthSuccess = (session: any) => {
    console.log('✅ [AuthPage] Authentication successful:', session);
    
    // Prevent duplicate redirects
    if (hasRedirected.current) {
      console.warn('⚠️ [AuthPage] Already redirected, ignoring duplicate call');
      return;
    }
    hasRedirected.current = true;
    
    if (session.phone && session.accessToken) {
      const onboardingStatus =
        session.onboardingStatus || session.profile?.onboarding_status || 'INIT';
      applyVendorPortalSessionFromVerifyPayload({
        phone: session.phone,
        accessToken: session.accessToken,
        user: session.user || {},
        profile: session.profile || {},
        vendorId: session.vendorId || '',
        onboardingStatus,
        countryCode: guessCountryCodeFromPhone(session.phone),
      });
    }
    
    // Determine routing
    const onboardingStatus = session.onboardingStatus || session.profile?.onboarding_status;
    const isActiveVendor = isVendorPortalActiveStatus(onboardingStatus);
    
    // Use window.location.replace for clean navigation
    window.location.replace(isActiveVendor ? '/' : '/onboarding');
  };

  // Show loading while checking session
  if (isCheckingSession) {
    return (
      <VendorPublicAppShell>
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-orange-500" />
            <p className="mt-4 text-gray-600">Checking session...</p>
          </div>
        </div>
      </VendorPublicAppShell>
    );
  }

  return (
    <VendorPublicAppShell>
      <VendorAuth usePublicAppShell onAuthSuccess={handleAuthSuccess} />
    </VendorPublicAppShell>
  );
}
