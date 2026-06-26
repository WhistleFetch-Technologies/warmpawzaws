import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

export type OpenVendorProfileChatParams = {
  phone: string;
  vendorId: string;
  vendorName?: string;
  openBookingChat: (bookingId: string, vendorName?: string) => void;
};

export async function openVendorProfileChat({
  phone,
  vendorId,
  vendorName,
  openBookingChat,
}: OpenVendorProfileChatParams): Promise<void> {
  const vid = String(vendorId || '').trim();
  if (!vid) {
    toast.info('Book a session with this vendor first to unlock chat.');
    return;
  }

  try {
    const res = await apiClient.get<{ booking: { bookingId: string; vendorName?: string } | null }>(
      `/customer/${encodeURIComponent(phone)}/latest-booking-by-vendor?vendorId=${encodeURIComponent(vid)}`
    );
    const bookingId = String(res?.booking?.bookingId || '').trim();
    if (!bookingId) {
      toast.info('Book a session with this vendor first to unlock chat.');
      return;
    }

    const resolvedName =
      String(vendorName || res?.booking?.vendorName || '').trim() || undefined;
    openBookingChat(bookingId, resolvedName);
  } catch (err) {
    console.error('[openVendorProfileChat] failed:', err);
    toast.error('Could not open chat.');
  }
}
