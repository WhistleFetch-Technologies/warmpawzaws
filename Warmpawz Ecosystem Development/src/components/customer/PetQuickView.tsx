import { useState, useEffect } from 'react';
import { 
  ChevronLeft, Calendar, Activity, FileText, Copy, Check,
  Clock, MapPin, Star, Navigation, Route, Timer, TrendingUp, Package
} from 'lucide-react';
import { Button } from '../ui/button';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import { copyTextToClipboard } from '../../utils/shareUtils';
import { LiveTracking } from './LiveTracking';
import { BookingActions } from './BookingActions';

interface Pet {
  id: string;
  name: string;
  type: string;
  breed: string;
  age: string;
  gender: string;
  weight: string;
  photo?: string;
  color?: string;
}

interface BookingSession {
  id: string;
  date: string;
  timeSlot: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  otp?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
  distance?: number;
  route?: Array<{ lat: number; lng: number }>;
  rating?: number;
  feedback?: string;
}

interface Booking {
  id: string;
  serviceType: string;
  vendorName: string;
  vendorPhoto?: string;
  startDate: string;
  totalSessions: number;
  completedSessions: number;
  upcomingSessions: number;
  status: 'active' | 'completed' | 'cancelled';
  price: number;
  sessions: BookingSession[];
}

export function PetQuickView({
  petId,
  phone,
  onBack,
  onViewFullProfile
}: {
  petId: string;
  phone: string;
  onBack: () => void;
  onViewFullProfile?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'active' | 'completed' | 'details'>('upcoming');
  const [pet, setPet] = useState<Pet | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedOtp, setCopiedOtp] = useState<string | null>(null);
  const [trackingSession, setTrackingSession] = useState<{ sessionId: string; bookingId: string } | null>(null);

  useEffect(() => {
    loadPetData();
  }, [petId]);

  const loadPetData = async () => {
    try {
      setLoading(true);
      
      // Load pet details
      const petResponse = await fetch(
        `${getApiBaseUrl()}/pet/${petId}`,
        { headers: getAuthHeaders() }
      );

      if (petResponse.ok) {
        const petResult = await petResponse.json();
        if (petResult.success && petResult.pet) {
          setPet(petResult.pet);
        }
      }

      // Load bookings for this pet
      console.log(`[PetQuickView] Fetching bookings for phone: ${phone}`);
      const bookingsResponse = await fetch(
        `${getApiBaseUrl()}/bookings/${phone}`,
        { headers: getAuthHeaders() }
      );

      if (bookingsResponse.ok) {
        const bookingsResult = await bookingsResponse.json();
        console.log(`[PetQuickView] Bookings response:`, bookingsResult);
        const petBookings = (bookingsResult.bookings || []).filter((b: any) => b.petId === petId);
        console.log(`[PetQuickView] Filtered pet bookings for pet ${petId}:`, petBookings);
        
        // Load sessions for each booking
        const bookingsWithSessions = await Promise.all(
          petBookings.map(async (booking: any) => {
            const sessionResponse = await fetch(
              `${getApiBaseUrl()}/bookings/${booking.id}`,
              { headers: getAuthHeaders() }
            );
            
            if (sessionResponse.ok) {
              const sessionResult = await sessionResponse.json();
              return sessionResult.booking;
            }
            return booking;
          })
        );
        
        setBookings(bookingsWithSessions);
      }
    } catch (error) {
      console.error('Error loading pet data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyOtp = (otp: string, sessionId: string) => {
    copyTextToClipboard(otp);
    setCopiedOtp(sessionId);
    setTimeout(() => setCopiedOtp(null), 2000);
  };

  // Collect all sessions from all bookings
  const allSessions = bookings.flatMap(booking => 
    (booking.sessions || []).map(session => ({
      ...session,
      bookingId: booking.id,
      serviceType: booking.serviceType,
      vendorName: booking.vendorName
    }))
  );

  const upcomingSessions = allSessions.filter(s => s.status === 'scheduled');
  const activeSessions = allSessions.filter(s => s.status === 'active');
  const completedSessions = allSessions.filter(s => s.status === 'completed');

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center w-full max-w-[430px] mx-auto">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto p-6">
        <p className="text-center text-gray-600">Pet not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto pb-8">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] px-6 pt-12 pb-8 sticky top-0 z-20">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={onBack} className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-white text-xl font-bold">{pet.name}</h1>
            <p className="text-white/90 text-sm">{pet.breed}</p>
          </div>
        </div>

        {/* Pet Quick Info */}
        <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/30 rounded-xl overflow-hidden">
              {pet.photo ? (
                <img src={pet.photo} alt={pet.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl">
                  {pet.type === 'dog' ? '🐕' : pet.type === 'cat' ? '🐈' : '🐾'}
                </div>
              )}
            </div>
            <div className="flex-1 grid grid-cols-3 gap-2 text-center">
              <div className="bg-white/20 rounded-lg p-2">
                <p className="text-white/80 text-xs">Age</p>
                <p className="text-white font-semibold">{pet.age}</p>
              </div>
              <div className="bg-white/20 rounded-lg p-2">
                <p className="text-white/80 text-xs">Gender</p>
                <p className="text-white font-semibold capitalize">{pet.gender}</p>
              </div>
              <div className="bg-white/20 rounded-lg p-2">
                <p className="text-white/80 text-xs">Weight</p>
                <p className="text-white font-semibold">{pet.weight}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-2 px-2">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeTab === 'upcoming'
                ? 'bg-white text-[#FF8C42]'
                : 'bg-white/20 text-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Upcoming ({upcomingSessions.length})
          </button>
          <button
            onClick={() => setActiveTab('active')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeTab === 'active'
                ? 'bg-white text-[#FF8C42]'
                : 'bg-white/20 text-white'
            }`}
          >
            <Activity className="w-4 h-4" />
            Active ({activeSessions.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeTab === 'completed'
                ? 'bg-white text-[#FF8C42]'
                : 'bg-white/20 text-white'
            }`}
          >
            <Check className="w-4 h-4" />
            Completed ({completedSessions.length})
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeTab === 'details'
                ? 'bg-white text-[#FF8C42]'
                : 'bg-white/20 text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            Details
          </button>
        </div>
      </div>

      {/* Content with Curved Top */}
      <div className="bg-white rounded-t-[32px] -mt-6 px-6 py-6 space-y-4">
        {/* Upcoming Sessions */}
        {activeTab === 'upcoming' && (
          upcomingSessions.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl">
              <div className="w-20 h-20 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Calendar className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">No Upcoming Sessions</h3>
              <p className="text-gray-600 text-sm">Book a service for {pet.name}</p>
            </div>
          ) : (
            upcomingSessions.map((session: any) => (
              <div key={session.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-800 mb-1 capitalize">
                      {session.serviceType} - {session.vendorName}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {new Date(session.date).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>{session.timeSlot}</span>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                    Scheduled
                  </span>
                </div>

                {/* OTP Section */}
                {session.otp && (
                  <div className="bg-gradient-to-br from-orange-50 to-pink-50 rounded-xl p-4 border-2 border-orange-200">
                    <p className="text-sm text-gray-700 mb-2 font-medium">Session Start OTP:</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-3xl font-bold text-[#FF8C42] tracking-wider">{session.otp}</span>
                      </div>
                      <button
                        onClick={() => handleCopyOtp(session.otp!, session.id)}
                        className="w-10 h-10 bg-white rounded-lg flex items-center justify-center hover:bg-gray-50 transition-all"
                      >
                        {copiedOtp === session.id ? (
                          <Check className="w-5 h-5 text-green-600" />
                        ) : (
                          <Copy className="w-5 h-5 text-gray-600" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      Share this OTP with the service provider
                    </p>
                  </div>
                )}
              </div>
            ))
          )
        )}

        {/* Active Sessions */}
        {activeTab === 'active' && (
          activeSessions.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl">
              <div className="w-20 h-20 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Navigation className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">No Active Sessions</h3>
              <p className="text-gray-600 text-sm">Active sessions will appear here</p>
            </div>
          ) : (
            activeSessions.map((session: any) => (
              <div key={session.id} className="bg-white rounded-2xl p-5 shadow-sm border-2 border-green-300">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-800 mb-1 capitalize">
                      {session.serviceType} - {session.vendorName}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {new Date(session.date).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>{session.timeSlot}</span>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full animate-pulse">
                    In Progress
                  </span>
                </div>

                {/* Live Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <Timer className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                    <p className="text-xs text-gray-600 mb-1">Duration</p>
                    <p className="font-bold text-gray-800">{session.duration || 0} min</p>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-3 text-center">
                    <Route className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                    <p className="text-xs text-gray-600 mb-1">Distance</p>
                    <p className="font-bold text-gray-800">{session.distance || 0} km</p>
                  </div>
                </div>

                {/* Live Tracking Button */}
                <Button 
                  className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 rounded-xl font-semibold"
                  onClick={() => setTrackingSession({ sessionId: session.id, bookingId: session.bookingId })}
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  Track Live Location
                </Button>
              </div>
            ))
          )
        )}

        {/* Completed Sessions */}
        {activeTab === 'completed' && (
          completedSessions.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl">
              <div className="w-20 h-20 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Check className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">No Completed Sessions</h3>
              <p className="text-gray-600 text-sm">Completed sessions will appear here</p>
            </div>
          ) : (
            completedSessions.map((session: any) => (
              <div key={session.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-800 mb-1 capitalize">
                      {session.serviceType} - {session.vendorName}
                    </h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {new Date(session.date).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>{session.startTime} - {session.endTime}</span>
                    </div>
                  </div>
                  {session.rating && (
                    <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-full">
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                      <span className="text-xs font-semibold">{session.rating}</span>
                    </div>
                  )}
                </div>

                {/* Session Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-3 text-center">
                    <Timer className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                    <p className="text-xs text-gray-600 mb-1">Duration</p>
                    <p className="font-bold text-gray-800 text-sm">{session.duration} min</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-3 text-center">
                    <Route className="w-4 h-4 text-purple-600 mx-auto mb-1" />
                    <p className="text-xs text-gray-600 mb-1">Distance</p>
                    <p className="font-bold text-gray-800 text-sm">{session.distance?.toFixed(2)} km</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-3 text-center">
                    <TrendingUp className="w-4 h-4 text-green-600 mx-auto mb-1" />
                    <p className="text-xs text-gray-600 mb-1">Speed</p>
                    <p className="font-bold text-gray-800 text-sm">
                      {session.distance && session.duration 
                        ? ((session.distance / (session.duration / 60))).toFixed(1)
                        : '0'} km/h
                    </p>
                  </div>
                </div>

                {/* Route Map Preview */}
                {session.route && session.route.length > 0 && (
                  <div className="bg-gray-100 rounded-xl h-32 mb-3 relative overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                      <MapPin className="w-8 h-8" />
                    </div>
                    <div className="absolute bottom-2 right-2">
                      <button className="bg-white px-3 py-1.5 rounded-lg text-xs font-medium text-[#FF8C42] shadow-sm">
                        View Map
                      </button>
                    </div>
                  </div>
                )}

                {/* Feedback */}
                {session.feedback && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-sm text-gray-700 italic">"{session.feedback}"</p>
                  </div>
                )}
              </div>
            ))
          )
        )}

        {/* Pet Details */}
        {activeTab === 'details' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4">Service Bookings</h3>
              {bookings.length === 0 ? (
                <div className="text-center py-6">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">No active bookings</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {bookings.map((booking) => (
                    <div key={booking.id} className="bg-gradient-to-br from-orange-50 to-pink-50 rounded-xl p-4 border border-orange-100">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-800 mb-1 capitalize">
                            {booking.serviceType} Service
                          </h4>
                          <p className="text-sm text-gray-600">{booking.vendorName}</p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                          booking.status === 'active' ? 'bg-green-100 text-green-700' :
                          booking.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                        </span>
                      </div>

                      {booking.status === 'active' && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                            <span>{booking.completedSessions} of {booking.totalSessions} completed</span>
                            <span>{Math.round((booking.completedSessions / booking.totalSessions) * 100)}%</span>
                          </div>
                          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B35]"
                              style={{ width: `${(booking.completedSessions / booking.totalSessions) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-sm mb-3">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Clock className="w-4 h-4" />
                          <span>{new Date(booking.startDate).toLocaleDateString()}</span>
                        </div>
                        <div className="text-[#FF8C42] font-semibold">
                          ₹{booking.price}
                        </div>
                      </div>
                      
                      {/* Booking Actions - Reschedule & Cancel */}
                      <BookingActions 
                        booking={booking}
                        phone={phone}
                        onSuccess={loadPetData}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button 
              onClick={onViewFullProfile}
              className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white py-6 rounded-xl font-semibold"
            >
              View Full Profile & Health Records
            </Button>
          </div>
        )}
      </div>

      {/* Live Tracking Modal */}
      {trackingSession && (
        <LiveTracking
          sessionId={trackingSession.sessionId}
          bookingId={trackingSession.bookingId}
          onClose={() => setTrackingSession(null)}
        />
      )}
    </div>
  );
}