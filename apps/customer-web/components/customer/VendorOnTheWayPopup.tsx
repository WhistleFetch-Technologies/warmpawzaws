'use client';

/**
 * ============================================================================
 * VENDOR ON THE WAY POPUP - Customer Notification
 * ============================================================================
 * 
 * Floating popup notification when vendor is traveling to customer location
 * Similar to Zomato/Uber style tracking notifications
 * 
 * Features:
 * - Shows vendor photo, name, and ETA prominently
 * - "Track" button to open live GPS tracking
 * - Updates when status changes (en_route → arrived)
 * - Can be dismissed but reappears on updates
 * - Smooth slide-in animation from bottom
 * - Minimized mode for less intrusive display
 * 
 * Date: 2026-01-27
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  X, Navigation, Phone, Clock, MapPin, User, Car, 
  CheckCircle2, MessageSquare, Bell, ChevronUp, ChevronDown,
  Loader2, Video
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export type TrackingStatus = 'en_route' | 'in_transit' | 'arriving' | 'arrived' | 'on_way';
export type ServiceStyle = 'at_home' | 'at_center' | 'tele' | 'clinic';

interface VendorOnTheWayPopupProps {
  booking: {
    bookingId: string;
    vendorName: string;
    vendorPhoto?: string;
    vendorPhone?: string;
    serviceName: string;
    petName?: string;
    eta: number; // minutes
    distance?: number; // km
    status?: TrackingStatus;
    serviceStyle?: ServiceStyle; // ✅ NEW: To show appropriate action (Track/Video Call)
    meetingId?: string; // ✅ NEW: For tele consultations
  };
  onTrack: (bookingId: string) => void;
  onCall?: (phone: string) => void;
  onChat?: (bookingId: string) => void;
  onJoinCall?: (bookingId: string, meetingId?: string) => void; // ✅ NEW: For tele consultations
  onDismiss: () => void;
  minimizable?: boolean;
  autoMinimizeAfterMs?: number; // Auto minimize after delay
}

export function VendorOnTheWayPopup({ 
  booking, 
  onTrack, 
  onCall, 
  onChat,
  onJoinCall, // ✅ NEW: For tele consultations
  onDismiss,
  minimizable = true,
  autoMinimizeAfterMs = 10000, // 10 seconds
}: VendorOnTheWayPopupProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [displayEta, setDisplayEta] = useState(booking.eta);

  // ✅ Determine service type for appropriate action buttons
  const isTeleService = booking.serviceStyle === 'tele';
  const isHomeService = booking.serviceStyle === 'at_home';
  
  // Determine if vendor has arrived
  const hasArrived = booking.status === 'arrived';
  const isArriving = booking.status === 'arriving' || (booking.eta <= 2 && !hasArrived);

  // Animate entrance
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Update ETA display
  useEffect(() => {
    setDisplayEta(booking.eta);
  }, [booking.eta]);

  // Auto minimize after delay (optional)
  useEffect(() => {
    if (autoMinimizeAfterMs && minimizable && !isMinimized && !hasArrived) {
      const timer = setTimeout(() => {
        setIsMinimized(true);
      }, autoMinimizeAfterMs);
      return () => clearTimeout(timer);
    }
  }, [autoMinimizeAfterMs, minimizable, isMinimized, hasArrived]);

  // Expand when status changes to arrived
  useEffect(() => {
    if (hasArrived && isMinimized) {
      setIsMinimized(false);
    }
  }, [hasArrived, isMinimized]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    setTimeout(onDismiss, 300);
  }, [onDismiss]);

  const handleTrack = useCallback(() => {
    // ✅ FIX: Only call onTrack, don't trigger navigation that breaks the flow
    onTrack(booking.bookingId);
  }, [onTrack, booking.bookingId]);

  // ✅ NEW: Handle video call for tele consultations
  const handleJoinCall = useCallback(() => {
    if (onJoinCall) {
      onJoinCall(booking.bookingId, booking.meetingId);
    }
  }, [onJoinCall, booking.bookingId, booking.meetingId]);

  const handleCall = useCallback(() => {
    if (booking.vendorPhone && onCall) {
      onCall(booking.vendorPhone);
    } else if (booking.vendorPhone) {
      window.open(`tel:${booking.vendorPhone}`, '_self');
    }
  }, [booking.vendorPhone, onCall]);

  const handleChat = useCallback(() => {
    if (onChat) {
      onChat(booking.bookingId);
    }
  }, [onChat, booking.bookingId]);

  const formatEta = (minutes: number) => {
    if (minutes < 1) return 'Less than 1 min';
    if (minutes === 1) return '1 min';
    return `${Math.round(minutes)} mins`;
  };

  // Get header gradient and status based on state
  const getStatusConfig = () => {
    if (hasArrived) {
      return {
        gradient: 'from-green-500 to-emerald-600',
        icon: CheckCircle2,
        title: 'Vendor Has Arrived!',
        subtitle: `${booking.vendorName} is at your location`,
        iconAnimation: '',
        badgeColor: 'bg-green-500',
      };
    }
    if (isArriving) {
      return {
        gradient: 'from-yellow-500 to-orange-500',
        icon: Navigation,
        title: 'Almost There!',
        subtitle: `${booking.vendorName} is arriving shortly`,
        iconAnimation: 'animate-pulse',
        badgeColor: 'bg-yellow-500',
      };
    }
    return {
      gradient: 'from-blue-500 to-indigo-600',
      icon: Car,
      title: 'Vendor On The Way!',
      subtitle: `Your ${booking.serviceName} is arriving soon`,
      iconAnimation: 'animate-bounce',
      badgeColor: 'bg-blue-500',
    };
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  // Minimized floating bar (Zomato/Uber style)
  if (isMinimized) {
    return (
      <div
        className={`fixed bottom-20 left-4 right-4 z-[100] max-w-md mx-auto transition-all duration-300 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        }`}
      >
        <button
          onClick={() => setIsMinimized(false)}
          className={`w-full bg-gradient-to-r ${statusConfig.gradient} rounded-2xl shadow-lg p-4 text-white flex items-center justify-between hover:shadow-xl transition-shadow`}
        >
          <div className="flex items-center gap-3">
            {/* Vendor photo or icon */}
            <div className="w-12 h-12 rounded-full bg-white/20 overflow-hidden flex items-center justify-center">
              {booking.vendorPhoto ? (
                <img 
                  src={booking.vendorPhoto} 
                  alt={booking.vendorName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <StatusIcon className={`w-6 h-6 ${statusConfig.iconAnimation}`} />
              )}
            </div>
            <div className="text-left">
              <p className="font-semibold text-sm">{booking.vendorName}</p>
              <div className="flex items-center gap-2 text-white/80 text-xs">
                <span className={`w-2 h-2 rounded-full ${statusConfig.badgeColor} animate-pulse`} />
                <span>{hasArrived ? 'Arrived' : isArriving ? 'Arriving' : 'On the way'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!hasArrived && (
              <div className="text-right">
                <p className="font-bold text-lg">{formatEta(displayEta)}</p>
                <p className="text-xs text-white/70">ETA</p>
              </div>
            )}
            <ChevronUp className="w-5 h-5" />
          </div>
        </button>
      </div>
    );
  }

  // Full expanded popup
  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-end sm:items-center justify-center transition-all duration-300 ${
        isVisible ? 'bg-black/40' : 'bg-transparent pointer-events-none'
      }`}
      onClick={handleDismiss}
    >
      <div 
        className={`bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden transition-all duration-300 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle for mobile swipe */}
        <div className="flex justify-center pt-2 sm:hidden">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header with Animation */}
        <div className={`bg-gradient-to-r ${statusConfig.gradient} px-4 py-5 text-white relative overflow-hidden`}>
          {/* Animated background icon */}
          <div className="absolute top-0 right-0 opacity-10">
            <StatusIcon className={`w-32 h-32 -mr-8 -mt-8 ${statusConfig.iconAnimation}`} />
          </div>
          
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 bg-white/20 rounded-full flex items-center justify-center ${hasArrived ? 'ring-4 ring-white/30' : ''}`}>
                <StatusIcon className={`w-6 h-6 ${statusConfig.iconAnimation}`} />
              </div>
              <div>
                <h3 className="font-bold text-lg">{statusConfig.title}</h3>
                <p className="text-white/80 text-sm">{statusConfig.subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {minimizable && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMinimized(true);
                  }}
                  className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              )}
              <button 
                onClick={handleDismiss}
                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Vendor Info */}
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 overflow-hidden flex-shrink-0 ring-2 ring-gray-200">
              {booking.vendorPhoto ? (
                <img 
                  src={booking.vendorPhoto} 
                  alt={booking.vendorName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-100 to-orange-200">
                  <User className="w-8 h-8 text-orange-500" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-gray-900 text-lg">{booking.vendorName}</h4>
              <p className="text-sm text-gray-600">{booking.serviceName}</p>
              {booking.petName && (
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                  <span className="text-orange-400">🐾</span> For {booking.petName}
                </p>
              )}
            </div>
            {/* Quick action buttons */}
            <div className="flex flex-col gap-2">
              {booking.vendorPhone && (
                <button
                  onClick={handleCall}
                  className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center hover:bg-green-200 transition-colors"
                  title="Call vendor"
                >
                  <Phone className="w-5 h-5 text-green-600" />
                </button>
              )}
              {onChat && (
                <button
                  onClick={handleChat}
                  className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center hover:bg-blue-200 transition-colors"
                  title="Chat with vendor"
                >
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                </button>
              )}
            </div>
          </div>

          {/* ETA Card - Different styles based on status */}
          {hasArrived ? (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 mb-4 border border-green-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-green-800 font-bold text-lg">Vendor has arrived!</p>
                  <p className="text-green-600 text-sm">Please meet them at your door</p>
                </div>
                <Bell className="w-6 h-6 text-green-500 animate-bounce" />
              </div>
            </div>
          ) : (
            <div className={`bg-gradient-to-r ${isArriving ? 'from-yellow-50 to-orange-50 border-yellow-200' : 'from-blue-50 to-indigo-50 border-blue-200'} rounded-xl p-4 mb-4 border`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 ${isArriving ? 'bg-yellow-100' : 'bg-blue-100'} rounded-full flex items-center justify-center relative`}>
                    <Clock className={`w-6 h-6 ${isArriving ? 'text-yellow-600' : 'text-blue-600'}`} />
                    {/* Pulsing ring for urgency */}
                    {isArriving && (
                      <span className="absolute inset-0 rounded-full bg-yellow-400 animate-ping opacity-25" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Estimated Arrival</p>
                    <p className={`text-3xl font-bold ${isArriving ? 'text-yellow-600' : 'text-blue-600'}`}>
                      {formatEta(displayEta)}
                    </p>
                  </div>
                </div>
                {booking.distance !== undefined && booking.distance !== null && (
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-gray-500 text-sm">
                      <MapPin className="w-4 h-4" />
                      <span>{booking.distance.toFixed(1)} km</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">away</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons - Different for tele vs home services */}
          <div className="flex gap-3">
            {isTeleService ? (
              // ✅ Tele consultation: Show "Join Video Call" button
              <Button
                onClick={handleJoinCall}
                disabled={!onJoinCall}
                className="flex-1 h-12 rounded-xl font-semibold bg-[#FF8C42] hover:bg-[#FF7029] text-white disabled:opacity-50"
              >
                <Video className="w-4 h-4 mr-2" />
                {hasArrived ? 'Join Call Now' : 'Join Video Call'}
              </Button>
            ) : (
              // ✅ Home service: Show "Track Live" button
              <Button
                onClick={handleTrack}
                className={`flex-1 h-12 rounded-xl font-semibold ${
                  hasArrived 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-[#FF8C42] hover:bg-[#FF7029]'
                } text-white`}
              >
                <Navigation className="w-4 h-4 mr-2" />
                {hasArrived ? 'View Location' : 'Track Live'}
              </Button>
            )}
            {booking.vendorPhone && (
              <Button
                onClick={handleCall}
                variant="outline"
                className="h-12 rounded-xl px-4 border-gray-200"
              >
                <Phone className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Dismiss hint */}
          <p className="text-center text-xs text-gray-400 mt-4">
            {minimizable ? 'Swipe down to minimize • Tap outside to dismiss' : 'Tap outside to dismiss'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default VendorOnTheWayPopup;
