import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

/**
 * Navigate to vendor bookings and open the appointment detail for a review's booking.
 * Works for active, completed, and historical bookings when the vendor owns the booking.
 */
export async function navigateToVendorBookingFromReview(
  router: AppRouterInstance,
  bookingId: string | undefined | null
): Promise<void> {
  const id = bookingId?.trim();
  if (!id) {
    toast.error('No booking linked to this review');
    return;
  }

  try {
    const response = (await apiClient.get(
      `/vendor/bookings/${encodeURIComponent(id)}/details`
    )) as { success?: boolean; booking?: { id?: string }; error?: string };

    const booking = response?.booking;
    if (!response?.success && !booking?.id) {
      toast.error('Booking not found or you do not have access');
      return;
    }

    router.push(`/bookings?bookingId=${encodeURIComponent(id)}`);
  } catch (err: unknown) {
    const message =
      err && typeof err === 'object' && 'message' in err && typeof (err as { message: string }).message === 'string'
        ? (err as { message: string }).message
        : 'Could not open booking';
    toast.error(message.includes('404') ? 'Booking not found' : message);
  }
}
