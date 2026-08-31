'use client';

/**
 * UNIVERSAL APPOINTMENT MANAGEMENT
 * 
 * Unified appointment management component with 100% feature parity across:
 * - Business Vendors
 * - Staff Members
 * - Solo Vendors
 * 
 * All enhancements automatically benefit all three user types.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import {
  isVendorTeleConsultationBooking,
  resolveVendorBookingId,
  resolveVendorBookingServiceLabel,
  shouldShowVendorBookingPrice,
} from '@/lib/vendor-utils';
import { Button } from '@/components/ui/button';
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
  X,
  Home,
  Building2,
  Monitor,
  Navigation,
  Map,
  Radio,
  Loader2,
  AlertCircle,
  User,
  Package,
  Clock,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { AppointmentDetailModal } from '../vendor/AppointmentDetailModal';
import { DeclineBookingModal } from '../vendor/DeclineBookingModal';
import { VendorChatModal } from '../vendor/VendorChatModal';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  buildVendorScheduleBookingsQuery,
  isTeleScheduleBooking,
  paginationShowingLabel,
  scheduleAppointmentsSectionTitle,
  scheduleEmptyStateMessage,
  VENDOR_SCHEDULE_PAGE_SIZE,
  type VendorSchedulePeriod,
} from '@/lib/vendor-schedule-bookings';

export type UserType = 'vendor' | 'staff' | 'solo' | 'solo_vendor';

interface UniversalAppointmentManagementProps {
  userId: string; // vendorId, staffId, or solo vendorId
  userType: UserType;
  userData?: any; // vendorData, staffData, or solo vendorData
  onBack: () => void;
  /** Whether chat capability is enabled */
  chatEnabled?: boolean;
  /** User phone for chat identification */
  userPhone?: string;
  /** User name for chat display */
  userName?: string;
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
  serviceType?: 'at_center' | 'at_home' | 'tele' | 'video_consultation';
  service_type?: string;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed' | 'in_progress';
  phone: string;
  customerPhone?: string;
  meetingId?: string;
  meeting_id?: string;
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
  otp?: string;
  customerLat?: string;
  customerLng?: string;
  distance?: number;
}

interface TimeSlot {
  time: string;
  available: boolean;
  booked?: boolean;
}

