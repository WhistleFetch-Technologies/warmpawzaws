'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiClient, getApiBaseUrl } from '@/lib/api-client';
import { ChimeVideoCall } from '@/components/vendor/teleCommunication/ChimeVideoCall';

interface VideoPageClientProps {
  bookingId?: string;
}

const normalizeBookingId = (value?: string | null) => (value && value !== '_' ? value : '');

export function VideoPageClient({ bookingId: bookingIdProp }: VideoPageClientProps) {

  //---------------------------hooks and state management------------------------------//
  const router = useRouter();
  const params = useParams();

  const [resolvedBookingId, setResolvedBookingId] = useState('');
  const [hasMounted, setHasMounted] = useState(false);
  const [bookingData, setBookingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string>('');
  const [waitingForPayment, setWaitingForPayment] = useState(false);
  const [paymentReceived, setPaymentReceived] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const sseRef = useRef<EventSource | null>(null);


  const bookingId = hasMounted ? resolvedBookingId : (normalizeBookingId(bookingIdProp) || normalizeBookingId(params?.bookingId as string) || '');


  //---------------------------useEffect hooks------------------------------//

  {/* Resolve bookingId from props, params, or URL only after mount (same on server and first client paint = '') */ }
  useEffect(() => {
    setHasMounted(true);
    const fromPath = typeof window !== 'undefined' ? window.location.pathname.match(/\/video\/([^/?]+)/)?.[1] : null;
    const fromQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('bookingId') : null;
    const id =
      normalizeBookingId(bookingIdProp) ||
      normalizeBookingId(params?.bookingId as string) ||
      normalizeBookingId(fromPath) ||
      normalizeBookingId(fromQuery) ||
      '';
    setResolvedBookingId(id);

    // ✅ Detect waitingForPayment flag from URL
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('waitingForPayment') === 'true') {
        const checkBookingStatus = async () => {
          try {
            const vendorId = localStorage.getItem('vendorId') || localStorage.getItem('vendor_id') || '';
            const url = vendorId ? `/vendor/bookings/${id}/details` : `/bookings/${id}`;
            const response = await apiClient.get<any>(url);
            const booking = response.booking || response.data || response;
            console.log('[VideoPageClient]:', booking);
            if (booking?.status === 'confirmed' && booking?.
              paymentStatus
              === 'paid') {
              setPaymentReceived(true);
              setWaitingForPayment(false);
              const newUrl = new URL(window.location.href);
              newUrl.searchParams.delete('waitingForPayment');
              window.history.replaceState({}, '', newUrl.toString());
            } else if (booking?.status === 'confirmed' && booking?.
              paymentStatus
              === 'pending') {
              setWaitingForPayment(true);
            } else {
              console.log('[VideoPageClient] Booking status:', booking, 'Payment status:', booking?.
                paymentStatus
              );
              setWaitingForPayment(false);
            }
          } catch (err) {
            console.warn('[VideoPageClient] Could not verify booking status, defaulting to URL param:', err);
          }

        }
        void checkBookingStatus();

      } else {
        console.log('[VideoPageClient] No waitingForPayment flag found in URL');
        setWaitingForPayment(false);
      }
    }
  }, [bookingIdProp, params?.bookingId]);



  {/*Init effect - must run on every render (Rules of Hooks)*/ }
  useEffect(() => {
    if (!hasMounted) {
      return () => { };
    }
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

      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('vendorId') || urlParams.get('customerId')) {
        const pathOnly = window.location.pathname;
        window.history.replaceState({}, '', pathOnly);
      }

      // 1. localStorage/sessionStorage (never put vendorId in the URL — leaks in screenshots/referrers)
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

      // 2. Fetch profile using auth token (mobile/webview cases)
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
        console.error('[VideoPageClient] ❌ No vendorId found in storage or profile. Redirecting to dashboard.');
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
  }, [bookingId, hasMounted]); // eslint-disable-line react-hooks/exhaustive-deps



  {/* Tele V3: SSE stream to listen for customer payment completion*/ }
  useEffect(() => {
    if (!waitingForPayment || !bookingId || paymentReceived) return;

    const apiBase = getApiBaseUrl();
    const sseUrl = `${apiBase}/vendor/tele/instant-stream/${bookingId}`;
    console.log('[VideoPageClient] 🔌 Connecting to vendor SSE stream:', sseUrl);

    const eventSource = new EventSource(sseUrl);
    sseRef.current = eventSource;

    eventSource.addEventListener('payment_completed', (event: MessageEvent) => {
      console.log('[VideoPageClient] ✅ Payment completed!', event.data);
      setPaymentReceived(true);
      setWaitingForPayment(false);
      eventSource.close();
    });

    eventSource.addEventListener('status_update', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[VideoPageClient] 📋 Status update:', data);
        if (data.status === 'confirmed' && data.paymentStatus === 'paid') {
          console.log('[VideoPageClient] ✅ Payment confirmed via status_update!');
          setPaymentReceived(true);
          setWaitingForPayment(false);
          eventSource.close();
        }
      } catch (err) {
        console.warn('[VideoPageClient] Could not parse status_update:', err);
      }
    });

    eventSource.addEventListener('booking_update', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[VideoPageClient] 📋 Booking update:', data);
        if (data.status === 'confirmed' || data.payment_status === 'paid') {
          setPaymentReceived(true);
          setWaitingForPayment(false);
          eventSource.close();
        }
      } catch (err) {
        console.warn('[VideoPageClient] Could not parse booking_update:', err);
      }
    });

    eventSource.onerror = (err) => {
      console.warn('[VideoPageClient] SSE error:', err);
    };

    return () => {
      eventSource.close();
      sseRef.current = null;
    };
  }, [waitingForPayment, bookingId, paymentReceived]);


  //---------------------------rendering the components------------------------------//

  {/* If not mounted, show loading screen */ }
  if (!hasMounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto" />
          <p className="mt-4 text-gray-400">Preparing video call...</p>
        </div>
      </div>
    );
  }

  {/* If no bookingId, show invalid link screen */ }
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

  //---------------------------helper functions------------------------------//
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
      // Use vendor-specific endpoint when we have vendorId (avoids 404 from GET /bookings/:id auth)
      const url = vid ? `/vendor/bookings/${bookingId}/details` : `/bookings/${bookingId}`;

      // Race between API call and timeout
      const response = await Promise.race([
        apiClient.get<any>(url),
        timeoutPromise
      ]) as any;

      const booking = response.booking || response.data || response;
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

  { /* Show loading only if we don't have participantId yet*/ }
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

  {/* Show "Waiting for payment" screen before video call starts */ }
  if (participantId && waitingForPayment && !paymentReceived) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
        <div className="text-center p-8 bg-slate-800 rounded-2xl max-w-md w-full shadow-2xl">
          {/* Animated waiting indicator */}
          <div className="relative mx-auto mb-6 w-24 h-24">
            <div className="absolute inset-0 rounded-full border-4 border-amber-400/30 animate-ping" />
            <div className="absolute inset-2 rounded-full border-4 border-amber-400/50 animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-12 h-12 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
              </svg>
            </div>
          </div>

          <h2 className="text-xl font-bold text-white mb-2">Waiting for Payment</h2>
          <p className="text-gray-400 mb-6">
            The customer is completing payment.<br />
            The video call will start automatically once payment is confirmed.
          </p>

          {/* Booking info */}
          {bookingData && (
            <div className="bg-slate-700/50 rounded-xl p-4 mb-6 text-left">
              <div className="flex items-center gap-2 text-sm text-gray-300 mb-1">
                <span className="font-medium text-white">{bookingData.customer_name || bookingData.customerName || 'Customer'}</span>
              </div>
              <div className="text-sm text-gray-400">
                {bookingData.service_name || bookingData.serviceName || 'Tele Consultation'}
              </div>
            </div>
          )}

          {/* Animated dots */}
          <div className="flex items-center justify-center gap-1.5 mb-6">
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>

          <button
            onClick={async () => {
              if (isCancelling) return;

              setIsCancelling(true);
              try {
                // Close SSE connection
                sseRef.current?.close();

                // Call cancel endpoint
                const response = await apiClient.post<any>(`/vendor/tele/instant-cancel/${bookingId}`, {});

                if (response.success) {
                  console.log('[VideoPageClient] ✅ Booking cancelled successfully');
                  alert(response.message || 'Booking cancelled successfully. Customer will be notified.');
                  window.location.href = '/dashboard';
                } else {
                  console.error('[VideoPageClient] ❌ Failed to cancel booking:', response.error);
                  alert(response.error || 'Failed to cancel booking. Please try again.');
                  setIsCancelling(false);
                }
              } catch (error: any) {
                console.error('[VideoPageClient] ❌ Error cancelling booking:', error);
                alert(error.message || 'An error occurred while cancelling. Please try again.');
                setIsCancelling(false);
              }
            }}
            disabled={isCancelling}
            className="px-6 py-2 text-gray-400 hover:text-white transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCancelling ? 'Cancelling...' : 'Cancel & return to dashboard'}
          </button>
        </div>
      </div>
    );
  }



  {/* If we have participantId, proceed with video call even if still loading booking data
   The ChimeVideoCall component can handle missing booking data*/ }
  if (participantId) {
    return (
      <div className="min-h-[100dvh] h-[100dvh] max-h-[100dvh] overflow-hidden bg-slate-900">
      <ChimeVideoCall
        bookingId={bookingId}
        participantType="vendor"
        participantId={participantId}
        vendorName={bookingData?.vendor_name || bookingData?.vendorName || 'You'}
        customerName={bookingData?.customer_name || bookingData?.customerName || 'Customer'}
        serviceName={bookingData?.service_name || bookingData?.serviceName || 'Tele Consultation'}
        onEndCall={async (duration) => {
          console.log('[VideoPageClient] Call ended, marking notifications as read');

          // Mark all call notifications for this booking as read when call ends
          if (bookingId) {
            try {
              const vendorId = typeof window !== 'undefined'
                ? localStorage.getItem('vendorId') || localStorage.getItem('vendor_id') || ''
                : '';

              if (vendorId) {
                // Fetch unread call notifications for this booking
                const notificationsResponse = await apiClient.get<any>(
                  `/notifications?userId=${vendorId}&userType=vendor&isRead=false`
                );

                if (notificationsResponse?.success && notificationsResponse?.notifications) {
                  const callTypes = ['tele_call_incoming', 'tele_customer_waiting', 'tele_instant_incoming'];
                  const bookingNotifications = notificationsResponse.notifications.filter((n: any) => {
                    const isCallType = callTypes.includes(n.notification_type || n.type);
                    const notificationData = typeof n.data === 'string' ? JSON.parse(n.data) : n.data || {};
                    return isCallType && notificationData.booking_id === bookingId;
                  });

                  // Mark all related notifications as read
                  for (const notification of bookingNotifications) {
                    const notificationId = notification.id || notification.notificationId || notification.notification_id;
                    if (notificationId) {
                      await apiClient.put(`/notifications/${notificationId}/read`, {}).catch(() => {
                        // Silent fail - notification might already be read
                      });
                    }
                  }

                  console.log(`[VideoPageClient] ✅ Marked ${bookingNotifications.length} notification(s) as read`);
                }
              }
            } catch (err) {
              console.warn('[VideoPageClient] Failed to mark notifications as read on call end:', err);
            }
          }

          // Navigate to dashboard
          window.location.href = '/dashboard';
        }}
      />
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
