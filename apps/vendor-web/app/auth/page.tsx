'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef } from 'react';
import { VendorAuth } from '@/components/vendor/VendorAuth';
import { VendorPublicAppShell } from '@/components/vendor/layout/VendorPublicChrome';
import {
  applyVendorPortalSessionFromVerifyPayload,
  guessCountryCodeFromPhone,
  isVendorPortalActiveStatus,
} from '@/lib/vendor-session-from-api';
import {
  clearVendorSession,
  getStoredVendorJwtForSession,
  hasRecoverableVendorSession,
} from '@/lib/session-utils';

export default function AuthPage() {
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const hasRedirected = useRef(false);

  useEffect(() => {
    sessionStorage.removeItem('_vendor_redirected_to_auth');

    const finish = () => setIsCheckingSession(false);

    void (async () => {
      const storedPhone = localStorage.getItem('vendorPhone');
      const storedToken = getStoredVendorJwtForSession();

      if (!storedPhone || (!storedToken && !hasRecoverableVendorSession())) {
        finish();
        return;
      }

      if (!hasRecoverableVendorSession()) {
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

      window.location.replace(isVendorPortalActiveStatus(onboardingStatus) ? '/' : '/onboarding');
    })();
  }, []);

  const handleAuthSuccess = (session: any) => {
    if (hasRedirected.current) return;
    hasRedirected.current = true;

    if (session.phone && session.accessToken) {
      const onboardingStatus =
        session.onboardingStatus || session.profile?.onboarding_status || 'INIT';
      applyVendorPortalSessionFromVerifyPayload({
        phone: session.phone,
        accessToken: session.accessToken,
        idToken: session.idToken,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
        user: session.user || {},
        profile: session.profile || {},
        vendorId: session.vendorId || '',
        onboardingStatus,
        countryCode: guessCountryCodeFromPhone(session.phone),
      });
    }

    const onboardingStatus = session.onboardingStatus || session.profile?.onboarding_status;
    window.location.replace(isVendorPortalActiveStatus(onboardingStatus) ? '/' : '/onboarding');
  };

  if (isCheckingSession) {
    return (
      <VendorPublicAppShell>
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" />
          <p className="text-gray-600">Checking session...</p>
        </div>
      </VendorPublicAppShell>
    );
  }

  return (
    <VendorPublicAppShell>
      <VendorAuth onAuthSuccess={handleAuthSuccess} usePublicAppShell />
    </VendorPublicAppShell>
  );
}