export function UniversalAppointmentManagement({ 
  userId, 
  userType,
  userData, 
  onBack,
  chatEnabled = true,
  userPhone,
  userName
}: UniversalAppointmentManagementProps) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [schedulePeriod, setSchedulePeriod] = useState<VendorSchedulePeriod>('today');
  const [bookingsPageIndex, setBookingsPageIndex] = useState(0);
  const [bookingsTotal, setBookingsTotal] = useState(0);
  const [bookingsHasMore, setBookingsHasMore] = useState(false);
  const [activeTab, setActiveTab] = useState<'bookings' | 'earnings' | 'payouts'>('bookings');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    calls: 0,
    online: 0,
    phone: 0,
    appointments: 0,
    earnings: 0
  });
  /** Bookings → Earnings tab: loaded from GET /vendor/:id/earnings (vendor_earnings), not sum of list rows */
  const [tabEarnings, setTabEarnings] = useState<{
    total: number;
    pending: number;
    txnCount: number;
    loading: boolean;
  }>({ total: 0, pending: 0, txnCount: 0, loading: false });
  
  // OTP Modal State
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');
  const [completingBooking, setCompletingBooking] = useState(false);
  const [otpAction, setOtpAction] = useState<'start' | 'complete'>('complete');
  
  // Chat Modal State
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatBooking, setChatBooking] = useState<Booking | null>(null);
  
  // Video Call Modal State
  const router = useRouter();
  
  // Appointment Detail Modal State
  const [showAppointmentDetail, setShowAppointmentDetail] = useState(false);
  const [detailBookingId, setDetailBookingId] = useState<string | null>(null);
  const [declineVendorBooking, setDeclineVendorBooking] = useState<Booking | null>(null);

  // GPS tracking state
  const [isTracking, setIsTracking] = useState<{ [key: string]: boolean }>({});
  const [trackingSessionIds, setTrackingSessionIds] = useState<{ [key: string]: string }>({});
  const [trackingLocation, setTrackingLocation] = useState<{ [key: string]: { lat: number; lng: number; updated: string } }>({});

  // Get API endpoint based on user type
  const getBookingsEndpoint = () => {
    switch (userType) {
      case 'vendor':
      case 'solo':
      case 'solo_vendor':
        return `/vendor/bookings/${userId}`;
      case 'staff':
        return `/staff/${userId}/appointments`;
      default:
        return `/vendor/bookings/${userId}`;
    }
  };

  // Get action endpoint based on user type
  const getActionEndpoint = (bookingId: string, action: string) => {
    switch (userType) {
      case 'vendor':
      case 'solo':
      case 'solo_vendor':
        return `/vendor/bookings/${bookingId}/${action}`;
      case 'staff':
        return `/staff/${userId}/appointments/${bookingId}/${action}`;
      default:
        return `/vendor/bookings/${bookingId}/${action}`;
    }
  };

  // Generate time slots from operating hours
  const generateTimeSlots = (operatingHours?: any, existingBookings?: Booking[]): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    const selectedDateObj = new Date(selectedDate);
    const dayOfWeek = selectedDateObj.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    let startHour = 9;
    let endHour = 18;
    
    if (operatingHours && operatingHours[dayOfWeek]) {
      const dayHours = operatingHours[dayOfWeek];
      if (dayHours.isOpen && dayHours.open && dayHours.close) {
        const [openH] = dayHours.open.split(':').map(Number);
        const [closeH] = dayHours.close.split(':').map(Number);
        startHour = openH;
        endHour = closeH;
      } else if (!dayHours.isOpen) {
        return [];
      }
    }
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        const isBooked = existingBookings?.some(b => {
          const bookingTime = b.time.replace(/\s*(AM|PM)/, '');
          return bookingTime === timeStr;
        }) || false;
        
        slots.push({
          time: timeStr,
          available: !isBooked,
          booked: isBooked
        });
      }
    }
    
    return slots;
  };

  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);

  const isVendorLikeUser =
    userType === 'vendor' || userType === 'solo' || userType === 'solo_vendor';

  useEffect(() => {
    setBookingsPageIndex(0);
  }, [selectedDate, schedulePeriod]);

  useEffect(() => {
    loadBookings();
  }, [selectedDate, schedulePeriod, bookingsPageIndex, userId, userType]);

  useEffect(() => {
    if (activeTab !== 'earnings') return;
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const vid =
      userType === 'staff'
        ? String(userData?.vendor_id || userData?.vendorId || '').trim() || userId
        : userId;
    if (!uuidRe.test(vid)) {
      setTabEarnings({ total: 0, pending: 0, txnCount: 0, loading: false });
      return;
    }
    let cancelled = false;
    setTabEarnings((s) => ({ ...s, loading: true }));
    (async () => {
      try {
        const res = (await apiClient.get(`/vendor/${vid}/earnings?period=lifetime`)) as any;
        if (cancelled) return;
        const e = res?.earnings;
        setTabEarnings({
          total: Number(e?.totalEarnings ?? 0),
          pending: Number(e?.pendingSettlement ?? 0),
          txnCount: Array.isArray(e?.transactions) ? e.transactions.length : 0,
          loading: false,
        });
      } catch {
        if (!cancelled) setTabEarnings({ total: 0, pending: 0, txnCount: 0, loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, userId, userType, userData?.vendor_id, userData?.vendorId]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      
      let queryString = '';
      if (isVendorLikeUser) {
        const queryParams = buildVendorScheduleBookingsQuery({
          schedulePeriod,
          anchorDate: selectedDate,
          pageIndex: bookingsPageIndex,
          pageSize: VENDOR_SCHEDULE_PAGE_SIZE,
          statusFilter: 'all',
        });
        queryString = `?${new URLSearchParams(queryParams).toString()}`;
      } else if (schedulePeriod === 'today') {
        queryString = `?date=${selectedDate}`;
      } else {
        queryString = `?period=${schedulePeriod}&anchorDate=${selectedDate}&limit=${VENDOR_SCHEDULE_PAGE_SIZE}&offset=${bookingsPageIndex * VENDOR_SCHEDULE_PAGE_SIZE}`;
      }

      const endpoint = getBookingsEndpoint();
      const [bookingsData, facilityData] = await Promise.all([
        apiClient.get(`${endpoint}${queryString}`) as Promise<any>,
        isVendorLikeUser ? apiClient.get(`/vendor/${userId}/facility`).catch(() => null) as Promise<any> : Promise.resolve(null)
      ]);

      if (bookingsData && bookingsData.success) {
        // Map bookings to expected format
        const mappedBookings = (bookingsData.bookings || bookingsData.appointments || []).map((booking: any) => ({
          id: booking.id,
          bookingId: booking.id,
          time: booking.scheduledTime || booking.booking_time || booking.time || '10:00 AM',
          customerName: booking.customerName || booking.customer_name || 'Customer',
          customerId: booking.customerId || booking.customer_id || null,
          petName: booking.petName || booking.pet_name || 'Pet',
          petType: booking.petType || booking.pet_type || booking.petBreed || booking.pet_breed || 'Pet',
          location: userData?.address || userData?.location || booking.customer_address || booking.address || 'Location',
          consultationType: booking.serviceType || booking.service_style || 'scheduled',
          communicationType: (booking.serviceType || booking.service_style) === 'tele' ? 'video' : 'in-person',
          serviceType: booking.serviceType || booking.service_style || 'at_center',
          status: booking.status || 'confirmed',
          phone: booking.customerPhone || booking.customer_phone || '+91 0000000000',
          date: booking.scheduledDate || booking.booking_date || booking.date || selectedDate,
          price: booking.price || booking.total_amount || 0,
          serviceName: booking.serviceName || booking.service_name || 'Service',
          commerce_mode: booking.commerce_mode || booking.commerceMode,
          commerceMode: booking.commerceMode || booking.commerce_mode,
          service_style: booking.service_style || booking.serviceStyle,
          duration: booking.duration || booking.duration_minutes || 30,
          hasUnreadMessages: booking.hasUnreadMessages || false,
          unreadMessageCount: booking.unreadMessageCount || 0,
          chatEnabled: booking.chatEnabled !== false,
          isFollowUp: booking.isFollowUp || false,
          hasPrescription: booking.hasPrescription || false,
          prescriptionUrl: booking.prescriptionUrl || null,
          prescriptionNotes: booking.prescriptionNotes || null,
          otp: booking.otp || null,
          customerLat: booking.customer_lat || booking.customerLat || null,
          customerLng: booking.customer_lng || booking.customerLng || null,
          distance: booking.distance || null,
        }));
        
        setBookings(mappedBookings);
        setBookingsTotal(Number(bookingsData.total ?? mappedBookings.length));
        setBookingsHasMore(Boolean(bookingsData.hasMore));

        const teleOnPage = mappedBookings.filter((b: Booking) => isTeleScheduleBooking(b));
        setStats({
          calls: teleOnPage.length,
          online: teleOnPage.filter((b: Booking) => b.communicationType === 'video').length,
          phone: teleOnPage.filter((b: Booking) => b.communicationType === 'call').length,
          appointments: Number(bookingsData.total ?? mappedBookings.length),
          earnings: mappedBookings
            .filter((b: Booking) => String(b.status).toLowerCase() === 'completed')
            .reduce((sum: number, b: Booking) => sum + Number(b.price || 0), 0),
        });
        
        // Generate time slots
        let operatingHours = null;
        if (facilityData && facilityData.facility && facilityData.facility.operatingHours) {
          operatingHours = facilityData.facility.operatingHours;
        }
        const newSlots = generateTimeSlots(operatingHours, mappedBookings);
        setTimeSlots(newSlots);
      } else {
        setBookings([]);
        setTimeSlots([]);
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
      toast.error('Failed to load appointments');
      setBookings([]);
      setTimeSlots([]);
    } finally {
      setLoading(false);
    }
  };

  const declineVendorId =
    userType === 'staff'
      ? String(userData?.vendor_id || userData?.vendorId || '')
      : userId;

  const handleReject = async (booking: Booking) => {
    if (userType === 'staff') {
      const reason = prompt('Reason for rejection (optional):');
      if (reason === null) return;

      try {
        setCompletingBooking(true);
        const endpoint = getActionEndpoint(booking.id, 'reject');
        const data = await apiClient.put<any>(endpoint, { reason }) as any;

        if (data && data.success) {
          toast.success('Booking rejected');
          loadBookings();
        } else {
          toast.error(data?.error || 'Failed to reject booking');
        }
      } catch (error: any) {
        console.error('Error rejecting booking:', error);
        toast.error(error.message || 'Failed to reject booking');
      } finally {
        setCompletingBooking(false);
      }
      return;
    }

    setDeclineVendorBooking({
      ...booking,
      scheduledDate: booking.date,
      scheduledTime: booking.time,
    } as any);
  };

  // Helper function to check if booking is tele consultation
  const isTeleConsultationBooking = (booking: Booking): boolean => {
    return booking.serviceType === 'tele' || 
           booking.serviceType === 'video_consultation' ||
           (booking as any).service_type === 'tele' ||
           (booking as any).service_type === 'video_consultation' ||
           (booking as any).service_style === 'tele';
  };

  const handleStart = async (booking: Booking) => {
    // ✅ FIX: Check service type FIRST - tele consultations don't need OTP
    if (!isVendorTeleConsultationBooking(booking) && booking.otp) {
      setSelectedBooking(booking);
      setOtpAction('start');
      setOtpInput('');
      setOtpError('');
      setShowOTPModal(true);
    } else {
      await doStart(booking, '');
    }
  };

  const doStart = async (booking: Booking, otpCode: string) => {
    try {
      setCompletingBooking(true);
      const endpoint = getActionEndpoint(booking.id, 'start');
      const data = await apiClient.put<any>(endpoint, { otp: otpCode }) as any;

      if (data && data.success) {
        toast.success('Service started' + (data.gpsTrackingEnabled ? ' - GPS tracking enabled' : ''));
        setShowOTPModal(false);
        
        // Start GPS tracking for at_home services
        if (booking.serviceType === 'at_home' && booking.customerLat && booking.customerLng) {
          startLocationTracking(booking.id, booking.customerLat, booking.customerLng);
        }
        
        loadBookings();
      } else {
        throw new Error(data?.error || 'Failed to start service');
      }
    } catch (error: any) {
      console.error('Error starting service:', error);
      toast.error(error.message || 'Failed to start service');
    } finally {
      setCompletingBooking(false);
    }
  };

  const startLocationTracking = async (bookingId: string, _customerLat: string, _customerLng: string) => {
    const effectiveVendorId = userType === 'staff' ? (userData?.vendor_id || userId) : userId;
    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;

            const res = await apiClient.post<any>(`/vendor/bookings/${bookingId}/start-travel`, {
              vendorId: effectiveVendorId,
              startLocation: { latitude, longitude },
            });

            const sessionId = res?.session?.id;
            if (!sessionId) {
              toast.error('Could not start tracking session');
              return;
            }

            setTrackingSessionIds(prev => ({ ...prev, [bookingId]: sessionId }));
            (window as any)[`tracking_session_${bookingId}`] = sessionId;
            setIsTracking(prev => ({ ...prev, [bookingId]: true }));
            setTrackingLocation(prev => ({
              ...prev,
              [bookingId]: { lat: latitude, lng: longitude, updated: new Date().toISOString() },
            }));

            const throttleKey = `gps_last_sent_${bookingId}`;
            const interval = setInterval(async () => {
              const now = Date.now();
              if ((window as any)[throttleKey] && now - (window as any)[throttleKey] < 30000) return;
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  async (pos) => {
                    const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
                    try {
                      await apiClient.post<any>(`/tracking/${sessionId}/update`, {
                        latitude: loc.latitude,
                        longitude: loc.longitude,
                      });
                      (window as any)[throttleKey] = Date.now();
                      setTrackingLocation(prev => ({
                        ...prev,
                        [bookingId]: { lat: loc.latitude, lng: loc.longitude, updated: new Date().toISOString() },
                      }));
                    } catch (error: any) {
                      console.error('Error updating location:', error);
                      const isNetwork = error?.message?.includes('fetch') || error?.code === 'ERR_NETWORK' || error?.name === 'TypeError';
                      if (isNetwork && !(window as any)[`gps_network_toast_${bookingId}`]) {
                        (window as any)[`gps_network_toast_${bookingId}`] = true;
                        toast.error('Connection issue. Location will retry when back online.');
                      }
                    }
                  },
                  (error) => {
                    if (error?.code === error?.TIMEOUT || error?.code === 3) {
                      toast.error('Location timed out. Check signal; tracking will retry.');
                    }
                  }
                );
              }
            }, 45000);

            (window as any)[`tracking_${bookingId}`] = interval;
          },
          (error) => {
            console.error('Error getting location:', error);
            toast.error('Location permission denied. GPS tracking disabled.');
          }
        );
      }
    } catch (error: any) {
      console.error('Error starting location tracking:', error);
      toast.error('Failed to start GPS tracking. Check connection and try again.');
    }
  };

  const stopLocationTracking = async (bookingId: string) => {
    const sessionId = trackingSessionIds[bookingId] || (window as any)[`tracking_session_${bookingId}`];
    try {
      if (sessionId) {
        await apiClient.post<any>(`/tracking/${sessionId}/cancel`, { reason: 'vendor_stopped' });
        delete (window as any)[`tracking_session_${bookingId}`];
        setTrackingSessionIds(prev => {
          const next = { ...prev };
          delete next[bookingId];
          return next;
        });
      }

      const interval = (window as any)[`tracking_${bookingId}`];
      if (interval) {
        clearInterval(interval);
        delete (window as any)[`tracking_${bookingId}`];
      }

      setIsTracking(prev => {
        const newState = { ...prev };
        delete newState[bookingId];
        return newState;
      });
      setTrackingLocation(prev => {
        const newState = { ...prev };
        delete newState[bookingId];
        return newState;
      });

      toast.success('GPS tracking stopped');
    } catch (error: any) {
      console.error('Error stopping location tracking:', error);
    }
  };

  // Cleanup tracking on unmount
  useEffect(() => {
    return () => {
      Object.keys(isTracking).forEach(bookingId => {
        const interval = (window as any)[`tracking_${bookingId}`];
        if (interval) {
          clearInterval(interval);
        }
      });
    };
  }, []);

  const handleComplete = async (booking: Booking) => {
    // ✅ FIX: Check service type FIRST - tele consultations don't need OTP
    if (!isVendorTeleConsultationBooking(booking) && booking.otp) {
      setSelectedBooking(booking);
      setOtpAction('complete');
      setOtpInput('');
      setOtpError('');
      setShowOTPModal(true);
    } else {
      await doComplete(booking, '');
    }
  };

  const doComplete = async (booking: Booking, otpCode: string) => {
    const bid = resolveVendorBookingId(booking);
    if (!bid) {
      toast.error('Missing booking id');
      return;
    }
    try {
      setCompletingBooking(true);
      const data =
        userType === 'vendor' || userType === 'solo' || userType === 'solo_vendor'
          ? ((await apiClient.post(`/vendor/bookings/${bid}/complete`, {
              vendorId: userId,
              otp: otpCode || null,
            })) as { success?: boolean; error?: string; message?: string })
          : ((await apiClient.put(getActionEndpoint(bid, 'complete'), { otp: otpCode })) as {
              success?: boolean;
              error?: string;
            });

      if (data && data.success !== false) {
        // Stop GPS tracking if active
        if (isTracking[booking.id]) {
          await stopLocationTracking(booking.id);
        }
        toast.success('Service completed successfully!');
        setShowOTPModal(false);
        loadBookings();
      } else {
        throw new Error(data?.error || 'Failed to complete service');
      }
    } catch (error: any) {
      console.error('Error completing service:', error);
      toast.error(error.message || 'Failed to complete service');
    } finally {
      setCompletingBooking(false);
    }
  };

  const handleOTPSubmit = async () => {
    if (!selectedBooking) return;
    
    if (otpInput.length !== 6 && otpInput.length !== 4) {
      setOtpError('Please enter a valid OTP (4 or 6 digits)');
      return;
    }
    
    if (otpAction === 'start') {
      await doStart(selectedBooking, otpInput);
    } else {
      await doComplete(selectedBooking, otpInput);
    }
  };

  const handleOpenChat = (booking: Booking) => {
    setChatBooking(booking);
    setShowChatModal(true);
  };

  const handleOpenVideoCall = (booking: Booking) => {
    const bid = resolveVendorBookingId(booking);
    if (!bid) {
      toast.error('Missing booking id');
      return;
    }
    const params = new URLSearchParams();
    params.set('bookingId', bid);
    router.push(`/video?${params.toString()}`);
  };

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

  const getServiceStyleIcon = (style: string) => {
    switch (style) {
      case 'at_home': return <Home className="w-4 h-4" />;
      case 'tele': return <Video className="w-4 h-4" />;
      case 'at_center': return <Building2 className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  const getDisplayName = () => {
    if (userType === 'staff') {
      return userData?.name || userData?.fullName || 'Staff Member';
    }
    return userData?.businessName || userData?.ownerName || userData?.fullName || 'Appointments';
  };

  const getDisplayLocation = () => {
    if (userType === 'staff') {
      return userData?.vendor?.businessName || userData?.vendor?.address || 'Location';
    }
    return userData?.address || 'Location';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="vendor-app-column bg-white min-h-screen pb-20">
        {/* Header */}
        <div className="p-4 bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={onBack} className="w-8 h-8 flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div className="flex-1">
              <h1 className="font-semibold text-gray-900">{getDisplayName()}</h1>
              <p className="text-xs text-gray-500">{getDisplayLocation()}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={loadBookings} disabled={loading}>
                <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
              </button>
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
            {userType === 'vendor' && (
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
            )}
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
              onClick={() => setSchedulePeriod('today')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                schedulePeriod === 'today'
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setSchedulePeriod('week')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                schedulePeriod === 'week'
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setSchedulePeriod('month')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                schedulePeriod === 'month'
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
            {/* Stats */}
            <div className="p-4 bg-white border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Overview</h3>
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
                    <Calendar className="w-6 h-6 text-gray-600" />
                  </div>
                  <div className="font-semibold text-gray-900">{stats.appointments}</div>
                  <div className="text-xs text-gray-500">Total</div>
                </div>
              </div>
            </div>

            {/* Appointments List */}
            <div className="p-4 bg-white">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                {isVendorLikeUser
                  ? scheduleAppointmentsSectionTitle(schedulePeriod, selectedDate)
                  : 'Appointments'}
              </h3>
              
              {loading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-[#FF8C42] mx-auto" />
                </div>
              ) : (() => {
                // ✅ FIX: Filter out completed bookings from main dashboard view
                const activeBookings = bookings.filter(b => b.status !== 'completed');
                return activeBookings.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    {isVendorLikeUser
                      ? scheduleEmptyStateMessage(schedulePeriod)
                      : 'No appointments scheduled'}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeBookings.map((booking) => (
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
                            <Clock className="w-4 h-4 text-gray-500" />
                            <span className="text-sm font-semibold text-gray-900">{booking.time}</span>
                            <Badge className={getStatusColor(booking.status)}>
                              {booking.status.replace('_', ' ')}
                            </Badge>
                            <div className="flex items-center gap-1 text-gray-500">
                              {getServiceStyleIcon(booking.serviceType || 'at_center')}
                            </div>
                          </div>
                          <div className="space-y-1 mb-2">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-400" />
                              <span className="text-sm font-medium text-gray-900">{booking.customerName}</span>
                              <span className="text-xs text-gray-500">({booking.phone})</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm">🐕</span>
                              <span className="text-sm text-gray-700">{booking.petName} - {booking.petType}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Package className="w-4 h-4 text-gray-400" />
                              <span className="text-sm font-medium text-[#FF8C42]">{resolveVendorBookingServiceLabel(booking)}</span>
                            </div>
                            {booking.location && (
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-700">{booking.location}</span>
                                {booking.distance && (
                                  <Badge variant="outline" className="text-xs">
                                    {booking.distance.toFixed(1)} km
                                  </Badge>
                                )}
                              </div>
                            )}
                            {shouldShowVendorBookingPrice(booking) && (
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-900">₹{booking.price}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 flex-wrap mt-3" onClick={(e) => e.stopPropagation()}>
                        {userType === 'staff' && booking.status === 'pending' && (
                          <Button
                            onClick={() => handleReject(booking)}
                            variant="outline"
                            className="flex-1 border-red-500 text-red-600 hover:bg-red-50"
                            size="sm"
                            disabled={completingBooking}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Reject
                          </Button>
                        )}

                        {(userType === 'vendor' || userType === 'solo' || userType === 'solo_vendor') &&
                          (booking.status === 'pending' || booking.status === 'confirmed') && (
                          <Button
                            onClick={() => handleReject(booking)}
                            variant="outline"
                            className="flex-1 border-red-500 text-red-600 hover:bg-red-50"
                            size="sm"
                            disabled={completingBooking}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Decline (refund per policy)
                          </Button>
                        )}

                        {booking.status === 'confirmed' && (
                          <Button
                            onClick={() => handleStart(booking)}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                            size="sm"
                            disabled={completingBooking}
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Start Service
                          </Button>
                        )}

                        {booking.status === 'in_progress' && (
                          <>
                            {booking.serviceType === 'at_home' && (
                              <>
                                <Button
                                  onClick={() => {
                                    if (booking.customerLat && booking.customerLng) {
                                      const url = `https://www.google.com/maps/dir/?api=1&destination=${booking.customerLat},${booking.customerLng}`;
                                      window.open(url, '_blank');
                                    }
                                  }}
                                  variant="outline"
                                  className="flex-1"
                                  size="sm"
                                >
                                  <Navigation className="w-4 h-4 mr-2" />
                                  Navigate
                                </Button>
                                {isTracking[booking.id] ? (
                                  <Button
                                    onClick={() => stopLocationTracking(booking.id)}
                                    variant="outline"
                                    className="flex-1 border-green-500 text-green-600 hover:bg-green-50"
                                    size="sm"
                                  >
                                    <Radio className="w-4 h-4 mr-2" />
                                    Stop GPS
                                  </Button>
                                ) : (
                                  <Button
                                    onClick={() => {
                                      if (booking.customerLat && booking.customerLng) {
                                        startLocationTracking(booking.id, booking.customerLat, booking.customerLng);
                                      }
                                    }}
                                    variant="outline"
                                    className="flex-1 border-blue-500 text-blue-600 hover:bg-blue-50"
                                    size="sm"
                                  >
                                    <Map className="w-4 h-4 mr-2" />
                                    Start GPS
                                  </Button>
                                )}
                              </>
                            )}
                            <Button
                              onClick={() => handleComplete(booking)}
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                              size="sm"
                              disabled={completingBooking}
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Complete
                            </Button>
                          </>
                        )}

                        {booking.status !== 'completed' && booking.status !== 'cancelled' && chatEnabled && (
                          <Button
                            onClick={() => handleOpenChat(booking)}
                            variant="outline"
                            size="sm"
                            className="flex-1"
                          >
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Chat
                            {booking.hasUnreadMessages && (
                              <Badge className="ml-2 bg-red-500 text-white text-xs">
                                {booking.unreadMessageCount || 1}
                              </Badge>
                            )}
                          </Button>
                        )}

                        {booking.communicationType === 'video' && booking.status !== 'completed' && (
                          <Button
                            onClick={() => handleOpenVideoCall(booking)}
                            variant="outline"
                            size="sm"
                            className="flex-1"
                          >
                            <Video className="w-4 h-4 mr-2" />
                            Video Call
                          </Button>
                        )}
                      </div>
                    </div>
                    ))}
                    {isVendorLikeUser &&
                      (bookingsTotal > VENDOR_SCHEDULE_PAGE_SIZE || bookingsPageIndex > 0) && (
                        <div className="pt-4 mt-2 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                          <p className="text-xs text-gray-500">
                            {paginationShowingLabel(
                              bookingsTotal,
                              bookingsPageIndex * VENDOR_SCHEDULE_PAGE_SIZE,
                              activeBookings.length
                            )}
                          </p>
                          <div className="flex gap-2 w-full sm:w-auto">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="flex-1 sm:flex-none"
                              disabled={bookingsPageIndex === 0 || loading}
                              onClick={() => setBookingsPageIndex((p) => Math.max(0, p - 1))}
                            >
                              Previous
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="flex-1 sm:flex-none"
                              disabled={!bookingsHasMore || loading}
                              onClick={() => setBookingsPageIndex((p) => p + 1)}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                  </div>
                );
              })()}
            </div>
          </>
        )}

        {/* EARNINGS TAB — uses vendor_earnings via API (center-aware); stats.earnings = completed-only sum from current list */}
        {activeTab === 'earnings' && (
          <div className="p-4">
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Earnings Summary</h3>
              {tabEarnings.loading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-10 w-10 animate-spin text-[#FF8C42]" aria-hidden />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-gray-600">Total recorded earnings</span>
                    <span className="font-bold text-lg text-gray-900 shrink-0">
                      ₹{tabEarnings.total.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-gray-600">Pending settlement</span>
                    <span className="font-semibold text-gray-900 shrink-0">
                      ₹{tabEarnings.pending.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-3">
                    <span className="text-gray-600">Earning records</span>
                    <span className="font-semibold text-gray-900 shrink-0">{tabEarnings.txnCount}</span>
                  </div>
                  <p className="text-xs text-gray-500 pt-3 border-t border-gray-100 leading-relaxed">
                    Totals include all visits recorded for payout after completion (same source as Finance →
                    Earnings). In the Bookings tab, &quot;Overview&quot; below shows only appointments loaded for
                    the selected date and filters — completed revenue from that list: ₹
                    {stats.earnings.toLocaleString()}.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PAYOUTS TAB (Vendor only) */}
        {activeTab === 'payouts' && userType === 'vendor' && (
          <div className="p-4">
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-4">Payouts</h3>
              <p className="text-gray-600 text-sm">Payout management is not available.</p>
            </div>
          </div>
        )}
      </div>

      {/* OTP Modal */}
      <Dialog open={showOTPModal} onOpenChange={setShowOTPModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {otpAction === 'start' ? 'Start Service' : 'Complete Service'}
            </DialogTitle>
            <DialogDescription>
              Enter the OTP provided by the customer to {otpAction === 'start' ? 'start' : 'complete'} the service
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedBooking && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Service:</strong> {resolveVendorBookingServiceLabel(selectedBooking)}
                </p>
                <p className="text-sm text-blue-800">
                  <strong>Customer:</strong> {selectedBooking.customerName}
                </p>
                {selectedBooking.otp && (
                  <p className="text-xs text-blue-600 mt-1">
                    Customer OTP: <strong>{selectedBooking.otp}</strong>
                  </p>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="otp" className="text-sm font-medium text-gray-700 mb-2 block">
                Enter OTP
              </Label>
              <Input
                id="otp"
                type="text"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="h-12 text-2xl text-center tracking-widest font-mono"
                maxLength={6}
                autoFocus
              />
              {otpError && (
                <p className="text-sm text-red-600 mt-2">{otpError}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowOTPModal(false);
                setSelectedBooking(null);
                setOtpInput('');
                setOtpError('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleOTPSubmit}
              disabled={otpInput.length < 4 || completingBooking}
              className="bg-[#FF8C42] hover:bg-[#FF7A29]"
            >
              {completingBooking ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                otpAction === 'start' ? 'Start Service' : 'Complete Service'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chat Modal */}
      {showChatModal && chatBooking && (
        <VendorChatModal
          bookingId={chatBooking.bookingId || chatBooking.id}
          customerName={chatBooking.customerName}
          customerPhone={chatBooking.customerPhone || chatBooking.phone}
          vendorId={userId}
          vendorPhone={userPhone || ''}
          vendorName={userName || getDisplayName()}
          bookingStatus={chatBooking.status}
          serviceName={chatBooking.serviceName}
          serviceType={chatBooking.serviceType || chatBooking.service_type}
          meetingId={chatBooking.meetingId || chatBooking.meeting_id}
          onClose={() => {
            setShowChatModal(false);
            setChatBooking(null);
            loadBookings();
          }}
          onVideoCallStart={(bid, mid) => {
            setShowChatModal(false);
            setChatBooking(null);
          }}
        />
      )}

      {/* Appointment Detail Modal */}
      {showAppointmentDetail && detailBookingId && (
        <AppointmentDetailModal
          bookingId={detailBookingId}
          vendorData={userData}
          onClose={() => {
            setShowAppointmentDetail(false);
            setDetailBookingId(null);
          }}
          onRefresh={() => loadBookings()}
        />
      )}

      {declineVendorBooking && declineVendorId && (
        <DeclineBookingModal
          booking={declineVendorBooking as any}
          vendorId={declineVendorId}
          onClose={() => setDeclineVendorBooking(null)}
          onSuccess={() => {
            setDeclineVendorBooking(null);
            loadBookings();
          }}
        />
      )}
    </div>
  );
}
