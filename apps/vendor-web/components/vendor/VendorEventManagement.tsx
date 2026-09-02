'use client';

import { useEffect, useState } from 'react';
import { Plus, QrCode } from 'lucide-react';
import { VendorHeader } from '@/components/vendor/VendorHeader';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface VendorEventManagementProps {
  vendorId: string;
  onBack?: () => void;
}

type EventRow = {
  id: string;
  name: string;
  event_date: string;
  start_time: string;
  status: string;
  approval_status: string;
  current_attendees?: number;
  max_attendees?: number;
  price_per_booking?: number;
  fees?: number;
};

export function VendorEventManagement({ vendorId, onBack }: VendorEventManagementProps) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [checkInToken, setCheckInToken] = useState('');
  const [form, setForm] = useState({
    name: '',
    description: '',
    eventDate: '',
    startTime: '',
    endTime: '',
    venue: '',
    maxAttendees: 20,
    pricePerBooking: 0,
  });

  const loadEvents = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<any>('/vendor/events');
      setEvents(res.events || []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [vendorId]);

  const loadBookings = async (eventId: string) => {
    setSelectedEventId(eventId);
    const res = await apiClient.get<any>(`/vendor/events/${eventId}/registrations`);
    setRegistrations(res.registrations || []);
    setTickets(res.tickets || []);
  };

  const createEvent = async () => {
    try {
      await apiClient.post('/vendor/events', {
        name: form.name,
        description: form.description,
        eventDate: form.eventDate,
        startTime: form.startTime,
        endTime: form.endTime,
        venue: form.venue,
        maxAttendees: form.maxAttendees,
        pricePerBooking: form.pricePerBooking,
      });
      toast.success('Event created as draft');
      setShowCreate(false);
      loadEvents();
    } catch (error: any) {
      toast.error(error.message || 'Create failed');
    }
  };

  const submitEvent = async (eventId: string) => {
    try {
      await apiClient.post(`/vendor/events/${eventId}/submit`);
      toast.success('Submitted for admin approval');
      loadEvents();
    } catch (error: any) {
      toast.error(error.message || 'Submit failed');
    }
  };

  const checkIn = async () => {
    try {
      const verified = await apiClient.get<any>(`/events/verify/${encodeURIComponent(checkInToken)}`);
      const ticketId = verified.ticket?.id;
      if (!ticketId) {
        toast.error('Ticket not found');
        return;
      }
      const result = await apiClient.post<any>(`/events/tickets/${ticketId}/check-in`, {});
      toast.success(result.already_checked_in ? 'already_checked_in' : 'Checked in');
      if (selectedEventId) loadBookings(selectedEventId);
    } catch (error: any) {
      toast.error(error.message || 'Check-in failed');
    }
  };

  if (loading) {
    return (
      <div className="vendor-app-column flex h-screen items-center justify-center bg-gray-50">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#FF8C42]" />
      </div>
    );
  }

  return (
    <div className="vendor-page-shell bg-gray-50">
      <div className="vendor-app-column min-h-screen bg-white">
        <VendorHeader
          tone="brand"
          title="Event Management"
          subtitle="Create, submit, and check in attendees"
          showBack={Boolean(onBack)}
          onBack={onBack}
        />
        <div className="space-y-4 p-4">
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-[#FF8C42] px-4 py-2 font-medium text-white"
          >
            <Plus className="mr-2 inline h-4 w-4" />
            Create Event
          </button>

          {events.map((event) => (
            <div key={event.id} className="rounded-xl border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{event.name}</h3>
                  <p className="text-sm text-gray-500">
                    {event.event_date} {event.start_time} · {event.status} · {event.approval_status}
                  </p>
                  <p className="text-xs text-gray-400">
                    {event.current_attendees || 0}/{event.max_attendees || '∞'} attendees
                  </p>
                </div>
                <div className="flex gap-2">
                  {event.approval_status !== 'approved' && event.approval_status !== 'pending' ? (
                    <button
                      type="button"
                      onClick={() => submitEvent(event.id)}
                      className="rounded-lg bg-orange-100 px-3 py-1 text-sm text-orange-700"
                    >
                      Submit
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => loadBookings(event.id)}
                    className="rounded-lg bg-sky-100 px-3 py-1 text-sm text-sky-700"
                  >
                    Bookings
                  </button>
                </div>
              </div>
            </div>
          ))}

          {showCreate ? (
            <div className="rounded-xl border bg-gray-50 p-4 space-y-2">
              <input className="w-full rounded border px-3 py-2" placeholder="Event name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <textarea className="w-full rounded border px-3 py-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <input type="date" className="w-full rounded border px-3 py-2" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} />
              <input type="time" className="w-full rounded border px-3 py-2" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              <input className="w-full rounded border px-3 py-2" placeholder="Venue" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
              <input type="number" className="w-full rounded border px-3 py-2" placeholder="Capacity" value={form.maxAttendees} onChange={(e) => setForm({ ...form, maxAttendees: Number(e.target.value) })} />
              <input type="number" className="w-full rounded border px-3 py-2" placeholder="Price per ticket" value={form.pricePerBooking} onChange={(e) => setForm({ ...form, pricePerBooking: Number(e.target.value) })} />
              <div className="flex gap-2">
                <button type="button" onClick={createEvent} className="rounded-lg bg-[#FF8C42] px-4 py-2 text-white">Save draft</button>
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg bg-gray-200 px-4 py-2">Cancel</button>
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border p-4">
            <h3 className="mb-2 flex items-center gap-2 font-semibold">
              <QrCode className="h-4 w-4" />
              Ticket check-in
            </h3>
            <input
              className="w-full rounded border px-3 py-2"
              placeholder="Paste opaque QR token"
              value={checkInToken}
              onChange={(e) => setCheckInToken(e.target.value)}
            />
            <button type="button" onClick={checkIn} className="mt-2 rounded-lg bg-green-600 px-4 py-2 text-white">
              Check in
            </button>
          </div>

          {selectedEventId ? (
            <div className="rounded-xl border p-4">
              <h3 className="mb-3 font-semibold">Bookings</h3>
              {registrations.map((reg) => {
                const eventTickets = tickets.filter((t) => String(t.registration_id) === String(reg.id));
                return (
                  <div key={reg.id} className="mb-3 rounded-lg bg-gray-50 p-3 text-sm">
                    <p className="font-medium">{reg.customer_name || reg.attendee_name}</p>
                    <p className="text-gray-500">
                      {reg.number_of_people} tickets · {reg.payment_status} · {reg.status}
                    </p>
                    {eventTickets.map((ticket) => (
                      <p key={ticket.id} className="mt-1 text-xs text-gray-600">
                        Ticket {ticket.ticket_index}: {ticket.pet_snapshot?.name || ticket.pet_id} ·{' '}
                        {ticket.check_in_status} · vaccinated {String(ticket.declarations?.vaccinated)}
                      </p>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default VendorEventManagement;
