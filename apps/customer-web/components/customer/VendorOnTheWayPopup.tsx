'use client';

/**
 * VendorOnTheWayPopup - Notification popup when vendor is traveling to customer location
 * 
 * Features:
 * - Shows vendor photo, name, and ETA
 * - Click to open GPS tracking
 * - Auto-dismiss after action or timeout
 * - Animated entrance/exit
 */

import { useState, useEffect } from 'react';
import { X, Navigation, Phone, Clock, MapPin, User, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  };
  onTrack: (bookingId: string) => void;
  onCall?: (phone: string) => void;
  onDismiss: () => void;
}

export function VendorOnTheWayPopup({ 
  booking, 
  onTrack, 
  onCall, 
  onDismiss 
}: VendorOnTheWayPopupProps) {
  const [isVisible, setIsVisible] = useState(false);

  // Animate entrance
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(onDismiss, 300);
  };

  const handleTrack = () => {
    onTrack(booking.bookingId);
    handleDismiss();
  };

  const handleCall = () => {
    if (booking.vendorPhone && onCall) {
      onCall(booking.vendorPhone);
    } else if (booking.vendorPhone) {
      window.open(`tel:${booking.vendorPhone}`, '_self');
    }
  };

  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 transition-all duration-300 ${
        isVisible ? 'bg-black/40' : 'bg-transparent pointer-events-none'
      }`}
      onClick={handleDismiss}
    >
      <div 
        className={`bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transition-all duration-300 ${
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Animation */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-4 text-white relative overflow-hidden">
          {/* Animated car icon */}
          <div className="absolute top-2 right-2 opacity-20">
            <Car className="w-24 h-24 animate-bounce" />
          </div>
          
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Navigation className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Vendor On The Way!</h3>
                <p className="text-white/80 text-sm">Your {booking.serviceName} is arriving soon</p>
              </div>
            </div>
            <button 
              onClick={handleDismiss}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Vendor Info */}
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
              {booking.vendorPhoto ? (
                <img 
                  src={booking.vendorPhoto} 
                  alt={booking.vendorName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-100 to-orange-200">
                  <User className="w-7 h-7 text-orange-500" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900">{booking.vendorName}</h4>
              <p className="text-sm text-gray-500">{booking.serviceName}</p>
              {booking.petName && (
                <p className="text-xs text-gray-400">For {booking.petName}</p>
              )}
            </div>
            {booking.vendorPhone && (
              <button
                onClick={handleCall}
                className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center hover:bg-green-200 transition-colors"
              >
                <Phone className="w-5 h-5 text-green-600" />
              </button>
            )}
          </div>

          {/* ETA Card */}
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl p-4 mb-4 border border-orange-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <Clock className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Estimated Arrival</p>
                  <p className="text-2xl font-bold text-orange-600">{booking.eta} min</p>
                </div>
              </div>
              {booking.distance && (
                <div className="text-right">
                  <div className="flex items-center gap-1 text-gray-500 text-sm">
                    <MapPin className="w-4 h-4" />
                    <span>{booking.distance.toFixed(1)} km away</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleTrack}
              className="flex-1 bg-[#FF8C42] hover:bg-[#FF7029] text-white h-12 rounded-xl font-semibold"
            >
              <Navigation className="w-4 h-4 mr-2" />
              Track Live Location
            </Button>
          </div>

          {/* Dismiss hint */}
          <p className="text-center text-xs text-gray-400 mt-3">
            Tap outside to dismiss
          </p>
        </div>
      </div>
    </div>
  );
}

export default VendorOnTheWayPopup;
