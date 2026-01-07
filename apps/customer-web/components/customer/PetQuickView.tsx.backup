'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, Calendar, Activity, FileText, Copy, Check, Clock, MapPin, Star, Navigation, Route, Timer, TrendingUp, Package } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

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

interface PetQuickViewProps {
  petId: string;
  phone: string;
  onBack: () => void;
  onViewFullProfile?: () => void;
}

export function PetQuickView({ petId, phone, onBack, onViewFullProfile }: PetQuickViewProps) {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'active' | 'completed' | 'details'>('upcoming');
  const [pet, setPet] = useState<Pet | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedOtp, setCopiedOtp] = useState<string | null>(null);

  useEffect(() => {
    loadPetData();
  }, [petId, phone]);

  const loadPetData = async () => {
    try {
      setLoading(true);
      
      // Load pet details
      const petResponse = await apiClient.get<{ success: boolean; pet: Pet }>(`/pet/${petId}`);
      if (petResponse.success && petResponse.pet) {
        setPet(petResponse.pet);
      }

      // Load bookings for this pet
      const bookingsResponse = await apiClient.get<{ bookings: Booking[] }>(`/bookings/${phone}`);
      if (bookingsResponse.bookings) {
        const petBookings = bookingsResponse.bookings.filter((b: any) => b.petId === petId);
        
        // Load sessions for each booking
        const bookingsWithSessions = await Promise.all(
          petBookings.map(async (booking: any) => {
            try {
              const sessionResponse = await apiClient.get<{ booking: Booking }>(`/bookings/${booking.id}`);
              return sessionResponse.booking || booking;
            } catch {
              return booking;
            }
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
    navigator.clipboard.writeText(otp);
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
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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
      <div className="bg-gradient-to-r from-primary to-primary-dark px-6 pt-12 pb-8 sticky top-0 z-20">
        <div className="flex items-center gap-4 mb-4">
          <button 
            onClick={onBack} 
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors"
          >
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
                <p className="text-white font-semibold">{pet.gender}</p>
              </div>
              <div className="bg-white/20 rounded-lg p-2">
                <p className="text-white/80 text-xs">Weight</p>
                <p className="text-white font-semibold">{pet.weight}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(['upcoming', 'active', 'completed', 'details'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 rounded-lg font-medium text-sm transition-all ${
                activeTab === tab
                  ? 'bg-white text-primary'
                  : 'bg-white/20 text-white'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6 space-y-4">
        {activeTab === 'upcoming' && (
          <div className="space-y-3">
            {upcomingSessions.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No upcoming sessions</p>
              </div>
            ) : (
              upcomingSessions.map((session) => (
                <div key={session.id} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">{session.serviceType}</h4>
                    <span className="text-xs text-gray-500">{session.vendorName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(session.date).toLocaleDateString()}</span>
                    <Clock className="w-4 h-4 ml-2" />
                    <span>{session.timeSlot}</span>
                  </div>
                  {session.otp && (
                    <div className="mt-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-orange-700">OTP</span>
                        <button
                          onClick={() => handleCopyOtp(session.otp!, session.id)}
                          className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700"
                        >
                          {copiedOtp === session.id ? (
                            <>
                              <Check className="w-3 h-3" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-2xl font-bold text-orange-600 mt-1 text-center">{session.otp}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'active' && (
          <div className="space-y-3">
            {activeSessions.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl">
                <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No active sessions</p>
              </div>
            ) : (
              activeSessions.map((session) => (
                <div key={session.id} className="bg-white rounded-2xl p-4 shadow-sm border-2 border-green-200">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">{session.serviceType}</h4>
                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">Active</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                    <Clock className="w-4 h-4" />
                    <span>Started: {session.startTime}</span>
                  </div>
                  {session.otp && (
                    <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <p className="text-xs font-semibold text-orange-700 mb-1">Service OTP</p>
                      <p className="text-2xl font-bold text-orange-600 text-center">{session.otp}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'completed' && (
          <div className="space-y-3">
            {completedSessions.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl">
                <Check className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No completed sessions</p>
              </div>
            ) : (
              completedSessions.map((session) => (
                <div key={session.id} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">{session.serviceType}</h4>
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">Completed</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(session.date).toLocaleDateString()}</span>
                  </div>
                  {session.duration && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Timer className="w-4 h-4" />
                      <span>Duration: {session.duration} min</span>
                    </div>
                  )}
                  {session.rating && (
                    <div className="flex items-center gap-1 mt-2">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${i < session.rating! ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'details' && (
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900">Pet Details</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">Name</p>
                <p className="font-medium text-gray-900">{pet.name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Breed</p>
                <p className="font-medium text-gray-900">{pet.breed}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Age</p>
                <p className="font-medium text-gray-900">{pet.age}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Gender</p>
                <p className="font-medium text-gray-900">{pet.gender}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Weight</p>
                <p className="font-medium text-gray-900">{pet.weight}</p>
              </div>
            </div>
            {onViewFullProfile && (
              <button
                onClick={onViewFullProfile}
                className="w-full py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-colors mt-4"
              >
                View Full Profile
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

