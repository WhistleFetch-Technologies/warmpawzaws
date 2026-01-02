import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, MapPin, Clock, Users, DollarSign, CheckCircle, AlertCircle, Phone, Mail } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

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
  allowedPets?: string[];
  menu?: { name: string; price: number }[];
  activities?: string[];
}

interface EventDetailViewProps {
  event: Event;
  vendorId: string;
  customerId?: string;
  customerPhone?: string;
  onBack: () => void;
  onSuccess?: () => void;
}

export function EventDetailView({ event, vendorId, customerId, customerPhone, onBack, onSuccess }: EventDetailViewProps) {
  const [loading, setLoading] = useState(false);
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [registrationData, setRegistrationData] = useState({
    attendeeName: '',
    attendeeEmail: '',
    attendeePhone: customerPhone || '',
    numberOfPeople: 1,
    pets: [] as { name: string; type: string; breed: string }[],
    specialRequirements: ''
  });

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const isEventFull = event.maxAttendees ? event.currentAttendees >= event.maxAttendees : false;
  const canRegister = event.registrationRequired && !isEventFull && event.status !== 'completed';

  const handleRegister = async () => {
    if (!registrationData.attendeeName || !registrationData.attendeeEmail || !registrationData.attendeePhone) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);

      // ✅ FIX: Use correct endpoint path - event registration endpoint
      // The endpoint is registered as /vendor/events/:vendorId/:eventId/register
      const response = await fetch(
        `${API_BASE}/vendor/events/${vendorId}/${event.id}/register`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(registrationData)
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          toast.success('Successfully registered for event!');
          if (onSuccess) onSuccess();
          onBack();
        } else {
          const errorMessage = data.error || data.message || 'Failed to register';
          toast.error(errorMessage);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
        const errorMessage = errorData.error || errorData.message || 'Failed to register for event';
        toast.error(errorMessage);
      }
    } catch (error: any) {
      console.error('Error registering for event:', error);
      const errorMessage = error?.message || 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-white sticky top-0 z-10 border-b border-gray-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold text-lg">Event Details</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Event Image */}
        {event.imageUrl && (
          <img
            src={event.imageUrl}
            alt={event.name}
            className="w-full h-64 object-cover rounded-xl"
          />
        )}

        {/* Event Info */}
        <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-4">
          <div>
            <h2 className="text-2xl font-bold mb-2">{event.name}</h2>
            <p className="text-gray-600">{event.description}</p>
          </div>

          {/* Date & Time */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-gray-700">
              <Calendar className="w-4 h-4 text-orange-500" />
              <span>{formatDate(event.eventDate)}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <Clock className="w-4 h-4 text-orange-500" />
              <span>{event.startTime} - {event.endTime}</span>
            </div>

            {/* Venue */}
            {event.venue.type === 'online' ? (
              <div className="flex items-center gap-2 text-blue-600">
                <span>🌐</span>
                <span>Online Event</span>
                {event.venue.meetingLink && (
                  <a href={event.venue.meetingLink} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                    Join Link
                  </a>
                )}
              </div>
            ) : event.venue.address ? (
              <div className="flex items-start gap-2 text-gray-700">
                <MapPin className="w-4 h-4 text-orange-500 mt-0.5" />
                <span>{event.venue.address}</span>
              </div>
            ) : null}

            {/* Attendees */}
            {event.maxAttendees && (
              <div className="flex items-center gap-2 text-gray-700">
                <Users className="w-4 h-4 text-orange-500" />
                <span>
                  {event.currentAttendees} / {event.maxAttendees} registered
                  {isEventFull && <span className="text-red-600 ml-2">(Full)</span>}
                </span>
              </div>
            )}

            {/* Fees */}
            {event.fees && event.fees > 0 && (
              <div className="flex items-center gap-2 text-gray-700">
                <DollarSign className="w-4 h-4 text-orange-500" />
                <span className="font-semibold">₹{event.fees} per person</span>
              </div>
            )}
          </div>

          {/* Pet Friendly */}
          {event.petFriendly && (
            <div className="inline-block px-3 py-1.5 bg-green-100 text-green-700 text-sm rounded-full">
              🐾 Pet Friendly Event
            </div>
          )}

          {/* Activities */}
          {event.activities && event.activities.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Activities</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                {event.activities.map((activity, idx) => (
                  <li key={idx}>{activity}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Menu */}
          {event.menu && event.menu.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Menu</h3>
              <div className="space-y-2">
                {event.menu.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{item.name}</span>
                    <span className="font-semibold">₹{item.price}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Registration Form */}
        {showRegistrationForm ? (
          <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-4">
            <h3 className="font-semibold text-lg">Register for Event</h3>
            
            <div className="space-y-3">
              <div>
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={registrationData.attendeeName}
                  onChange={(e) => setRegistrationData({ ...registrationData, attendeeName: e.target.value })}
                  placeholder="Enter your name"
                />
              </div>

              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={registrationData.attendeeEmail}
                  onChange={(e) => setRegistrationData({ ...registrationData, attendeeEmail: e.target.value })}
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  value={registrationData.attendeePhone}
                  onChange={(e) => setRegistrationData({ ...registrationData, attendeePhone: e.target.value })}
                  placeholder="Enter your phone"
                />
              </div>

              <div>
                <Label htmlFor="people">Number of People</Label>
                <Input
                  id="people"
                  type="number"
                  min="1"
                  value={registrationData.numberOfPeople}
                  onChange={(e) => setRegistrationData({ ...registrationData, numberOfPeople: parseInt(e.target.value) || 1 })}
                />
              </div>

              <div>
                <Label htmlFor="requirements">Special Requirements</Label>
                <Textarea
                  id="requirements"
                  value={registrationData.specialRequirements}
                  onChange={(e) => setRegistrationData({ ...registrationData, specialRequirements: e.target.value })}
                  placeholder="Any special requirements or notes..."
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setShowRegistrationForm(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRegister}
                disabled={loading}
                className="flex-1 bg-orange-500 hover:bg-orange-600"
              >
                {loading ? 'Registering...' : 'Register'}
              </Button>
            </div>
          </div>
        ) : (
          /* Register Button */
          canRegister && (
            <Button
              onClick={() => setShowRegistrationForm(true)}
              className="w-full bg-orange-500 hover:bg-orange-600"
              size="lg"
            >
              Register for Event
            </Button>
          )
        )}

        {/* Status Messages */}
        {!canRegister && (
          <div className={`p-4 rounded-xl ${
            isEventFull ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'
          }`}>
            <div className="flex items-center gap-2">
              {isEventFull ? (
                <>
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span className="text-red-700">This event is full. Registration is closed.</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 text-gray-600" />
                  <span className="text-gray-700">Registration not required for this event.</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

