'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { 
  ArrowLeft, 
  Search, 
  Filter, 
  Calendar, 
  Phone, 
  Video, 
  MapPin, 
  MessageSquare, 
  CheckCircle, 
  Play, 
  Square, 
  Pill, 
  FileText, 
  RefreshCw, 
  X 
} from 'lucide-react';

interface VendorBookingManagementProps {
  vendorId: string;
  vendorData: any;
  onBack: () => void;
}

interface Booking {
  id: string;
  bookingId?: string;
  time: string;
  customerName: string;
  customerId?: string;
  petName: string;
  petType: string;
  location: string;
  consultationType: 'instant' | 'scheduled';
  communicationType: 'call' | 'video' | 'clinic' | 'at_home';
  serviceType?: 'at_center' | 'at_home' | 'tele';
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed' | 'in_progress';
  phone: string;
  date: string;
  price: number;
  serviceName: string;
  duration: number;
  hasUnreadMessages?: boolean;
  unreadMessageCount?: number;
  chatEnabled?: boolean;
  isFollowUp?: boolean;
  hasPrescription?: boolean;
  prescriptionUrl?: string;
  prescriptionNotes?: string;
}

interface TimeSlot {
  time: string;
  available: boolean;
  booked?: boolean;
}

export function VendorBookingManagement({ vendorId, vendorData, onBack }: VendorBookingManagementProps) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeFilter, setActiveFilter] = useState<'today' | 'week' | 'month'>('today');
  const [activeView, setActiveView] = useState<'consultations' | 'locations'>('consultations');
  const [activeTab, setActiveTab] = useState<'bookings' | 'earnings' | 'payouts'>('bookings');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    calls: 243,
    online: 0,
    phone: 0
  });
  
  // OTP Modal State
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');
  const [completingBooking, setCompletingBooking] = useState(false);

  // Generate time slots for the day (10:00 AM to 6:00 PM)
  const generateTimeSlots = (): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    for (let hour = 10; hour <= 18; hour++) {
      slots.push({
        time: `${hour}:00`,
        available: Math.random() > 0.3,
        booked: Math.random() > 0.7
      });
    }
    return slots;
  };

  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>(generateTimeSlots());

  useEffect(() => {
    loadBookings();
  }, [selectedDate, activeFilter]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      
      // Convert activeFilter to dateFilter for API
      let dateFilter = 'all';
      if (activeFilter === 'today') {
        dateFilter = 'today';
      } else if (activeFilter === 'week') {
        dateFilter = 'week';
      } else if (activeFilter === 'month') {
        dateFilter = 'month';
      }
      
      const response = await apiClient.get<any>(
        `/vendor/bookings/${vendorId}?date=${selectedDate}&filter=all&dateFilter=${dateFilter}`
      );
      
      // Map bookings to expected format
      const mappedBookings = (response.bookings || []).map((booking: any) => ({
        id: booking.id,
        bookingId: booking.id,
        time: booking.booking_time || booking.time || '10:00 AM',
        customerName: booking.customer?.name || booking.customer_name || 'Customer',
        customerId: booking.customer?.id || booking.customer_id || null,
        petName: booking.pet_name || 'Pet',
        petType: booking.pet_type || booking.pet_breed || 'Pet',
        location: booking.address || vendorData?.address || 'Location',
        consultationType: booking.service_type === 'tele' ? 'instant' : 'scheduled',
        communicationType: booking.service_type === 'tele' ? 'video' : booking.service_type === 'at_home' ? 'at_home' : 'clinic',
        serviceType: booking.service_type || 'at_center',
        status: booking.status || 'confirmed',
        phone: booking.customer?.phone || booking.customer_phone || '+91 0000000000',
        date: booking.booking_date || booking.date || selectedDate,
        price: booking.total_amount || booking.price || 0,
        serviceName: booking.service?.name || booking.service_name || 'Service',
        duration: booking.duration || 30,
        hasUnreadMessages: booking.unreadMessageCount > 0,
        unreadMessageCount: booking.unreadMessageCount || 0,
        chatEnabled: true,
        isFollowUp: booking.is_follow_up || false,
        hasPrescription: booking.hasPrescription || false,
        prescriptionUrl: booking.prescription_url || null,
        prescriptionNotes: booking.prescription_notes || null
      }));
      
      setBookings(mappedBookings);
    } catch (error) {
      console.error('Error loading bookings:', error);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    try {
      await apiClient.put(`/bookings/${bookingId}/status`, { status: 'cancelled' });
      loadBookings();
    } catch (error) {
      console.error('Error cancelling booking:', error);
      alert('Failed to cancel booking');
    }
  };

  const handleAcceptBooking = async (booking: Booking) => {
    try {
      setCompletingBooking(true);
      await apiClient.put(`/bookings/${booking.id}/status`, { 
        status: 'confirmed',
        vendorId 
      });
      alert('✅ Booking accepted!');
      loadBookings();
    } catch (error: any) {
      console.error('Error accepting booking:', error);
      alert(`❌ Failed to accept: ${error.message || 'Unknown error'}`);
    } finally {
      setCompletingBooking(false);
    }
  };

  const handleCompleteBooking = (booking: Booking) => {
    setSelectedBooking(booking);
    setOtpInput('');
    setOtpError('');
    
    const isDogWalking = booking.serviceName?.toLowerCase().includes('walk') || 
                         booking.serviceName?.toLowerCase().includes('walking');
    
    if (isDogWalking && booking.status === 'confirmed') {
      setShowOTPModal(true);
    } else if (booking.communicationType === 'video') {
      handleCompleteWithoutOTP(booking);
    } else {
      setShowOTPModal(true);
    }
  };
  
  const handleStartSession = async () => {
    if (!selectedBooking) return;
    
    if (otpInput.length !== 4) {
      setOtpError('Please enter 4-digit OTP');
      return;
    }
    
    try {
      setCompletingBooking(true);
      setOtpError('');
      
      await apiClient.post(`/vendor/bookings/${selectedBooking.id}/start-session`, {
        vendorId,
        otp: otpInput
      });
      
      setShowOTPModal(false);
      alert('✅ Session started! Customer can now track your location.');
      loadBookings();
    } catch (error: any) {
      setOtpError(error.message || 'Invalid OTP. Please try again.');
    } finally {
      setCompletingBooking(false);
    }
  };
  
  const handleEndSession = async (booking: Booking) => {
    if (!confirm('End this walking session?')) return;
    
    try {
      setCompletingBooking(true);
      await apiClient.post(`/vendor/bookings/${booking.id}/end-session`, {
        vendorId
      });
      alert('✅ Session ended and booking completed!');
      loadBookings();
    } catch (error: any) {
      alert(`❌ Error: ${error.message || 'Failed to end session'}`);
    } finally {
      setCompletingBooking(false);
    }
  };
  
  const handleCompleteWithoutOTP = async (booking: Booking) => {
    try {
      setCompletingBooking(true);
      await apiClient.post(`/vendor/bookings/${booking.id}/complete`, {
        vendorId,
        otp: null
      });
      alert('✅ Booking completed successfully!');
      loadBookings();
    } catch (error: any) {
      alert(`❌ Error: ${error.message || 'Failed to complete booking'}`);
    } finally {
      setCompletingBooking(false);
    }
  };
  
  const handleOTPSubmit = async () => {
    if (!selectedBooking) return;
    
    if (otpInput.length !== 4) {
      setOtpError('Please enter 4-digit OTP');
      return;
    }
    
    try {
      setCompletingBooking(true);
      setOtpError('');
      
      await apiClient.post(`/vendor/bookings/${selectedBooking.id}/complete`, {
        vendorId,
        otp: otpInput
      });
      
      setShowOTPModal(false);
      alert('✅ Booking completed successfully!');
      loadBookings();
    } catch (error: any) {
      setOtpError(error.message || 'Invalid OTP. Please try again.');
    } finally {
      setCompletingBooking(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[430px] mx-auto bg-white min-h-screen pb-20">
        {/* Header */}
        <div className="p-4 bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={onBack} className="w-8 h-8 flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-gray-900">{vendorData?.business_name || vendorData?.fullName || 'Booking Management'}</h1>
              <p className="text-xs text-gray-500">{vendorData?.address || 'India'}</p>
            </div>
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-gray-400" />
              <Filter className="w-5 h-5 text-gray-400" />
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('bookings')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'bookings'
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Bookings
            </button>
            <button
              onClick={() => setActiveTab('earnings')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'earnings'
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Earnings
            </button>
            <button
              onClick={() => setActiveTab('payouts')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'payouts'
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Payouts
            </button>
          </div>
        </div>

        {/* Schedule Section */}
        <div className="p-4 bg-white border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Schedule</h2>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="w-4 h-4" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedDate(e.target.value)}
                className="border-none bg-transparent outline-none"
              />
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveFilter('today')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === 'today'
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setActiveFilter('week')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === 'week'
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setActiveFilter('month')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === 'month'
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Month
            </button>
          </div>
        </div>

        {/* BOOKINGS TAB CONTENT */}
        {activeTab === 'bookings' && (
          <>
            {/* View Toggle */}
            <div className="p-4 bg-white border-b border-gray-100">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveView('consultations')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeView === 'consultations'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  All Consultations
                </button>
                <button
                  onClick={() => setActiveView('locations')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeView === 'locations'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  All Locations
                </button>
              </div>
            </div>

            {/* Instant Consultations Stats */}
            <div className="p-4 bg-white border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Instant Consultations</h3>
              <div className="flex items-center justify-between">
                <div className="text-center flex-1">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg mx-auto mb-1 flex items-center justify-center">
                    <Phone className="w-6 h-6 text-gray-600" />
                  </div>
                  <div className="font-semibold text-gray-900">{stats.calls}</div>
                  <div className="text-xs text-gray-500">Calls</div>
                </div>
                <div className="text-center flex-1">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg mx-auto mb-1 flex items-center justify-center">
                    <Video className="w-6 h-6 text-gray-600" />
                  </div>
                  <div className="font-semibold text-gray-900">{stats.online}</div>
                  <div className="text-xs text-gray-500">Online</div>
                </div>
                <div className="text-center flex-1">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg mx-auto mb-1 flex items-center justify-center">
                    <Phone className="w-6 h-6 text-gray-600" />
                  </div>
                  <div className="font-semibold text-gray-900">{stats.phone}</div>
                  <div className="text-xs text-gray-500">Phone</div>
                </div>
              </div>
            </div>

            {/* Today's Appointments */}
            <div className="p-4 bg-white">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Today's Appointments</h3>
              
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42] mx-auto"></div>
                </div>
              ) : bookings.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No appointments scheduled
                </div>
              ) : (
                <div className="space-y-3">
                  {bookings.map((booking) => (
                    <div 
                      key={booking.id} 
                      className="border border-gray-200 rounded-xl p-3 cursor-pointer hover:shadow-lg hover:border-[#FF8C42] transition-all"
                    >
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
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <MapPin className="w-3 h-3" />
                            <span>{booking.location}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Action buttons based on status */}
                      {booking.status !== 'completed' && booking.status !== 'cancelled' && (() => {
                        if (booking.status === 'pending') {
                          return (
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <button
                                className="px-4 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium transition-colors"
                                onClick={() => handleCancelBooking(booking.id)}
                                disabled={completingBooking}
                              >
                                Reject
                              </button>
                              <button
                                className="px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
                                onClick={() => handleAcceptBooking(booking)}
                                disabled={completingBooking}
                              >
                                Accept
                              </button>
                            </div>
                          );
                        }

                        const isDogWalking = booking.serviceName?.toLowerCase().includes('walk') || 
                                            booking.serviceName?.toLowerCase().includes('walking');
                        
                        if (isDogWalking) {
                          if (booking.status === 'in_progress') {
                            return (
                              <div className="mt-3">
                                <button
                                  onClick={() => handleEndSession(booking)}
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
                                  onClick={() => handleCompleteBooking(booking)}
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
                          return (
                            <div className="mt-3">
                              <button
                                onClick={() => handleCompleteBooking(booking)}
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
                      
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <a 
                          href={`tel:${booking.phone}`}
                          className="flex items-center gap-2 text-xs text-[#FF8C42]"
                        >
                          <Phone className="w-3 h-3" />
                          {booking.phone}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Available Time Slots */}
            <div className="p-4 bg-white border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Available Time Slots</h3>
              
              <div className="grid grid-cols-4 gap-2">
                {timeSlots.map((slot, index) => (
                  <button
                    key={index}
                    className={`p-3 rounded-lg text-sm font-medium transition-all ${
                      slot.booked
                        ? 'bg-pink-100 text-pink-700 border border-pink-200'
                        : slot.available
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-gray-100 text-gray-400 border border-gray-200'
                    }`}
                    disabled={!slot.available && !slot.booked}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
              
              <div className="flex items-center gap-4 mt-4 text-xs text-gray-600">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-pink-100 border border-pink-200 rounded"></div>
                  <span>Booked</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-gray-100 border border-gray-200 rounded"></div>
                  <span>Unavailable</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* EARNINGS TAB CONTENT - Placeholder */}
        {activeTab === 'earnings' && (
          <div className="p-4">
            <p className="text-gray-500 text-center py-8">Earnings tab - To be implemented</p>
          </div>
        )}

        {/* PAYOUTS TAB CONTENT - Placeholder */}
        {activeTab === 'payouts' && (
          <div className="p-4">
            <p className="text-gray-500 text-center py-8">Payouts tab - To be implemented</p>
          </div>
        )}
      </div>
      
      {/* OTP VERIFICATION MODAL */}
      {showOTPModal && selectedBooking && (() => {
        const isDogWalking = selectedBooking.serviceName?.toLowerCase().includes('walk') || 
                            selectedBooking.serviceName?.toLowerCase().includes('walking');
        const isStartSession = isDogWalking && selectedBooking.status === 'confirmed';
        
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-[380px] p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">
                  {isStartSession ? 'Start Walking Session' : 'Enter Customer OTP'}
                </h3>
                <button 
                  onClick={() => setShowOTPModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>{selectedBooking.customerName}</strong> has a 4-digit OTP for this booking.
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {isStartSession 
                    ? 'Enter OTP to start the walk. Live tracking will be enabled for the customer.'
                    : 'Ask the customer to share their OTP from "My Bookings" to complete this service.'}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  4-Digit OTP
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={otpInput}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOtpInput(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="0000"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                  autoFocus
                />
                {otpError && (
                  <p className="text-sm text-red-600 mt-2">{otpError}</p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowOTPModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={isStartSession ? handleStartSession : handleOTPSubmit}
                  disabled={completingBooking || otpInput.length !== 4}
                  className={`flex-1 px-4 py-2.5 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                    isStartSession ? 'bg-blue-500 hover:bg-blue-600' : 'bg-green-500 hover:bg-green-600'
                  }`}
                >
                  {completingBooking 
                    ? 'Verifying...' 
                    : (isStartSession ? 'Start Session' : 'Complete Booking')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

