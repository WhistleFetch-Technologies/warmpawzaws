'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { useCustomerNavigation } from '@/lib/navigation/use-customer-navigation';
import { hasAuthenticatedCustomerSession, requestGuestAuthForEventBook } from '@/lib/guest-auth-gate';

export default function EventDetailPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = String(params.eventId || '');
  const nav = useCustomerNavigation();
  const [event, setEvent] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    apiClient
      .get<any>(`/events/${eventId}`)
      .then((res) => setEvent(res.event || res))
      .catch((err) => setError(err.message || 'Event not found'));
  }, [eventId]);

  const handleBook = () => {
    if (!hasAuthenticatedCustomerSession()) {
      requestGuestAuthForEventBook({ eventId });
      return;
    }
    nav.goToEventBook(eventId);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-orange-50 p-6">
        <button type="button" onClick={() => nav.goToEvents()} className="text-orange-600">
          ← Events
        </button>
        <p className="mt-6 text-red-600">{error}</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-orange-500" />
      </div>
    );
  }

  const title = event.title || event.name;
  const fee = Number(event.registration_fee || 0);
  const remaining =
    event.max_participants != null
      ? Math.max(0, Number(event.max_participants) - Number(event.registered_count || 0))
      : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="mx-auto max-w-3xl p-6">
        <button type="button" onClick={() => nav.goToEvents()} className="text-sm text-orange-600">
          ← Events
        </button>
        <div className="mt-4 rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="mt-2 text-sm text-gray-500">{event.organizer_name}</p>
          <p className="mt-4 text-gray-700">{event.description}</p>
          <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Date</p>
              <p className="font-medium">
                {event.start_date
                  ? new Date(event.start_date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : ''}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Time</p>
              <p className="font-medium">
                {event.start_time || ''}
                {event.end_time ? ` - ${event.end_time}` : ''}
              </p>
            </div>
          </div>
          <div className="mt-4 text-sm">
            <p className="text-gray-500">Venue</p>
            <p className="font-medium">
              {event.venue}
              {event.address ? `, ${event.address}` : ''}
              {event.city ? `, ${event.city}` : ''}
            </p>
          </div>
          {fee > 0 ? (
            <p className="mt-4 font-medium text-orange-600">₹{fee} per ticket</p>
          ) : (
            <p className="mt-4 font-medium text-green-600">Free event</p>
          )}
          {remaining != null ? (
            <p className="mt-2 text-sm text-gray-500">{remaining} spots remaining</p>
          ) : null}
          <button
            type="button"
            onClick={handleBook}
            disabled={remaining === 0}
            className="mt-6 w-full rounded-lg bg-orange-500 py-3 font-medium text-white hover:bg-orange-600 disabled:bg-gray-300"
          >
            {remaining === 0 ? 'Event full' : 'Book tickets'}
          </button>
        </div>
      </div>
    </div>
  );
}
