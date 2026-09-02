'use client';

/**
 * Event Check-in Page
 * Handles QR code scanning and attendee check-in for events
 * Uses query parameter for eventId instead of path param
 */

import React, { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, CheckCircle, XCircle, QrCode, Users, Search } from 'lucide-react';

interface Registration {
  id: string;
  booking_reference: string;
  attendee_name: string;
  attendee_phone: string;
  attendee_email?: string;
  number_of_people: number;
  check_in_status: 'pending' | 'checked_in';
  check_in_time?: string;
  payment_status: string;
  created_at: string;
}

interface Event {
  id: string;
  name: string;
  event_date: string;
  start_time: string;
  venue: any;
  current_attendees: number;
  max_attendees?: number;
}

function CheckInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get('eventId');
  
  const [event, setEvent] = useState<Event | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (eventId) {
      loadEventData();
    } else {
      router.push('/events');
    }
  }, [eventId, router]);

  const loadEventData = async () => {
    if (!eventId) return;
    
    try {
      setLoading(true);
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) {
        router.push('/onboarding');
        return;
      }
      
      // Load event details
      const eventData = await apiClient.get<any>(`/events/${eventId}`);
      if (eventData.success || eventData.event) {
        setEvent(eventData.event || eventData);
      }
      
      // Load registrations
      const regData = await apiClient.get<any>(`/vendor/events/${eventId}/registrations?vendorId=${vendorId}`);
      if (regData.success) {
        setRegistrations(regData.registrations || []);
      }
    } catch (error: any) {
      console.error('Error loading event data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (registrationId: string) => {
    try {
      setProcessingId(registrationId);
      await apiClient.post(`/events/registrations/${registrationId}/check-in`, {});
      loadEventData();
    } catch (error: any) {
      console.error('Error checking in:', error);
      alert(error.message || 'Failed to check in attendee');
    } finally {
      setProcessingId(null);
    }
  };

  const handleTokenCheckIn = async () => {
    const token = searchQuery.trim();
    if (!token) return;
    try {
      const verified = await apiClient.get<any>(`/events/verify/${encodeURIComponent(token)}`);
      const ticketId = verified.ticket?.id;
      if (!ticketId) throw new Error('Ticket not found');
      const result = await apiClient.post<any>(`/events/tickets/${ticketId}/check-in`, {});
      alert(result.already_checked_in ? 'already_checked_in' : 'Checked in');
      loadEventData();
    } catch (error: any) {
      alert(error.message || 'Check-in failed');
    }
  };

  const filteredRegistrations = registrations.filter(r =>
    r.attendee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.booking_reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.attendee_phone.includes(searchQuery)
  );

  const checkedInCount = registrations.filter(r => r.check_in_status === 'checked_in').length;
  const pendingCount = registrations.filter(r => r.check_in_status === 'pending').length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading event data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back
        </button>
        
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <QrCode className="h-8 w-8 text-blue-500" />
          Event Check-in
        </h1>
        {event && (
          <p className="text-gray-600 mt-1">{event.name} • {event.event_date}</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-500" />
            <span className="text-sm text-gray-600">Total</span>
          </div>
          <p className="text-2xl font-bold">{registrations.length}</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <span className="text-sm text-gray-600">Checked In</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{checkedInCount}</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-orange-500" />
            <span className="text-sm text-gray-600">Pending</span>
          </div>
          <p className="text-2xl font-bold text-orange-600">{pendingCount}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Paste opaque QR token or search attendees"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={handleTokenCheckIn}
          className="mt-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white"
        >
          Check in token
        </button>
      </div>

      {/* Registrations List */}
      <div className="space-y-3">
        {filteredRegistrations.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">
              {searchQuery ? 'No registrations found' : 'No registrations yet'}
            </p>
          </div>
        ) : (
          filteredRegistrations.map((reg) => (
            <div
              key={reg.id}
              className={`bg-white rounded-lg p-4 shadow-sm flex items-center justify-between ${
                reg.check_in_status === 'checked_in' ? 'border-l-4 border-green-500' : ''
              }`}
            >
              <div>
                <p className="font-medium">{reg.attendee_name}</p>
                <p className="text-sm text-gray-600">{reg.attendee_phone}</p>
                <p className="text-xs text-gray-400">Ref: {reg.booking_reference}</p>
                <p className="text-xs text-gray-400">{reg.number_of_people} people</p>
              </div>
              <div>
                {reg.check_in_status === 'checked_in' ? (
                  <div className="flex items-center text-green-600">
                    <CheckCircle className="h-6 w-6 mr-2" />
                    <span className="text-sm">Checked In</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleCheckIn(reg.id)}
                    disabled={processingId === reg.id}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
                  >
                    {processingId === reg.id ? 'Processing...' : 'Check In'}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p>Loading...</p>
      </div>
    </div>
  );
}

export default function EventCheckInPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CheckInContent />
    </Suspense>
  );
}
