'use client';

/**
 * ============================================================================
 * UNIFIED APPOINTMENT & SERVICE TRACKER WIDGET
 * ============================================================================
 * 
 * Fixed position widget for tracking:
 * - Upcoming tele consultation appointments
 * - Active home service bookings with GPS tracking
 * - In-progress appointments
 * 
 * Features:
 * - Minimize/Expand functionality
 * - Direct video call join for tele consultations
 * - Live GPS tracking for home services
 * - Chat coordination
 * - Real-time countdown timers
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, Clock, MapPin, Phone, MessageSquare, 
  ChevronUp, ChevronDown, X, Navigation, User,
  AlertCircle, CheckCircle2, Car, Loader2, Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface AppointmentItem {
  id: string;
  type: 'tele' | 'home' | 'clinic';
  bookingId: string;
  serviceName: string;
  providerName: string;
  status: 'upcoming' | 'starting_soon' | 'in_progress' | 'arriving';
  minutesUntil?: number;
  bookingTime?: string;
  meetingId?: string;
  // For home services
  trackingData?: {
    staffName: string;
    staffPhone?: string;
    etaMinutes?: number;
    distanceKm?: number;
    currentLocation?: { lat: number; lng: number };
    destination?: { lat: number; lng: number; address: string };
  };
}

interface UnifiedAppointmentTrackerProps {
  customerPhone: string;
  onJoinCall?: (bookingId: string, meetingId?: string) => void;
  onOpenChat?: (bookingId: string) => void;
  onCallProvider?: (phone: string) => void;
  onNavigate?: (screen: string, data?: any) => void;
  className?: string;
}

export function UnifiedAppointmentTracker({
  customerPhone,
  onJoinCall,
  onOpenChat,
  onCallProvider,
  onNavigate,
  className = '',
}: UnifiedAppointmentTrackerProps) {
  const [items, setItems] = useState<AppointmentItem[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [countdowns, setCountdowns] = useState<Record<string, number>>({});
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadDoneRef = useRef(false);

  // Load appointments and active bookings. Poll every 15s so 5-min-away tele calls show quickly
  useEffect(() => {
    initialLoadDoneRef.current = false;
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    const poll = () => loadData();
    poll();
    const id = setInterval(poll, 15000);
    pollingRef.current = id;
    return () => {
      clearInterval(pollingRef.current!);
      pollingRef.current = null;
    };
  }, [customerPhone]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdowns(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(id => {
          if (updated[id] > 0) {
            updated[id] -= 1;
          }
        });
        return updated;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    const isInitial = !initialLoadDoneRef.current;
    try {
      if (isInitial) setLoading(true);
      
      // Fetch upcoming tele consultations: use customer-specific upcoming-calls first (more reliable)
      let appointmentItemsFromTele: any[] = [];
      if (customerPhone) {
        const upcomingCallsRes = await apiClient.get<any>(
          `/customer/${encodeURIComponent(customerPhone)}/bookings/upcoming-calls?minutes=60&includeLive=true`
        ).catch(() => null);
        if (upcomingCallsRes?.success && upcomingCallsRes.bookings?.length > 0) {
          upcomingCallsRes.bookings.forEach((apt: any) => {
            const scheduledAt = new Date(apt.scheduledAt || apt.bookingDate);
            const minutesUntil = Math.max(0, Math.round((scheduledAt.getTime() - Date.now()) / 60000));
            appointmentItemsFromTele.push({
              id: apt.id,
              type: 'tele',
              bookingId: apt.id,
              serviceName: apt.serviceName || 'Tele Consultation',
              providerName: apt.vendorName || 'Doctor',
              status: minutesUntil <= 5 ? 'starting_soon' : 'upcoming',
              minutesUntil,
              bookingTime: apt.bookingTime,
              meetingId: apt.meetingId,
            });
          });
        }
      }
      // Fallback: reminders/upcoming (returns all customers; filter by customerPhone if available)
      const appointmentsRes = appointmentItemsFromTele.length > 0 ? null : await apiClient.get<any>(
        `/reminders/upcoming?minutes=60&serviceStyle=tele`
      ).catch(() => null);
      
      // Fetch active bookings with tracking (home services)
      const bookingsRes = await apiClient.get<any>(
        `/customer/bookings/active?phone=${encodeURIComponent(customerPhone)}`
      ).catch(() => null);

      const appointmentItems: AppointmentItem[] = [];

      // Process tele consultations (from upcoming-calls or reminders/upcoming)
      if (appointmentItemsFromTele.length > 0) {
        appointmentItemsFromTele.forEach((apt) => {
          const secondsUntil = (apt.minutesUntil || 0) * 60;
          appointmentItems.push(apt);
          setCountdowns(prev => ({ ...prev, [apt.id]: secondsUntil }));
        });
      } else if (appointmentsRes?.success && appointmentsRes.appointments) {
        appointmentsRes.appointments.forEach((apt: any) => {
          if (apt.serviceStyle === 'tele') {
            const minutesUntil = apt.minutesUntil || 0;
            const secondsUntil = minutesUntil * 60;
            appointmentItems.push({
              id: apt.id || apt.bookingId,
              type: 'tele',
              bookingId: apt.id || apt.bookingId,
              serviceName: apt.serviceName || 'Tele Consultation',
              providerName: apt.providerName || 'Doctor',
              status: minutesUntil <= 5 ? 'starting_soon' : 'upcoming',
              minutesUntil,
              bookingTime: apt.bookingTime,
              meetingId: apt.meetingId,
            });
            setCountdowns(prev => ({
              ...prev,
              [apt.id || apt.bookingId]: secondsUntil,
            }));
          }
        });
      }

      // Process home service bookings with tracking
      if (bookingsRes?.bookings || bookingsRes?.data) {
        const bookings = bookingsRes.bookings || bookingsRes.data || [];
        for (const booking of bookings) {
          if (booking.serviceStyle === 'at_home' && (booking.status === 'confirmed' || booking.status === 'in_progress')) {
            try {
              // Check if tracking is available
              const trackingRes = await apiClient.get<any>(
                `/tracking/booking/${booking.id || booking.bookingId}`
              ).catch(() => null);

              if (trackingRes?.success && trackingRes.tracking) {
                const t = trackingRes.tracking;
                appointmentItems.push({
                  id: booking.id || booking.bookingId,
                  type: 'home',
                  bookingId: booking.id || booking.bookingId,
                  serviceName: booking.serviceName || 'Home Service',
                  providerName: t.providerName || t.staff_name || 'Provider',
                  status: t.status === 'arrived' ? 'arriving' : t.status === 'in_transit' ? 'in_progress' : 'in_progress',
                  trackingData: {
                    staffName: t.providerName || t.staff_name,
                    staffPhone: t.staff_phone,
                    etaMinutes: t.estimatedEtaMinutes ?? t.eta_minutes,
                    distanceKm: t.distanceKm ?? t.distance_km,
                    currentLocation: t.currentLocation || t.current_location,
                    destination: t.destinationLocation || t.destination,
                  },
                });
              }
            } catch (err) {
              console.error('Error loading tracking:', err);
            }
          }
        }
      }

      setItems(appointmentItems);
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      if (isInitial) {
        initialLoadDoneRef.current = true;
        setLoading(false);
      }
    }
  };

  const handleDismiss = (id: string) => {
    setDismissed(prev => new Set([...prev, id]));
  };

  const formatCountdown = (seconds: number): string => {
    if (seconds <= 0) return 'Starting now!';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const formatETA = (minutes: number): string => {
    if (minutes < 1) return 'Arriving now';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    // ✅ FIX: Show hours when >= 60 minutes
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (mins === 0) {
      return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    } else {
      return `${hours}h ${mins}m`;
    }
  };

  // Filter out dismissed items
  const visibleItems = items.filter(item => !dismissed.has(item.id));

  // Don't show if no items or loading
  if (loading || visibleItems.length === 0) {
    return null;
  }

  // Minimized view - show as floating pill
  if (isMinimized) {
    const nextItem = visibleItems[0];
    const secondsRemaining = countdowns[nextItem.id] || 0;
    const isUrgent = nextItem.type === 'tele' && secondsRemaining <= 300; // 5 minutes

    return (
      <div className={`fixed bottom-6 right-6 z-50 ${className}`}>
        <button
          onClick={() => setIsMinimized(false)}
          className={`rounded-full shadow-lg p-4 flex items-center gap-3 transition-all hover:scale-105 ${
            isUrgent
              ? 'bg-gradient-to-r from-red-500 to-rose-600 animate-pulse'
              : nextItem.type === 'home'
              ? 'bg-gradient-to-r from-[#FF8C42] to-[#FF7029]'
              : 'bg-gradient-to-r from-purple-500 to-indigo-600'
          } text-white`}
        >
          <div className="flex items-center gap-3">
            {nextItem.type === 'tele' ? (
              <Video className="w-5 h-5" />
            ) : (
              <Car className="w-5 h-5" />
            )}
            <div className="text-left">
              <p className="font-semibold text-sm">
                {nextItem.type === 'tele' 
                  ? `${formatCountdown(secondsRemaining)}`
                  : `ETA: ${nextItem.trackingData?.etaMinutes ? formatETA(nextItem.trackingData.etaMinutes) : 'Calculating...'}`
                }
              </p>
              <p className="text-xs text-white/80">{nextItem.serviceName}</p>
            </div>
          </div>
          <ChevronUp className="w-5 h-5" />
        </button>
      </div>
    );
  }

  // Expanded view - show full card
  return (
    <div className={`fixed bottom-6 right-6 z-50 w-80 max-w-[calc(100vw-3rem)] ${className}`}>
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF7029] p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-lg">Upcoming & Active</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMinimized(true)}
                className="p-1 hover:bg-white/20 rounded-full transition"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
          </div>
          <p className="text-sm text-white/80">{visibleItems.length} {visibleItems.length === 1 ? 'item' : 'items'}</p>
        </div>

        {/* Items List */}
        <div className="max-h-96 overflow-y-auto">
          {visibleItems.map((item) => {
            const secondsRemaining = countdowns[item.id] || 0;
            const isStarting = item.type === 'tele' && secondsRemaining <= 60;
            const isUrgent = item.type === 'tele' && secondsRemaining <= 300;

            return (
              <div
                key={item.id}
                className={`p-4 border-b border-gray-100 last:border-0 ${
                  isStarting ? 'bg-red-50' : isUrgent ? 'bg-orange-50' : ''
                }`}
              >
                {/* Item Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {item.type === 'tele' ? (
                        <Video className="w-4 h-4 text-purple-600" />
                      ) : (
                        <Car className="w-4 h-4 text-[#FF8C42]" />
                      )}
                      <h4 className="font-semibold text-sm text-gray-900">{item.serviceName}</h4>
                    </div>
                    <p className="text-xs text-gray-600">{item.providerName}</p>
                  </div>
                  <button
                    onClick={() => handleDismiss(item.id)}
                    className="p-1 hover:bg-gray-100 rounded-full transition"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                {/* Countdown/Status */}
                {item.type === 'tele' && (
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className={`text-sm font-mono font-bold ${
                      isStarting ? 'text-red-600' : isUrgent ? 'text-orange-600' : 'text-gray-700'
                    }`}>
                      {formatCountdown(secondsRemaining)}
                    </span>
                    {item.bookingTime && (() => {
                      const d = new Date(item.bookingTime!);
                      const valid = !Number.isNaN(d.getTime());
                      return valid ? (
                        <span className="text-xs text-gray-500">
                          at {d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : null;
                    })()}
                  </div>
                )}

                {/* Tracking Info for Home Services */}
                {item.type === 'home' && item.trackingData && (
                  <div className="space-y-2 mb-3">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <MapPin className="w-4 h-4 text-[#FF8C42]" />
                      <span>
                        {item.trackingData.distanceKm 
                          ? `${item.trackingData.distanceKm.toFixed(1)} km away`
                          : 'Location updating...'
                        }
                      </span>
                    </div>
                    {item.trackingData.etaMinutes !== null && item.trackingData.etaMinutes !== undefined && (
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#FF8C42]">
                        <Clock className="w-4 h-4" />
                        <span>ETA: {formatETA(item.trackingData.etaMinutes)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  {item.type === 'tele' && (item.status === 'starting_soon' || item.status === 'in_progress') && (
                    <Button
                      size="sm"
                      onClick={() => {
                        if (onJoinCall) {
                          onJoinCall(item.bookingId, item.meetingId);
                        } else if (onNavigate) {
                          onNavigate('video-call', { bookingId: item.bookingId, meetingId: item.meetingId });
                        } else {
                          const params = new URLSearchParams();
                          params.set('bookingId', item.bookingId);
                          if (customerPhone) params.set('phone', customerPhone);
                          const qs = params.toString();
                          window.location.href = `/video${qs ? `?${qs}` : ''}`;
                        }
                      }}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-xs"
                    >
                      <Video className="w-3 h-3 mr-1" />
                      Join Call
                    </Button>
                  )}
                  
                  {item.type === 'home' && item.trackingData?.staffPhone && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (onCallProvider) {
                          onCallProvider(item.trackingData!.staffPhone!);
                        } else {
                          window.open(`tel:${item.trackingData!.staffPhone}`, '_self');
                        }
                      }}
                      className="flex-1 border-green-500 text-green-600 hover:bg-green-50 text-xs"
                    >
                      <Phone className="w-3 h-3 mr-1" />
                      Call
                    </Button>
                  )}
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (onOpenChat) {
                        onOpenChat(item.bookingId);
                      } else if (onNavigate) {
                        onNavigate('booking-details', { bookingId: item.bookingId, chat: true });
                      }
                    }}
                    className="flex-1 border-blue-500 text-blue-600 hover:bg-blue-50 text-xs"
                  >
                    <MessageSquare className="w-3 h-3 mr-1" />
                    Chat
                  </Button>
                </div>

                {/* View Full Details Button */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (onNavigate) {
                      onNavigate('booking-details', { bookingId: item.bookingId });
                    }
                  }}
                  className="w-full mt-2 text-xs text-gray-600 hover:text-gray-900"
                >
                  View Details
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default UnifiedAppointmentTracker;
