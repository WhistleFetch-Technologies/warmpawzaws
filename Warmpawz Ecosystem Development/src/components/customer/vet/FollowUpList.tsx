import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import {
  ArrowLeft,
  MessageCircle,
  Calendar,
  Clock,
  MapPin,
  Video,
  Home,
  Stethoscope,
  ChevronRight
} from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';

interface FollowUpListProps {
  phone: string;
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

export function FollowUpList({ phone, onBack, onNavigate }: FollowUpListProps) {
  const [eligibleBookings, setEligibleBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEligibleFollowUps();
  }, []);

  const loadEligibleFollowUps = async () => {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/customer/bookings/follow-up-eligible/${phone}`,
        {
          headers: {
            Authorization: (getAuthHeaders().Authorization || ""),
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Loaded eligible follow-ups:', data);
        setEligibleBookings(data.bookings || []);
      }
    } catch (error) {
      console.error('Error loading eligible follow-ups:', error);
    } finally {
      setLoading(false);
    }
  };

  const getServiceIcon = (serviceStyle: string) => {
    switch (serviceStyle) {
      case 'at_home':
        return Home;
      case 'tele':
        return Video;
      default:
        return Stethoscope;
    }
  };

  const getDaysRemaining = (completedDate: string) => {
    const completed = new Date(completedDate);
    const now = new Date();
    const diffTime = 7 * 24 * 60 * 60 * 1000 - (now.getTime() - completed.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-[430px] mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Status Bar */}
      <div className="bg-white px-6 pt-3 pb-2 flex justify-between items-center text-black">
        <span>09:41</span>
        <div className="flex gap-1 items-center">
          <div className="w-4 h-3 bg-black/30"></div>
          <div className="w-4 h-3 bg-black/30"></div>
          <div className="w-6 h-3 bg-black/30"></div>
        </div>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-br from-teal-500 to-cyan-600 px-6 pt-4 pb-8">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-white flex-1 ml-4">Follow-Up Consultations</h1>
        </div>

        <p className="text-white/90 text-sm">
          Continue care for your pet's recent consultations
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 -mt-4 bg-white rounded-t-[32px] px-6 pt-6 pb-24">
        {eligibleBookings.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <Calendar className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-gray-900 font-semibold mb-2">No Follow-Ups Available</h3>
            <p className="text-gray-500 text-sm mb-6">
              You don't have any consultations eligible for follow-up at this time.
            </p>
            <Button onClick={onBack} className="bg-[#FF8C42] hover:bg-[#FF7A2E]">
              Browse Services
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mb-4">
              <h2 className="text-gray-900 font-semibold mb-1">Eligible for Follow-Up</h2>
              <p className="text-sm text-gray-500">
                {eligibleBookings.length} consultation{eligibleBookings.length > 1 ? 's' : ''} available
              </p>
            </div>

            {eligibleBookings.map((booking) => {
              const ServiceIcon = getServiceIcon(booking.serviceStyle);
              const daysLeft = getDaysRemaining(booking.completedDate);

              return (
                <Card key={booking.bookingId} className="p-4 border-gray-200 shadow-sm">
                  <div className="flex items-start gap-4 mb-3">
                    <div className="w-14 h-14 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <ServiceIcon className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-gray-900 mb-1">
                        {booking.serviceName}
                      </h3>
                      <p className="text-xs text-gray-500 mb-2">
                        {booking.vendorName}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {booking.scheduledDate}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {booking.scheduledTime}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium">
                        {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
                      </span>
                      <span className="text-xs text-gray-500">for follow-up</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <button
                      onClick={() => onNavigate('follow_up_chat', { booking })}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium text-gray-700 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Chat
                    </button>
                    <button
                      onClick={() => onNavigate('follow_up_booking', { booking })}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 rounded-xl text-sm font-medium text-white transition-colors"
                    >
                      <Calendar className="w-4 h-4" />
                      Book Visit
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Home Indicator */}
      <div className="fixed bottom-0 left-0 right-0 bg-white flex justify-center pb-2 max-w-[430px] mx-auto">
        <div className="w-32 h-1 bg-black rounded-full"></div>
      </div>
    </div>
  );
}
