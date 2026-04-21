'use client';

import { useState, useEffect, useMemo } from 'react';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

type TabStatus = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled';

type BookingRowStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

interface Booking {
  id: string;
  bookingId: string;
  vendorName: string;
  serviceName: string;
  petName: string;
  scheduledDate: string;
  scheduledTime: string;
  status: BookingRowStatus;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  amount: number;
}

interface CustomerBookingsPageProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

/** Map API row (snake_case / camelCase) to list card shape. */
function normalizeBookingRow(b: Record<string, unknown>): Booking {
  const id = String(b.id ?? b.booking_id ?? b.bookingId ?? '');
  const scheduledDateRaw =
    (b.scheduled_date as string) ||
    (b.scheduledDate as string) ||
    (b.booking_date as string) ||
    (b.bookingDate as string) ||
    (b.appointment_date as string) ||
    (b.appointmentDate as string) ||
    '';
  const scheduledTimeRaw =
    (b.scheduled_time as string) ||
    (b.scheduledTime as string) ||
    (b.booking_time as string) ||
    (b.bookingTime as string) ||
    (b.start_time as string) ||
    (b.startTime as string) ||
    '';
  const raw = String(b.status ?? 'pending')
    .toLowerCase()
    .replace(/\s+/g, '_');
  let status: BookingRowStatus = 'pending';
  if (raw === 'completed') status = 'completed';
  else if (raw === 'cancelled' || raw === 'canceled') status = 'cancelled';
  else if (
    raw === 'confirmed' ||
    raw === 'in_progress' ||
    raw === 'arrived' ||
    raw === 'vendor_on_way' ||
    raw === 'scheduled'
  ) {
    status = 'confirmed';
  } else {
    status = 'pending';
  }
  const payRaw = String(b.payment_status ?? b.paymentStatus ?? 'pending').toLowerCase();
  const paymentStatus: Booking['paymentStatus'] =
    payRaw === 'paid' ? 'paid' : payRaw === 'refunded' ? 'refunded' : 'pending';
  const amount = Number(b.total_amount ?? b.totalAmount ?? b.amount ?? b.price ?? 0);

  return {
    id: id || `row-${Math.random().toString(36).slice(2, 9)}`,
    bookingId: id,
    vendorName: String(
      b.vendor_name ?? b.vendorName ?? (b.vendor as { business_name?: string })?.business_name ?? 'Vendor'
    ),
    serviceName: String(
      b.service_name ?? b.serviceName ?? (b.service as { name?: string })?.name ?? 'Service'
    ),
    petName: String(b.pet_name ?? b.petName ?? ''),
    scheduledDate: scheduledDateRaw,
    scheduledTime: scheduledTimeRaw,
    status,
    paymentStatus,
    amount,
  };
}

