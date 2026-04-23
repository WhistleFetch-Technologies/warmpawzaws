'use client';

import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { HomeServiceTrackingManager } from '@/components/vendor/tracking/HomeServiceTrackingManager';
import {
  consumeHomeServiceTrackingReturnHref,
  setSkipWalkAutoLiveTrackerOnce,
} from '@/lib/vendor-live-tracker-nav';

function resolveHomeServiceBookingId(
  pathSegment: string | undefined,
  queryValue: string | null
): string {
  const q = (queryValue || '').trim();
  if (q && q !== 'placeholder') return q;
  const p = (pathSegment || '').trim();
  if (p && p !== 'placeholder') return p;
  return '';
}

/** Planned walk length (minutes) from /details payload — same fields as vendor booking modal. */
function extractPlannedServiceMinutesFromBooking(booking: any): number {
  const svc = booking?.service;
  const candidates = [
    svc?.duration,
    svc?.durationMinutes,
    svc?.duration_minutes,
    booking?.duration,
    booking?.totalDurationMinutes,
    booking?.total_duration_minutes,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 30;
}

export default function HomeServiceTrackingPageClient() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const queryBookingId = searchParams.get('bookingId');
  const bookingId = useMemo(
    () =>
      resolveHomeServiceBookingId(
        typeof params?.bookingId === 'string' ? params.bookingId : undefined,
        queryBookingId
      ),
    [params?.bookingId, queryBookingId]
  );
  
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [bookingData, setBookingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedVendorId = localStorage.getItem('vendorId');
    if (storedVendorId) {
      setVendorId(storedVendorId);
    }

    setError(null);
    setBookingData(null);

    if (bookingId) {
      loadBookingData();
    } else {
      setLoading(false);
      setError('Missing booking id');
    }
  }, [bookingId]);

  const loadBookingData = async () => {
    try {
      setLoading(true);
      // Must use /details: plain /vendor/bookings/:id is the list-by-vendor route (id = vendorId), not booking.
      const response = await apiClient.get<any>(`/vendor/bookings/${encodeURIComponent(bookingId)}/details`);
      
      if (response.success && response.booking) {
        const booking = response.booking;
        
        // Determine if this is a walker/sitter session requiring special tracking
        const serviceTypeLower = (booking.serviceType || booking.service_type || '').toLowerCase();
        const serviceNameLower = (
          booking.serviceName ||
          booking.service_name ||
          ''
        ).toLowerCase();
        const vendorNameLower = String(
          booking.vendorName ||
            booking.vendor_name ||
            booking.vendor?.business_name ||
            booking.vendor?.businessName ||
            ''
        ).toLowerCase();
        const isWalkerSession =
          serviceTypeLower.includes('walk') ||
          serviceTypeLower === 'walking' ||
          serviceNameLower.includes('walk') ||
          serviceNameLower.includes('walking') ||
          vendorNameLower.includes('walker') ||
          vendorNameLower.includes('dog walk');
        const isSitterSession =
          serviceTypeLower.includes('sit') ||
          serviceTypeLower === 'sitting' ||
          serviceNameLower.includes('sit') ||
          serviceNameLower.includes('sitting');

        // Same minutes as vendor /details service object (e.g. 30 / 60 / 90 min Extended Dog Walk).
        const rawPlan = extractPlannedServiceMinutesFromBooking(booking);
        const plannedWalkDurationMinutes = Math.min(1440, Math.max(5, Math.round(rawPlan) || 30));
        
        setBookingData({
          customerName: booking.customerName || booking.customer_name || 'Customer',
          customerPhone: booking.customerPhone || booking.customer_phone || '',
          petName: booking.petName || booking.pet_name || 'Pet',
          serviceName: booking.serviceName || booking.service_name || 'Home Service',
          serviceType: booking.serviceType || booking.service_type,
          address: booking.address || booking.location || '',
          latitude: booking.latitude,
          longitude: booking.longitude,
          scheduledTime: booking.scheduledTime || booking.booking_time || '',
          isWalkerSession,
          isSitterSession,
          packageSessionId: booking.packageSessionId || booking.package_session_id,
          bookingStatus: booking.status || booking.bookingStatus,
          plannedWalkDurationMinutes,
          sessionStartedAt:
            booking.sessionStartedAt ||
            booking.session_started_at ||
            booking.startedAt ||
            booking.started_at ||
            null,
        });
      } else {
        setError('Booking not found');
      }
    } catch (err: any) {
      console.error('Error loading booking:', err);
      setError(err.message || 'Failed to load booking');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setSkipWalkAutoLiveTrackerOnce();
    router.push(consumeHomeServiceTrackingReturnHref());
  };

  const handleComplete = (_result: any) => {
    setSkipWalkAutoLiveTrackerOnce();
    const base = consumeHomeServiceTrackingReturnHref();
    const qIdx = base.indexOf('?');
    const pathPart = qIdx === -1 ? base : base.slice(0, qIdx);
    const queryPart = qIdx === -1 ? '' : base.slice(qIdx + 1);
    const u = new URLSearchParams(queryPart);
    u.set('completed', String(bookingId));
    const q = u.toString();
    router.push(q ? `${pathPart}?${q}` : `${pathPart}?completed=${encodeURIComponent(String(bookingId))}`);
  };

  if (loading) {
    return (
      <div className="vendor-app-column flex min-h-[100dvh] min-h-screen flex-col items-center justify-center bg-[#FFF5F1] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#FF8C42] border-t-transparent" />
        <p className="mt-4 text-sm font-medium text-gray-600">Loading booking…</p>
      </div>
    );
  }

  if (error || !vendorId || !bookingData) {
    return (
      <div className="vendor-app-column flex min-h-[100dvh] min-h-screen flex-col bg-[#FFF5F1] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mx-auto w-full max-w-md rounded-t-[40px] bg-white px-6 py-10 text-center shadow-[0_-10px_40px_rgba(0,0,0,0.04)]">
          <p className="text-sm font-semibold text-red-600">{error || 'Unable to load booking'}</p>
          <button
            type="button"
            onClick={handleBack}
            className="mt-6 w-full rounded-xl bg-[#FF8C42] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#FF7A2E]"
          >
            Back to bookings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] min-h-screen bg-[#FFF5F1]">
      <HomeServiceTrackingManager
        vendorId={vendorId}
        bookingId={bookingId}
        bookingData={bookingData}
        onBack={handleBack}
        onComplete={handleComplete}
      />
    </div>
  );
}
