'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { useCustomerNavigation } from '@/lib/navigation/use-customer-navigation';
import { hasAuthenticatedCustomerSession } from '@/lib/guest-auth-gate';

type PublicEvent = {
  id: string;
  title?: string;
  name?: string;
  description?: string;
  category?: string;
  organizer_name?: string;
  venue?: string;
  city?: string;
  start_date?: string;
  start_time?: string;
  end_time?: string;
  registration_fee?: number;
  max_participants?: number;
  registered_count?: number;
  is_featured?: boolean;
  status?: string;
};

type Registration = {
  id: string;
  event_id: string;
  event_title?: string;
  event_name?: string;
  status?: string;
  payment_status?: string;
  number_of_people?: number;
};

export default function EventsPage() {
  const nav = useCustomerNavigation();
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [activeTab, setActiveTab] = useState<'discover' | 'my-events'>('discover');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const eventsRes = await apiClient.get<any>('/events/discover');
        const list = eventsRes.events || [];
        if (!cancelled) setEvents(Array.isArray(list) ? list : []);
        if (hasAuthenticatedCustomerSession()) {
          const regs = await apiClient.get<any>('/events/my-registrations').catch(() => ({ registrations: [] }));
          if (!cancelled) setRegistrations(regs.registrations || []);
        } else if (!cancelled) {
          setRegistrations([]);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load events');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const title = String(event.title || event.name || '');
      if (filterCategory && event.category !== filterCategory) return false;
      if (!searchTerm) return true;
      const search = searchTerm.toLowerCase();
      return (
        title.toLowerCase().includes(search) ||
        String(event.description || '').toLowerCase().includes(search) ||
        String(event.organizer_name || '').toLowerCase().includes(search)
      );
    });
  }, [events, filterCategory, searchTerm]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="sticky top-0 z-30 border-b border-orange-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <button type="button" onClick={() => nav.goToHome()} className="text-sm text-orange-600">
            ← Home
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Events</h1>
          <p className="mt-1 text-sm text-gray-500">Discover pet meetups, workshops, and activities</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-6 flex rounded-xl bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab('discover')}
            className={`flex-1 rounded-lg py-3 font-medium ${
              activeTab === 'discover' ? 'bg-orange-500 text-white' : 'text-gray-600'
            }`}
          >
            Discover Events
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('my-events')}
            className={`flex-1 rounded-lg py-3 font-medium ${
              activeTab === 'my-events' ? 'bg-orange-500 text-white' : 'text-gray-600'
            }`}
          >
            My Events
          </button>
        </div>

        {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div> : null}

        {activeTab === 'discover' ? (
          <>
            <div className="mb-6 flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="min-w-[200px] flex-1 rounded-lg border px-4 py-2 outline-none focus:border-orange-500"
              />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="rounded-lg border px-4 py-2 outline-none focus:border-orange-500"
              >
                <option value="">All Categories</option>
                <option value="adoption">Adoption</option>
                <option value="workshop">Workshop</option>
                <option value="exhibition">Exhibition</option>
                <option value="charity">Charity</option>
                <option value="training">Training</option>
              </select>
            </div>
            {filteredEvents.length === 0 ? (
              <div className="rounded-2xl bg-white p-12 text-center text-gray-500">No published events yet</div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredEvents.map((event) => {
                  const title = event.title || event.name || 'Event';
                  const fee = Number(event.registration_fee || 0);
                  const full =
                    event.max_participants != null &&
                    Number(event.registered_count || 0) >= Number(event.max_participants);
                  return (
                    <div key={event.id} className="rounded-2xl bg-white p-5 shadow-sm">
                      <h3 className="font-semibold text-gray-900">{title}</h3>
                      <p className="mt-2 line-clamp-2 text-sm text-gray-600">{event.description}</p>
                      <div className="mt-3 space-y-1 text-sm text-gray-500">
                        <p>
                          {event.start_date
                            ? new Date(event.start_date).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })
                            : ''}{' '}
                          {event.start_time || ''}
                        </p>
                        <p>
                          {event.venue || ''}
                          {event.city ? `, ${event.city}` : ''}
                        </p>
                        <p>{event.organizer_name}</p>
                      </div>
                      {fee > 0 ? <p className="mt-2 text-sm font-medium text-orange-600">₹{fee} per ticket</p> : null}
                      {full ? <p className="mt-2 text-xs text-gray-400">Event full</p> : null}
                      <button
                        type="button"
                        onClick={() => nav.goToEventDetail(event.id)}
                        className="mt-4 w-full rounded-lg bg-orange-500 py-2 text-sm font-medium text-white hover:bg-orange-600"
                      >
                        View details
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div>
            {!hasAuthenticatedCustomerSession() ? (
              <div className="rounded-2xl bg-white p-12 text-center text-gray-500">
                Login to see your Event registrations.
              </div>
            ) : registrations.length === 0 ? (
              <div className="rounded-2xl bg-white p-12 text-center text-gray-500">No Event registrations yet</div>
            ) : (
              <div className="space-y-3">
                {registrations.map((reg) => (
                  <button
                    key={reg.id}
                    type="button"
                    onClick={() => nav.goToEventRegistration(reg.id)}
                    className="w-full rounded-2xl bg-white p-5 text-left shadow-sm"
                  >
                    <p className="font-semibold text-gray-900">{reg.event_title || reg.event_name}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      {reg.number_of_people || 1} ticket(s) · {reg.payment_status || reg.status}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
