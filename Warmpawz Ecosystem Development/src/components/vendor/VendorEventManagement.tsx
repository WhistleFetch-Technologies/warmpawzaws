import React, { useState, useEffect } from 'react';
import { Calendar, Users, CheckCircle, XCircle, MapPin, Clock, Plus, Edit2 } from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import { toast } from 'react-toastify';

interface Event {
  id: string;
  vendorType: 'shelter' | 'cafe' | 'other';
  name: string;
  description: string;
  category: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  venue: {
    type: 'at_center' | 'external' | 'online';
    address?: string;
    capacity?: number;
    meetingLink?: string;
  };
  registrationRequired: boolean;
  maxAttendees?: number;
  currentAttendees: number;
  fees?: number;
  status: 'draft' | 'published' | 'ongoing' | 'completed' | 'cancelled';
  
  // Shelter-specific
  adoptionGoal?: number;
  fundraisingGoal?: number;
  amountRaised?: number;
  animalsAvailable?: number;
  animalsAdopted?: number;
  
  // Cafe-specific
  petFriendly?: boolean;
  allowedPets?: string[];
  menu?: { name: string; price: number }[];
  activities?: string[];
  
  sponsors?: string[];
  createdAt: string;
}

interface EventRegistration {
  id: string;
  eventId: string;
  attendeeName: string;
  attendeeEmail: string;
  numberOfPeople: number;
  pets?: { name: string; type: string }[];
  checkInStatus: 'pending' | 'checked_in' | 'no_show';
  status: 'confirmed' | 'waitlist' | 'cancelled';
  createdAt: string;
}

interface VendorEventManagementProps {
  vendorId: string;
  vendorData?: any;
  vendorType?: 'shelter' | 'cafe' | 'other';
  onBack?: () => void;
}

