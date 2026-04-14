'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef } from 'react';
import { VendorAuth } from '@/components/vendor/VendorAuth';
import { VendorPublicAppShell } from '@/components/vendor/layout/VendorPublicChrome';
import { isTokenExpired, clearVendorSession, isStaleTempVendorSession } from '@/lib/session-utils';

export default function AuthPage() {
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const hasChecked = useRef(false);
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Strict single-run check to prevent flickering
    if (hasChecked.current) {
      return;
    }
    hasChecked.current = true;

    // Clear redirect flag when we're on auth page
    sessionStorage.removeItem('_vendor_redirected_to_auth');

    // Synchronous session check - no async, no delays
    const storedPhone = localStorage.getItem('vendorPhone');
    const storedToken = localStorage.getItem('authToken') || localStorage.getItem('vendorSessionToken');
    
    // If no credentials, show login immediately
    if (!storedPhone || !storedToken || storedToken.length < 10) {
      setIsCheckingSession(false);
      return;
    }

    // Check if token is valid
    if (isTokenExpired(storedToken)) {
      clearVendorSession();
      setIsCheckingSession(false);
      return;
    }

    // Stale temp_vendor_ session (e.g. leftover from previous visit) – clear and show login only when no valid token
    if (isStaleTempVendorSession(storedToken)) {
      clearVendorSession();
      setIsCheckingSession(false);
      return;
    }

    // Valid session exists - redirect based on status
    const storedVendor = localStorage.getItem('vendorData');
    const vendorData = storedVendor ? JSON.parse(storedVendor) : null;
    const onboardingStatus = vendorData?.onboarding_status || localStorage.getItem('vendorApplicationStatus');
    
    // Route based on status
    const isActiveVendor = ['ACTIVATED', 'APPROVED'].includes(onboardingStatus || '');
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
    
    // Store session data (authToken + vendorAuthToken so api-client finds token on first request after redirect)
    if (session.phone && session.accessToken) {
      localStorage.setItem('vendorPhone', session.phone);
      localStorage.setItem('authToken', session.accessToken);
      localStorage.setItem('vendorAuthToken', session.accessToken);
      
      if (session.vendorId) {
        localStorage.setItem('vendorId', session.vendorId);
      }
      if (session.user) {
        localStorage.setItem('vendorUser', JSON.stringify(session.user));
      }
      if (session.profile) {
        localStorage.setItem('vendorData', JSON.stringify(session.profile));
        const bizName = (session.profile as any).business_name || (session.profile as any).businessName || '';
        if (bizName) {
          localStorage.setItem('vendorName', bizName);
          localStorage.setItem('businessName', bizName);
        }
      }
      if (session.onboardingStatus) {
        localStorage.setItem('vendorApplicationStatus', session.onboardingStatus);
      }
    }
    
    // Set session flags immediately before redirect so destination page sees them (avoids redirect back to login)
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('_warmpawz_vendor_just_logged_in', 'true');
      sessionStorage.setItem('_warmpawz_vendor_has_session', 'true');
    }
    
    // Determine routing
    const onboardingStatus = session.onboardingStatus || session.profile?.onboarding_status;
    const isActiveVendor = ['ACTIVATED', 'APPROVED'].includes(onboardingStatus || '');
    
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
