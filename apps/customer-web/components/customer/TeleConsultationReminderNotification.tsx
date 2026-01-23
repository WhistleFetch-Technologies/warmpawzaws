'use client';

/**
 * ============================================================================
 * TELE CONSULTATION REMINDER NOTIFICATION
 * ============================================================================
 * 
 * Fixed top banner notification for upcoming video calls
 * - Shows "Consultation in 5 minutes" message
 * - "Open Chat" button to coordinate before call
 * - Auto-dismisses after call starts
 * 
 * Phase: Phase 2 - Customer Engagement & Notifications
 * Date: 2026-01-28
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { Video, MessageSquare, X, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TeleConsultationReminderNotificationProps {
  booking: {
    id: string;
    vendorName: string;
    vendorPhoto?: string;
    serviceName: string;
    petName?: string;
    scheduledAt: string;
    minutesUntil: number;
    meetingId?: string;
  };
  onOpenChat: (bookingId: string) => void;
  onStartCall?: (bookingId: string, meetingId?: string) => void;
  onDismiss: () => void;
}

export function TeleConsultationReminderNotification({
  booking,
  onOpenChat,
  onStartCall,
  onDismiss,
}: TeleConsultationReminderNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [countdown, setCountdown] = useState(booking.minutesUntil);

  // Animate entrance
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Update countdown every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const scheduled = new Date(booking.scheduledAt);
      const diff = Math.max(0, Math.round((scheduled.getTime() - now.getTime()) / 60000));
      setCountdown(diff);

      // Auto-dismiss if time has passed
      if (diff <= 0) {
        onDismiss();
      }
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [booking.scheduledAt, onDismiss]);

  const handleOpenChat = () => {
    onOpenChat(booking.id);
  };

  const handleStartCall = () => {
    if (onStartCall) {
      onStartCall(booking.id, booking.meetingId);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(onDismiss, 300);
  };

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[100] transition-all duration-300 ${
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      }`}
    >
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white shadow-lg">
        <div className="max-w-[430px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Video className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">
                  Consultation in {countdown} {countdown === 1 ? 'minute' : 'minutes'}
                </div>
                <div className="text-xs text-white/90 truncate">
                  {booking.vendorName} • {booking.serviceName}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                onClick={handleOpenChat}
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-0 h-8 px-3 text-xs"
              >
                <MessageSquare className="w-3 h-3 mr-1" />
                Chat
              </Button>
              {onStartCall && countdown <= 2 && (
                <Button
                  onClick={handleStartCall}
                  size="sm"
                  className="bg-white text-[#FF8C42] hover:bg-white/90 h-8 px-3 text-xs font-semibold"
                >
                  <Video className="w-3 h-3 mr-1" />
                  Start
                </Button>
              )}
              <button
                onClick={handleDismiss}
                className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
