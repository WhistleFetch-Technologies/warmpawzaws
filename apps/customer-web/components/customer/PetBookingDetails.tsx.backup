'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Clock, MapPin, Star, Copy, Check, Navigation, Route, Timer, TrendingUp, Play } from 'lucide-react';
import Image from 'next/image';
import { apiClient } from '@/lib/api-client';

interface BookingSession {
  id: string;
  date: string;
  timeSlot: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  otp?: string;
  startTime?: string;
  endTime?: string;
  distance?: number;
  duration?: number;
  route?: Array<{ lat: number; lng: number }>;
  rating?: number;
  feedback?: string;
}

interface Booking {
  id: string;
  serviceType: string;
  petId: string;
  petName: string;
  petPhoto?: string;
  vendorId: string;
  vendorName: string;
  vendorPhoto?: string;
  startDate: string;
  endDate?: string;
  duration: string;
  frequency: 'single' | 'weekly' | 'monthly';
  schedule: 'morning' | 'evening' | 'anytime';
  sessionsPerDay?: number;
  totalSessions: number;
  completedSessions: number;
  upcomingSessions: number;
  status: 'active' | 'completed' | 'cancelled';
  price: number;
  sessions: BookingSession[];
}

interface PetBookingDetailsProps {
  bookingId: string;
  petId: string;
  phone: string;
  onBack: () => void;
  onReorderMedicine?: (medications: any[]) => void;
}

export function PetBookingDetails({
  bookingId,
  petId,
  phone,
  onBack,
  onReorderMedicine
}: PetBookingDetailsProps) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedOtp, setCopiedOtp] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<BookingSession | null>(null);

  useEffect(() => {
    loadBookingDetails();
  }, [bookingId, phone]);

  const loadBookingDetails = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ booking: Booking }>(`/bookings/${bookingId}`);
      if (response.booking) {
        setBooking(response.booking);
      }
    } catch (error) {
      console.error('Error loading booking details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyOtp = (otp: string, sessionId: string) => {
    navigator.clipboard.writeText(otp);
    setCopiedOtp(sessionId);
    setTimeout(() => setCopiedOtp(null), 2000);
  };

  const getServiceIcon = (type: string) => {
    switch (type) {
      case 'walker': return '🐕';
      case 'grooming': return '✂️';
      case 'vet': return '⚕️';
      case 'boarding': return '🏠';
      default: return '📦';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-700';
      case 'active': return 'bg-green-100 text-green-700';
      case 'completed': return 'bg-gray-100 text-gray-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center w-full max-w-[430px] mx-auto">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center w-full max-w-[430px] mx-auto p-6">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Booking not found</p>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const upcomingSessions = booking.sessions?.filter(s => s.status === 'scheduled') || [];
  const activeSessions = booking.sessions?.filter(s => s.status === 'active') || [];
  const completedSessions = booking.sessions?.filter(s => s.status === 'completed') || [];

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary-dark px-6 pt-12 pb-6 sticky top-0 z-20">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onBack}
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-white text-xl font-bold">Booking Details</h1>
            <p className="text-white/90 text-sm">{booking.serviceType}</p>
          </div>
        </div>

        {/* Booking Summary */}
        <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-16 h-16 bg-white/30 rounded-xl flex items-center justify-center text-3xl">
              {getServiceIcon(booking.serviceType)}
            </div>
            <div className="flex-1 text-white">
              <h3 className="font-bold text-lg">{booking.petName}</h3>
              <p className="text-white/90 text-sm">{booking.vendorName}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white/20 rounded-lg p-2">
              <p className="text-white/80 text-xs">Total</p>
              <p className="text-white font-semibold">{booking.totalSessions}</p>
            </div>
            <div className="bg-white/20 rounded-lg p-2">
              <p className="text-white/80 text-xs">Completed</p>
              <p className="text-white font-semibold">{booking.completedSessions}</p>
            </div>
            <div className="bg-white/20 rounded-lg p-2">
              <p className="text-white/80 text-xs">Upcoming</p>
              <p className="text-white font-semibold">{booking.upcomingSessions}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6 space-y-6">
        {/* Booking Info */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-4">Booking Information</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Service Type</span>
              <span className="font-semibold text-gray-900">{booking.serviceType}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Start Date</span>
              <span className="font-semibold text-gray-900">
                {new Date(booking.startDate).toLocaleDateString()}
              </span>
            </div>
            {booking.endDate && (
              <div className="flex items-center justify-between">
                <span className="text-gray-600">End Date</span>
                <span className="font-semibold text-gray-900">
                  {new Date(booking.endDate).toLocaleDateString()}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Frequency</span>
              <span className="font-semibold text-gray-900 capitalize">{booking.frequency}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Schedule</span>
              <span className="font-semibold text-gray-900 capitalize">{booking.schedule}</span>
            </div>
            <div className="flex items-center justify-between pt-3 border-t">
              <span className="text-gray-600">Total Price</span>
              <span className="text-2xl font-bold text-primary">₹{booking.price}</span>
            </div>
          </div>
        </div>

        {/* Active Sessions */}
        {activeSessions.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">Active Sessions</h3>
            <div className="space-y-3">
              {activeSessions.map((session) => (
                <div key={session.id} className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                      Active
                    </span>
                    <span className="text-sm text-gray-600">{session.timeSlot}</span>
                  </div>
                  {session.otp && (
                    <div className="mt-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-orange-700">Service OTP</span>
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
                      <p className="text-2xl font-bold text-orange-600 text-center mt-1 tracking-widest">
                        {session.otp}
                      </p>
                    </div>
                  )}
                  {session.startTime && (
                    <div className="flex items-center gap-2 mt-3 text-sm text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>Started: {session.startTime}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Sessions */}
        {upcomingSessions.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">Upcoming Sessions</h3>
            <div className="space-y-3">
              {upcomingSessions.map((session) => (
                <div key={session.id} className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                      Scheduled
                    </span>
                    <span className="text-sm text-gray-600">{session.timeSlot}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(session.date).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed Sessions */}
        {completedSessions.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-4">Completed Sessions</h3>
            <div className="space-y-3">
              {completedSessions.map((session) => (
                <div key={session.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-semibold">
                      Completed
                    </span>
                    <span className="text-sm text-gray-600">{session.timeSlot}</span>
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
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

