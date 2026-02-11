'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { ChimeVideoCall } from '@/components/customer/booking/ChimeVideoCall';

interface VideoPageClientProps {
  bookingId: string;
}

export function VideoPageClient({ bookingId }: VideoPageClientProps) {
  const router = useRouter();
  
  const [bookingData, setBookingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Prefer query params (mobile WebView/deep links), then localStorage
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

      if (qpCustomerId) {
        localStorage.setItem('customerId', qpCustomerId);
      }
      if (qpPhone) {
        localStorage.setItem('customerPhone', qpPhone);
        localStorage.setItem('customer_phone', qpPhone);
        localStorage.setItem('phone', qpPhone);
      }

      const storedId =
        localStorage.getItem('customerId') ||
        localStorage.getItem('customerPhone') ||
        localStorage.getItem('customer_phone') ||
        localStorage.getItem('phone') ||
        '';

      setParticipantId(qpCustomerId || qpPhone || storedId);
    }
    loadBookingData();
  }, [bookingId]);

  const loadBookingData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load booking details to get vendor name and service info
      const response = await apiClient.get<any>(`/customer/bookings/${bookingId}`);
      const booking = response.booking || response;
      
      if (booking) {
        setBookingData(booking);
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
      <ChimeVideoCall
        bookingId={bookingId}
        participantType="customer"
        participantId={participantId}
        vendorName={bookingData?.vendorName || bookingData?.staffName || 'Service Provider'}
        customerName={bookingData?.customerName || 'Customer'}
        serviceName={bookingData?.serviceName || 'Tele Consultation'}
        onEndCall={(duration) => {
          console.log('Call ended, duration:', duration);
          // Optionally navigate back or show completion screen
          router.push(`/bookings/${bookingId}`);
        }}
      />
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
          onClick={() => router.back()}
          className="mt-3 px-6 py-2 text-gray-400 hover:text-white transition"
        >
          Go Back
        </button>
      </div>
    </div>
  );
}
