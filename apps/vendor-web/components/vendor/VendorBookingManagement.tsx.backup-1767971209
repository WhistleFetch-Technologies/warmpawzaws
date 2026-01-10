'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { projectId, publicAnonKey } from '@/lib/supabase/info';
import { VendorChatModal } from './VendorChatModal';
import { VendorTeleConsultationFlow } from './VendorTeleConsultationFlow';
import { AppointmentDetailModal } from './AppointmentDetailModal';
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
  bookingId?: string; // ✅ ADD: Main booking ID
  time: string;
  customerName: string;
  customerId?: string; // ✅ ADD: Customer ID for chat
  petName: string;
  petType: string;
  location: string;
  consultationType: 'instant' | 'scheduled';
  communicationType: 'call' | 'video' | 'clinic' | 'at_home'; // ✅ UPDATE
  serviceType?: 'at_center' | 'at_home' | 'tele'; // ✅ ADD
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed' | 'in_progress';
  phone: string;
  date: string;
  price: number;
  serviceName: string;
  duration: number;
  
  // ✅ NEW: Chat fields
  hasUnreadMessages?: boolean;
  unreadMessageCount?: number;
  chatEnabled?: boolean;
  isFollowUp?: boolean;
  
  // ✅ NEW: Prescription fields (vet only)
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
  
  // ✅ Chat Modal State
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatBooking, setChatBooking] = useState<Booking | null>(null);
  
  // ✅ Video Call Modal State
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [videoBooking, setVideoBooking] = useState<Booking | null>(null);
  
  // ✅ Appointment Detail Modal State
  const [showAppointmentDetail, setShowAppointmentDetail] = useState(false);
  const [detailBookingId, setDetailBookingId] = useState<string | null>(null);

  // Generate time slots for the day (10:00 AM to 6:00 PM)
  const generateTimeSlots = (): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    for (let hour = 10; hour <= 18; hour++) {
      slots.push({
        time: `${hour}:00`,
        available: Math.random() > 0.3, // Random availability for demo
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
      
      console.log('🔍 [VENDOR-UI] Loading bookings with filters:', {
        date: selectedDate,
        filter: activeFilter,
        vendorId
      });
      
      // Don't pass activeFilter (today/week/month) as status filter - it's just for UI display
      // Pass empty string to get all statuses
      const response = await apiClient.get('/make-server-3dd53475/vendor/bookings/${vendorId}?date=${selectedDate}&filter=all'),
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        console.log('📦 [VENDOR-UI] Raw booking data from API:', data);
        console.log('📊 [VENDOR-UI] Debug info:', data.debug);
        
        // Map bookings to expected format
        const mappedBookings = (data.bookings || []).map((booking: any) => ({
          id: booking.id,
          time: booking.scheduledTime || booking.time || '10:00 AM',
          customerName: booking.customerName || 'Customer',
          customerId: booking.customerId || null, // ✅ ADD: Customer ID for chat
          petName: booking.petName || 'Pet',
          petType: booking.petType || booking.petBreed || 'Pet',
          location: vendorData?.address || vendorData?.location || 'Clinic Location',
          consultationType: booking.serviceType || 'scheduled',
          communicationType: booking.serviceType === 'tele' ? 'video' : 'in-person',
          serviceType: booking.serviceType || 'at_center', // ✅ ADD
          status: booking.status || 'confirmed',
          phone: booking.customerPhone || '+91 0000000000',
          date: booking.scheduledDate || booking.date || selectedDate,
          price: booking.price || 0,
          serviceName: booking.serviceName || 'Service',
          duration: booking.duration || 30,
          
          // ✅ NEW: Chat fields
          hasUnreadMessages: booking.hasUnreadMessages || false,
          unreadMessageCount: booking.unreadMessageCount || 0,
          chatEnabled: booking.chatEnabled || false,
          isFollowUp: booking.isFollowUp || false,
          
          // ✅ NEW: Prescription fields (vet only)
          hasPrescription: booking.hasPrescription || false,
          prescriptionUrl: booking.prescriptionUrl || null,
          prescriptionNotes: booking.prescriptionNotes || null
        }));
        
        setBookings(mappedBookings);
        console.log(`✅ Loaded ${mappedBookings.length} bookings for vendor ${vendorId}`);
      } else {
        console.error('Failed to load bookings:', response.statusText);
        setBookings([]);
      }
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
      const response = await apiClient.get('/make-server-3dd53475/vendor/bookings/${bookingId}/cancel'),
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        loadBookings(); // Reload bookings
      }
    } catch (error) {
      console.error('Error cancelling booking:', error);
    }
  };

  const handleEditBooking = (bookingId: string) => {
    // TODO: Open edit modal
    console.log('Edit booking:', bookingId);
  };
  
  // Accept Booking (Cafe/Resort)
  const handleAcceptBooking = async (booking: Booking) => {
    try {
      setCompletingBooking(true);
      const response = await apiClient.get('/make-server-3dd53475/bookings/${booking.id}/accept'),
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ vendorId })
        }
      );

      if (response.ok) {
        alert('✅ Booking accepted!');
        loadBookings();
      } else {
        const err = await response.json();
        alert(`❌ Failed to accept: ${err.error}`);
      }
    } catch (error) {
      console.error('Error accepting booking:', error);
      alert('❌ Error accepting booking');
    } finally {
      setCompletingBooking(false);
    }
  };

  // Complete Booking (with OTP for in-person services)
  const handleCompleteBooking = (booking: Booking) => {
    setSelectedBooking(booking);
    setOtpInput('');
    setOtpError('');
    
    // Check if this is a dog walking service (requires session tracking)
    const isDogWalking = booking.serviceName?.toLowerCase().includes('walk') || 
                         booking.serviceName?.toLowerCase().includes('walking');
    
    if (isDogWalking && booking.status === 'confirmed') {
      // For dog walking, show OTP modal to START session (not complete)
      setShowOTPModal(true);
    } else if (booking.communicationType === 'video') {
      // For tele consultations, complete without OTP
      handleCompleteWithoutOTP(booking);
    } else {
      // For regular in-person services, show OTP modal to complete
      setShowOTPModal(true);
    }
  };
  
  // Start session for dog walking with OTP
  const handleStartSession = async () => {
    if (!selectedBooking) return;
    
    if (otpInput.length !== 4) {
      setOtpError('Please enter 4-digit OTP');
      return;
    }
    
    try {
      setCompletingBooking(true);
      setOtpError('');
      
      const response = await apiClient.get('/make-server-3dd53475/vendor/bookings/${selectedBooking.id}/start-session'),
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            vendorId,
            otp: otpInput
          })
        }
      );
      
      const data = await response.json();
      
      if (response.ok) {
        setShowOTPModal(false);
        alert('✅ Session started! Customer can now track your location.');
        loadBookings(); // Reload bookings
      } else {
        setOtpError(data.error || 'Invalid OTP. Please try again.');
      }
    } catch (error) {
      console.error('Error starting session:', error);
      setOtpError('Error starting session. Please try again.');
    } finally {
      setCompletingBooking(false);
    }
  };
  
  // End session for dog walking (no OTP needed)
  const handleEndSession = async (booking: Booking) => {
    if (!confirm('End this walking session?')) return;
    
    try {
      setCompletingBooking(true);
      
      const response = await apiClient.get('/make-server-3dd53475/vendor/bookings/${booking.id}/end-session'),
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            vendorId
          })
        }
      );
      
      const data = await response.json();
      
      if (response.ok) {
        alert('✅ Session ended and booking completed!');
        loadBookings(); // Reload bookings
      } else {
        alert(`❌ Error: ${data.error || 'Failed to end session'}`);
      }
    } catch (error) {
      console.error('Error ending session:', error);
      alert('❌ Error ending session. Please try again.');
    } finally {
      setCompletingBooking(false);
    }
  };
  
  // Complete booking without OTP (for tele consultations)
  const handleCompleteWithoutOTP = async (booking: Booking) => {
    try {
      setCompletingBooking(true);
      
      const response = await apiClient.get('/make-server-3dd53475/vendor/bookings/${booking.id}/complete'),
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            vendorId,
            otp: null
          })
        }
      );
      
      const data = await response.json();
      
      if (response.ok) {
        alert('✅ Booking completed successfully!');
        loadBookings(); // Reload bookings
      } else {
        alert(`❌ Error: ${data.error || 'Failed to complete booking'}`);
      }
    } catch (error) {
      console.error('Error completing booking:', error);
      alert('❌ Error completing booking. Please try again.');
    } finally {
      setCompletingBooking(false);
    }
  };
  
  // Complete booking with OTP verification
  const handleOTPSubmit = async () => {
    if (!selectedBooking) return;
    
    if (otpInput.length !== 4) {
      setOtpError('Please enter 4-digit OTP');
      return;
    }
    
    try {
      setCompletingBooking(true);
      setOtpError('');
      
      const response = await apiClient.get('/make-server-3dd53475/vendor/bookings/${selectedBooking.id}/complete'),
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            vendorId,
            otp: otpInput
          })
        }
      );
      
      const data = await response.json();
      
      if (response.ok) {
        setShowOTPModal(false);
        alert('✅ Booking completed successfully!');
        loadBookings(); // Reload bookings
      } else {
        setOtpError(data.error || 'Invalid OTP. Please try again.');
      }
    } catch (error) {
      console.error('Error completing booking:', error);
      setOtpError('Error completing booking. Please try again.');
    } finally {
      setCompletingBooking(false);
    }
  };

  const formatTimeRange = (time: string) => {
    // Convert "10:00 AM" to "10:00 AM - 10:30 AM"
    const [hourMin, period] = time.split(' ');
    const [hour, min] = hourMin.split(':');
    const nextHour = parseInt(hour);
    const nextMin = parseInt(min) + 30;
    const endHour = nextMin >= 60 ? nextHour + 1 : nextHour;
    const endMin = nextMin >= 60 ? nextMin - 60 : nextMin;
    return `${hourMin} ${period} - ${endHour}:${endMin.toString().padStart(2, '0')} ${period}`;
  };

  // ✅ Handle Open Chat - UPDATED TO USE MODAL
  const handleOpenChat = (booking: Booking) => {
    console.log('💬 Opening chat for booking:', booking.bookingId || booking.id);
    setChatBooking(booking);
    setShowChatModal(true);
  };
  
  // ✅ Handle Open Prescription
  const handleOpenPrescription = async (booking: Booking) => {
    console.log('💊 Opening prescription for booking:', booking.bookingId || booking.id);
    
    const bookingId = booking.bookingId || booking.id;
    
    if (booking.hasPrescription) {
      // View existing prescription
      try {
        const response = await apiClient.get('/make-server-3dd53475/vendor/prescription/${bookingId}'),
          {
            headers: { 'Authorization': `Bearer ${publicAnonKey}` }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          const prescription = data.prescription;
          alert(`📋 Prescription Details\n\nPet: ${booking.petName}\nCustomer: ${booking.customerName}\n\nNotes:\n${prescription.notes}\n\nUploaded: ${new Date(prescription.uploadedAt).toLocaleString()}`);
        } else {
          alert('❌ Failed to load prescription');
        }
      } catch (error) {
        console.error('❌ Error fetching prescription:', error);
        alert('❌ Error loading prescription');
      }
    } else {
      // Upload new prescription
      const notes = prompt(`Enter prescription notes for ${booking.petName}:\n\n(e.g., Take 2 tablets daily after meals for 7 days)`);
      if (!notes || notes.trim() === '') return;
      
      try {
        const response = await apiClient.get('/make-server-3dd53475/vendor/prescription/upload'),
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              bookingId,
              vendorId,
              prescriptionNotes: notes.trim(),
              prescriptionFile: null // TODO: Add file upload
            })
          }
        );
        
        if (response.ok) {
          alert('✅ Prescription uploaded successfully!');
          loadBookings(); // Reload to show prescription badge
        } else {
          const data = await response.json();
          alert('❌ Failed to upload prescription:\n' + (data.error || 'Unknown error'));
        }
      } catch (error) {
        console.error('❌ Error uploading prescription:', error);
        alert('❌ Error uploading prescription');
      }
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
              <h1 className="font-semibold text-gray-900">{vendorData?.businessName || vendorData?.fullName || 'Booking Management'}</h1>
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
                onChange={(e) => setSelectedDate(e.target.value)}
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
                      onClick={() => {
                        setDetailBookingId(booking.id);
                        setShowAppointmentDetail(true);
                      }}
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
                      
                      {/* NEW: Smart buttons based on service type and status */}
                      {booking.status !== 'completed' && booking.status !== 'cancelled' && (() => {
                        
                        // PENDING STATE (Cafe/Resort)
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
                          // DOG WALKING: Show Start/End Session buttons
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
                          // REGULAR SERVICES: Complete with OTP (or without for tele)
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
                      
                      {/* ✅ ACTION BUTTONS: Chat, Prescription, Video Call */}
                      <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2 flex-wrap">
                        {/* Video Call Button - TELE ONLY */}
                        {booking.communicationType === 'video' && booking.serviceType === 'tele' && booking.status !== 'completed' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setVideoBooking(booking);
                              setShowVideoCall(true);
                            }}
                            className="flex-1 min-w-[100px] py-2 px-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1"
                          >
                            <Video className="w-3.5 h-3.5" />
                            Join Call
                          </button>
                        )}
                        
                        {/* Chat Button - ALL BOOKINGS */}
                        {booking.chatEnabled !== false && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenChat(booking);
                            }}
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
                        {vendorData?.roleId === 'veterinarian' && (booking.status === 'completed' || booking.status === 'in_progress' || booking.status === 'confirmed') && (
                          <button
                            onClick={() => handleOpenPrescription(booking)}
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
                      </div>
                      
                      {/* ✅ Prescription Info Widget */}
                      {vendorData?.roleId === 'veterinarian' && booking.hasPrescription && booking.prescriptionNotes && (
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

            {/* Client Consultation Section */}
            <div className="p-4 bg-white border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Client Consultation</h3>
              <div className="text-center py-4 text-gray-500 text-sm">
                No upcoming client consultations
              </div>
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

            {/* Emergency Availability Toggle */}
            <div className="p-4 bg-white border-t border-gray-100">
              <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xl">🚨</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Emergency Availability</h3>
                    <p className="text-xs text-gray-600">24x7 on-call service</p>
                  </div>
                </div>
                <button className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium">
                  Enable
                </button>
              </div>
            </div>
          </>
        )}

        {/* EARNINGS TAB CONTENT */}
        {activeTab === 'earnings' && (
          <>
            {/* Earnings Summary */}
            <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-b border-green-200">
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="bg-white p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600">₹12,450</div>
                  <div className="text-xs text-gray-600">Today</div>
                </div>
                <div className="bg-white p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600">₹89,320</div>
                  <div className="text-xs text-gray-600">This Week</div>
                </div>
                <div className="bg-white p-3 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600">₹3,45,680</div>
                  <div className="text-xs text-gray-600">This Month</div>
                </div>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600">Pending Earnings</span>
                  <span className="text-lg font-bold text-orange-600">₹24,580</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Earnings</span>
                  <span className="text-lg font-bold text-green-600">₹4,67,230</span>
                </div>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Recent Transactions</h3>
              <div className="space-y-2">
                {[
                  { id: '1', date: '2024-11-15', service: 'Home Visit - Vaccination', amount: 1500, status: 'completed', customer: 'Priya Sharma' },
                  { id: '2', date: '2024-11-15', service: 'Tele Consultation', amount: 500, status: 'completed', customer: 'Arjun Patel' },
                  { id: '3', date: '2024-11-14', service: 'Clinic Visit - Checkup', amount: 800, status: 'pending', customer: 'Nitika Verma' },
                  { id: '4', date: '2024-11-14', service: 'Home Visit - Grooming', amount: 1200, status: 'completed', customer: 'Rajesh Kumar' },
                  { id: '5', date: '2024-11-13', service: 'Tele Consultation', amount: 500, status: 'completed', customer: 'Meera Singh' },
                ].map((transaction) => (
                  <div key={transaction.id} className="border border-gray-200 rounded-xl p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 text-sm">{transaction.service}</div>
                        <div className="text-xs text-gray-500">{transaction.customer} • {transaction.date}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-600">₹{transaction.amount.toLocaleString()}</div>
                        <div className={`text-xs px-2 py-0.5 rounded-full inline-block mt-1 ${
                          transaction.status === 'completed' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {transaction.status}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Earnings Chart Placeholder */}
            <div className="p-4 bg-white border-t border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-3">Earnings Trend</h3>
              <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 text-center">
                <div className="text-4xl mb-2">📈</div>
                <p className="text-sm text-gray-600">Earnings chart coming soon</p>
              </div>
            </div>
          </>
        )}

        {/* PAYOUTS TAB CONTENT */}
        {activeTab === 'payouts' && (
          <>
            {/* Payout Summary */}
            <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-b border-blue-200">
              <div className="bg-white p-4 rounded-lg mb-3">
                <div className="text-center mb-3">
                  <div className="text-3xl font-bold text-blue-600">₹1,23,450</div>
                  <div className="text-sm text-gray-600">Available for Payout</div>
                </div>
                <button className="w-full bg-[#FF8C42] hover:bg-[#ff7a28] text-white rounded-xl h-11 font-medium">
                  Request Payout
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-lg text-center">
                  <div className="text-xl font-bold text-gray-900">₹24,580</div>
                  <div className="text-xs text-gray-600">Pending</div>
                </div>
                <div className="bg-white p-3 rounded-lg text-center">
                  <div className="text-xl font-bold text-gray-900">₹4,42,650</div>
                  <div className="text-xs text-gray-600">Paid Out</div>
                </div>
              </div>
            </div>

            {/* Bank Account Info */}
            <div className="p-4 bg-white border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-3">Bank Account</h3>
              <div className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-xl">🏦</span>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">HDFC Bank</div>
                    <div className="text-sm text-gray-600">••••  ••••  ••••  4532</div>
                  </div>
                  <button className="text-sm text-[#FF8C42] font-medium">
                    Change
                  </button>
                </div>
                <div className="text-xs text-gray-500">
                  Account Holder: {vendorData?.fullName || 'Vendor Name'}
                </div>
              </div>
            </div>

            {/* Payout History */}
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Payout History</h3>
              <div className="space-y-2">
                {[
                  { id: '1', date: '2024-11-10', amount: 45000, status: 'completed', txnId: 'TXN123456789' },
                  { id: '2', date: '2024-11-03', amount: 38500, status: 'completed', txnId: 'TXN123456788' },
                  { id: '3', date: '2024-10-27', amount: 52300, status: 'completed', txnId: 'TXN123456787' },
                  { id: '4', date: '2024-10-20', amount: 41200, status: 'completed', txnId: 'TXN123456786' },
                  { id: '5', date: '2024-10-13', amount: 39800, status: 'completed', txnId: 'TXN123456785' },
                ].map((payout) => (
                  <div key={payout.id} className="border border-gray-200 rounded-xl p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 text-sm">Payout - {payout.date}</div>
                        <div className="text-xs text-gray-500">TXN ID: {payout.txnId}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-blue-600">₹{payout.amount.toLocaleString()}</div>
                        <div className="text-xs px-2 py-0.5 rounded-full inline-block mt-1 bg-green-100 text-green-700">
                          {payout.status}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payout Schedule Info */}
            <div className="p-4 bg-white border-t border-gray-100">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xl">ℹ️</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Payout Schedule</h4>
                    <p className="text-sm text-gray-600">
                      Payouts are processed every <strong>Friday</strong>. Earnings from completed bookings are held for 48 hours before becoming available for payout.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
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
                  onChange={(e) => setOtpInput(e.target.value.replace(/[^0-9]/g, ''))}
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
      
      {/* VIDEO CALL MODAL */}
      {showVideoCall && videoBooking && (
        <VendorTeleConsultationFlow
          vendorId={vendorId}
          vendorData={vendorData}
          bookingData={videoBooking}
          onBack={() => {
            setShowVideoCall(false);
            setVideoBooking(null);
            // Refresh bookings
            loadBookings();
          }}
        />
      )}
      
      {/* CHAT MODAL */}
      {showChatModal && chatBooking && (
        <VendorChatModal
          bookingId={chatBooking.id}
          vendorPhone={vendorData?.phone || vendorData?.mobile || '+91'}
          vendorName={vendorData?.fullName || vendorData?.businessName || 'Vendor'}
          customerPhone={chatBooking.phone}
          customerName={chatBooking.customerName}
          onClose={() => {
            setShowChatModal(false);
            setChatBooking(null);
            loadBookings(); // Reload to clear unread badges
          }}
        />
      )}
      
      {/* APPOINTMENT DETAIL MODAL */}
      {showAppointmentDetail && detailBookingId && (
        <AppointmentDetailModal
          bookingId={detailBookingId}
          vendorData={vendorData}
          onClose={() => {
            setShowAppointmentDetail(false);
            setDetailBookingId(null);
          }}
          onRefresh={() => loadBookings()}
        />
      )}
    </div>
  );
}