'use client';

export const dynamic = 'force-dynamic';

import nextDynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { isTokenExpired, clearVendorSession, isStaleTempVendorSession } from '@/lib/session-utils';

const VendorApp = nextDynamic(
  () => import('@/components/vendor/landingPage/VendorApp').then((m) => ({ default: m.VendorApp })),
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

  useEffect(() => {
    // ✅ CRITICAL: Don't render this page if we're on a video route
    // Static hosting can route all paths to root HTML; force redirect to /video with query param fallback.
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      const isVideoRoute = pathname === '/video' || pathname.startsWith('/video/');
      if (isVideoRoute) {
        console.log('[VendorHomePage] Skipping render - on video route:', pathname);
        try {
          const parts = pathname.split('/').filter(Boolean);
          const bookingIdFromPath = parts[1] || '';
          const url = new URL(window.location.href);
          if (bookingIdFromPath && bookingIdFromPath !== '_' && pathname !== '/video') {
            url.pathname = '/video';
            url.searchParams.set('bookingId', bookingIdFromPath);
          }
          // Preserve vendorId / meetingId if already present
          if (!url.searchParams.get('vendorId')) {
            const storedVendorId = localStorage.getItem('vendorId') || localStorage.getItem('vendor_id');
            if (storedVendorId) {
              url.searchParams.set('vendorId', storedVendorId);
            }
          }
          if (url.pathname === '/video' && window.location.pathname !== '/video') {
            window.location.replace(url.pathname + url.search);
            return;
          }
        } catch (err) {
          console.warn('[VendorHomePage] Video route redirect failed:', err);
        }
        return; // Don't render anything, let the video page handle it
      }
    }

    const bootstrap =
      typeof sessionStorage !== 'undefined' &&
      sessionStorage.getItem('_warmpawz_vendor_just_logged_in') === 'true';

    const readSession = () => ({
      phone: localStorage.getItem('vendorPhone'),
      token: localStorage.getItem('authToken') || localStorage.getItem('vendorSessionToken'),
    });

    const trySession = (attempt: number) => {
      const { phone: storedPhone, token: storedToken } = readSession();

      // After /session/from-admin, storage is synchronous; retry briefly for Strict Mode / static shell edge cases
      if (
        (!storedPhone || !storedToken || storedToken.length < 10) &&
        bootstrap &&
        attempt < 8
      ) {
        window.setTimeout(() => trySession(attempt + 1), 40);
        return;
      }

      if (!storedPhone || !storedToken || storedToken.length < 10) {
        window.location.replace('/auth');
        return;
      }

      if (isTokenExpired(storedToken)) {
        clearVendorSession();
        window.location.replace('/auth');
        return;
      }

      if (isStaleTempVendorSession(storedToken)) {
        clearVendorSession();
        window.location.replace('/auth');
        return;
      }

      let vendorData: Record<string, unknown> | null = null;
      try {
        const storedVendor = localStorage.getItem('vendorData');
        vendorData = storedVendor ? (JSON.parse(storedVendor) as Record<string, unknown>) : null;
      } catch {
        vendorData = null;
      }

      const storedVendorId = localStorage.getItem('vendorId');

      sessionStorage.removeItem('_vendor_redirected_to_auth');

      setSession({
        phone: storedPhone,
        sessionToken: storedToken,
        verified: true,
        vendor: vendorData,
        vendorId: storedVendorId || (vendorData?.id as string | undefined),
      });
      setIsLoading(false);
    };

    trySession(0);
  }, []); // Empty dependency - run once

  // ✅ CRITICAL: Don't render if we're on a video route
  if (typeof window !== 'undefined' && (window.location.pathname === '/video' || window.location.pathname.startsWith('/video/'))) {
    console.log('[VendorHomePage] Returning null - on video route');
    return null; // Let the video page render
  }

  if (isLoading) {
    return (
      <div className="vendor-page-shell flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
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
