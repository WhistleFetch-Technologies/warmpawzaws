import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, MapPin, Clock, Users, DollarSign, Search, Filter } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

interface Event {
  id: string;
  name: string;
  description: string;
  category: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  venue: {
    type: 'at_center' | 'external' | 'online';
    address?: string;
    meetingLink?: string;
  };
  registrationRequired: boolean;
  maxAttendees?: number;
  currentAttendees: number;
  fees?: number;
  status: 'published' | 'ongoing';
  imageUrl?: string;
  adoptionGoal?: number;
  fundraisingGoal?: number;
  petFriendly?: boolean;
}

interface EventListViewProps {
  vendorId: string;
  vendorName?: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

export function EventListView({ vendorId, vendorName, onBack, onNavigate }: EventListViewProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [upcomingOnly, setUpcomingOnly] = useState(true);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadEvents();
  }, [vendorId, upcomingOnly, categoryFilter]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (upcomingOnly) params.append('upcoming', 'true');
      if (categoryFilter !== 'all') params.append('category', categoryFilter);

      const response = await fetch(
        `${API_BASE}/customer/events/${vendorId}?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        // ✅ FIX: Handle standardized response format
        const eventsList = data.events || data.data?.events || [];
        setEvents(eventsList);
        console.log('✅ Loaded events:', eventsList.length);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to load events:', errorData);
        setEvents([]);
      }
    } catch (error: any) {
      console.error('Error loading events:', error);
      const errorMessage = error?.message || 'Failed to load events';
      toast.error(errorMessage);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = !searchQuery || 
      event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center max-w-md mx-auto">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-semibold text-lg">Events</h1>
            {vendorName && <p className="text-sm text-gray-600">{vendorName}</p>}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="px-4 pb-3 space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setUpcomingOnly(!upcomingOnly)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                upcomingOnly
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-gray-700 border-gray-300'
              }`}
            >
              Upcoming Only
            </button>
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="p-4 space-y-3">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No events found</p>
          </div>
        ) : (
          filteredEvents.map((event) => (
            <div
              key={event.id}
              onClick={() => onNavigate('event-detail', { event, vendorId })}
              className="bg-white rounded-xl p-4 border border-gray-200 hover:border-orange-500 transition-colors cursor-pointer"
            >
              {event.imageUrl && (
                <img
                  src={event.imageUrl}
                  alt={event.name}
                  className="w-full h-40 object-cover rounded-lg mb-3"
                />
              )}
              
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-lg flex-1">{event.name}</h3>
                  {event.fees && event.fees > 0 && (
                    <div className="flex items-center gap-1 text-orange-600 font-semibold">
                      <DollarSign className="w-4 h-4" />
                      <span>₹{event.fees}</span>
                    </div>
                  )}
                </div>

                <p className="text-sm text-gray-600 line-clamp-2">{event.description}</p>

                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDate(event.eventDate)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{event.startTime} - {event.endTime}</span>
                  </div>
                </div>

                {event.venue.type === 'online' ? (
                  <div className="flex items-center gap-1 text-xs text-blue-600">
                    <span>🌐 Online Event</span>
                  </div>
                ) : event.venue.address ? (
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate">{event.venue.address}</span>
                  </div>
                ) : null}

                {event.maxAttendees && (
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <Users className="w-3 h-3" />
                    <span>
                      {event.currentAttendees} / {event.maxAttendees} registered
                    </span>
                  </div>
                )}

                {event.petFriendly && (
                  <div className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                    🐾 Pet Friendly
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

