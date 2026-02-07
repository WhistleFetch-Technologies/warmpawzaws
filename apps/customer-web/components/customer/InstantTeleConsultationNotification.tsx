'use client';

/**
 * ============================================================================
 * INSTANT TELE CONSULTATION NOTIFICATION
 * ============================================================================
 * 
 * Popup notification for instant tele consultations when queue is accepted
 * - Shows immediately when queue is accepted
 * - Displays "Join" button to start video call
 * - Appears on home screen as a modal/popup
 * 
 * Date: 2026-01-28
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { Video, X, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InstantTeleConsultationNotificationProps {
  booking: {
    id: string;
    vendorName: string;
    vendorPhoto?: string;
    serviceName: string;
    petName?: string;
    meetingId?: string;
  };
  onJoin: (bookingId: string, meetingId?: string) => void;
  onDismiss: () => void;
}

export function InstantTeleConsultationNotification({
  booking,
  onJoin,
  onDismiss,
}: InstantTeleConsultationNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);

  // Animate entrance
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleJoin = () => {
    onJoin(booking.id, booking.meetingId);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(onDismiss, 300);
  };

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
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <Video className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">Consultation Ready!</h3>
                <p className="text-white/90 text-sm">Your doctor is waiting</p>
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
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center">
                <Video className="w-8 h-8 text-slate-400" />
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

          <div className="bg-orange-50 rounded-xl p-4 mb-6 border border-orange-200">
            <div className="flex items-center gap-2 text-orange-700">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">Your consultation is ready to start</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleDismiss}
              variant="outline"
              className="flex-1 h-12 border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Later
            </Button>
            <Button
              onClick={handleJoin}
              className="flex-1 h-12 bg-[#FF8C42] hover:bg-[#FF7A35] text-white font-semibold"
            >
              <Video className="w-4 h-4 mr-2" />
              Join Now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
