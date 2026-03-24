'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { getResolvedCustomerId } from '@/lib/customer-id-storage';

// ============================================================================
// TYPES
// ============================================================================

interface Event {
  id: string;
  title: string;
  description: string;
  category: 'adoption' | 'workshop' | 'exhibition' | 'charity' | 'training' | 'other';
  organizer_name: string;
  organizer_type: 'vendor' | 'admin' | 'partner';
  venue: string;
  address: string;
  city: string;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  image_url?: string;
  registration_required: boolean;
  registration_fee: number;
  max_participants?: number;
  registered_count: number;
  is_featured: boolean;
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  tags: string[];
}

interface Registration {
  id: string;
  event_id: string;
  event_title?: string;
  event_name?: string;
  registered_at: string;
  status: 'confirmed' | 'cancelled' | 'waitlist';
  qr_code?: string;
  booking_reference?: string;
  attendee_name?: string;
  attendee_phone?: string;
  attendee_email?: string;
  number_of_people?: number;
  payment_status?: string;
  payment_amount?: number;
  check_in_status?: 'pending' | 'checked_in' | 'no_show';
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Filters
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // UI States
  const [activeTab, setActiveTab] = useState<'discover' | 'my-events'>('discover');
  const [showEventDetails, setShowEventDetails] = useState<Event | null>(null);
  const [registering, setRegistering] = useState<string | null>(null);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get customer ID
      const customerData = localStorage.getItem('customerData');
      const customer = customerData ? JSON.parse(customerData) : null;
      const finalCustomerId =
        getResolvedCustomerId() || extractCustomerUuidFromProfile(customer as Record<string, unknown>);

      const [eventsRes, registrationsRes] = await Promise.all([
        apiClient.get<any>('/events/discover'),
        finalCustomerId
          ? apiClient.get<any>(`/events/my-registrations?customerId=${finalCustomerId}`).catch(() => ({ registrations: [] }))
          : Promise.resolve({ registrations: [] }),
      ]);
      
