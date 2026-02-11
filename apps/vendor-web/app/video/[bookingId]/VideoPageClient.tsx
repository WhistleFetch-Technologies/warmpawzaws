'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { ChimeVideoCall } from '@/components/vendor/ChimeVideoCall';

interface VideoPageClientProps {
  bookingId?: string;
}

export function VideoPageClient({ bookingId: bookingIdProp }: VideoPageClientProps) {
  const router = useRouter();
  const params = useParams();
  
  // ✅ CRITICAL: Get bookingId from URL path if not in params (for static exports)
  const bookingIdFromPath = typeof window !== 'undefined' 
    ? window.location.pathname.match(/\/video\/([^/?]+)/)?.[1] 
    : null;
  const bookingIdFromQuery = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('bookingId')
    : null;
  const normalizeBookingId = (value?: string | null) => (value && value !== '_' ? value : '');
  const bookingId =
    normalizeBookingId(bookingIdProp) ||
    normalizeBookingId(params?.bookingId as string) ||
    normalizeBookingId(bookingIdFromPath) ||
    normalizeBookingId(bookingIdFromQuery) ||
    '';
  
  const [bookingData, setBookingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string>('');

  // ✅ CRITICAL: Log immediately to verify component is mounting
  console.log('[VideoPageClient] ✅ Component mounted', { 
    bookingId, 
    bookingIdFromPath,
    pathname: typeof window !== 'undefined' ? window.location.pathname : 'SSR',
    search: typeof window !== 'undefined' ? window.location.search : ''
  });

  useEffect(() => {
    console.log('[VideoPageClient] ✅ useEffect running', { 
      bookingId, 
      pathname: typeof window !== 'undefined' ? window.location.pathname : 'SSR',
      search: typeof window !== 'undefined' ? window.location.search : '' 
    });

    let cancelled = false;

    const resolveVendorId = async (): Promise<string> => {
      if (typeof window === 'undefined') {
        console.log('[VideoPageClient] window is undefined (SSR)');
        return '';
      }
      
      // 1. First, try URL query parameter (most reliable after page reload)
      const urlParams = new URLSearchParams(window.location.search);
      const urlVendorId = urlParams.get('vendorId');
      console.log('[VideoPageClient] URL search:', window.location.search, 'vendorId from URL:', urlVendorId);
      
      if (urlVendorId) {
        console.log('[VideoPageClient] ✅ Found vendorId in URL:', urlVendorId);
        // Store it in localStorage for future use
        localStorage.setItem('vendorId', urlVendorId);
        localStorage.setItem('vendor_id', urlVendorId);
        return urlVendorId;
      }
      
      // 2. Fallback to localStorage/sessionStorage
      const storedVendorId =
        localStorage.getItem('vendorId') ||
        localStorage.getItem('vendor_id') ||
        sessionStorage.getItem('vendorId') ||
        sessionStorage.getItem('vendor_id') ||
        (() => {
          // Try to get from vendorData if available
          try {
            const vendorData = localStorage.getItem('vendorData');
            if (vendorData) {
              const parsed = JSON.parse(vendorData);
              return parsed.id || parsed.vendorId || '';
            }
          } catch (e) {
            // Ignore parse errors
          }
          return '';
        })() ||
        '';
      
      if (storedVendorId) {
        console.log('[VideoPageClient] ✅ Found vendorId in storage:', storedVendorId);
        return storedVendorId;
      }

      // 3. Final fallback: fetch profile using auth token (mobile/webview cases)
      try {
        const profile = await apiClient.get<any>('/vendor/profile');
        const fetchedVendorId =
          profile?.vendor?.id ||
          profile?.vendor?.vendorId ||
          profile?.id ||
          profile?.vendorId ||
          '';
        if (fetchedVendorId) {
          localStorage.setItem('vendorId', fetchedVendorId);
          localStorage.setItem('vendor_id', fetchedVendorId);
          return fetchedVendorId;
        }
      } catch (err) {
        console.warn('[VideoPageClient] ❌ Could not fetch vendor profile for ID:', err);
      }

      return '';
    };
    
    const init = async () => {
      const vendorId = await resolveVendorId();
      if (cancelled) return;
      console.log('[VideoPageClient] Final vendorId check:', vendorId ? `✅ Found: ${vendorId}` : '❌ NOT FOUND');
      
      if (vendorId) {
        console.log('[VideoPageClient] ✅ Setting participantId:', vendorId);
        setParticipantId(vendorId);
        // ✅ CRITICAL: Set loading to false immediately so ChimeVideoCall can render
        // Don't wait for booking data - it's not required for video call to start
        setLoading(false);
        
        if (bookingId) {
          // Load booking data in background (non-blocking)
          loadBookingData().catch(err => {
            console.warn('[VideoPageClient] Background booking data load failed:', err);
          });
        }
      } else {
        // If not found, show error immediately (don't retry - URL param is most reliable)
        console.error('[VideoPageClient] ❌ No vendorId found in URL or storage. Redirecting to dashboard.');
        setLoading(false);
        // Redirect to dashboard after a short delay to show error
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 2000);
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [bookingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadBookingData = async () => {
    if (!bookingId) {
      console.log('[VideoPageClient] No bookingId, skipping booking data load');
      return;
    }
    const vid =
      typeof window !== 'undefined'
        ? localStorage.getItem('vendorId') || localStorage.getItem('vendor_id') || sessionStorage.getItem('vendorId') || sessionStorage.getItem('vendor_id') || ''
        : '';
    
    // Set default booking data immediately so we can proceed even if API fails
    setBookingData({
      vendor_name: 'You',
      customer_name: 'Customer',
      service_name: 'Tele Consultation',
    });
    
    // Try to load booking data with timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), 5000)
    );
    
    try {
      console.log('[VideoPageClient] Loading booking data for:', bookingId);
      setError(null);
      const url = vid ? `/bookings/${bookingId}?vendorId=${encodeURIComponent(vid)}` : `/bookings/${bookingId}`;
      
      // Race between API call and timeout
      const response = await Promise.race([
        apiClient.get<any>(url),
        timeoutPromise
      ]) as any;
      
      const booking = response.booking || response;
      if (booking) {
        console.log('[VideoPageClient] ✅ Booking data loaded:', booking);
        setBookingData({
          vendor_name: booking.vendor_name || booking.vendorName || 'You',
          customer_name: booking.customer_name || booking.customerName || 'Customer',
          service_name: booking.service_name || booking.serviceName || 'Tele Consultation',
          ...booking
        });
      }
    } catch (err: any) {
      console.warn('[VideoPageClient] Could not load booking data, using defaults:', err);
      // Keep default booking data that was set above
      // Don't set error - we can still proceed with video call
    }
    // ✅ NOTE: Don't set loading to false here - it's already false, and we don't want to block rendering
  };

  if (!bookingId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
        <div className="text-center p-6 bg-slate-800 rounded-2xl max-w-md">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-2">Invalid link</h2>
          <p className="text-gray-400 mb-4">No booking ID in the URL.</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-6 py-2 bg-[#FF8C42] text-white rounded-full hover:bg-[#FF7A2E] transition"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  // If we have participantId, proceed with video call even if still loading booking data
  // The ChimeVideoCall component can handle missing booking data
  if (participantId) {
    return (
      <ChimeVideoCall
        bookingId={bookingId}
        participantType="vendor"
        participantId={participantId}
        vendorName={bookingData?.vendor_name || bookingData?.vendorName || 'You'}
        customerName={bookingData?.customer_name || bookingData?.customerName || 'Customer'}
        serviceName={bookingData?.service_name || bookingData?.serviceName || 'Tele Consultation'}
        onEndCall={(duration) => {
          console.log('[VideoPageClient] Call ended, navigating to dashboard');
          // Use window.location for reliable navigation in static exports
          window.location.href = '/dashboard';
        }}
      />
    );
  }

  // Show loading only if we don't have participantId yet
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto" />
          <p className="mt-4 text-gray-400">Preparing video call...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="text-center p-6 bg-slate-800 rounded-2xl max-w-md">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-white mb-2">Sign in required</h2>
        <p className="text-gray-400 mb-4">
          Please sign in to the vendor dashboard to join the video call.
        </p>
        <button
          onClick={() => router.push('/auth')}
          className="px-6 py-2 bg-[#FF8C42] text-white rounded-full hover:bg-[#FF7A2E] transition"
        >
          Sign in
        </button>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-3 px-6 py-2 text-gray-400 hover:text-white transition"
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );
}
