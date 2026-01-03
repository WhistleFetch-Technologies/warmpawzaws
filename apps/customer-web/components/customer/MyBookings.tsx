'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

interface Booking {
  id: string;
  service_name?: string;
  vendor_name?: string;
  booking_date?: string;
  booking_time?: string;
  status?: string;
  total_amount?: number;
}

interface MyBookingsProps {
  customerPhone: string;
}

export function MyBookings({ customerPhone }: MyBookingsProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        // Best-effort contract: try a customer bookings endpoint filtered by phone
        const res = await apiClient.get<any>(`/customer/bookings?phone=${encodeURIComponent(customerPhone)}`);
        if (res?.bookings) {
          setBookings(res.bookings);
        } else {
          setBookings([]);
        }
      } catch (err: any) {
        console.error('Failed to load bookings', err);
        setError('Unable to load bookings right now.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [customerPhone]);

  if (loading) {
    return <div className="p-4">Loading bookings…</div>;
  }

  if (error) {
    return <div className="p-4 text-red-600">{error}</div>;
  }

  if (!bookings.length) {
    return <div className="p-4">No bookings found.</div>;
  }

  return (
    <div className="p-4 space-y-3">
      {bookings.map((b) => (
        <div key={b.id} className="rounded border p-3 shadow-sm">
          <div className="font-semibold">{b.service_name || 'Service'}</div>
          <div className="text-sm text-gray-600">
            {b.booking_date} {b.booking_time}
          </div>
          <div className="text-sm">Vendor: {b.vendor_name || 'N/A'}</div>
          <div className="text-sm">Status: {b.status || 'pending'}</div>
          {b.total_amount !== undefined && (
            <div className="text-sm">Amount: ₹{b.total_amount}</div>
          )}
        </div>
      ))}
    </div>
  );
}

