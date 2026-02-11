'use client';

/**
 * Shared Appointment Card Component
 * 
 * Reusable appointment card for both solo providers and staff
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { Clock, User, Phone, Home, Video, MapPin, MessageSquare, Navigation, CheckCircle2, Play, Radio, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface AppointmentCardProps {
  appointment: {
    id: string;
    bookingId: string;
    time: string;
    duration?: number;
    petName: string;
    petBreed?: string;
    customerName: string;
    customerPhone: string;
    serviceName: string;
    serviceType: string;
    status: string;
    price: number;
    address?: string;
    customerLat?: string;
    customerLng?: string;
    hasUnreadMessages?: boolean;
    unreadMessageCount?: number;
    chatEnabled?: boolean;
    isFollowUp?: boolean;
    otp?: string;
  };
  onViewDetails?: (appointmentId: string) => void;
  onCall?: (phone: string) => void;
  onChat?: (appointmentId: string) => void;
  onStart?: (appointmentId: string) => void;
  onComplete?: (appointmentId: string) => void;
  onAccept?: (appointmentId: string) => void;
  onReject?: (appointmentId: string) => void;
  onNavigate?: (lat: string, lng: string) => void;
  onStartGPS?: (appointmentId: string) => void;
  onStopGPS?: (appointmentId: string) => void;
  isTracking?: boolean;
  showActions?: boolean;
  className?: string;
}

export function AppointmentCard({
  appointment,
  onViewDetails,
  onCall,
  onChat,
  onStart,
  onComplete,
  onAccept,
  onReject,
  onNavigate,
  onStartGPS,
  onStopGPS,
  isTracking = false,
  showActions = true,
  className = '',
}: AppointmentCardProps) {
  const router = useRouter();
  const serviceType = appointment.serviceType?.toLowerCase();
  
  // Determine service style icon and colors
  let typeIcon = Home;
  let typeColor = 'bg-green-100';
  let typeTextColor = 'text-green-700';
  let typeLabel = 'Home Visit';

  if (serviceType === 'tele' || serviceType === 'teleconsultation') {
    typeIcon = Video;
    typeColor = 'bg-purple-100';
    typeTextColor = 'text-purple-700';
    typeLabel = 'Tele';
  } else if (serviceType === 'at_center' || serviceType === 'at_clinic') {
    typeIcon = MapPin;
    typeColor = 'bg-blue-100';
    typeTextColor = 'text-blue-700';
    typeLabel = 'At Center';
  }

  const TypeIcon = typeIcon;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'in_progress': return 'bg-blue-100 text-blue-700';
      case 'completed': return 'bg-gray-100 text-gray-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className={`bg-white border-2 border-gray-200 rounded-xl p-3 hover:border-[#FF8C42] transition-colors ${className}`}>
      <div className="flex items-start gap-3">
        {/* Service Type Icon */}
        <div className="flex flex-col items-center gap-1">
          <div className={`w-12 h-12 ${typeColor} rounded-xl flex items-center justify-center`}>
            <TypeIcon className={`w-6 h-6 ${typeTextColor}`} />
          </div>
          <span className={`text-xs font-medium ${typeTextColor}`}>{typeLabel}</span>
        </div>

        {/* Appointment Details */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-semibold text-gray-900">{appointment.time}</span>
            </div>
            <Badge className={getStatusColor(appointment.status)}>
              {appointment.status.replace('_', ' ')}
            </Badge>
          </div>

          <div className="flex items-center gap-1 mb-1">
            <User className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-500">Customer:</span>
            <span className="text-sm font-medium text-gray-900">{appointment.customerName}</span>
          </div>

          <div className="text-sm font-medium text-gray-900 mb-1">
            {appointment.petName} {appointment.petBreed ? `(${appointment.petBreed})` : ''}
          </div>

          <div className="flex items-center gap-1 mb-2">
            <span className="text-xs text-gray-500">Service:</span>
            <span className="text-xs font-medium text-[#FF8C42]">{appointment.serviceName}</span>
          </div>

          {appointment.address && (
            <div className="flex items-center gap-1 mb-2">
              <MapPin className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-700">{appointment.address}</span>
            </div>
          )}

          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-gray-900">₹{appointment.price}</span>
            {appointment.duration && (
              <span className="text-xs text-gray-500">• {appointment.duration} min</span>
            )}
          </div>

          {/* Action Buttons */}
          {showActions && (
            <div className="flex gap-2 flex-wrap">
              {onViewDetails && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewDetails(appointment.bookingId)}
                  className="flex-1 min-w-[80px]"
                >
                  Details
                </Button>
              )}

              {onCall && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onCall(appointment.customerPhone)}
                  className="flex-1 min-w-[80px]"
                >
                  <Phone className="w-3.5 h-3.5 mr-1" />
                  Call
                </Button>
              )}

              {appointment.status === 'pending' && onAccept && onReject && (
                <>
                  <Button
                    size="sm"
                    onClick={() => onAccept(appointment.bookingId)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Accept
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onReject(appointment.bookingId)}
                    className="flex-1 border-red-500 text-red-600 hover:bg-red-50"
                  >
                    Reject
                  </Button>
                </>
              )}

              {appointment.status === 'confirmed' && onStart && (
                <Button
                  size="sm"
                  onClick={() => onStart(appointment.bookingId)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Play className="w-3.5 h-3.5 mr-1" />
                  Start
                </Button>
              )}

              {appointment.status === 'in_progress' && (
                <>
                  {appointment.serviceType === 'at_home' && appointment.customerLat && appointment.customerLng && (
                    <>
                      {onNavigate && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onNavigate(appointment.customerLat!, appointment.customerLng!)}
                          className="flex-1"
                        >
                          <Navigation className="w-3.5 h-3.5 mr-1" />
                          Navigate
                        </Button>
                      )}
                      {isTracking ? (
                        onStopGPS && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onStopGPS(appointment.bookingId)}
                            className="flex-1 border-green-500 text-green-600 hover:bg-green-50"
                          >
                            <Radio className="w-3.5 h-3.5 mr-1" />
                            Stop GPS
                          </Button>
                        )
                      ) : (
                        onStartGPS && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onStartGPS(appointment.bookingId)}
                            className="flex-1 border-blue-500 text-blue-600 hover:bg-blue-50"
                          >
                            <Map className="w-3.5 h-3.5 mr-1" />
                            Start GPS
                          </Button>
                        )
                      )}
                    </>
                  )}
                  {onComplete && (
                    <Button
                      size="sm"
                      onClick={() => onComplete(appointment.bookingId)}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Complete
                    </Button>
                  )}
                </>
              )}

              {onChat && appointment.chatEnabled && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onChat(appointment.bookingId)}
                  className="relative flex-1 min-w-[80px]"
                >
                  <MessageSquare className="w-3.5 h-3.5 mr-1" />
                  Chat
                  {appointment.hasUnreadMessages && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  )}
                </Button>
              )}

              {serviceType === 'tele' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const bid = appointment.bookingId || appointment.id;
                    if (bid) {
                      let vendorId = '';
                      if (typeof window !== 'undefined') {
                        vendorId =
                          localStorage.getItem('vendorId') ||
                          localStorage.getItem('vendor_id') ||
                          '';
                      }
                      const params = new URLSearchParams();
                      params.set('bookingId', bid);
                      if (vendorId) params.set('vendorId', vendorId);
                      const query = params.toString();
                      router.push(`/video${query ? `?${query}` : ''}`);
                    }
                  }}
                  className="flex-1 min-w-[80px] py-1.5 px-3 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium flex items-center justify-center gap-1 hover:bg-purple-200"
                >
                  <Video className="w-3.5 h-3.5" />
                  Join
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