export function VendorEventManagement({ vendorId, vendorData, vendorType = 'other', onBack }: VendorEventManagementProps) {
  const [activeTab, setActiveTab] = useState<'events' | 'registrations'>('events');
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  const [eventForm, setEventForm] = useState({
    name: '',
    description: '',
    category: vendorType === 'shelter' ? 'adoption_drive' : 'pet_party',
    eventDate: '',
    startTime: '',
    endTime: '',
    venueType: 'at_center' as 'at_center' | 'external' | 'online',
    address: '',
    capacity: '',
    meetingLink: '',
    registrationRequired: true,
    maxAttendees: '',
    fees: '',
    
    // Shelter-specific
    adoptionGoal: '',
    fundraisingGoal: '',
    animalsAvailable: '',
    
    // Cafe-specific
    petFriendly: true,
    allowedPets: [] as string[],
    activities: [] as string[]
  });

  useEffect(() => {
    loadDashboard();
    loadEvents();
  }, [vendorId]);

  useEffect(() => {
    if (selectedEvent) {
      loadRegistrations(selectedEvent.id);
    }
  }, [selectedEvent]);

  const loadDashboard = async () => {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/vendor/event-management/${vendorId}/dashboard`,
        {
          headers: { Authorization: (getAuthHeaders().Authorization || "") }
        }
      );
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  };

  const loadEvents = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/vendor/event-management/${vendorId}/list`,
        {
          headers: { Authorization: (getAuthHeaders().Authorization || "") }
        }
      );
      const data = await response.json();
      if (data.success) {
        setEvents(data.events);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRegistrations = async (eventId: string) => {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/vendor/event-management/${vendorId}/${eventId}/registrations`,
        {
          headers: { Authorization: (getAuthHeaders().Authorization || "") }
        }
      );
      const data = await response.json();
      if (data.success) {
        setRegistrations(data.registrations);
      }
    } catch (error) {
      console.error('Error loading registrations:', error);
    }
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingEvent
        ? `${getApiBaseUrl()}/vendor/event-management/${vendorId}/${editingEvent.id}`
        : `${getApiBaseUrl()}/vendor/event-management/${vendorId}/create`;

      const method = editingEvent ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: (getAuthHeaders().Authorization || "")
        },
        body: JSON.stringify({
          ...eventForm,
          vendorType,
          venue: {
            type: eventForm.venueType,
            address: eventForm.address,
            capacity: eventForm.capacity ? parseInt(eventForm.capacity) : undefined,
            meetingLink: eventForm.meetingLink
          },
          maxAttendees: eventForm.maxAttendees ? parseInt(eventForm.maxAttendees) : undefined,
          fees: eventForm.fees ? parseFloat(eventForm.fees) : undefined,
          adoptionGoal: eventForm.adoptionGoal ? parseInt(eventForm.adoptionGoal) : undefined,
          fundraisingGoal: eventForm.fundraisingGoal ? parseFloat(eventForm.fundraisingGoal) : undefined,
          animalsAvailable: eventForm.animalsAvailable ? parseInt(eventForm.animalsAvailable) : undefined
        })
      });

      const data = await response.json();
      if (data.success) {
        setShowAddEvent(false);
        setEditingEvent(null);
        resetForm();
        loadEvents();
        loadDashboard();
      }
    } catch (error) {
      console.error('Error saving event:', error);
    }
  };

  const updateEventStatus = async (eventId: string, status: Event['status']) => {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/vendor/event-management/${vendorId}/${eventId}/status`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: (getAuthHeaders().Authorization || "")
          },
          body: JSON.stringify({ status })
        }
      );
      const data = await response.json();
      if (data.success) {
        loadEvents();
        loadDashboard();
      }
    } catch (error) {
      console.error('Error updating event status:', error);
    }
  };

  // ✅ FIX: Priority 2 Gap #1 - Add DELETE handler
  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event? This will also delete all registrations. This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/vendor/event-management/${vendorId}/${eventId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: (getAuthHeaders().Authorization || "")
          }
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success('Event deleted successfully');
        loadEvents();
        loadDashboard();
      } else {
        toast.error(data.error || 'Failed to delete event');
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Error deleting event');
    }
  };

  const handleCheckIn = async (eventId: string, registrationId: string) => {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/vendor/event-management/${vendorId}/${eventId}/registrations/${registrationId}/checkin`,
        {
          method: 'PUT',
          headers: { Authorization: (getAuthHeaders().Authorization || "") }
        }
      );

      const data = await response.json();
      if (data.success && selectedEvent) {
        loadRegistrations(selectedEvent.id);
      }
    } catch (error) {
      console.error('Error checking in:', error);
    }
  };

  const resetForm = () => {
    setEventForm({
      name: '',
      description: '',
      category: vendorType === 'shelter' ? 'adoption_drive' : 'pet_party',
      eventDate: '',
      startTime: '',
      endTime: '',
      venueType: 'at_center',
      address: '',
      capacity: '',
      meetingLink: '',
      registrationRequired: true,
      maxAttendees: '',
      fees: '',
      adoptionGoal: '',
      fundraisingGoal: '',
      animalsAvailable: '',
      petFriendly: true,
      allowedPets: [],
      activities: []
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'published': return 'bg-blue-100 text-blue-800';
      case 'ongoing': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-purple-100 text-purple-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryOptions = () => {
    if (vendorType === 'shelter') {
      return [
        { value: 'adoption_drive', label: 'Adoption Drive' },
        { value: 'fundraiser', label: 'Fundraiser' },
        { value: 'awareness_campaign', label: 'Awareness Campaign' },
        { value: 'volunteer_drive', label: 'Volunteer Drive' }
      ];
    } else if (vendorType === 'cafe') {
      return [
        { value: 'pet_party', label: 'Pet Party' },
        { value: 'meetup', label: 'Pet Meetup' },
        { value: 'training_workshop', label: 'Training Workshop' },
        { value: 'contest', label: 'Pet Contest' }
      ];
    }
    return [{ value: 'other', label: 'Other' }];
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          {onBack && (
            <button onClick={onBack} className="text-blue-600 hover:text-blue-700 mb-4">
              ← Back to Dashboard
            </button>
          )}
          <h1 className="text-3xl text-gray-900 mb-2">Event Management</h1>
          <p className="text-gray-600">Manage events, track registrations, and monitor attendance</p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Upcoming Events</p>
                  <p className="text-2xl text-gray-900 mt-1">{stats.events?.upcoming || 0}</p>
                </div>
                <Calendar className="text-blue-500" size={32} />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Ongoing</p>
                  <p className="text-2xl text-green-600 mt-1">{stats.events?.ongoing || 0}</p>
                </div>
                <Clock className="text-green-500" size={32} />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">Total Registrations</p>
                  <p className="text-2xl text-gray-900 mt-1">{stats.attendance?.totalRegistered || 0}</p>
                </div>
                <Users className="text-purple-500" size={32} />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">
                    {vendorType === 'shelter' ? 'Total Adoptions' : 'Completed Events'}
                  </p>
                  <p className="text-2xl text-orange-600 mt-1">
                    {vendorType === 'shelter' ? stats.shelter?.totalAdoptions || 0 : stats.events?.completed || 0}
                  </p>
                </div>
                <CheckCircle className="text-orange-500" size={32} />
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="bg-white rounded-lg shadow">
          {/* Events Tab Content */}
          {!selectedEvent ? (
            <div className="p-6">
              <div className="flex justify-between mb-6">
                <h2 className="text-xl text-gray-900">All Events</h2>
                <button
                  onClick={() => {
                    setEditingEvent(null);
                    resetForm();
                    setShowAddEvent(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus size={20} />
                  Create Event
                </button>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="text-gray-600 mt-2">Loading events...</p>
                </div>
              ) : events.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="mx-auto text-gray-400 mb-4" size={48} />
                  <p className="text-gray-600">No events created yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {events.map((event) => (
                    <div key={event.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg text-gray-900">{event.name}</h3>
                            <span className={`px-2 py-1 rounded text-xs ${getStatusColor(event.status)}`}>
                              {event.status.toUpperCase()}
                            </span>
                            {event.petFriendly && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                                🐾 Pet-Friendly
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mb-3">{event.description}</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Date:</span>
                              <p className="text-gray-900">{new Date(event.eventDate).toLocaleDateString()}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Time:</span>
                              <p className="text-gray-900">{event.startTime} - {event.endTime}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Venue:</span>
                              <p className="text-gray-900 capitalize">{event.venue.type.replace('_', ' ')}</p>
                            </div>
                            <div>
                              <span className="text-gray-500">Attendees:</span>
                              <p className="text-gray-900">
                                {event.currentAttendees}
                                {event.maxAttendees ? ` / ${event.maxAttendees}` : ''}
                              </p>
                            </div>
                          </div>

                          {/* Shelter-specific metrics */}
                          {vendorType === 'shelter' && (
                            <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                              {event.adoptionGoal && (
                                <div>
                                  <span className="text-gray-500">Adoptions:</span>
                                  <p className="text-green-600">
                                    {event.animalsAdopted || 0} / {event.adoptionGoal}
                                  </p>
                                </div>
                              )}
                              {event.fundraisingGoal && (
                                <div>
                                  <span className="text-gray-500">Funds Raised:</span>
                                  <p className="text-blue-600">
                                    ₹{event.amountRaised?.toLocaleString() || 0} / ₹{event.fundraisingGoal.toLocaleString()}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingEvent(event);
                              setEventForm({
                                name: event.name,
                                description: event.description,
                                category: event.category,
                                eventDate: event.eventDate.split('T')[0],
                                startTime: event.startTime,
                                endTime: event.endTime,
                                venueType: event.venue.type,
                                address: event.venue.address || '',
                                capacity: event.venue.capacity?.toString() || '',
                                meetingLink: event.venue.meetingLink || '',
                                registrationRequired: event.registrationRequired,
                                maxAttendees: event.maxAttendees?.toString() || '',
                                fees: event.fees?.toString() || '',
                                adoptionGoal: event.adoptionGoal?.toString() || '',
                                fundraisingGoal: event.fundraisingGoal?.toString() || '',
                                animalsAvailable: event.animalsAvailable?.toString() || '',
                                petFriendly: event.petFriendly || false,
                                allowedPets: event.allowedPets || [],
                                activities: event.activities || []
                              });
                              setShowAddEvent(true);
                            }}
                            className="px-3 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 flex items-center gap-1 text-sm"
                          >
                            <Edit2 size={14} />
                            Edit
                          </button>
                          <button
                            onClick={() => setSelectedEvent(event)}
                            className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
                          >
                            View Registrations
                          </button>
                          {event.status === 'draft' && (
                            <button
                              onClick={() => updateEventStatus(event.id, 'published')}
                              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                            >
                              Publish
                            </button>
                          )}
                          {event.status === 'published' && (
                            <button
                              onClick={() => updateEventStatus(event.id, 'ongoing')}
                              className="px-3 py-1 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm"
                            >
                              Start
                            </button>
                          )}
                          {event.status === 'ongoing' && (
                            <button
                              onClick={() => updateEventStatus(event.id, 'completed')}
                              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                            >
                              Complete
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
                            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Registrations View */
            <div className="p-6">
              <div className="mb-6">
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-blue-600 hover:text-blue-700 mb-4"
                >
                  ← Back to Events
                </button>
                <h2 className="text-2xl text-gray-900 mb-2">{selectedEvent.name}</h2>
                <p className="text-gray-600">Registrations and Check-ins</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Total Registered</p>
                  <p className="text-2xl text-blue-600">{registrations.length}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Confirmed</p>
                  <p className="text-2xl text-green-600">
                    {registrations.filter(r => r.status === 'confirmed').length}
                  </p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Checked In</p>
                  <p className="text-2xl text-purple-600">
                    {registrations.filter(r => r.checkInStatus === 'checked_in').length}
                  </p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600">No Show</p>
                  <p className="text-2xl text-red-600">
                    {registrations.filter(r => r.checkInStatus === 'no_show').length}
                  </p>
                </div>
              </div>

              {registrations.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="mx-auto text-gray-400 mb-4" size={48} />
                  <p className="text-gray-600">No registrations yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {registrations.map((reg) => (
                    <div key={reg.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-gray-900">{reg.attendeeName}</h4>
                            <span className={`px-2 py-1 rounded text-xs ${
                              reg.checkInStatus === 'checked_in' ? 'bg-green-100 text-green-800' :
                              reg.checkInStatus === 'no_show' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {reg.checkInStatus === 'checked_in' ? '✓ Checked In' :
                               reg.checkInStatus === 'no_show' ? 'No Show' : 'Pending'}
                            </span>
                            {reg.status === 'waitlist' && (
                              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                                Waitlist
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                            <div>Email: {reg.attendeeEmail}</div>
                            <div>People: {reg.numberOfPeople}</div>
                            <div>Registered: {new Date(reg.createdAt).toLocaleDateString()}</div>
                            {reg.pets && reg.pets.length > 0 && (
                              <div>Pets: {reg.pets.length}</div>
                            )}
                          </div>
                        </div>
                        {reg.checkInStatus === 'pending' && reg.status === 'confirmed' && (
                          <button
                            onClick={() => handleCheckIn(selectedEvent.id, reg.id)}
                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
                          >
                            <CheckCircle size={18} />
                            Check In
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Event Modal */}
      {showAddEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-3xl w-full my-8">
            <div className="p-6 max-h-[85vh] overflow-y-auto">
              <h2 className="text-2xl text-gray-900 mb-4">
                {editingEvent ? 'Edit Event' : 'Create Event'}
              </h2>
              <form onSubmit={handleSaveEvent} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-700 mb-1">Event Name *</label>
                    <input
                      type="text"
                      required
                      value={eventForm.name}
                      onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-700 mb-1">Description *</label>
                    <textarea
                      required
                      value={eventForm.description}
                      onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Category *</label>
                    <select
                      required
                      value={eventForm.category}
                      onChange={(e) => setEventForm({ ...eventForm, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {getCategoryOptions().map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Event Date *</label>
                    <input
                      type="date"
                      required
                      value={eventForm.eventDate}
                      onChange={(e) => setEventForm({ ...eventForm, eventDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Start Time *</label>
                    <input
                      type="time"
                      required
                      value={eventForm.startTime}
                      onChange={(e) => setEventForm({ ...eventForm, startTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1">End Time *</label>
                    <input
                      type="time"
                      required
                      value={eventForm.endTime}
                      onChange={(e) => setEventForm({ ...eventForm, endTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Venue Type *</label>
                    <select
                      required
                      value={eventForm.venueType}
                      onChange={(e) => setEventForm({ ...eventForm, venueType: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="at_center">At Center</option>
                      <option value="external">External Location</option>
                      <option value="online">Online Event</option>
                    </select>
                  </div>

                  {eventForm.venueType === 'external' && (
                    <div className="md:col-span-2">
                      <label className="block text-sm text-gray-700 mb-1">Address</label>
                      <input
                        type="text"
                        value={eventForm.address}
                        onChange={(e) => setEventForm({ ...eventForm, address: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  )}

                  {eventForm.venueType === 'online' && (
                    <div className="md:col-span-2">
                      <label className="block text-sm text-gray-700 mb-1">Meeting Link</label>
                      <input
                        type="url"
                        value={eventForm.meetingLink}
                        onChange={(e) => setEventForm({ ...eventForm, meetingLink: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Max Attendees</label>
                    <input
                      type="number"
                      min="1"
                      value={eventForm.maxAttendees}
                      onChange={(e) => setEventForm({ ...eventForm, maxAttendees: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Entry Fee (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={eventForm.fees}
                      onChange={(e) => setEventForm({ ...eventForm, fees: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  {/* Shelter-specific fields */}
                  {vendorType === 'shelter' && (
                    <>
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Adoption Goal</label>
                        <input
                          type="number"
                          min="0"
                          value={eventForm.adoptionGoal}
                          onChange={(e) => setEventForm({ ...eventForm, adoptionGoal: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Fundraising Goal (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={eventForm.fundraisingGoal}
                          onChange={(e) => setEventForm({ ...eventForm, fundraisingGoal: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-700 mb-1">Animals Available</label>
                        <input
                          type="number"
                          min="0"
                          value={eventForm.animalsAvailable}
                          onChange={(e) => setEventForm({ ...eventForm, animalsAvailable: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    {editingEvent ? 'Update Event' : 'Create Event'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddEvent(false);
                      setEditingEvent(null);
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}