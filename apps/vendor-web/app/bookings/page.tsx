'use client';

import { useRouter } from 'next/navigation';
import { VendorBookingManagementScreen } from '@/components/vendor/bookings/VendorBookingManagementScreen';

export default function BookingsPage() {
  const router = useRouter();

  const handleSelectBooking = (bookingId: string) => {
    console.log(`[BookingsPage] Navigating to booking detail: ${bookingId}`);
    router.push(`/bookings/${bookingId}`);
  };

  const handleBack = () => {
    router.back();
  };

  // Get vendor data from localStorage
  const vendorId = typeof window !== 'undefined' ? localStorage.getItem('vendorId') || '' : '';

  return (
    <VendorBookingManagementScreen
      vendorId={vendorId}
      onSelectBooking={handleSelectBooking}
      onBack={handleBack}
    />
  );
}