'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import {
  getResolvedCustomerId,
  isCustomerDatabaseUuid,
  persistCustomerDatabaseId,
} from '@/lib/customer-id-storage';
import { ChimeVideoCall } from '@/components/teleCommunication/ChimeVideoCall';
import { goBackOrHome } from '@/lib/go-back-or-replace';

interface VideoPageClientProps {
  bookingId?: string;
}

export function VideoPageClient({ bookingId: bookingIdProp }: VideoPageClientProps) {
  const router = useRouter();

  const bookingIdFromPath =
    typeof window !== 'undefined'
      ? window.location.pathname.match(/\/video\/([^/?]+)/)?.[1]
      : null;
  const bookingIdFromQuery =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('bookingId')
      : null;
  const normalizeBookingId = (value?: string | null) =>
    value && value !== '_' && value !== 'placeholder' ? value : '';
  const bookingId =
    normalizeBookingId(bookingIdProp) ||
    normalizeBookingId(bookingIdFromPath) ||
    normalizeBookingId(bookingIdFromQuery) ||
    '';
  
  const [bookingData, setBookingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const qpCustomerId =
        urlParams.get('customerId') ||
        urlParams.get('customer_id') ||
        urlParams.get('participantId') ||
        '';
      const qpPhone =
        urlParams.get('customerPhone') ||
        urlParams.get('customer_phone') ||
        urlParams.get('phone') ||
        '';

      if (qpCustomerId && isCustomerDatabaseUuid(qpCustomerId)) {
        persistCustomerDatabaseId(qpCustomerId.trim());
      }
      if (qpPhone) {
        localStorage.setItem('customerPhone', qpPhone);
        localStorage.setItem('customer_phone', qpPhone);
        localStorage.setItem('phone', qpPhone);
      }

      const storedId =
        getResolvedCustomerId() ||
        localStorage.getItem('customerPhone') ||
        localStorage.getItem('customer_phone') ||
        localStorage.getItem('phone') ||
        '';

      setParticipantId(qpCustomerId || qpPhone || storedId);

      // Strip sensitive query params only — keep bookingId, meetingId, etc.
      if (qpCustomerId || qpPhone || urlParams.get('meetingId')) {
        const customerKeys = [
          'customerId',
          'customer_id',
          'participantId',
          'customerPhone',
          'customer_phone',
          'phone',
          'meetingId',
        ];
        const u = new URL(window.location.href);
        let changed = false;
        for (const k of customerKeys) {
          if (u.searchParams.has(k)) {
            u.searchParams.delete(k);
            changed = true;
          }
        }
        if (changed) {
          const qs = u.searchParams.toString();
          window.history.replaceState({}, '', u.pathname + (qs ? `?${qs}` : '') + u.hash);
        }
      }
    }
    void loadBookingData();
  }, [bookingId]);

  /**
   * Loads booking data from the API.
   * Also extracts customerId from booking data as a fallback if localStorage is empty.
   * This handles cases where localStorage is cleared on deployed environments after refresh.
   */
  const loadBookingData = async () => {
    if (!bookingId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      
      // Load booking details to get vendor name, service info, and customer ID
      const response = await apiClient.get<any>(`/customer/bookings/${bookingId}`);
      const booking = response.booking || response;
      
      if (booking) {
        setBookingData(booking);
        
        // Extract customerId from booking data as fallback for deployed environments
        // Check if we already have participantId from localStorage/query params
        // If not, extract it from booking data to ensure we can join the call
        setParticipantId((currentParticipantId) => {
          // If we already have a participantId, keep it
          if (currentParticipantId) {
            return currentParticipantId;
          }
          
          // Try customer_id first (UUID)
          if (booking.customer_id && isCustomerDatabaseUuid(String(booking.customer_id))) {
            persistCustomerDatabaseId(String(booking.customer_id).trim());
            console.log('[VideoPageClient] Extracted customerId from booking data');
            return String(booking.customer_id).trim();
          }
          
          // Fallback to customer_phone if customer_id not available
          if (booking.customer_phone) {
            const phone = booking.customer_phone;
            localStorage.setItem('customerPhone', phone);
            localStorage.setItem('phone', phone);
            console.log('[VideoPageClient] Extracted customerPhone from booking data');
            return phone;
          }
          
          // No customer info found in booking
          return currentParticipantId;
        });
      } else {
        setError('Booking not found');
      }
    } catch (err: any) {
      console.error('Error loading booking:', err);
      // Don't set error - allow user to still try joining
      // The ChimeVideoCall component will handle the actual join
      setBookingData({
        vendorName: 'Service Provider',
        serviceName: 'Tele Consultation',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!bookingId && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
        <div className="text-center p-6 bg-slate-800 rounded-2xl max-w-md">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-white mb-2">Invalid link</h2>
          <p className="text-gray-400 mb-4">No booking ID in the URL.</p>
          <button
            onClick={() => router.push('/bookings')}
            className="px-6 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition"
          >
            Back to bookings
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Preparing video call...</p>
        </div>
      </div>
    );
  }

  // If we have participant ID, render ChimeVideoCall directly
  // This component handles the entire flow including joining
  if (participantId) {
    return (
      <div className="min-h-[100dvh] h-[100dvh] max-h-[100dvh] overflow-hidden bg-slate-900">
        <ChimeVideoCall
          bookingId={bookingId}
          participantType="customer"
          participantId={participantId}
          vendorName={
            bookingData?.vendor?.businessName ||
            bookingData?.vendor?.business_name ||
            bookingData?.vendorName ||
            bookingData?.vendor_name ||
            bookingData?.staffName ||
            'Service Provider'
          }
          customerName={bookingData?.customerName || bookingData?.customer_name || 'Customer'}
          serviceName={
            bookingData?.service?.name ||
            bookingData?.serviceName ||
            bookingData?.service_name ||
            'Tele Consultation'
          }
          onEndCall={(duration) => {
            console.log('Call ended, duration:', duration);
            router.push('/');
          }}
        />
      </div>
    );
  }

  // If no participant ID, show error
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="text-center p-6 bg-slate-800 rounded-2xl max-w-md">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-white mb-2">Authentication Required</h2>
        <p className="text-gray-400 mb-4">
          Please log in to join the video call.
        </p>
        <button
          onClick={() => router.push('/auth')}
          className="px-6 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition"
        >
          Go to Login
        </button>
        <button
          onClick={() => goBackOrHome(router)}
          className="mt-3 px-6 py-2 text-gray-400 hover:text-white transition"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}
