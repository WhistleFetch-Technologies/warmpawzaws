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
import { toast } from 'sonner';

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
  
  // ✅ Handle Open Chat
  const handleOpenChat = async () => {
    console.log('💬 Opening chat for booking:', booking.bookingId || booking.id);
    
    const bookingId = booking.bookingId || booking.id;
    
    // Mark messages as read (if endpoint exists)
    try {
      const { apiCallJson } = await import('@warmpawz/api-client/http');
      const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';
      if (API_GATEWAY_URL) {
        // Note: Chat mark-read endpoint may not exist yet, so we'll skip silently
        try {
          await apiCallJson<any>(
            `${API_GATEWAY_URL}/make-server-3dd53475/chat/mark-read/${bookingId}`,
            {
              method: 'POST',
              body: JSON.stringify({ vendorId })
            }
          );
        } catch (err) {
          // Endpoint may not exist yet, that's OK
          console.log('Chat mark-read endpoint not available yet');
        }
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
    
    // TODO: Navigate to VendorChatInterface
    // For now, show alert
    alert(`Chat with ${booking.customerName} about ${booking.petName}'s booking.\n\nChat interface will open here.`);
    
    // Reload bookings to clear unread badges
    onRefresh();
  };
  
  // ✅ Handle Open Prescription
  const handleOpenPrescription = async () => {
    console.log('💊 Opening prescription for booking:', booking.bookingId || booking.id);
    
    const bookingId = booking.bookingId || booking.id;
    const { apiCallJson } = await import('@warmpawz/api-client/http');
    const API_GATEWAY_URL = process.env.NEXT_PUBLIC_API_GATEWAY_URL || '';
    if (!API_GATEWAY_URL) {
      toast.error('API Gateway URL not configured');
      return;
    }
    
    if (booking.hasPrescription) {
      // View existing prescription
      try {
        const data = await apiCallJson<any>(
          `${API_GATEWAY_URL}/make-server-3dd53475/vendor/prescription/booking/${bookingId}`
        );
        
        if (data.success && data.prescription) {
          const prescription = data.prescription;
          alert(`📋 Prescription Details\n\n${prescription.notes || prescription.generalNotes || 'No notes'}\n\nUploaded: ${new Date(prescription.uploadedAt).toLocaleString()}`);
        } else {
          toast.error('Failed to load prescription');
        }
      } catch (error: any) {
        console.error('Error fetching prescription:', error);
        toast.error(error?.message || 'Error loading prescription');
      }
    } else {
      // Upload new prescription
      const notes = prompt('Enter prescription notes for ' + booking.petName + ':');
      if (!notes) return;
      
      try {
        const result = await apiCallJson<any>(
          `${API_GATEWAY_URL}/make-server-3dd53475/vendor/prescription/upload`,
          {
            method: 'POST',
            body: JSON.stringify({
              bookingId,
              vendorId,
              prescriptionNotes: notes,
              prescriptionFile: null // TODO: Add file upload
            })
          }
        );
        
        if (result.success) {
          toast.success('Prescription uploaded successfully!');
          onRefresh(); // Reload to show prescription badge
        } else {
          toast.error(result.error || result.message || 'Failed to upload prescription');
        }
      } catch (error: any) {
        console.error('Error uploading prescription:', error);
        toast.error(error?.message || 'Error uploading prescription');
      }
    }
  };
  
  return (
    <div className="border border-gray-200 rounded-xl p-3">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-gray-900">{booking.time}</span>
            <span className="text-sm text-gray-600">{booking.customerName}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
            <span>🐕</span>
            <span>{booking.petName} - {booking.petType}</span>
          </div>
          <div className="flex items-center gap-1 text-xs font-medium text-[#FF8C42] mb-1">
            <span>{booking.serviceName}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <MapPin className="w-3 h-3" />
            <span>{booking.location}</span>
          </div>
        </div>
      </div>
      
      {/* Action buttons based on status */}
      {booking.status !== 'completed' && booking.status !== 'cancelled' && (() => {
        if (isDogWalking) {
          // DOG WALKING: Show Start/End Session buttons
          if (booking.status === 'in_progress') {
            return (
              <div className="mt-3">
                <button
                  onClick={() => onEndSession(booking)}
                  disabled={completingBooking}
                  className="w-full px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Square className="w-4 h-4" />
                  End Session & Complete
                </button>
                <p className="text-xs text-gray-500 mt-1 text-center">
                  🗺️ Customer is tracking your location
                </p>
              </div>
            );
          } else {
            return (
              <div className="mt-3">
                <button
                  onClick={() => onComplete(booking)}
                  disabled={completingBooking}
                  className="w-full px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  Start Session with OTP
                </button>
                <p className="text-xs text-gray-500 mt-1 text-center">
                  Enter customer OTP to start walk & enable live tracking
                </p>
              </div>
            );
          }
        } else {
          // REGULAR SERVICES: Complete with OTP (or without for tele)
          return (
            <div className="mt-3">
              <button
                onClick={() => onComplete(booking)}
                disabled={completingBooking}
                className="w-full px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                {booking.communicationType === 'video' ? 'Mark Complete' : 'Complete with OTP'}
              </button>
              <p className="text-xs text-gray-500 mt-1 text-center">
                {booking.communicationType === 'video' 
                  ? 'Tele consultation - No OTP required' 
                  : 'Ask customer for 4-digit OTP to complete'}
              </p>
            </div>
          );
        }
      })()}
      
      {booking.status === 'completed' && (
        <div className="mt-3 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-center">
          <span className="text-sm font-medium text-green-700">✓ Completed</span>
        </div>
      )}
      
      {/* ✅ NEW: Action Buttons Row - Chat, Prescription, Call */}
      <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2 flex-wrap">
        {/* Call Button - TELE ONLY */}
        {booking.communicationType === 'video' && booking.serviceType === 'tele' && booking.status !== 'completed' && (
          <button
            onClick={() => alert('Video call interface would open here.\n\nIntegrate with your video call provider (Jitsi, Agora, Twilio, etc.)')}
            className="flex-1 min-w-[100px] py-2 px-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1"
          >
            <Video className="w-3.5 h-3.5" />
            Video Call
          </button>
        )}
        
        {/* Chat Button - ALL BOOKINGS */}
        {booking.chatEnabled !== false && (
          <button
            onClick={handleOpenChat}
            className="relative flex-1 min-w-[100px] py-2 px-3 bg-[#FF8C42] hover:bg-[#FF7829] text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Chat
            {booking.hasUnreadMessages && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {booking.unreadMessageCount}
              </span>
            )}
          </button>
        )}
        
        {/* Prescription Button - VET ONLY */}
        {isVet && (booking.status === 'completed' || booking.status === 'in_progress' || booking.status === 'confirmed') && (
          <button
            onClick={handleOpenPrescription}
            className={`flex-1 min-w-[100px] py-2 px-3 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${
              booking.hasPrescription
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-green-50 hover:bg-green-100 text-green-700'
            }`}
          >
            <Pill className="w-3.5 h-3.5" />
            {booking.hasPrescription ? 'View Rx' : 'Add Rx'}
          </button>
        )}
        
        {/* Phone Call Link */}
        <a
          href={`tel:${booking.phone}`}
          className="flex-1 min-w-[100px] py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1"
        >
          <Phone className="w-3.5 h-3.5" />
          Call
        </a>
      </div>
      
      {/* ✅ Prescription Info Widget */}
      {isVet && booking.hasPrescription && booking.prescriptionNotes && (
        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-2">
            <FileText className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-xs font-medium text-green-900">Prescription Added</div>
              <div className="text-xs text-green-700 mt-0.5 line-clamp-2">{booking.prescriptionNotes}</div>
            </div>
          </div>
        </div>
      )}
      
      {/* ✅ Follow-up Indicator */}
      {booking.isFollowUp && (
        <div className="mt-2 px-2 py-1 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-1.5">
          <RefreshCw className="w-3 h-3 text-blue-600" />
          <span className="text-xs text-blue-700 font-medium">Follow-up Appointment</span>
        </div>
      )}
    </div>
  );
}
