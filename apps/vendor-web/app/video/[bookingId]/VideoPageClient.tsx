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
  const bookingId = bookingIdProp ?? (params?.bookingId as string) ?? '';
  const [bookingData, setBookingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string>('');

  useEffect(() => {
    const vendorId =
      typeof window !== 'undefined'
        ? localStorage.getItem('vendorId') ||
          localStorage.getItem('vendor_id') ||
          sessionStorage.getItem('vendorId') ||
          sessionStorage.getItem('vendor_id') ||
          ''
        : '';
    setParticipantId(vendorId);
    if (bookingId) loadBookingData();
    else setLoading(false);
  }, [bookingId]);

  const loadBookingData = async () => {
    if (!bookingId) return;
    const vid =
      typeof window !== 'undefined'
        ? localStorage.getItem('vendorId') || localStorage.getItem('vendor_id') || sessionStorage.getItem('vendorId') || sessionStorage.getItem('vendor_id') || ''
        : '';
    try {
      setLoading(true);
      setError(null);
      const url = vid ? `/bookings/${bookingId}?vendorId=${encodeURIComponent(vid)}` : `/bookings/${bookingId}`;
      const response = await apiClient.get<any>(url);
      const booking = response.booking || response;
      if (booking) {
        setBookingData(booking);
      } else {
        setError('Booking not found');
      }
    } catch (err: any) {
      console.error('Error loading booking:', err);
      setBookingData({
        vendor_name: 'You',
        customer_name: 'Customer',
        service_name: 'Tele Consultation',
      });
    } finally {
      setLoading(false);
    }
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
          router.push('/dashboard');
        }}
      />
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
