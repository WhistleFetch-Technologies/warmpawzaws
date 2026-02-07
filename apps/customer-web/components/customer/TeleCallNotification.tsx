'use client';

/**
 * ============================================================================
 * TELE CALL NOTIFICATION - WhatsApp-like Call Experience
 * ============================================================================
 * 
 * Shows incoming/outgoing call notification similar to WhatsApp
 * - Phone ringing animation
 * - Accept/Reject buttons
 * - Shows vendor/provider info
 * - Works for both incoming (vendor calling) and outgoing (customer calling)
 * 
 * Date: 2026-01-27
 * ============================================================================
 */

import { useState, useEffect, useRef } from 'react';
import { Video, Phone, PhoneOff, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Rule 3: Play ringtone for incoming video call (loud notification)
function useIncomingCallRingtone(ringing: boolean, callType: string) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!ringing || callType !== 'incoming') return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;
      const playBeep = () => {
        if (!audioContextRef.current) return;
        const o = audioContextRef.current.createOscillator();
        const g = audioContextRef.current.createGain();
        o.connect(g);
        g.connect(audioContextRef.current.destination);
        o.frequency.value = 800;
        o.type = 'sine';
        g.gain.setValueAtTime(0.25, audioContextRef.current.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + 0.3);
        o.start(audioContextRef.current.currentTime);
        o.stop(audioContextRef.current.currentTime + 0.3);
      };
      playBeep();
      intervalRef.current = setInterval(playBeep, 1200);
    } catch (_) {}
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      audioContextRef.current = null;
    };
  }, [ringing, callType]);
}

interface TeleCallNotificationProps {
  callType: 'incoming' | 'outgoing';
  provider: {
    id: string;
    name: string;
    photo?: string;
    role?: string;
  };
  bookingId: string;
  meetingId?: string;
  serviceName?: string;
  petName?: string;
  onAccept: (bookingId: string, meetingId?: string) => void;
  onReject: () => void;
  onDismiss?: () => void;
}

export function TeleCallNotification({
  callType,
  provider,
  bookingId,
  meetingId,
  serviceName,
  petName,
  onAccept,
  onReject,
  onDismiss,
}: TeleCallNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [ringing, setRinging] = useState(true);

  // Rule 3: Loud incoming call notification (ringtone)
  useIncomingCallRingtone(ringing, callType);

  // Animate entrance
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Ringing animation
  useEffect(() => {
    if (ringing) {
      // Auto-reject after 30 seconds if not answered
      const timeout = setTimeout(() => {
        handleReject();
      }, 30000);
      return () => clearTimeout(timeout);
    }
  }, [ringing]);

  const handleAccept = () => {
    setRinging(false);
    setIsVisible(false);
    onAccept(bookingId, meetingId);
  };

  const handleReject = () => {
    setRinging(false);
    setIsVisible(false);
    setTimeout(() => {
      onReject();
      onDismiss?.();
    }, 300);
  };

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/80 transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div
        className={`bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-4 transform transition-all duration-300 ${
          isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
      >
        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-[#FF8C42] to-[#FF6B35] rounded-t-3xl px-6 py-8 text-center">
          <div className="flex flex-col items-center">
            {/* Provider Photo */}
            {provider.photo ? (
              <img
                src={provider.photo}
                alt={provider.name}
                className={`w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg mb-4 ${
                  ringing ? 'animate-pulse' : ''
                }`}
              />
            ) : (
              <div className={`w-24 h-24 rounded-full bg-white/20 flex items-center justify-center border-4 border-white shadow-lg mb-4 ${
                ringing ? 'animate-pulse' : ''
              }`}>
                <User className="w-12 h-12 text-white" />
              </div>
            )}

            {/* Call Status */}
            <div className="flex items-center gap-2 mb-2">
              {ringing && (
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
              <h3 className="text-white font-bold text-xl">
                {callType === 'incoming' ? 'Incoming Call' : 'Calling...'}
              </h3>
            </div>

            {/* Provider Name */}
            <p className="text-white/90 text-lg font-semibold">{provider.name}</p>
            {provider.role && (
              <p className="text-white/80 text-sm">{provider.role}</p>
            )}
            {serviceName && (
              <p className="text-white/70 text-xs mt-1">{serviceName}</p>
            )}
            {petName && (
              <p className="text-white/70 text-xs">For {petName}</p>
            )}
          </div>
        </div>

        {/* Action Buttons - big round green Accept / red Reject (calling style) */}
        <div className="p-6 flex gap-8 justify-center items-center">
          {/* Reject - big red round */}
          <button
            onClick={handleReject}
            className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-xl transition-transform hover:scale-110 active:scale-95"
            aria-label="Reject call"
          >
            <PhoneOff className="w-10 h-10 text-white" />
          </button>

          {/* Accept - big green round */}
          <button
            onClick={handleAccept}
            className="w-20 h-20 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center shadow-xl transition-transform hover:scale-110 active:scale-95"
            aria-label="Accept call"
          >
            <Phone className="w-10 h-10 text-white" />
          </button>
        </div>

        {/* Call Type Indicator */}
        <div className="px-6 pb-6 text-center">
          <div className="flex items-center justify-center gap-2 text-gray-600">
            <Video className="w-4 h-4" />
            <span className="text-sm">Video Call</span>
          </div>
        </div>
      </div>
    </div>
  );
}
