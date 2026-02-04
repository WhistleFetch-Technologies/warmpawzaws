'use client';

export const dynamic = 'force-dynamic';

import nextDynamic from 'next/dynamic';
import { useEffect, useState, useRef } from 'react';
import { isTokenExpired, clearVendorSession, isStaleTempVendorSession } from '@/lib/session-utils';

const VendorApp = nextDynamic(
  () => import('@/components/vendor/VendorApp').then((m) => ({ default: m.VendorApp })),
  { ssr: false }
);

interface VendorSession {
  phone: string;
  vendorId?: string;
  vendor?: any;
  sessionToken?: string;
  verified: boolean;
}

export default function VendorHomePage() {
  const [session, setSession] = useState<VendorSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasChecked = useRef(false); // ✅ FIX: Single check flag

  useEffect(() => {
    // ✅ CRITICAL: Don't render this page if we're on a video route
    // Next.js static export might route all paths to root page
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      if (pathname.startsWith('/video/')) {
        console.log('[VendorHomePage] Skipping render - on video route:', pathname);
        return; // Don't render anything, let the video page handle it
      }
    }

    // Run session check on every mount so Strict Mode remount still gets session (avoids stuck loading)
    hasChecked.current = true;

    // Synchronous session check
    const storedPhone = localStorage.getItem('vendorPhone');
    const storedToken = localStorage.getItem('authToken') || localStorage.getItem('vendorSessionToken');
    
    // No session - redirect to auth
    if (!storedPhone || !storedToken || storedToken.length < 10) {
      window.location.replace('/auth');
      return;
    }
    
    // Token expired - clear and redirect
    if (isTokenExpired(storedToken)) {
      clearVendorSession();
      window.location.replace('/auth');
      return;
    }

    // Stale temp_vendor_ session – clear and show auth so user gets actual prompt (only when no valid token)
    if (isStaleTempVendorSession(storedToken)) {
      clearVendorSession();
      window.location.replace('/auth');
      return;
    }
    
    // Valid session - set up the app
    const storedVendor = localStorage.getItem('vendorData');
    const storedVendorId = localStorage.getItem('vendorId');
    const vendorData = storedVendor ? JSON.parse(storedVendor) : null;
    
    // Clear any stale redirect flags
    sessionStorage.removeItem('_vendor_redirected_to_auth');
    
    // Set session and show app
    setSession({
      phone: storedPhone,
      sessionToken: storedToken,
      verified: true,
      vendor: vendorData,
      vendorId: storedVendorId || vendorData?.id
    });
    setIsLoading(false);
  }, []); // Empty dependency - run once

  // ✅ CRITICAL: Don't render if we're on a video route
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/video/')) {
    console.log('[VendorHomePage] Returning null - on video route');
    return null; // Let the video page render
  }

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
