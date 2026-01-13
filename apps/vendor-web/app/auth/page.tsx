'use client';

export const dynamic = 'force-dynamic';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { VendorAuth } from '@/components/vendor/VendorAuth';

export default function AuthPage() {
  const router = useRouter();
  const pathname = usePathname();
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const hasRedirected = useRef(false); // Prevent multiple redirects

  useEffect(() => {
    // Only check session once on mount
    if (hasRedirected.current) return;

    // Initialize session (clears on hard refresh)
    const { initializeSession, isTokenExpired } = require('@/lib/session-utils');
    initializeSession();

    // Check if user is already authenticated
    const checkSession = () => {
      try {
        const storedPhone = localStorage.getItem('vendorPhone');
        const storedToken = localStorage.getItem('authToken') || localStorage.getItem('vendorSessionToken');
        
        if (storedPhone && storedToken) {
          // Check token expiry
          if (!isTokenExpired(storedToken) && storedToken.length > 10) {
            // User is already authenticated, redirect to onboarding
            hasRedirected.current = true;
            router.replace('/onboarding');
            return;
          } else {
            // Token expired or invalid, clear stale data
            const { clearVendorSession } = require('@/lib/session-utils');
            clearVendorSession();
          }
        }
        
        // No valid session found, show auth UI
        setIsCheckingSession(false);
      } catch (error) {
        console.error('Error checking session:', error);
        setIsCheckingSession(false);
      }
    };

    // Add small delay to ensure localStorage is available
    const timer = setTimeout(checkSession, 100);
    
    return () => clearTimeout(timer);
  }, [router]);

  const handleAuthSuccess = (session: any) => {
    console.log('✅ [AuthPage] Authentication successful:', session);
    
    // Prevent redirect loop
    if (hasRedirected.current) {
      console.warn('⚠️ [AuthPage] Already redirected, ignoring duplicate call');
      return;
    }
    
    // Mark as redirected to prevent loops
    hasRedirected.current = true;
    
    // Store session data immediately if not already stored
    if (session.phone && session.accessToken) {
      localStorage.setItem('vendorPhone', session.phone);
      localStorage.setItem('authToken', session.accessToken);
      
      if (session.vendorId) {
        localStorage.setItem('vendorId', session.vendorId);
      }
      
      if (session.user) {
        localStorage.setItem('vendorUser', JSON.stringify(session.user));
      }
      
      if (session.profile) {
        localStorage.setItem('vendorData', JSON.stringify(session.profile));
      }
      
      if (session.onboardingStatus) {
        localStorage.setItem('vendorApplicationStatus', session.onboardingStatus);
      }
      
      console.log('💾 [AuthPage] Session data stored directly:', {
        phone: session.phone,
        token: session.accessToken?.substring(0, 30) + '...',
        vendorId: session.vendorId
      });
    }
    
    // Verify session was stored before redirecting
    const storedPhone = localStorage.getItem('vendorPhone');
    const storedToken = localStorage.getItem('authToken');
    
    console.log('🔍 [AuthPage] Verifying session storage:', {
      storedPhone: !!storedPhone,
      storedToken: !!storedToken,
      tokenPreview: storedToken ? storedToken.substring(0, 30) + '...' : 'none'
    });
    
    if (!storedPhone || !storedToken) {
      console.error('❌ [AuthPage] Session not stored properly!', {
        phone: storedPhone,
        token: storedToken,
        session: session
      });
      // Wait a bit more and try again
      setTimeout(() => {
        const retryPhone = localStorage.getItem('vendorPhone');
        const retryToken = localStorage.getItem('authToken');
        if (retryPhone && retryToken) {
          console.log('✅ [AuthPage] Session found on retry, redirecting...');
          router.replace('/onboarding');
        } else {
          console.error('❌ [AuthPage] Session still not found, redirecting anyway...');
          router.replace('/onboarding');
        }
      }, 200);
      return;
    }
    
    // Check state from backend response to route appropriately
    // Backend returns: { data: { state: 'new' | 'existing', profile: {...} } }
    // Also check onboardingStatus from VendorAuth component
    const responseState = session.state || session.data?.state;
    const onboardingStatus = session.onboardingStatus || session.profile?.onboarding_status || session.data?.profile?.onboarding_status;
    
    console.log('🔄 [AuthPage] Routing decision:', {
      state: responseState,
      onboardingStatus,
      vendorId: session.vendorId,
      sessionKeys: Object.keys(session)
    });
    
    // Route based on state and onboarding status
    // For active vendors, go directly to home page (which shows dashboard)
    if (onboardingStatus === 'ACTIVATED' || (responseState === 'existing' && session.vendorId && !onboardingStatus)) {
      // Existing active vendor - go directly to home (dashboard)
      console.log('✅ [AuthPage] Active vendor - routing to home (dashboard)');
      router.replace('/');
    } else {
      // All other cases - go to onboarding (which will route based on status)
      console.log('🔄 [AuthPage] Routing to onboarding (status:', onboardingStatus, ')');
      router.replace('/onboarding');
    }
  };

  // Show loading while checking session
  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking session...</p>
        </div>
      </div>
    );
  }

  // Render the authentication UI (OTP flow)
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
      <VendorAuth onAuthSuccess={handleAuthSuccess} />
    </div>
  );
}