      setEvents(eventsRes.events || eventsRes || []);
      setRegistrations(registrationsRes.registrations || registrationsRes || []);
    } catch (err: any) {
      console.error('Error loading events:', err);
      setError(err.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleRegister = async (eventId: string) => {
    try {
      setRegistering(eventId);
      setError(null);
      
      // Get customer ID from localStorage
      const customerData = localStorage.getItem('customerData');
      const customer = customerData ? JSON.parse(customerData) : null;
      const customerId =
        getResolvedCustomerId() || extractCustomerUuidFromProfile(customer as Record<string, unknown>);

      if (!customerId) {
        setError('Please login to register for events');
        return;
      }

      await apiClient.post(`/events/${eventId}/register`, {
        customerId,
        attendeeName: customer?.name || 'Customer',
        attendeePhone: customer?.phone || '',
        attendeeEmail: customer?.email || null,
        numberOfPeople: 1,
      });
      setSuccess('Successfully registered for the event!');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to register for event');
    } finally {
      setRegistering(null);
    }
  };

  const handleCancelRegistration = async (registrationId: string) => {
    if (!confirm('Cancel your registration?')) return;
    
    try {
      await apiClient.delete(`/events/registrations/${registrationId}`);
      setSuccess('Registration cancelled');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel registration');
    }
  };

  // ============================================================================
  // FILTER
  // ============================================================================

  const filteredEvents = events.filter(event => {
    if (filterCategory && event.category !== filterCategory) return false;
    if (filterStatus && event.status !== filterStatus) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        event.title.toLowerCase().includes(search) ||
        event.description.toLowerCase().includes(search) ||
        event.organizer_name.toLowerCase().includes(search) ||
        event.tags.some(tag => tag.toLowerCase().includes(search))
      );
    }
    return true;
  });

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading events...</p>
        </div>
      </div>
    );
  }

  const categoryIcons: Record<string, string> = {
    adoption: '🏠',
    workshop: '🎓',
    exhibition: '🎪',
    charity: '❤️',
    training: '🎯',
    other: '📅',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header - Match consistency pattern: max-w-7xl mx-auto px-6 py-4 */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-orange-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              {/* ✅ FIX: Match consistency - text-2xl font-bold */}
              <h1 className="text-2xl font-bold text-gray-800">Events & Activities</h1>
              <p className="text-sm text-gray-500 mt-1">Discover and join pet-related events</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Match consistency pattern: max-w-7xl mx-auto p-6 or p-8 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6">
          
          {/* Tabs */}
          <div className="mb-6">
            <div className="flex bg-white rounded-xl p-1 shadow-sm">
          <button
            onClick={() => setActiveTab('discover')}
            className={`flex-1 py-3 rounded-lg font-medium transition ${
              activeTab === 'discover' ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            🔍 Discover Events
          </button>
          <button
            onClick={() => setActiveTab('my-events')}
            className={`flex-1 py-3 rounded-lg font-medium transition ${
              activeTab === 'my-events' ? 'bg-orange-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            📅 My Events
          </button>
        </div>
      </div>

          {/* Messages */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
            </div>
          )}
          
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center justify-between">
              <span>{success}</span>
              <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-600">✕</button>
            </div>
          )}
        {/* Discover Tab */}
        {activeTab === 'discover' && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6">
              <input
                type="text"
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="flex-1 min-w-[200px] px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
              />
              <select
                value={filterCategory}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterCategory(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
              >
                <option value="">All Categories</option>
                <option value="adoption">Adoption</option>
                <option value="workshop">Workshop</option>
                <option value="exhibition">Exhibition</option>
                <option value="charity">Charity</option>
                <option value="training">Training</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
              >
                <option value="">All Status</option>
                <option value="upcoming">Upcoming</option>
                <option value="ongoing">Ongoing</option>
              </select>
            </div>

            {/* Featured Events */}
            {!filterCategory && !filterStatus && !searchTerm && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">⭐ Featured Events</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {events.filter(e => e.is_featured).map(event => (
                    <div key={event.id} className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-6 border-2 border-orange-200">
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-3xl">{categoryIcons[event.category]}</span>
                        <span className="px-2 py-1 bg-orange-500 text-white rounded text-xs font-medium">Featured</span>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{event.title}</h3>
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">{event.description}</p>
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                          <p>{new Date(event.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                          <p>{event.start_time} - {event.end_time}</p>
                        </div>
                        <button
                          onClick={() => setShowEventDetails(event)}
                          className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All Events */}
            <h2 className="text-lg font-semibold text-gray-900 mb-4">All Events</h2>
            {filteredEvents.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                <div className="text-5xl mb-4">📅</div>
                <p className="text-gray-500">No events found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEvents.map(event => {
                  const isRegistered = registrations.some(r => r.event_id === event.id && r.status === 'confirmed');
                  const isFull = event.max_participants && event.registered_count >= event.max_participants;
                  
                  return (
                    <div key={event.id} className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition">
                      <div className="flex items-start justify-between mb-3">
                        <span className="text-3xl">{categoryIcons[event.category]}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          event.status === 'upcoming' ? 'bg-green-100 text-green-700' :
                          event.status === 'ongoing' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {event.status}
                        </span>
                      </div>
                      
                      <h3 className="font-semibold text-gray-900 mb-2">{event.title}</h3>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{event.description}</p>
                      
                      <div className="space-y-1 mb-4 text-sm text-gray-500">
                        <p>📅 {new Date(event.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        <p>🕐 {event.start_time} - {event.end_time}</p>
                        <p>📍 {event.venue}, {event.city}</p>
                        <p>👤 {event.organizer_name}</p>
                      </div>
                      
                      {event.registration_fee > 0 && (
                        <p className="text-sm font-medium text-orange-600 mb-3">₹{event.registration_fee} registration fee</p>
                      )}
                      
                      {event.max_participants && (
                        <p className="text-xs text-gray-500 mb-3">
                          {event.registered_count}/{event.max_participants} registered
                        </p>
                      )}
                      
                      <button
                        onClick={() => isRegistered ? null : handleRegister(event.id)}
                        disabled={!!(registering === event.id || isRegistered || isFull)}
                        className={`w-full py-2 rounded-lg text-sm font-medium transition ${
                          isRegistered
                            ? 'bg-green-100 text-green-700 cursor-default'
                            : isFull
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-orange-500 text-white hover:bg-orange-600'
                        }`}
                      >
                        {isRegistered ? '✓ Registered' : isFull ? 'Event Full' : registering === event.id ? 'Registering...' : 'Register Now'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* My Events Tab */}
        {activeTab === 'my-events' && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">My Registered Events</h2>
            {registrations.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                <div className="text-5xl mb-4">📅</div>
                <p className="text-gray-500 mb-4">No event registrations yet</p>
                <button
                  onClick={() => setActiveTab('discover')}
                  className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
                >
                  Discover Events
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {registrations.map(reg => {
                  const event = events.find(e => e.id === reg.event_id);
                  if (!event) return null;
                  
                  return (
                    <div key={reg.id} className="bg-white rounded-2xl p-6 shadow-sm">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-4">
                          <span className="text-3xl">{categoryIcons[event.category]}</span>
                          <div>
                            <h3 className="font-semibold text-gray-900">{event.title}</h3>
                            <p className="text-sm text-gray-500 mt-1">{event.organizer_name}</p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          reg.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {reg.status}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
                        <div>
                          <p className="text-gray-500">Date</p>
                          <p className="font-medium">{new Date(event.start_date).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Time</p>
                          <p className="font-medium">{event.start_time} - {event.end_time}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Venue</p>
                          <p className="font-medium">{event.venue}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Registered</p>
                          <p className="font-medium">{new Date(reg.registered_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      
                      {/* Booking Reference */}
                      {reg.booking_reference && (
                        <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg mb-4 border border-orange-200">
                          <p className="text-sm font-medium text-gray-700 mb-1">Booking Reference</p>
                          <p className="font-mono text-xl font-bold text-orange-600 mb-3">{reg.booking_reference}</p>
                          <p className="text-xs text-gray-600">Show this reference or QR code at the event venue</p>
                        </div>
                      )}

                      {/* QR Code */}
                      {reg.qr_code && (
                        <div className="p-4 bg-white rounded-lg border-2 border-gray-200 mb-4">
                          <p className="text-sm font-medium text-gray-700 mb-3 text-center">Your QR Code</p>
                          <div className="flex justify-center mb-2">
                            <div className="w-48 h-48 bg-white border-2 border-gray-300 rounded-lg flex items-center justify-center relative">
                              {/* QR Code Display - In production, use a QR code library to render the QR code */}
                              <div className="text-center p-4">
                                <div className="text-4xl mb-2">📱</div>
                                <p className="text-xs text-gray-500 font-mono break-all">{reg.booking_reference || 'QR Code'}</p>
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 text-center">
                            Scan this QR code at the event venue for check-in
                          </p>
                        </div>
                      )}

                      {/* Registration Details */}
                      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                        {reg.attendee_name && (
                          <div>
                            <p className="text-gray-500">Attendee</p>
                            <p className="font-medium">{reg.attendee_name}</p>
                          </div>
                        )}
                        {reg.number_of_people && (
                          <div>
                            <p className="text-gray-500">People</p>
                            <p className="font-medium">{reg.number_of_people}</p>
                          </div>
                        )}
                        {reg.payment_amount !== undefined && reg.payment_amount > 0 && (
                          <div>
                            <p className="text-gray-500">Payment</p>
                            <p className="font-medium">
                              ₹{reg.payment_amount} ({reg.payment_status || 'pending'})
                            </p>
                          </div>
                        )}
                        {reg.check_in_status && (
                          <div>
                            <p className="text-gray-500">Check-In</p>
                            <p className={`font-medium ${
                              reg.check_in_status === 'checked_in' ? 'text-green-600' : 'text-yellow-600'
                            }`}>
                              {reg.check_in_status === 'checked_in' ? '✓ Checked In' : 'Pending'}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      {reg.status === 'confirmed' && (
                        <button
                          onClick={() => handleCancelRegistration(reg.id)}
                          className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition"
                        >
                          Cancel Registration
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Modals - Outside main content wrapper */}
      {/* Event Details Modal */}
      {showEventDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">{showEventDetails.title}</h3>
                <button onClick={() => setShowEventDetails(null)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Organizer</p>
                <p className="font-medium">{showEventDetails.organizer_name}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500 mb-1">Description</p>
                <p className="text-gray-700">{showEventDetails.description}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Date</p>
                  <p className="font-medium">{new Date(showEventDetails.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Time</p>
                  <p className="font-medium">{showEventDetails.start_time} - {showEventDetails.end_time}</p>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-gray-500 mb-1">Venue</p>
                <p className="font-medium">{showEventDetails.venue}</p>
                <p className="text-sm text-gray-600">{showEventDetails.address}, {showEventDetails.city}</p>
              </div>
              
              {showEventDetails.registration_fee > 0 && (
                <div className="p-3 bg-orange-50 rounded-lg">
                  <p className="text-sm font-medium text-orange-700">
                    Registration Fee: ₹{showEventDetails.registration_fee}
                  </p>
                </div>
              )}
              
              {showEventDetails.max_participants && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Available Spots</p>
                  <p className="font-medium">
                    {showEventDetails.max_participants - showEventDetails.registered_count} of {showEventDetails.max_participants} remaining
                  </p>
                </div>
              )}
              
              {showEventDetails.tags.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Tags</p>
                  <div className="flex gap-2">
                    {showEventDetails.tags.map(tag => (
                      <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => setShowEventDetails(null)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
              >
                Close
              </button>
              {!registrations.some(r => r.event_id === showEventDetails.id && r.status === 'confirmed') && (
                <button
                  onClick={() => {
                    setShowEventDetails(null);
                    handleRegister(showEventDetails.id);
                  }}
                  disabled={registering === showEventDetails.id}
                  className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition disabled:opacity-50"
                >
                  {registering === showEventDetails.id ? 'Registering...' : 'Register Now'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

