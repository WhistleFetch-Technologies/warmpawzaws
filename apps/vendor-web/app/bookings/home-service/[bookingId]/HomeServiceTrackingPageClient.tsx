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
      const response = await apiClient.get<any>(`/vendor/bookings/${bookingId}`);
      
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading booking...</p>
        </div>
      </div>
    );
  }

  if (error || !vendorId || !bookingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-500 font-medium">{error || 'Unable to load booking'}</p>
          <button
            onClick={handleBack}
            className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg"
          >
            Back to Bookings
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