function formatDisplayDate(isoOrDate: string): string {
  if (!isoOrDate || !String(isoOrDate).trim()) return 'Date TBD';
  const parsed = new Date(isoOrDate);
  if (Number.isNaN(parsed.getTime())) return 'Date TBD';
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDisplayTime(t: string): string {
  if (!t || !String(t).trim()) return '—';
  return String(t).trim();
}

export function CustomerBookingsPage({ phone, onBack, onNavigate }: CustomerBookingsPageProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabStatus>('all');

  useEffect(() => {
    if (phone) {
      fetchBookings();
    }
  }, [phone]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await apiClient.get<{ bookings?: Record<string, unknown>[] }>(
        `/customer/bookings?phone=${encodeURIComponent(phone)}`
      );
      const raw = data.bookings || [];
      setBookings(raw.map((row) => normalizeBookingRow(row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookings');
      console.error('Error fetching bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredBookings = useMemo(() => {
    if (activeTab === 'all') return bookings;
    return bookings.filter((b) => b.status === activeTab);
  }, [bookings, activeTab]);

  return (
    <div
      className="mx-auto min-h-screen w-full max-w-customer bg-gray-50"
      style={{ paddingBottom: 'max(1rem, var(--customer-tabbar-content-pad))' }}
    >
      {/* Header — safe top, mobile tap targets */}
      <div
        className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm
          pt-[max(0.75rem,env(safe-area-inset-top,0px))]
          pl-[max(1rem,env(safe-area-inset-left,0px))]
          pr-[max(1rem,env(safe-area-inset-right,0px))]
          pb-3 flex flex-wrap items-center gap-2 justify-between"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 rounded-full hover:bg-orange-50"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-800" />
          </Button>
          <h1 className="text-lg font-bold text-gray-900 truncate">My Bookings</h1>
        </div>
        <Button
          size="sm"
          className="h-10 shrink-0 rounded-xl bg-[#FF8C42] hover:bg-[#FF7A2E] text-white font-semibold px-4 shadow-sm"
          onClick={() => onNavigate('services')}
        >
          New Booking
        </Button>
      </div>

      {/* Tabs — horizontal scroll, touch-friendly */}
      <div
        className="bg-white border-b border-gray-100 overflow-x-auto scrollbar-hide
          pl-[max(1rem,env(safe-area-inset-left,0px))]
          pr-[max(1rem,env(safe-area-inset-right,0px))]"
      >
        <div className="flex gap-1 py-2 min-w-max">
          {(['all', 'pending', 'confirmed', 'completed', 'cancelled'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setActiveTab(status)}
              className={`min-h-[44px] px-4 rounded-xl text-sm font-medium capitalize transition-colors whitespace-nowrap ${
                activeTab === status
                  ? 'bg-[#FF8C42] text-white shadow-sm'
                  : 'text-gray-600 hover:bg-orange-50 hover:text-[#FF8C42]'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div
        className="w-full px-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] py-4 max-w-2xl mx-auto"
      >
        {loading ? (
          <LoadingState message="Loading your bookings..." />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchBookings} />
        ) : filteredBookings.length === 0 ? (
          <EmptyState
            message={
              activeTab === 'all'
                ? "You haven't made any bookings yet."
                : `No ${activeTab} bookings found.`
            }
            action={
              activeTab === 'all' ? (
                <Button onClick={() => onNavigate('services')} className="bg-[#FF8C42] hover:bg-[#FF7A2E]">
                  Book a Service
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {filteredBookings.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                onViewDetails={() => onNavigate('booking-details', { bookingId: booking.bookingId || booking.id })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BookingCard({ booking, onViewDetails }: { booking: Booking; onViewDetails: () => void }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'completed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-amber-100 text-amber-900 border-amber-200';
    }
  };

  const dateLine = formatDisplayDate(booking.scheduledDate);
  const timeLine = formatDisplayTime(booking.scheduledTime);
  const petLine = booking.petName?.trim() || '—';

  return (
    <Card className="overflow-hidden border border-gray-100 shadow-sm rounded-2xl">
      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-3">
          <div className="min-w-0 order-2 sm:order-1">
            <h3 className="font-bold text-gray-900 text-base leading-snug">{booking.serviceName}</h3>
            <p className="text-sm text-gray-500 mt-0.5 truncate">{booking.vendorName}</p>
          </div>
          <Badge
            variant="outline"
            className={`${getStatusColor(booking.status)} border shrink-0 self-start sm:self-auto order-1 sm:order-2 capitalize`}
          >
            {booking.status.replace('_', ' ')}
          </Badge>
        </div>

        <div className="space-y-2.5 mb-4 text-sm text-gray-600">
          <div className="flex items-start gap-2">
            <Calendar className="w-4 h-4 mt-0.5 text-[#FF8C42] shrink-0" aria-hidden />
            <span>{dateLine}</span>
          </div>
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 mt-0.5 text-[#FF8C42] shrink-0" aria-hidden />
            <span>{timeLine}</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-medium text-gray-700">Pet</span>
            <span className="text-gray-800">{petLine}</span>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between pt-3 border-t border-gray-100">
          <span className="font-bold text-lg text-gray-900">₹{Number.isFinite(booking.amount) ? booking.amount : 0}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={onViewDetails}
            className="w-full sm:w-auto min-h-[44px] rounded-xl border-[#FF8C42] text-[#FF8C42] hover:bg-orange-50"
          >
            View Details
          </Button>
        </div>
      </div>
    </Card>
  );
}
