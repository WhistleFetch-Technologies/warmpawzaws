'use client';

/**
 * ============================================================================
 * APPOINTMENT REMINDER BANNER COMPONENT
 * ============================================================================
 * 
 * Displays upcoming appointment reminders on the customer home screen
 * - Shows 5-minute warnings for video consultations
 * - One-click navigation to video call
 * - Auto-updates with countdown
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { Video, Clock, X, ArrowRight, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';

interface UpcomingAppointment {
  id: string;
  serviceName: string;
  providerName: string;
  serviceStyle: string;
  minutesUntil: number;
  bookingTime: string;
  meetingId?: string;
}

interface AppointmentReminderBannerProps {
  customerId: string;
  onJoinCall?: (bookingId: string, meetingId: string) => void;
  onOpenChat?: (bookingId: string) => void;
}

export function AppointmentReminderBanner({
  customerId,
  onJoinCall,
  onOpenChat,
}: AppointmentReminderBannerProps) {
  const [appointments, setAppointments] = useState<UpcomingAppointment[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [countdown, setCountdown] = useState<Record<string, number>>({});

  // Fetch upcoming appointments
  useEffect(() => {
    const fetchUpcoming = async () => {
      try {
        const res = await apiClient.get<any>(`/reminders/upcoming?minutes=15&serviceStyle=tele`);
        if (res.success && res.appointments) {
          setAppointments(res.appointments);
          
          // Initialize countdowns
          const newCountdown: Record<string, number> = {};
          res.appointments.forEach((apt: UpcomingAppointment) => {
            newCountdown[apt.id] = apt.minutesUntil * 60; // Convert to seconds
          });
          setCountdown(newCountdown);
        }
      } catch (error) {
        console.error('Error fetching upcoming appointments:', error);
      }
    };

    fetchUpcoming();
    const interval = setInterval(fetchUpcoming, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, [customerId]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
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

  const formatCountdown = (seconds: number): string => {
    if (seconds <= 0) return 'Starting now!';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const handleDismiss = (id: string) => {
    setDismissed(prev => new Set([...prev, id]));
  };

  // Filter out dismissed appointments
  const visibleAppointments = appointments.filter(apt => !dismissed.has(apt.id));

  if (visibleAppointments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {visibleAppointments.map((apt) => {
        const secondsRemaining = countdown[apt.id] || 0;
        const isUrgent = secondsRemaining <= 300; // 5 minutes or less
        const isStarting = secondsRemaining <= 60; // 1 minute or less

        return (
          <div
            key={apt.id}
            className={`relative overflow-hidden rounded-2xl p-4 shadow-lg transition-all ${
              isStarting
                ? 'bg-gradient-to-r from-red-500 to-rose-600 animate-pulse'
                : isUrgent
                ? 'bg-gradient-to-r from-orange-500 to-amber-500'
                : 'bg-gradient-to-r from-purple-500 to-indigo-600'
            }`}
          >
            {/* Dismiss button */}
            <button
              onClick={() => handleDismiss(apt.id)}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition"
            >
              <X className="w-4 h-4 text-white" />
            </button>

            <div className="flex items-center gap-4 text-white">
              {/* Icon */}
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                isStarting ? 'bg-white/30 animate-bounce' : 'bg-white/20'
              }`}>
                <Video className="w-7 h-7" />
              </div>

              {/* Info */}
              <div className="flex-1">
                <p className="font-bold text-lg">
                  {isStarting ? '🔴 Starting Now!' : isUrgent ? '📹 Almost Time!' : '⏰ Upcoming'}
                </p>
                <p className="text-white/90 text-sm">
                  {apt.serviceName} with {apt.providerName}
                </p>
                <div className="flex items-center gap-2 mt-1 text-sm">
                  <Clock className="w-4 h-4" />
                  <span className="font-mono font-bold">
                    {formatCountdown(secondsRemaining)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                {apt.meetingId && (
                  <Button
                    size="sm"
                    className="bg-white text-purple-600 hover:bg-purple-50"
                    onClick={() => onJoinCall?.(apt.id, apt.meetingId!)}
                  >
                    <Video className="w-4 h-4 mr-1" />
                    Join
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-transparent border-white text-white hover:bg-white/10"
                  onClick={() => onOpenChat?.(apt.id)}
                >
                  <MessageCircle className="w-4 h-4 mr-1" />
                  Chat
                </Button>
              </div>
            </div>

            {/* Progress bar */}
            {secondsRemaining > 0 && secondsRemaining <= 900 && (
              <div className="mt-3 bg-white/20 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-1000"
                  style={{ width: `${Math.max(0, (1 - secondsRemaining / 900) * 100)}%` }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default AppointmentReminderBanner;
