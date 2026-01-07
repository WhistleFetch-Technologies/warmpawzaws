'use client';

import { 
  Phone, 
  Video, 
  MapPin, 
  MessageSquare, 
  Pill, 
  FileText, 
  RefreshCw,
  CheckCircle,
  Play,
  Square
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface BookingCardProps {
  booking: any;
  vendorId: string;
  vendorData: any;
  onComplete: (booking: any) => void;
  onEndSession: (booking: any) => void;
  completingBooking: boolean;
  onRefresh: () => void;
}

export function VendorBookingCard({ 
  booking, 
  vendorId, 
  vendorData, 
  onComplete, 
  onEndSession,
  completingBooking,
  onRefresh
}: BookingCardProps) {
  
  const isVet = vendorData?.roleId === 'veterinarian' || vendorData?.roleId === 'vet';
  const isDogWalking = booking.serviceName?.toLowerCase().includes('walk') || 
                      booking.serviceName?.toLowerCase().includes('walking');
  
  const handleOpenChat = async () => {
    const bookingId = booking.bookingId || booking.id;
    try {
      await apiClient.post(`/chat/mark-read/${bookingId}`, { vendorId });
      alert(`Chat with ${booking.customerName} about ${booking.petName}'s booking.`);
      onRefresh();
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };
  
  const handleOpenPrescription = async () => {
    const bookingId = booking.bookingId || booking.id;
    
    if (booking.hasPrescription) {
      try {
        const response = await apiClient.get<any>(`/prescriptions/booking/${bookingId}`);
        alert(`📋 Prescription Details\n\n${response.prescription?.notes || 'No notes'}`);
      } catch (error) {
        alert('❌ Failed to load prescription');
      }
    } else {
      const notes = prompt('Enter prescription notes for ' + booking.petName + ':');
      if (!notes) return;
      
      try {
        await apiClient.post(`/prescriptions`, {
          bookingId,
          vendorId,
          notes,
        });
        alert('✅ Prescription uploaded successfully!');
        onRefresh();
      } catch (error: any) {
        alert('❌ Failed to upload prescription: ' + (error.message || 'Unknown error'));
      }
    }
  };
  
  return (
    <div className="border border-gray-200 rounded-xl p-0">
      <div className="flex items-start justify-between mb-0">
        <div className="flex-1">
          <div className="flex items-center gap-0 mb-0">
            <span className="text-sm font-semibold text-gray-900">{booking.time}</span>
            <span className="text-sm text-gray-600">{booking.customerName}</span>
          </div>
          <div className="flex items-center gap-0 text-xs text-gray-500 mb-0">
            <span>🐕</span>
            <span>{booking.petName} - {booking.petType}</span>
          </div>
          <div className="flex items-center gap-0 text-xs font-medium text-[#FF8C42] mb-0">
            <span>{booking.serviceName}</span>
          </div>
          <div className="flex items-center gap-0 text-xs text-gray-500">
            <MapPin className="w-3 h-3" />
            <span>{booking.location}</span>
          </div>
        </div>
      </div>
      
      {booking.status !== 'completed' && booking.status !== 'cancelled' && (() => {
        if (isDogWalking) {
          if (booking.status === 'in_progress') {
            return (
              <div className="mt-0">
                <button
                  onClick={() => onEndSession(booking)}
                  disabled={completingBooking}
                  className="w-full px-4 py-0.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-0 transition-colors disabled:opacity-50"
                >
                  <Square className="w-4 h-4" />
                  End Session & Complete
                </button>
                <p className="text-xs text-gray-500 mt-0 text-center">
                  🗺️ Customer is tracking your location
                </p>
              </div>
            );
          } else {
            return (
              <div className="mt-0">
                <button
                  onClick={() => onComplete(booking)}
                  disabled={completingBooking}
                  className="w-full px-4 py-0.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-0 transition-colors disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  Start Session with OTP
                </button>
                <p className="text-xs text-gray-500 mt-0 text-center">
                  Enter customer OTP to start walk & enable live tracking
                </p>
              </div>
            );
          }
        } else {
          return (
            <div className="mt-0">
              <button
                onClick={() => onComplete(booking)}
                disabled={completingBooking}
                className="w-full px-4 py-0.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-0 transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                {booking.communicationType === 'video' ? 'Mark Complete' : 'Complete with OTP'}
              </button>
              <p className="text-xs text-gray-500 mt-0 text-center">
                {booking.communicationType === 'video' 
                  ? 'Tele consultation - No OTP required' 
                  : 'Ask customer for 4-digit OTP to complete'}
              </p>
            </div>
          );
        }
      })()}
      
      {booking.status === 'completed' && (
        <div className="mt-0 px-0 py-0 bg-green-50 border border-green-200 rounded-lg text-center">
          <span className="text-sm font-medium text-green-700">✓ Completed</span>
        </div>
      )}
      
      <div className="mt-0 pt-0 border-t border-gray-100 flex gap-0 flex-wrap">
        {booking.communicationType === 'video' && booking.serviceType === 'tele' && booking.status !== 'completed' && (
          <button
            onClick={() => alert('Video call interface would open here.')}
            className="flex-1 min-w-[100px] py-0 px-0 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-0"
          >
            <Video className="w-3.5 h-3.5" />
            Video Call
          </button>
        )}
        
        {booking.chatEnabled !== false && (
          <button
            onClick={handleOpenChat}
            className="relative flex-1 min-w-[100px] py-0 px-0 bg-[#FF8C42] hover:bg-[#FF7829] text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-0"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Chat
            {booking.hasUnreadMessages && (
              <span className="absolute -top-0 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {booking.unreadMessageCount}
              </span>
            )}
          </button>
        )}
        
        {isVet && (booking.status === 'completed' || booking.status === 'in_progress' || booking.status === 'confirmed') && (
          <button
            onClick={handleOpenPrescription}
            className={`flex-1 min-w-[100px] py-0 px-0 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-0 ${
              booking.hasPrescription
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-green-50 hover:bg-green-100 text-green-700'
            }`}
          >
            <Pill className="w-3.5 h-3.5" />
            {booking.hasPrescription ? 'View Rx' : 'Add Rx'}
          </button>
        )}
        
        <a
          href={`tel:${booking.phone}`}
          className="flex-1 min-w-[100px] py-0 px-0 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-0"
        >
          <Phone className="w-3.5 h-3.5" />
          Call
        </a>
      </div>
      
      {isVet && booking.hasPrescription && booking.prescriptionNotes && (
        <div className="mt-0 p-0 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-0">
            <FileText className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs font-medium text-green-900">Prescription Added</div>
              <div className="text-xs text-green-700 mt-0.5 line-clamp-0">{booking.prescriptionNotes}</div>
            </div>
          </div>
        </div>
      )}
      
      {booking.isFollowUp && (
        <div className="mt-0 px-0 py-0 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-0.5">
          <RefreshCw className="w-3 h-3 text-blue-600" />
          <span className="text-xs text-blue-700 font-medium">Follow-up Appointment</span>
        </div>
      )}
    </div>
  );
}

