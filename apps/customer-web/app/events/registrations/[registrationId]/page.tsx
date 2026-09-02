'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { OpaqueTicketQr } from '@/components/customer/events/OpaqueTicketQr';
import { useCustomerNavigation } from '@/lib/navigation/use-customer-navigation';

export default function EventRegistrationPage() {
  const params = useParams<{ registrationId: string }>();
  const registrationId = String(params.registrationId || '');
  const nav = useCustomerNavigation();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = () => {
    if (!registrationId) return;
    apiClient
      .get<any>(`/events/registrations/${registrationId}`)
      .then((res) => setData(res.registration || res))
      .catch((err) => setError(err.message || 'Registration not found'));
  };

  useEffect(() => {
    load();
  }, [registrationId]);

  const paid = data?.payment_status === 'paid' || data?.payment_status === 'waived';
  const tickets = data?.tickets || [];

  const cancel = async () => {
    if (!confirm('Cancel this Event registration? Unused tickets will be invalidated.')) return;
    try {
      setCancelling(true);
      await apiClient.delete(`/events/registrations/${registrationId}`);
      load();
    } catch (err: any) {
      setError(err.message || 'Cancel failed');
    } finally {
      setCancelling(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen p-6">
        <button type="button" onClick={() => nav.goToEvents()} className="text-orange-600">
          ← Events
        </button>
        <p className="mt-6 text-red-600">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="mx-auto max-w-3xl p-6">
        <button type="button" onClick={() => nav.goToEvents()} className="text-sm text-orange-600">
          ← Events
        </button>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">{data.event_name || 'Event tickets'}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {data.booking_reference} · {data.payment_status} · {data.status}
        </p>

        {!paid ? (
          <div className="mt-6 rounded-2xl bg-white p-5 text-sm text-gray-600">
            Payment is not verified yet. QR tickets are issued only after a successful payment.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {tickets.map((ticket: any) => (
              <div key={ticket.id} className="rounded-2xl bg-white p-5">
                <p className="font-medium text-gray-900">
                  Ticket {ticket.ticket_index} · {ticket.pet_snapshot?.name || 'Pet'}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Check-in: {ticket.check_in_status === 'checked_in' ? 'Checked in' : 'Pending'}
                </p>
                {ticket.qr_token ? <div className="mt-4"><OpaqueTicketQr token={String(ticket.qr_token)} /></div> : null}
              </div>
            ))}
          </div>
        )}

        {data.status !== 'cancelled' ? (
          <button
            type="button"
            onClick={cancel}
            disabled={cancelling}
            className="mt-6 rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-700"
          >
            {cancelling ? 'Cancelling…' : 'Cancel & refund'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
