'use client';

import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { HomeServiceTrackingManager } from '@/components/vendor/tracking/HomeServiceTrackingManager';

export default function HomeServiceTrackingPageClient() {
  const router = useRouter();
  const params = useParams();
  const bookingId = params?.bookingId as string;
  
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [bookingData, setBookingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedVendorId = localStorage.getItem('vendorId');
    if (storedVendorId) {
      setVendorId(storedVendorId);
    }
    
    if (bookingId && bookingId !== 'placeholder') {
      loadBookingData();
    } else {
      setLoading(false);
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
        const isWalkerSession =
          serviceTypeLower.includes('walk') ||
          serviceTypeLower === 'walking' ||
          serviceNameLower.includes('walk') ||
          serviceNameLower.includes('walking');
        const isSitterSession =
          serviceTypeLower.includes('sit') ||
          serviceTypeLower === 'sitting' ||
          serviceNameLower.includes('sit') ||
          serviceNameLower.includes('sitting');
        
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
          packageSessionId: booking.packageSessionId || booking.package_session_id
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
    router.push('/bookings');
  };

  const handleComplete = (result: any) => {
    // Navigate back to bookings with success message
    router.push(`/bookings?completed=${bookingId}`);
  };

  if (loading) {
    return (
      <div className="vendor-app-column flex min-h-screen flex-col items-center justify-center bg-[#FFF5F1]">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#FF8C42] border-t-transparent" />
        <p className="mt-4 text-sm font-medium text-gray-600">Loading booking…</p>
      </div>
    );
  }

  if (error || !vendorId || !bookingData) {
    return (
      <div className="vendor-app-column flex min-h-screen flex-col bg-[#FFF5F1] px-6 pb-10 pt-12">
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
    <HomeServiceTrackingManager
      vendorId={vendorId}
      bookingId={bookingId}
      bookingData={bookingData}
      onBack={handleBack}
      onComplete={handleComplete}
    />
  );
}
