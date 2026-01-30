import { useState, useEffect } from 'react';
import { ArrowLeft, MessageCircle, Calendar, ChevronRight, Clock, MapPin } from 'lucide-react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';

interface FollowUpSelectionProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

export function FollowUpSelection({ phone, onBack, onNavigate }: FollowUpSelectionProps) {
  const [eligibleBookings, setEligibleBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [showChatModal, setShowChatModal] = useState(false);

  useEffect(() => {
    loadEligibleBookings();
  }, []);

  const loadEligibleBookings = async () => {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/customer/followup-eligible/${phone}`,
        {
          headers: {
            Authorization: (getAuthHeaders().Authorization || ""),
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Follow-up eligible bookings:', data);
        setEligibleBookings(data.bookings || []);
      }
    } catch (error) {
      console.error('Error loading follow-up eligible bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChatClick = (booking: any) => {
    setSelectedBooking(booking);
    onNavigate('followup_chat', { booking });
  };

  const handleBookFollowUp = (booking: any) => {
    // Navigate to follow-up booking flow
    onNavigate('followup_booking', { 
      originalBooking: booking,
      vendorId: booking.vendorId,
      vendorName: booking.vendorName,
      isFollowUp: true
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white max-w-[430px] mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#FF8C42] to-[#FF6B35] px-6 pt-12 pb-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onBack}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-white text-2xl font-bold">Follow-Up Consultation</h1>
            <p className="text-white/90 text-sm">Continue care from previous visits</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 -mt-4 bg-white rounded-t-[32px] pt-6 pb-24 min-h-screen">
        {eligibleBookings.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Calendar className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Follow-Up Available</h3>
            <p className="text-sm text-gray-600 mb-6">
              You don't have any recent consultations eligible for follow-up.
            </p>
            <p className="text-xs text-gray-500">
              Follow-ups are available for consultations completed within the last 7 days.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Recent Consultations</h2>
              <p className="text-sm text-gray-600">
                {eligibleBookings.length} consultation{eligibleBookings.length !== 1 ? 's' : ''} eligible for follow-up
              </p>
            </div>

            <div className="space-y-4">
              {eligibleBookings.map((booking) => (
                <Card key={booking.bookingId} className="p-4 border-2 border-gray-100 hover:border-cyan-200 transition-all">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="w-7 h-7 text-white" />
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{booking.serviceName}</h3>
                      <p className="text-sm text-gray-600 mb-2">{booking.vendorName}</p>
                      
                      <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{booking.completedDate}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{booking.daysAgo} days ago</span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleChatClick(booking)}
                          className="flex-1 px-3 py-2 bg-cyan-50 text-cyan-600 rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-cyan-100 transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Chat
                        </button>
                        <button
                          onClick={() => handleBookFollowUp(booking)}
                          className="flex-1 px-3 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:shadow-lg transition-all"
                        >
                          <Calendar className="w-4 h-4" />
                          Book Follow-Up
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Info Box */}
            <Card className="mt-6 p-4 bg-cyan-50 border-cyan-200">
              <h3 className="font-semibold text-cyan-900 mb-2 text-sm">About Follow-Up Consultations</h3>
              <ul className="space-y-2 text-xs text-cyan-800">
                <li className="flex items-start gap-2">
                  <div className="w-1 h-1 bg-cyan-600 rounded-full mt-1.5"></div>
                  <span>Chat with your vet about your previous consultation for free</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1 h-1 bg-cyan-600 rounded-full mt-1.5"></div>
                  <span>Book a follow-up appointment at a discounted rate</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1 h-1 bg-cyan-600 rounded-full mt-1.5"></div>
                  <span>Follow-up availability expires 7 days after consultation</span>
                </li>
              </ul>
            </Card>
          </>
        )}
      </div>

      {/* Chat Modal */}
      {showChatModal && selectedBooking && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-white p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Chat with Veterinarian</h3>
            <p className="text-sm text-gray-600 mb-6">
              Chat feature for booking #{selectedBooking.bookingId} will be available soon. You can discuss follow-up questions about your recent consultation.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowChatModal(false)}
                variant="outline"
                className="flex-1"
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  setShowChatModal(false);
                  handleBookFollowUp(selectedBooking);
                }}
                className="flex-1 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:shadow-lg"
              >
                Book Follow-Up Instead
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}