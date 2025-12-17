import { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, Star, ChevronRight, User, Heart, Settings, LogOut, FileText, Package, Gift, Coins } from 'lucide-react';
import { Button } from '../ui/button';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { useLogout } from '../../hooks/useLogout';

interface Booking {
  id: string;
  serviceType: 'walker' | 'grooming' | 'vet' | 'boarding';
  petId: string;
  petName: string;
  petPhoto?: string;
  vendorId: string;
  vendorName: string;
  vendorPhoto?: string;
  startDate: string;
  endDate?: string;
  duration: string;
  frequency: 'single' | 'weekly' | 'monthly';
  schedule: 'morning' | 'evening' | 'anytime';
  sessionsPerDay?: number;
  totalSessions: number;
  completedSessions: number;
  upcomingSessions: number;
  status: 'active' | 'completed' | 'cancelled';
  price: number;
  sessions?: BookingSession[];
}

interface BookingSession {
  id: string;
  date: string;
  timeSlot: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  otp?: string;
  startTime?: string;
  endTime?: string;
  distance?: number;
  duration?: number;
  route?: Array<{ lat: number; lng: number }>;
  rating?: number;
  feedback?: string;
}

export function CustomerSidebar({ 
  phone, 
  isOpen, 
  onClose,
  onViewBooking,
  onNavigate
}: { 
  phone: string; 
  isOpen: boolean; 
  onClose: () => void;
  onViewBooking?: (bookingId: string, petId: string) => void;
  onNavigate?: (screen: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'bookings' | 'profile' | 'settings'>('bookings');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const { logout } = useLogout();

  useEffect(() => {
    if (isOpen) {
      loadBookings();
    }
  }, [isOpen, phone]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/bookings/${phone}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const result = await response.json();
        setBookings(result.bookings || []);
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getServiceIcon = (type: string) => {
    switch (type) {
      case 'walker': return '🐕';
      case 'grooming': return '✂️';
      case 'vet': return '⚕️';
      case 'boarding': return '🏠';
      default: return '📦';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'completed': return 'bg-gray-100 text-gray-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-[430px] bg-white z-50 transform transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-white">My Account</h2>
            <button
              onClick={onClose}
              className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('bookings')}
              className={`flex-1 py-2.5 rounded-lg font-medium transition-all ${
                activeTab === 'bookings'
                  ? 'bg-white text-[#FF8C42]'
                  : 'bg-white/20 text-white'
              }`}
            >
              My Bookings
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex-1 py-2.5 rounded-lg font-medium transition-all ${
                activeTab === 'profile'
                  ? 'bg-white text-[#FF8C42]'
                  : 'bg-white/20 text-white'
              }`}
            >
              Profile
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-180px)] overflow-y-auto">
          {activeTab === 'bookings' && (
            <div className="p-6 space-y-4">
              {loading ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 border-4 border-[#FF8C42] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading bookings...</p>
                </div>
              ) : bookings.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <Package className="w-10 h-10 text-gray-400" />
                  </div>
                  <h3 className="text-gray-800 font-semibold mb-2">No Bookings Yet</h3>
                  <p className="text-gray-600 text-sm">
                    Your service bookings will appear here
                  </p>
                </div>
              ) : (
                bookings.map((booking) => (
                  <button
                    key={booking.id}
                    onClick={() => onViewBooking?.(booking.id, booking.petId)}
                    className="w-full bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all text-left"
                  >
                    <div className="flex gap-4">
                      {/* Service Icon */}
                      <div className="w-14 h-14 bg-gradient-to-br from-orange-100 to-pink-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                        {getServiceIcon(booking.serviceType)}
                      </div>

                      {/* Booking Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-bold text-gray-800 mb-1">
                              {booking.serviceType.charAt(0).toUpperCase() + booking.serviceType.slice(1)} Service
                            </h3>
                            <p className="text-sm text-gray-600">
                              {booking.petName} • {booking.vendorName}
                            </p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(booking.status)}`}>
                            {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                          </span>
                        </div>

                        {/* Progress */}
                        {booking.status === 'active' && (
                          <div className="mb-3">
                            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                              <span>{booking.completedSessions} of {booking.totalSessions} sessions</span>
                              <span>{Math.round((booking.completedSessions / booking.totalSessions) * 100)}%</span>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B35]"
                                style={{ width: `${(booking.completedSessions / booking.totalSessions) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Details */}
                        <div className="flex items-center gap-3 text-xs text-gray-600">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(booking.startDate).toLocaleDateString()}
                          </span>
                          <span>•</span>
                          <span className="font-semibold text-[#FF8C42]">₹{booking.price}</span>
                        </div>

                        {booking.status === 'active' && booking.upcomingSessions > 0 && (
                          <div className="mt-2 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-md inline-block">
                            {booking.upcomingSessions} upcoming session{booking.upcomingSessions > 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="p-6 space-y-3">
              <button className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="font-medium text-gray-800">Edit Profile</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>

              <button 
                onClick={() => {
                  onNavigate?.('order_history');
                  onClose();
                }}
                className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center">
                    <Package className="w-5 h-5 text-green-600" />
                  </div>
                  <span className="font-medium text-gray-800">My Orders</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>

              {/* ✅ NEW: Referral & Rewards Link */}
              <button 
                onClick={() => {
                  onNavigate?.('referral');
                  onClose();
                }}
                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-xl hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full flex items-center justify-center">
                    <Coins className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left">
                    <span className="font-semibold text-gray-800 block">Referral & Rewards</span>
                    <span className="text-xs text-orange-600">Earn Pawints!</span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-orange-400" />
              </button>

              <button className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-pink-100 to-pink-200 rounded-full flex items-center justify-center">
                    <Heart className="w-5 h-5 text-pink-600" />
                  </div>
                  <span className="font-medium text-gray-800">My Pets</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>

              <button className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full flex items-center justify-center">
                    <Settings className="w-5 h-5 text-purple-600" />
                  </div>
                  <span className="font-medium text-gray-800">Settings</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>

              <button className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-orange-200 rounded-full flex items-center justify-center">
                    <FileText className="w-5 h-5 text-orange-600" />
                  </div>
                  <span className="font-medium text-gray-800">Terms & Privacy</span>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </button>

              <button 
                onClick={async () => {
                  await logout({ redirectTo: '/customer' });
                }}
                className="w-full flex items-center justify-between p-4 bg-white border border-red-200 rounded-xl hover:bg-red-50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-red-100 to-red-200 rounded-full flex items-center justify-center">
                    <LogOut className="w-5 h-5 text-red-600" />
                  </div>
                  <span className="font-medium text-red-600">Logout</span>
                </div>
                <ChevronRight className="w-5 h-5 text-red-400" />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}