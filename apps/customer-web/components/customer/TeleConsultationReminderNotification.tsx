'use client';

/**
 * ============================================================================
 * TELE CONSULTATION REMINDER NOTIFICATION
 * ============================================================================
 * 
 * Notification for upcoming video calls - supports two variants:
 * - 'banner': Fixed top banner (default, for general reminders)
 * - 'modal': Full-screen modal popup (for imminent calls, similar to GPS tracker)
 * 
 * GAP FIX: Enhanced to support full-screen modal variant like GPS tracker popup
 * 
 * Features:
 * - Shows countdown to consultation
 * - "Open Chat" button to coordinate before call
 * - "Start Call" button when time is close
 * - Auto-dismisses after call starts
 * 
 * Phase: Phase 2 - Customer Engagement & Notifications
 * Date: 2026-01-28
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { Video, MessageSquare, X, Clock, Phone } from 'lucide-react';
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
  /** 
   * Variant: 'banner' for top banner, 'modal' for full-screen popup
   * GAP FIX: Added modal variant for imminent calls (similar to GPS tracker popup)
   */
  variant?: 'banner' | 'modal';
}

export function TeleConsultationReminderNotification({
  booking,
  onOpenChat,
  onStartCall,
  onDismiss,
  variant = 'banner', // Default to banner for backward compatibility
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

  // ============================================
  // MODAL VARIANT (Full-screen popup)
  // GAP FIX: Similar to GPS tracker popup for imminent calls
  // ============================================
  if (variant === 'modal') {
    return (
      <div
        className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/50 transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleDismiss}
      >
        <div
          className={`bg-white rounded-2xl shadow-2xl max-w-[90%] w-full max-w-md mx-4 transform transition-all duration-300 ${
            isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] rounded-t-2xl px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                  <Video className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">
                    {countdown <= 1 ? 'Starting Now!' : `Starting in ${countdown} min`}
                  </h3>
                  <p className="text-white/90 text-sm">Video Consultation</p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            <div className="flex items-start gap-4 mb-6">
              {booking.vendorPhoto ? (
                <img
                  src={booking.vendorPhoto}
                  alt={booking.vendorName}
                  className="w-16 h-16 rounded-full object-cover border-2 border-orange-200"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center">
                  <Video className="w-8 h-8 text-orange-500" />
                </div>
              )}
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 text-base mb-1">
                  {booking.vendorName}
                </h4>
                <p className="text-sm text-gray-600 mb-1">{booking.serviceName}</p>
                {booking.petName && (
                  <p className="text-xs text-gray-500">For {booking.petName}</p>
                )}
              </div>
            </div>

            {/* Chat Info Box */}
            <div className="bg-blue-50 rounded-xl p-4 mb-4 border border-blue-200">
              <div className="flex items-center gap-2 text-blue-700 mb-2">
                <MessageSquare className="w-4 h-4" />
                <span className="text-sm font-medium">Chat is now active!</span>
              </div>
              <p className="text-xs text-blue-600">
                You can message your provider before the call starts.
              </p>
            </div>

            {/* Countdown Timer */}
            <div className="bg-orange-50 rounded-xl p-4 mb-6 border border-orange-200">
              <div className="flex items-center justify-center gap-3">
                <Clock className="w-5 h-5 text-orange-600" />
                <span className="text-2xl font-bold text-orange-700">
                  {countdown <= 0 ? 'Starting...' : `${countdown}:00`}
                </span>
                <span className="text-sm text-orange-600">
                  {countdown <= 0 ? '' : countdown === 1 ? 'minute' : 'minutes'}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleOpenChat}
                variant="outline"
                className="flex-1 h-12 border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Open Chat
              </Button>
              <Button
                onClick={handleStartCall}
                disabled={!onStartCall}
                className="flex-1 h-12 bg-[#FF8C42] hover:bg-[#FF7A35] text-white font-semibold disabled:opacity-50"
              >
                <Video className="w-4 h-4 mr-2" />
                {countdown <= 1 ? 'Join Call' : 'Start Call'}
              </Button>
            </div>

            {countdown > 2 && (
              <p className="text-xs text-center text-gray-500 mt-4">
                Call will auto-start at scheduled time
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // BANNER VARIANT (Original top banner)
  // ============================================
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
              {/* ✅ FIX: Always show video call button for tele consultations */}
              {onStartCall && (
                <Button
                  onClick={handleStartCall}
                  size="sm"
                  className={`h-8 px-3 text-xs font-semibold ${
                    countdown <= 2 
                      ? 'bg-white text-[#FF8C42] hover:bg-white/90 animate-pulse' 
                      : 'bg-white/30 text-white hover:bg-white/40'
                  }`}
                >
                  <Video className="w-3 h-3 mr-1" />
                  {countdown <= 2 ? 'Join Now' : 'Join Call'}
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
