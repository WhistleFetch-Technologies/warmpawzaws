'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { VendorApp } from '@/components/vendor/VendorApp';

interface VendorSession {
  phone: string;
  vendorId?: string;
  vendor?: any;
  sessionToken?: string;
  verified: boolean;
  isStaffLogin?: boolean;
  staff?: any;
}

export default function VendorHomePage() {
  const router = useRouter();
  const [session, setSession] = useState<VendorSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // ✅ FIX: Prevent infinite loader - add timeout and better error handling
    const checkSession = async () => {
      try {
        // Wait for next tick to ensure DOM is ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Get session data from localStorage
        const storedPhone = localStorage.getItem('vendorPhone');
        const storedToken = localStorage.getItem('authToken') || localStorage.getItem('vendorSessionToken');
        const storedVendor = localStorage.getItem('vendorData');
        const storedVendorId = localStorage.getItem('vendorId');

        // Check token validity if token exists
        if (storedToken) {
          const { isTokenExpired } = require('@/lib/session-utils');
          if (isTokenExpired(storedToken)) {
            // Token expired, clear and redirect
            const { clearVendorSession } = require('@/lib/session-utils');
            clearVendorSession();
            
            // ✅ FIX: Clear redirect flag and redirect (only once per session)
            const redirectKey = '_vendor_redirected_to_auth';
            if (!sessionStorage.getItem(redirectKey)) {
              sessionStorage.setItem(redirectKey, 'true');
              setIsLoading(false); // Clear loading before redirect
              if (typeof window !== 'undefined') {
                window.location.href = '/auth';
              }
            } else {
              // Already redirected, just clear loading
              setIsLoading(false);
            }
            return;
          }
        }

        if (storedPhone && storedToken) {
          const vendorData = storedVendor ? JSON.parse(storedVendor) : null;
          
          // Clear redirect flag if we have a valid session
          sessionStorage.removeItem('_vendor_redirected_to_auth');
          
          setSession({
            phone: storedPhone,
            sessionToken: storedToken,
            verified: true,
            vendor: vendorData,
            vendorId: storedVendorId || vendorData?.id
          });
          setIsLoading(false);
        } else {
          // No valid session - redirect to auth
          // ✅ FIX: Only redirect if we haven't already set the flag
          const redirectKey = '_vendor_redirected_to_auth';
          if (!sessionStorage.getItem(redirectKey)) {
            sessionStorage.setItem(redirectKey, 'true');
            setIsLoading(false); // Clear loading before redirect
            
            // ✅ FIX: Use window.location for reliable redirect
            if (typeof window !== 'undefined') {
              window.location.href = '/auth';
            }
          } else {
            // Flag already set, just clear loading state
            // This prevents infinite loading if redirect somehow failed
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error('Error checking session:', error);
        // ✅ FIX: Always clear loading state on error
        setIsLoading(false);
        
        // On error, redirect to auth as fallback
        const redirectKey = '_vendor_redirected_to_auth';
        if (!sessionStorage.getItem(redirectKey)) {
          sessionStorage.setItem(redirectKey, 'true');
          if (typeof window !== 'undefined') {
            window.location.href = '/auth';
          }
        }
      }
    };

    // ✅ FIX: Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        console.warn('⚠️ [VendorHomePage] Session check timeout, clearing loading state');
        setIsLoading(false);
      }
    }, 5000); // 5 second timeout

    checkSession();

    return () => {
      clearTimeout(timeoutId);
    };
  }, [router, isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null; // Will redirect to /auth
  }

  return <VendorApp initialSession={session} />;
}
