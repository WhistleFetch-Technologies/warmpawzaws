'use client';

import { useState, useEffect, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  VENDOR_CANCELLATION_REASON_OPTIONS,
  type VendorCancellationReasonSlug,
} from '@/lib/vendor-cancellation-reasons';
import { getApiBaseUrl, getAuthHeaders } from '@/lib/api-config';
import { setHomeServiceTrackingReturnHref } from '@/lib/vendor-live-tracker-nav';
import { bookingNeedsWalkLiveTracker } from '@/lib/vendor-walk-live-tracker';
import { VendorChatModal } from './VendorChatModal';
import { VendorTeleConsultationFlow } from './VendorTeleConsultationFlow';
import { AppointmentDetailModal } from './AppointmentDetailModal';
import { PrescriptionHistoryModal } from './PrescriptionHistoryModal';
import { VendorHeader } from '@/components/vendor/VendorHeader';
import { 
  Search, 
  Filter, 
  Calendar, 
  Phone, 
  Video, 
  MapPin, 
  Navigation,
  MessageSquare, 
  CheckCircle, 
  Pill, 
  FileText, 
  RefreshCw, 
  X,
  Sparkles,
  Package,
} from 'lucide-react';
import {
  getVendorRoleId,
  getVendorAllowedServiceStyles,
  hasVendorRole,
  isSoloVendor,
} from '@/lib/vendor-utils';
import { EmergencyAvailabilitySosCard } from './EmergencyAvailabilitySosCard';
import { DeclineBookingModal } from './DeclineBookingModal';

/** 7-day chart when API omits dailyBreakdown: bucket by credited-at (realizedAt). */
function buildDailyTrendFromEarningTransactions(transactions: any[]): Array<{ day: string; amount: number }> {
  const shortDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const formatLocalYmd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const byKey = new Map<string, number>();
  for (const t of transactions || []) {
    const raw = t?.realizedAt ?? t?.realized_at ?? t?.createdAt ?? t?.created_at;
    if (!raw) continue;
    const k = formatLocalYmd(new Date(raw));
    const a = Number(t?.amount ?? t?.price ?? 0);
    if (!Number.isFinite(a)) continue;
    byKey.set(k, (byKey.get(k) || 0) + a);
  }
  const ref = new Date();
  const out: Array<{ day: string; amount: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - i, 12, 0, 0, 0);
    const key = formatLocalYmd(d);
    const amt = Math.round((byKey.get(key) || 0) * 100) / 100;
    out.push({ day: shortDay[d.getDay()] ?? '—', amount: amt });
  }
  return out;
}

interface VendorBookingManagementProps {
  vendorId: string;
  vendorData?: any;
  onBack: () => void;
  /** Whether chat capability is enabled for this vendor's role (from role config) */
  chatEnabled?: boolean;
  /** Vendor phone for chat identification */
  vendorPhone?: string;
  /** Vendor name for chat display */
  vendorName?: string;
  /** When true, omit outer shell and VendorHeader (parent provides them, e.g. VendorRouteShell). */
  embedded?: boolean;
  /** Set when opening `/bookings?walkSessions=1` from the walker dashboard tile. */
  walkSessionsFocus?: boolean;
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
  service_type?: string; // snake_case from API
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
  
  // ✅ Meeting/video call fields
  meetingId?: string;
  meeting_id?: string;
  
  // Allow any additional properties from API
  [key: string]: any;
}

interface TimeSlot {
  time: string;
  available: boolean;
  booked?: boolean;
  isPast?: boolean;
  serviceType?: string;
}

interface BreakWindow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

function timeToMinutes(timeStr: string): number {
  const normalized = (timeStr || '').trim();
  const parts = normalized.split(':');
  const hours = parseInt(parts[0] || '0', 10);
  const minutes = parseInt(parts[1] || '0', 10);
  return (hours * 60) + minutes;
}

function normalizeBookingTimeTo24h(rawTime: string): string | null {
  if (!rawTime || typeof rawTime !== 'string') return null;
  const trimmed = rawTime.trim();
  if (!trimmed) return null;

  // Format like "10:00 AM"
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hour = parseInt(ampmMatch[1], 10);
    const minute = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3].toUpperCase();
    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  // Formats like "10:00", "10:00:00", "10:00:00.123"
  const hhmmssMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if (hhmmssMatch) {
    const hour = parseInt(hhmmssMatch[1], 10);
    const minute = parseInt(hhmmssMatch[2], 10);
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  return null;
}

function format24hTo12hLabel(time24: string): string {
  const normalized = normalizeBookingTimeTo24h(time24);
  if (!normalized) return time24;
  const [hh, mm] = normalized.split(':').map((v) => parseInt(v, 10));
  const period = hh >= 12 ? 'PM' : 'AM';
  const hour12 = hh % 12 || 12;
  return `${hour12}:${String(mm).padStart(2, '0')} ${period}`;
}

function normalizeServiceType(raw: string | undefined): string {
  const v = (raw || '').toLowerCase().trim();
  if (!v) return 'other';
  if (v === 'at_center' || v === 'at_clinic' || v === 'at_vendor') return 'at_center';
  if (v === 'at_home' || v === 'home_visit' || v === 'home_service') return 'at_home';
  if (v === 'tele' || v === 'video_consultation' || v === 'tele_consultation' || v === 'online') return 'tele';
  return v;
}

/** Format DB time (e.g. "10:00:00" or "10:00") to 12h (e.g. "10:00 AM") */
function formatDbTimeTo12h(raw: string): string {
  if (!raw || typeof raw !== 'string') return '10:00 AM';
  if (raw.includes('AM') || raw.includes('PM')) return raw.trim();
  const parts = raw.replace(/\.\d+$/, '').split(':');
  const h = parseInt(parts[0] || '10', 10);
  const m = parseInt(parts[1] || '0', 10);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

export function VendorBookingManagement({
  vendorId,
  vendorData,
  onBack,
  chatEnabled = true,
  vendorPhone,
  vendorName,
  embedded = false,
  walkSessionsFocus = false,
}: VendorBookingManagementProps) {
  const router = useRouter();

  // ✅ FIX: Check if vendor is solo groomer (groomer_solo) - they only do at_home, no tele
  const isSoloGroomer = hasVendorRole(vendorData, ['pet_groomer', 'groomer', 'groomer_solo']) && 
                        (vendorData?.vendorConfiguration === 'solo' || 
                         vendorData?.vendorType === 'solo' || 
                         vendorData?.vendor_type === 'solo' ||
                         isSoloVendor(vendorData));
  
  const allowedServiceStyles = getVendorAllowedServiceStyles(vendorData);
  const hasTeleService = !isSoloGroomer && allowedServiceStyles.includes('tele');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeFilter, setActiveFilter] = useState<'today' | 'week' | 'month'>('today');
  const [activeView, setActiveView] = useState<'consultations' | 'locations'>('consultations');
  const [activeTab, setActiveTab] = useState<'bookings' | 'earnings' | 'payouts'>('bookings');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  /** Walk sessions tile: land on bookings-only UI; do not auto-open live tracker (vendor taps Live tracker). */
  useEffect(() => {
    if (walkSessionsFocus) setActiveTab('bookings');
  }, [walkSessionsFocus]);

  const [stats, setStats] = useState({
    calls: 0,
    online: 0,
    phone: 0
  });
  
  // Earnings State
  const [earningsData, setEarningsData] = useState<{
    today: number;
    thisWeek: number;
    thisMonth: number;
    pending: number;
    total: number;
    transactions: Array<{
      id: string;
      date: string;
      service: string;
      amount: number;
      status: string;
      customer: string;
    }>;
    dailyTrend: Array<{
      day: string;
      amount: number;
    }>;
  } | null>(null);
  const [earningsLoading, setEarningsLoading] = useState(false);
  const [tierInfo, setTierInfo] = useState<{
    name?: string;
    current?: string;
    commission?: number;
    commissionRate?: number;
    canUpgrade?: boolean;
    nextTier?: string | { name?: string };
    payoutCycleLabel?: string;
  } | null>(null);
  
  // Payouts State
  const [payoutsData, setPayoutsData] = useState<{
    availableForPayout: number;
    pending: number;
    paidOut: number;
    bankAccount: {
      bankName: string;
      accountNumber: string;
      accountHolder: string;
      verified: boolean;
    } | null;
    payoutHistory: Array<{
      id: string;
      date: string;
      amount: number;
      status: string;
      txnId: string;
    }>;
    payoutSchedule: string;
  } | null>(null);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  
  // OTP Modal State
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');
  const [completingBooking, setCompletingBooking] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [cancelPolicyReason, setCancelPolicyReason] =
    useState<VendorCancellationReasonSlug>('operational');
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [declineModalBooking, setDeclineModalBooking] = useState<Booking | null>(null);

  // ✅ Chat Modal State
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatBooking, setChatBooking] = useState<Booking | null>(null);
  
  // ✅ Video Call Modal State
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [videoBooking, setVideoBooking] = useState<Booking | null>(null);
  
  // ✅ Appointment Detail Modal State
  const [showAppointmentDetail, setShowAppointmentDetail] = useState(false);
  const [detailBookingId, setDetailBookingId] = useState<string | null>(null);
  
  // ✅ Prescription Modal State
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [prescriptionBookingId, setPrescriptionBookingId] = useState<string | null>(null);

  /**
   * Build time-slot chips purely from vendor availability API response.
   * No fallback. No assumptions. Only real data.
   *
   * 1. Filter availability windows to the selected day-of-week.
   * 2. Find the smallest startTime across all windows → that is the real day start.
   * 3. Generate 30-min slots within each window.
   * 4. Exclude break windows.
   * 5. For today, skip slots whose time has already passed.
   * 6. Mark booked slots from actual bookings.
   * 7. Return sorted chronologically (earliest first).
   */
  const buildSlotsFromAvailability = (
    availabilitySlots: any[] = [],
    breaks: any[] = [],
    existingBookings: Booking[] = []
  ): TimeSlot[] => {
    const selectedDateObj = new Date(selectedDate);
    const dayOfWeek = selectedDateObj.getDay(); // 0=Sun..6=Sat
    const isToday = selectedDate === new Date().toISOString().split('T')[0];
    const now = new Date();
    const nowMinutes = isToday ? (now.getHours() * 60) + now.getMinutes() : 0;

    // 1. Get enabled windows for selected day
    const windowsForDay = availabilitySlots
      .filter((s: any) => Number(s?.dayOfWeek) === dayOfWeek && s?.isEnabled !== false)
      .map((s: any) => ({
        start: (s.startTime || '').toString().substring(0, 5),
        end:   (s.endTime   || '').toString().substring(0, 5),
        serviceType: normalizeServiceType(
          (Array.isArray(s.serviceStyles) && s.serviceStyles.length > 0 ? s.serviceStyles[0] : s.serviceType) || ''
        ),
      }))
      .filter((w) => /^\d{2}:\d{2}$/.test(w.start) && /^\d{2}:\d{2}$/.test(w.end));

    if (windowsForDay.length === 0) return [];

    // 2. Collect break ranges for this day
    const breakRanges = breaks
      .filter((b: any) => Number(b?.dayOfWeek) === dayOfWeek)
      .map((b: any) => ({
        start: timeToMinutes((b.startTime || '').toString().substring(0, 5)),
        end:   timeToMinutes((b.endTime   || '').toString().substring(0, 5)),
      }));
    const isInBreak = (m: number) => breakRanges.some((br) => m >= br.start && m < br.end);

    // 3. Booked times set (normalised to HH:MM)
    const bookedTimeSet = new Set(
      existingBookings
        .filter((b) => !['cancelled', 'no_show'].includes((b.status || '').toLowerCase()))
        .map((b) => normalizeBookingTimeTo24h(b.time))
        .filter((t): t is string => !!t)
    );

    // 4. Generate 30-min slots from each window, skip breaks only.
    //    Past slots are kept but marked isPast so they render before future ones.
    const slotMap = new Map<string, { order: number; slot: TimeSlot }>(); // key = type + minutes
    for (const w of windowsForDay) {
      const startM = timeToMinutes(w.start);
      const endM   = timeToMinutes(w.end);
      for (let m = startM; m < endM; m += 30) {
        if (isInBreak(m)) continue;              // skip breaks
        const hh = String(Math.floor(m / 60)).padStart(2, '0');
        const mm = String(m % 60).padStart(2, '0');
        const time = `${hh}:${mm}`;
        const isPast = isToday && m < nowMinutes;
        const isBooked = bookedTimeSet.has(time);
        const key = `${w.serviceType}:${m}`;
        slotMap.set(key, {
          order: m,
          slot: {
            time,
            available: isPast ? false : !isBooked,
            booked: isBooked,
            isPast,
            serviceType: w.serviceType,
          },
        });
      }
    }

    // 5. Return sorted by time (ascending)
    return Array.from(slotMap.values())
      .sort((a, b) => a.order - b.order)
      .map((entry) => entry.slot);
  };

  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [breakWindows, setBreakWindows] = useState<BreakWindow[]>([]);
  const selectedDayOfWeek = new Date(selectedDate).getDay();
  const slotTypeOrder = ['at_center', 'at_home', 'tele', 'other'];
  const slotTypeLabelMap: Record<string, string> = {
    at_center: 'At Center',
    at_home: 'At Home',
    tele: 'Tele',
    other: 'Other',
  };
  const groupedSlotsByType = slotTypeOrder
    .map((type) => ({
      type,
      label: slotTypeLabelMap[type] || type,
      slots: timeSlots.filter((slot) => (slot.serviceType || 'other') === type),
    }))
    .filter((group) => group.slots.length > 0);
  const breakWindowsForDay = breakWindows
    .filter((b) => b.dayOfWeek === selectedDayOfWeek)
    .map((b) => ({
      start: (b.startTime || '').toString().substring(0, 5),
      end: (b.endTime || '').toString().substring(0, 5),
    }))
    .filter((b) => /^\d{2}:\d{2}$/.test(b.start) && /^\d{2}:\d{2}$/.test(b.end))
    .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

  useEffect(() => {
    loadBookings();
  }, [selectedDate, activeFilter]);
  
  // Load earnings when Earnings tab is shown (vendorId must be set; not tied to bookings date filter)
  useEffect(() => {
    if (activeTab === 'earnings' && vendorId) {
      loadEarningsData();
    }
  }, [activeTab, vendorId]);
  
  // Load payouts data when payouts tab is active
  useEffect(() => {
    if (activeTab === 'payouts') {
      loadPayoutsData();
    }
  }, [activeTab]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      
      console.log('🔍 [VENDOR-UI] Loading bookings with filters:', {
        date: selectedDate,
        filter: activeFilter,
        vendorId
      });
      
      // Load bookings and vendor-configured availability in parallel
      // Use startDate for week/month filters, date for today filter
      let dateParam = '';
      if (activeFilter === 'today') {
        dateParam = `date=${selectedDate}`;
      } else if (activeFilter === 'week') {
        dateParam = `startDate=${selectedDate}`;
      } else if (activeFilter === 'month') {
        dateParam = `startDate=${selectedDate}`;
      }
      
      const [bookingsData, availabilityData] = await Promise.all([
        apiClient.get(`/vendor/bookings/${vendorId}?${dateParam}&filter=all`) as Promise<any>,
        apiClient.get(`/vendor/${vendorId}/availability`).catch(() => null) as Promise<any>
      ]);

      if (bookingsData && bookingsData.success) {
        console.log('📦 [VENDOR-UI] Raw booking data from API:', bookingsData);
        console.log('📊 [VENDOR-UI] Debug info:', bookingsData.debug);
        
        // Map bookings to expected format - use booking-specific data (not vendor address for all)
        const mappedBookings = (bookingsData.bookings || []).map((booking: any) => {
          // Format time: DB returns booking_time (e.g. "10:00:00") or scheduledTime
          const rawTime = booking.booking_time || booking.scheduledTime || booking.time || booking.scheduled_time;
          const timeStr = typeof rawTime === 'string' 
            ? (rawTime.includes('AM') || rawTime.includes('PM') ? rawTime : formatDbTimeTo12h(rawTime))
            : '10:00 AM';
          // Location: booking address first (customer/destination), fallback to vendor for at_center
          const isAtHome = (booking.service_type || booking.serviceType || '').toString().toLowerCase().includes('home') || 
            (booking.service_style || booking.serviceStyle || '').toString().toLowerCase().includes('home');
          const location = (isAtHome ? (booking.address || booking.destination_address || booking.location || booking.delivery_address) : null)
            || (booking.address || booking.destination_address || booking.location || booking.delivery_address)
            || vendorData?.address || vendorData?.location || 'Clinic Location';
          return {
          id: booking.id,
          bookingId: booking.id,
          time: timeStr,
          customerName: booking.customer?.name || booking.customer_name || booking.customerName || 'Customer',
          customerId: booking.customer_id || booking.customerId || booking.customer?.id || null,
          petName: booking.pet_name || booking.petName || 'Pet',
          petType: booking.pet_type || booking.petType || booking.pet_breed || booking.petBreed || 'Pet',
          location,
          consultationType: booking.service_type || booking.serviceType || 'scheduled',
          communicationType: (booking.service_type || booking.serviceType) === 'tele' ? 'video' : 'in-person',
          serviceType: booking.service_type || booking.serviceType || 'at_center',
          status: booking.status || 'confirmed',
          phone: booking.customer?.phone || booking.customer_phone || booking.customerPhone || '+91 0000000000',
          date: booking.booking_date || booking.scheduledDate || booking.date || selectedDate,
          price: booking.price || 0,
          serviceName: booking.service?.name || booking.service_name || booking.serviceName || 'Service',
          serviceCategory:
            booking.service?.category != null
              ? String(booking.service.category)
              : booking.service_category != null
                ? String(booking.service_category)
                : '',
          service_style: booking.service_style || booking.serviceStyle || '',
          duration: booking.duration || 30,
          
          // ✅ NEW: Chat fields
          hasUnreadMessages: booking.hasUnreadMessages || false,
          unreadMessageCount: booking.unreadMessageCount || 0,
          chatEnabled: booking.chatEnabled || false,
          isFollowUp: booking.isFollowUp || false,
          
          // ✅ NEW: Prescription fields (vet only)
          hasPrescription: booking.hasPrescription || false,
          prescriptionUrl: booking.prescriptionUrl || null,
          prescriptionNotes: booking.prescriptionNotes || null,
          // Preserve meetingId, service_type etc. for downstream
          meetingId: booking.meeting_id || booking.meetingId,
          meeting_id: booking.meeting_id || booking.meetingId,
          
          // Track rescheduled bookings
          isRescheduled: Boolean(booking.isRescheduled || booking.rescheduledAt || booking.rescheduled_at),
          rescheduledAt: booking.rescheduledAt || booking.rescheduled_at || null,

          packagePurchaseId: booking.packagePurchaseId ?? booking.package_purchase_id ?? null,
          package_purchase_id: booking.package_purchase_id ?? booking.packagePurchaseId ?? null,
          isPackageSession: Boolean(booking.isPackageSession ?? booking.is_package_session),
          is_package_session: Boolean(booking.is_package_session ?? booking.isPackageSession),
          packageSessionNumber:
            booking.packageSessionNumber != null
              ? Number(booking.packageSessionNumber)
              : booking.package_session_number != null
                ? Number(booking.package_session_number)
                : null,
          package_session_number:
            booking.package_session_number != null
              ? Number(booking.package_session_number)
              : booking.packageSessionNumber != null
                ? Number(booking.packageSessionNumber)
                : null,
          packageTotalSessions:
            booking.packageTotalSessions != null
              ? Number(booking.packageTotalSessions)
              : booking.package_total_sessions != null
                ? Number(booking.package_total_sessions)
                : null,
          package_total_sessions:
            booking.package_total_sessions != null
              ? Number(booking.package_total_sessions)
              : booking.packageTotalSessions != null
                ? Number(booking.packageTotalSessions)
                : null,
          packageRemainingSessions:
            booking.packageRemainingSessions != null
              ? Number(booking.packageRemainingSessions)
              : booking.package_remaining_sessions != null
                ? Number(booking.package_remaining_sessions)
                : null,
          package_remaining_sessions:
            booking.package_remaining_sessions != null
              ? Number(booking.package_remaining_sessions)
              : booking.packageRemainingSessions != null
                ? Number(booking.packageRemainingSessions)
                : null,
          packageUnlimitedUsage: Boolean(booking.packageUnlimitedUsage ?? booking.package_unlimited_usage),
          package_name: booking.package_name ?? booking.packageName ?? null,
        };
        });
        
        setBookings(mappedBookings);
        console.log(`✅ Loaded ${mappedBookings.length} bookings for vendor ${vendorId}`);
        
        // ✅ FIX: Calculate instant consultation stats from filtered bookings (respects activeFilter: today/week/month)
        // Stats should match what's shown on the dashboard for the selected period
        // Check both serviceType and service_type (from raw booking data) to identify tele consultations
        const teleBookings = mappedBookings.filter((b: Booking) => {
          const serviceType = (b.serviceType || (b as any).service_type || '').toString().toLowerCase();
          return serviceType === 'tele' || 
                 serviceType === 'teleconsultation' || 
                 serviceType.includes('tele') ||
                 b.communicationType === 'video';
        });
        
        // Separate phone calls from video consultations
        const phoneCalls = teleBookings.filter((b: Booking) => 
          b.communicationType === 'call' || 
          (b.serviceType === 'tele' && b.communicationType !== 'video') // Tele without video = phone
        );
        
        const videoCalls = teleBookings.filter((b: Booking) => 
          b.communicationType === 'video' || 
          ((b as any).service_type && (b as any).service_type.toString().toLowerCase() === 'teleconsultation')
        );
        
        // Calculate stats for the selected period (today/week/month)
        setStats({
          calls: teleBookings.length, // Total tele consultations (phone + video)
          online: videoCalls.length, // Video/online consultations
          phone: phoneCalls.length, // Phone consultations
        });
        
        console.log(`📊 [VENDOR-UI] Stats for ${activeFilter}:`, {
          totalTele: teleBookings.length,
          video: videoCalls.length,
          phone: phoneCalls.length,
          totalBookings: mappedBookings.length
        });
        
        // Build slots purely from vendor availability API — no fallback, no assumptions.
        const availabilitySlots = availabilityData?.availability?.slots || [];
        const availabilityBreaks = availabilityData?.availability?.breaks || [];
        const newSlots = buildSlotsFromAvailability(availabilitySlots, availabilityBreaks, mappedBookings);
        setTimeSlots(newSlots);
        setBreakWindows(
          availabilityBreaks.map((b: any) => ({
            dayOfWeek: Number(b?.dayOfWeek),
            startTime: (b?.startTime || '').toString(),
            endTime: (b?.endTime || '').toString(),
          }))
        );
      } else {
        console.error('Failed to load bookings:', bookingsData);
        setBookings([]);
        setTimeSlots([]);
        setBreakWindows([]);
        // ✅ FIX: Reset stats to 0 when no bookings are found for the selected period
        setStats({
          calls: 0,
          online: 0,
          phone: 0,
        });
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
      setBookings([]);
      setTimeSlots([]);
      setBreakWindows([]);
      // ✅ FIX: Reset stats to 0 on error
      setStats({
        calls: 0,
        online: 0,
        phone: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadEarningsData = async () => {
    if (!vendorId) return;
    try {
      setEarningsLoading(true);
      console.log('💰 [VENDOR-UI] Loading earnings data for vendor:', vendorId);
      
      // Fetch earnings, transactions, and tier in parallel
      const [todayData, weekData, monthData, totalData, transactionsData, tierRes] = await Promise.all([
        apiClient.get(`/vendor/${vendorId}/earnings?period=day`).catch(() => null) as Promise<any>,
        apiClient.get(`/vendor/${vendorId}/earnings?period=week`).catch(() => null) as Promise<any>,
        apiClient.get(`/vendor/${vendorId}/earnings?period=month`).catch(() => null) as Promise<any>,
        apiClient.get(`/vendor/${vendorId}/earnings?period=lifetime`).catch(() => null) as Promise<any>,
        apiClient.get(`/vendor/${vendorId}/transactions?period=month&limit=25`).catch(() => null) as Promise<any>,
        apiClient.get(`/vendor/${vendorId}/tier`).catch(() => null) as Promise<any>,
      ]);

      if (tierRes?.tier) {
        setTierInfo(tierRes.tier);
      } else {
        setTierInfo(null);
      }
      
      console.log('📊 [VENDOR-UI] Earnings API responses:', { todayData, weekData, monthData, totalData, transactionsData });
      
      const fromApi =
        weekData?.earnings?.dailyBreakdown ||
        weekData?.earnings?.dailyEarnings ||
        weekData?.dailyBreakdown ||
        weekData?.dailyEarnings;
      let dailyTrend: Array<{ day: string; amount: number }>;
      if (Array.isArray(fromApi) && fromApi.length > 0) {
        dailyTrend = fromApi.map((d: any, index: number) => ({
          day: d.day || d.date || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index] || '',
          amount: Number(d.amount ?? d.earnings ?? 0) || 0,
        }));
      } else {
        const weekTx = weekData?.earnings?.transactions;
        const built = Array.isArray(weekTx) && weekTx.length > 0 ? buildDailyTrendFromEarningTransactions(weekTx) : null;
        dailyTrend =
          built && built.some((x) => x.amount > 0)
            ? built
            : [
                { day: 'Mon', amount: 0 },
                { day: 'Tue', amount: 0 },
                { day: 'Wed', amount: 0 },
                { day: 'Thu', amount: 0 },
                { day: 'Fri', amount: 0 },
                { day: 'Sat', amount: 0 },
                { day: 'Sun', amount: 0 },
              ];
      }
      
      // Prefer credited-at time so totals align with earnings APIs (booking_date can differ)
      const transactions = (transactionsData?.transactions || transactionsData?.data || []).slice(0, 15).map((t: any) => {
        const credited =
          t.realizedAt ||
          t.realized_at ||
          t.createdAt ||
          t.created_at ||
          t.date ||
          new Date().toISOString().split('T')[0];
        return {
          id: String(t.id || t.transactionId || Math.random()),
          date: credited,
          service: t.serviceName || t.service || 'Service',
          amount: Number(t.amount || t.price || 0) || 0,
          status: t.status || 'completed',
          customer: t.customerName || t.customer || 'Customer',
        };
      });
      
      // API returns { success, earnings: { totalEarnings, thisPeriod, ... }, period } - extract numbers only
      const eNum = (res: any, field: 'thisPeriod' | 'totalEarnings') => {
        const earn = res?.earnings;
        if (earn && typeof earn === 'object') return Number(earn[field]) || 0;
        return Number(res?.[field] ?? res?.totalEarnings) || 0;
      };
      setEarningsData({
        today: eNum(todayData, 'thisPeriod') || eNum(todayData, 'totalEarnings'),
        thisWeek: eNum(weekData, 'thisPeriod') || eNum(weekData, 'totalEarnings'),
        thisMonth: eNum(monthData, 'thisPeriod') || eNum(monthData, 'totalEarnings'),
        pending: Number(totalData?.earnings?.pendingSettlement ?? totalData?.pendingSettlement ?? totalData?.pending ?? monthData?.earnings?.pendingSettlement ?? 0) || 0,
        total: eNum(totalData, 'totalEarnings'),
        transactions,
        dailyTrend: dailyTrend.map((d: any, index: number) => ({
          day: d.day || d.date || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index],
          amount: d.amount || d.earnings || 0,
        })),
      });
      
      console.log('✅ [VENDOR-UI] Earnings data loaded successfully');
    } catch (error) {
      console.error('❌ Error loading earnings:', error);
      setTierInfo(null);
      // Set empty data on error
      setEarningsData({
        today: 0,
        thisWeek: 0,
        thisMonth: 0,
        pending: 0,
        total: 0,
        transactions: [],
        dailyTrend: [],
      });
    } finally {
      setEarningsLoading(false);
    }
  };

  const loadPayoutsData = async () => {
    try {
      setPayoutsLoading(true);
      console.log('🏦 [VENDOR-UI] Loading payouts data for vendor:', vendorId);
      
      // Fetch settlements/payouts data and bank details in parallel
      const [settlementsData, settlementsSummary, bankData, policyData] = await Promise.all([
        apiClient.get(`/vendor/${vendorId}/settlements?limit=10`).catch(() => null) as Promise<any>,
        apiClient.get(`/vendor/${vendorId}/settlements?summary=true`).catch(() => null) as Promise<any>,
        apiClient.get(`/vendor/${vendorId}/bank-details`).catch(() => apiClient.get(`/vendor/${vendorId}/bank-account`).catch(() => null)) as Promise<any>,
        apiClient
          .get(`/settlements/policy?vendorId=${encodeURIComponent(vendorId)}`)
          .catch(() => null) as Promise<any>,
      ]);
      
      console.log('📊 [VENDOR-UI] Payouts API responses:', { settlementsData, settlementsSummary, bankData, policyData });
      
      // Extract summary totals
      const summary = settlementsSummary?.summary || settlementsData?.summary || {};
      
      // Map payout history
      const payoutHistory = (settlementsData?.settlements || settlementsData?.data || []).slice(0, 5).map((s: any) => ({
        id: s.id || s.settlementId,
        date: s.date || s.createdAt || s.processedAt || new Date().toISOString().split('T')[0],
        amount: s.amount || s.netAmount || s.payout || 0,
        status: s.status || 'completed',
        txnId: s.transactionId || s.txnId || s.utr || `TXN${s.id?.slice(0, 8)?.toUpperCase() || 'XXXXXX'}`,
      }));
      
      // Extract bank account info (bankDetails from GET /vendor/:id/bank-details)
      const bankAccount = bankData?.bankDetails || bankData?.bankAccount || bankData?.bank || bankData?.data;
      const bankVerifiedFlag =
        !!bankAccount?.verified ||
        !!bankAccount?.isVerified ||
        !!bankAccount?.bank_verified ||
        !!bankAccount?.is_verified ||
        (typeof bankAccount?.verification_status === 'string' &&
          bankAccount.verification_status.toLowerCase() === 'verified');

      const policy = policyData?.policy ?? policyData;
      const payoutDays = policy?.holdPeriodDays ?? policy?.payoutPeriodDays ?? 7;
      const payoutScheduleText =
        policy?.description ||
        policyData?.schedule ||
        policyData?.payoutSchedule ||
        `Earnings are held for ${payoutDays} days (per your tier) before becoming eligible for settlement. Minimum payout and schedule are set by Finance.`;

      setPayoutsData({
        availableForPayout: summary.availableForPayout || summary.available || summary.pendingAmount || 0,
        pending: summary.pending || summary.holdAmount || summary.onHold || 0,
        paidOut: summary.paidOut || summary.totalPaidOut || summary.completed || 0,
        bankAccount: bankAccount ? {
          bankName: bankAccount.bankName || bankAccount.bank_name || 'Bank',
          accountNumber: bankAccount.accountNumber || bankAccount.account_number || '••••••••••',
          accountHolder: bankAccount.accountHolder || bankAccount.account_holder || vendorData?.fullName || 'Account Holder',
          verified: bankVerifiedFlag,
        } : null,
        payoutHistory,
        payoutSchedule: payoutScheduleText,
      });
      
      console.log('✅ [VENDOR-UI] Payouts data loaded successfully');
    } catch (error) {
      console.error('❌ Error loading payouts:', error);
      // Set empty data on error
      setPayoutsData({
        availableForPayout: 0,
        pending: 0,
        paidOut: 0,
        bankAccount: null,
        payoutHistory: [],
        payoutSchedule: 'Payouts are processed every Friday.',
      });
    } finally {
      setPayoutsLoading(false);
    }
  };

  const handleRequestPayout = async () => {
    if (!payoutsData?.availableForPayout || payoutsData.availableForPayout <= 0) {
      toast.error('No amount available for payout');
      return;
    }
    if (!payoutsData?.bankAccount?.verified) {
      toast.error('Please add and verify your bank account in Settings first.');
      router.push('/settings?tab=bank');
      return;
    }
    
    if (!confirm(`Request payout of ₹${payoutsData.availableForPayout.toLocaleString('en-IN')}?`)) {
      return;
    }
    
    try {
      const response = await apiClient.post('/settlements/request', {
        vendorId,
        amount: payoutsData.availableForPayout,
      }) as any;
      
      if (response?.success) {
        toast.success(
          (response as any)?.message ||
            'Payout request submitted. You will be notified when it is processed.'
        );
        loadPayoutsData(); // Refresh data
      } else {
        toast.error(`Failed to request payout: ${response?.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error requesting payout:', error);
      toast.error('Error requesting payout. Please try again.');
    }
  };

  const openCancelBookingDialog = (e: MouseEvent<HTMLButtonElement>, bookingId: string) => {
    e.stopPropagation();
    setCancelTargetId(bookingId);
    setCancelPolicyReason('operational');
    setCancelDialogOpen(true);
  };

  const confirmCancelBooking = async () => {
    if (!cancelTargetId) return;
    setCancelSubmitting(true);
    try {
      const data = (await apiClient.post(`/vendor/bookings/${cancelTargetId}/cancel`, {
        vendorCancellationReason: cancelPolicyReason,
      })) as any;

      if (data && data.success) {
        toast.success(data?.refund?.message || 'Booking cancelled');
        setCancelDialogOpen(false);
        setCancelTargetId(null);
        loadBookings();
      } else {
        toast.error(data?.error || 'Failed to cancel booking');
      }
    } catch (error: any) {
      console.error('Error cancelling booking:', error);
      toast.error(error?.message || 'Failed to cancel booking');
    } finally {
      setCancelSubmitting(false);
    }
  };

  const handleEditBooking = (bookingId: string) => {
    // TODO: Open edit modal
    console.log('Edit booking:', bookingId);
  };
  
  // Complete Booking (with OTP for in-person services)
  const handleCompleteBooking = (booking: Booking) => {
    setSelectedBooking(booking);
    setOtpInput('');
    setOtpError('');

    if (bookingNeedsWalkLiveTracker(booking, vendorData) && booking.status === 'confirmed') {
      const id = booking.bookingId || booking.id;
      if (id) {
        setHomeServiceTrackingReturnHref(
          walkSessionsFocus ? '/bookings?walkSessions=1' : '/bookings'
        );
        router.push(`/bookings/home-service?bookingId=${encodeURIComponent(id)}`);
      }
      return;
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
      
      const data = await apiClient.post(`/vendor/bookings/${selectedBooking.id}/start-session`, {
        vendorId,
        otp: otpInput
      }) as any;
      
      // data already available
      
      if (data && data.success) {
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
  
  /** Walker live session: start OTP, GPS, end OTP — use dedicated tracking screen (not list + end-session API). */
  const openWalkLiveTracker = (booking: Booking) => {
    const id = booking.bookingId || booking.id;
    if (!id) {
      toast.error('Missing booking id');
      return;
    }
    setHomeServiceTrackingReturnHref(
      walkSessionsFocus ? '/bookings?walkSessions=1' : '/bookings'
    );
    router.push(`/bookings/home-service?bookingId=${encodeURIComponent(id)}`);
  };
  
  // Complete booking without OTP (for tele consultations)
  const handleCompleteWithoutOTP = async (booking: Booking) => {
    try {
      setCompletingBooking(true);
      
      const data = await apiClient.post(`/vendor/bookings/${booking.id}/complete`, { vendorId, otp: null }) as any;
      
      // data already available
      
      if (data && data.success) {
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
      
      const data = await apiClient.post(`/vendor/bookings/${selectedBooking.id}/complete`, { vendorId, otp: otpInput }) as any;
      
      // data already available
      
      if (data && data.success) {
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
  
  // ✅ Handle Open Prescription - Opens prescription modal for viewing/uploading
  const handleOpenPrescription = (booking: Booking) => {
    console.log('💊 Opening prescription for booking:', booking.bookingId || booking.id);
    const bookingId = booking.bookingId || booking.id;
    setPrescriptionBookingId(bookingId);
    setShowPrescriptionModal(true);
  };

  const bookingMainBody = (
    <>
        {!walkSessionsFocus && (
          <div className="border-b border-gray-200 bg-white px-4 pb-4">
            {/* Tab Navigation — hidden on Walk sessions flow (bookings only) */}
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
        )}

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
            {/* View Toggle - Hide for solo groomers (no tele consultations) */}
            {hasTeleService && (
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
            )}

            {/* Instant Consultations Stats - Hide for solo groomers (no tele services) */}
            {hasTeleService && (
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
            )}

            {/* Today's Appointments */}
            <div className="p-4 bg-white">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Today's Appointments</h3>
              
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42] mx-auto"></div>
                </div>
              ) : (() => {
                return bookings.length === 0 ? (
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
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900">{booking.time}</span>
                            <span className="text-sm text-gray-600">{booking.customerName}</span>
                            {booking.isRescheduled && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
                                📅 Rescheduled
                              </span>
                            )}
                            {(booking as any).packagePurchaseId && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-800">
                                <Package className="h-3 w-3 shrink-0" />
                                {(booking as any).packageSessionNumber != null &&
                                (booking as any).packageTotalSessions != null
                                  ? `Session ${(booking as any).packageSessionNumber} of ${(booking as any).packageTotalSessions}`
                                  : 'Package'}
                                {(booking as any).packageRemainingSessions != null &&
                                !(booking as any).packageUnlimitedUsage && (
                                  <span className="text-purple-600">
                                    {' '}
                                    · {(booking as any).packageRemainingSessions} left
                                  </span>
                                )}
                                {(booking as any).packageUnlimitedUsage ? (
                                  <span className="text-purple-600"> · Unlimited</span>
                                ) : null}
                              </span>
                            )}
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
                        const showWalkTracker = bookingNeedsWalkLiveTracker(booking, vendorData);

                        if (booking.status === 'pending' || booking.status === 'confirmed') {
                          const declineBtn = (
                            <button
                              type="button"
                              className="w-full px-4 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeclineModalBooking({
                                  ...booking,
                                  scheduledDate: booking.date,
                                  scheduledTime: booking.time,
                                } as any);
                              }}
                              disabled={completingBooking}
                            >
                              Decline booking (refund per policy)
                            </button>
                          );

                          if (showWalkTracker) {
                            return <div className="mt-3">{declineBtn}</div>;
                          }

                          return (
                            <div className="mt-3 space-y-2">
                              {declineBtn}
                              {booking.status === 'confirmed' && (
                                <>
                                  <button
                                    type="button"
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
                                </>
                              )}
                            </div>
                          );
                        }

                        if (showWalkTracker) {
                          return null;
                        }

                        return (
                          <div className="mt-3">
                            <button
                              type="button"
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
                      })()}
                      
                      {booking.status === 'completed' && (
                        <div className="mt-3 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-center">
                          <span className="text-sm font-medium text-green-700">✓ Completed</span>
                        </div>
                      )}
                      
                      {/* ✅ ACTION BUTTONS: Live tracker (walkers), Chat, Prescription, Video Call */}
                      <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2 flex-wrap">
                        {bookingNeedsWalkLiveTracker(booking, vendorData) &&
                          booking.status !== 'completed' &&
                          booking.status !== 'cancelled' &&
                          booking.status !== 'pending' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openWalkLiveTracker(booking);
                            }}
                            title="Start OTP, GPS route, end OTP"
                            className="flex-1 min-w-[100px] py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                            Live tracker
                          </button>
                        )}
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
                        
                        {/* Chat Button - Only show if chat capability is enabled for this role */}
                        {chatEnabled && booking.chatEnabled !== false && (
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
                );
              })()}
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
              
              {groupedSlotsByType.map((group) => (
                <div key={group.type} className="mb-4 last:mb-0">
                  <h4 className="text-xs font-semibold text-gray-600 mb-2">{group.label}</h4>
                  <div className="grid grid-cols-4 gap-2">
                    {group.slots.map((slot, index) => (
                      <button
                        key={`${group.type}-${slot.time}-${index}`}
                        className={`p-3 rounded-lg text-sm font-medium transition-all ${
                          slot.isPast
                            ? 'bg-gray-100 text-gray-400 border border-gray-200 opacity-60'
                            : slot.booked
                            ? 'bg-pink-100 text-pink-700 border border-pink-200'
                            : slot.available
                            ? 'bg-blue-100 text-blue-700 border border-blue-200'
                            : 'bg-gray-100 text-gray-400 border border-gray-200'
                        }`}
                        disabled={slot.isPast || (!slot.available && !slot.booked)}
                      >
                        {format24hTo12hLabel(slot.time)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {breakWindowsForDay.length > 0 && (
                <div className="mb-4 last:mb-0">
                  <h4 className="text-xs font-semibold text-gray-600 mb-2">Break</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {breakWindowsForDay.map((br, index) => (
                      <div
                        key={`break-${br.start}-${br.end}-${index}`}
                        className="p-3 rounded-lg text-sm font-medium bg-gray-100 text-gray-500 border border-gray-200"
                      >
                        {format24hTo12hLabel(br.start)} - {format24hTo12hLabel(br.end)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex items-center gap-4 mt-4 text-xs text-gray-600 flex-wrap">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-pink-100 border border-pink-200 rounded"></div>
                  <span>Booked</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-gray-100 border border-gray-200 rounded opacity-60"></div>
                  <span>Past</span>
                </div>
              </div>
            </div>

            {/* Emergency Availability (SOS) — ambulance & vet roles; gated by VENDOR_FEATURE_FLAGS.emergencyAvailabilitySos */}
            {hasVendorRole(vendorData, ['ambulance', 'veterinarian', 'vet_clinic', 'veterinary_clinic', 'vet', 'pet_clinic', 'animal_hospital']) && (
              <div className="border-t border-gray-100 bg-white p-4">
                <EmergencyAvailabilitySosCard />
              </div>
            )}
          </>
        )}

        {/* EARNINGS TAB CONTENT */}
        {activeTab === 'earnings' && (
          <>
            {earningsLoading ? (
              <div className="p-8 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42]"></div>
              </div>
            ) : (
              <>
                {/* Tier summary + upgrade (full flow on /earnings) */}
                <div className="p-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-b border-orange-600/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <Sparkles className="w-5 h-5 shrink-0 mt-0.5 opacity-95" />
                      <div className="min-w-0">
                        <p className="text-xs opacity-90">Your tier</p>
                        <p className="text-lg font-bold truncate">
                          {tierInfo?.name || tierInfo?.current || 'Standard'}
                        </p>
                        {(() => {
                          const cr = tierInfo?.commissionRate ?? tierInfo?.commission;
                          const commissionPct =
                            typeof cr === 'number' && Number.isFinite(cr)
                              ? cr > 1
                                ? Math.round(cr)
                                : Math.round(cr * 100)
                              : 15;
                          return (
                            <p className="text-xs opacity-90 mt-1">
                              Commission ~{commissionPct}% ·{' '}
                              {tierInfo?.payoutCycleLabel || 'Settlement per Finance'}
                            </p>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {tierInfo?.canUpgrade ? (
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-9 px-3 bg-white text-orange-700 hover:bg-orange-50 font-semibold"
                          onClick={() => router.push('/earnings')}
                        >
                          Upgrade tier
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-9 px-3 bg-white/95 text-orange-800 hover:bg-white font-medium"
                          onClick={() => router.push('/earnings')}
                        >
                          Tiers & earnings
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Earnings Summary */}
                <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-b border-green-200">
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="bg-white p-3 rounded-lg text-center">
                      <div className="text-2xl font-bold text-green-600">
                        ₹{(earningsData?.today || 0).toLocaleString('en-IN')}
                      </div>
                      <div className="text-xs text-gray-600">Today</div>
                      <div className="text-[10px] text-gray-500 mt-1 leading-tight">Credited today</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg text-center">
                      <div className="text-2xl font-bold text-green-600">
                        ₹{(earningsData?.thisWeek || 0).toLocaleString('en-IN')}
                      </div>
                      <div className="text-xs text-gray-600">This Week</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg text-center">
                      <div className="text-2xl font-bold text-green-600">
                        ₹{(earningsData?.thisMonth || 0).toLocaleString('en-IN')}
                      </div>
                      <div className="text-xs text-gray-600">This Month</div>
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">Pending Earnings</span>
                      <span className="text-lg font-bold text-orange-600">
                        ₹{(earningsData?.pending || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Total Earnings</span>
                      <span className="text-lg font-bold text-green-600">
                        ₹{(earningsData?.total || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Recent Transactions */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-1">Recent Transactions</h3>
                  <p className="text-xs text-gray-500 mb-3">Amounts credited to your account (may differ from appointment date).</p>
                  {(!earningsData?.transactions || earningsData.transactions.length === 0) ? (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      No transactions yet
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {earningsData.transactions.map((transaction) => (
                        <div key={transaction.id} className="border border-gray-200 rounded-xl p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 text-sm">{transaction.service}</div>
                              <div className="text-xs text-gray-500">
                                {transaction.customer} · Credited{' '}
                                {new Date(transaction.date).toLocaleDateString('en-IN')}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-green-600">₹{transaction.amount.toLocaleString('en-IN')}</div>
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
                  )}
                </div>

                {/* Earnings Chart */}
                <div className="p-4 bg-white border-t border-gray-100">
                  <h3 className="font-semibold text-gray-900 mb-3">Earnings Trend (Last 7 Days)</h3>
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-4">
                    {(!earningsData?.dailyTrend || earningsData.dailyTrend.length === 0) ? (
                      <div className="text-center py-8 text-gray-500 text-sm">
                        No earnings data for this period
                      </div>
                    ) : (
                      <>
                        <div className="flex items-end justify-between h-32 gap-2">
                          {(() => {
                            const maxAmount = Math.max(...earningsData.dailyTrend.map(d => d.amount), 1);
                            return earningsData.dailyTrend.map((item, index) => {
                              const heightPercent = maxAmount > 0 ? Math.max((item.amount / maxAmount) * 100, 5) : 5;
                              return (
                                <div key={index} className="flex-1 flex flex-col items-center gap-1">
                                  <div className="text-xs text-gray-600 font-medium">₹{item.amount.toLocaleString('en-IN')}</div>
                                  <div 
                                    className="w-full bg-gradient-to-t from-green-500 to-green-400 rounded-t-md transition-all hover:from-green-600 hover:to-green-500"
                                    style={{ height: `${heightPercent}%`, minHeight: '8px' }}
                                  />
                                  <div className="text-xs text-gray-500">{item.day}</div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between text-sm">
                          <span className="text-gray-600">Weekly Total</span>
                          <span className="font-bold text-green-600">
                            ₹{earningsData.dailyTrend.reduce((sum, d) => sum + d.amount, 0).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* PAYOUTS TAB CONTENT */}
        {activeTab === 'payouts' && (
          <>
            {payoutsLoading ? (
              <div className="p-8 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42]"></div>
              </div>
            ) : (
              <>
                {/* Payout Summary */}
                <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-b border-blue-200">
                  <div className="bg-white p-4 rounded-lg mb-3">
                    <div className="text-center mb-3">
                      <div className="text-3xl font-bold text-blue-600">
                        ₹{(payoutsData?.availableForPayout || 0).toLocaleString('en-IN')}
                      </div>
                      <div className="text-sm text-gray-600">Available for Payout</div>
                    </div>
                    <button 
                      onClick={handleRequestPayout}
                      disabled={!payoutsData?.availableForPayout || payoutsData.availableForPayout <= 0}
                      className="w-full bg-[#FF8C42] hover:bg-[#ff7a28] text-white rounded-xl h-11 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Request Payout
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-3 rounded-lg text-center">
                      <div className="text-xl font-bold text-gray-900">
                        ₹{(payoutsData?.pending || 0).toLocaleString('en-IN')}
                      </div>
                      <div className="text-xs text-gray-600">On Hold</div>
                    </div>
                    <div className="bg-white p-3 rounded-lg text-center">
                      <div className="text-xl font-bold text-gray-900">
                        ₹{(payoutsData?.paidOut || 0).toLocaleString('en-IN')}
                      </div>
                      <div className="text-xs text-gray-600">Total Paid Out</div>
                    </div>
                  </div>
                </div>

                {/* Bank Account Info */}
                <div className="p-4 bg-white border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900 mb-3">Bank Account</h3>
                  {payoutsData?.bankAccount ? (
                    <div className="border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <span className="text-xl">🏦</span>
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{payoutsData.bankAccount.bankName}</div>
                          <div className="text-sm text-gray-600">
                            {payoutsData.bankAccount.accountNumber?.includes('*') || payoutsData.bankAccount.accountNumber?.includes('•')
                              ? payoutsData.bankAccount.accountNumber
                              : `****${String(payoutsData.bankAccount.accountNumber || '').slice(-4)}`}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {payoutsData.bankAccount.verified && (
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Verified</span>
                          )}
                          <button
                            onClick={() => router.push('/settings?tab=bank')}
                            className="text-sm text-[#FF8C42] font-medium hover:underline"
                          >
                            Change
                          </button>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        Account Holder: {payoutsData.bankAccount.accountHolder}
                      </div>
                    </div>
                  ) : (
                    <div className="border border-dashed border-gray-300 rounded-xl p-4 text-center">
                      <div className="text-gray-500 mb-2">No bank account linked</div>
                      <button
                        onClick={() => router.push('/settings?tab=bank')}
                        className="text-sm text-[#FF8C42] font-medium hover:underline"
                      >
                        + Add Bank Account
                      </button>
                    </div>
                  )}
                </div>

                {/* Payout History */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Payout History</h3>
                  {(!payoutsData?.payoutHistory || payoutsData.payoutHistory.length === 0) ? (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      No payouts yet
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {payoutsData.payoutHistory.map((payout) => (
                        <div key={payout.id} className="border border-gray-200 rounded-xl p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 text-sm">
                                Payout - {new Date(payout.date).toLocaleDateString('en-IN')}
                              </div>
                              <div className="text-xs text-gray-500">TXN ID: {payout.txnId}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-blue-600">₹{payout.amount.toLocaleString('en-IN')}</div>
                              <div className={`text-xs px-2 py-0.5 rounded-full inline-block mt-1 ${
                                payout.status === 'completed' || payout.status === 'processed'
                                  ? 'bg-green-100 text-green-700'
                                  : payout.status === 'pending' || payout.status === 'processing'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {payout.status}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
                          {payoutsData?.payoutSchedule || 'Payouts are processed every Friday. Earnings from completed bookings are held for 48 hours before becoming available for payout.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
    </>
  );

  return (
    <>
      {!embedded ? (
        <div className="vendor-page-shell bg-gray-50">
          <div className="vendor-app-column min-h-screen bg-white pb-20">
            <VendorHeader
              title={vendorData?.businessName || vendorData?.fullName || 'Booking Management'}
              subtitle={vendorData?.address || 'India'}
              onBack={onBack}
            />
            {bookingMainBody}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-white">
          <div className="min-h-0 flex-1 overflow-y-auto pb-20">{bookingMainBody}</div>
        </div>
      )}

      {declineModalBooking && (
        <DeclineBookingModal
          booking={declineModalBooking as any}
          vendorId={vendorId}
          onClose={() => setDeclineModalBooking(null)}
          onSuccess={() => {
            setDeclineModalBooking(null);
            loadBookings();
          }}
        />
      )}

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Cancel booking</DialogTitle>
            <DialogDescription>
              Select the provider cancellation reason. Customer refund and fees follow Admin Finance (Refund tiers
              for Service Provider / Platform).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="vendor-cancel-reason">Vendor cancellation reason</Label>
            <Select
              value={cancelPolicyReason}
              onValueChange={(v) => setCancelPolicyReason(v as VendorCancellationReasonSlug)}
            >
              <SelectTrigger id="vendor-cancel-reason" className="w-full">
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                {VENDOR_CANCELLATION_REASON_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Back
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmCancelBooking()}
              disabled={cancelSubmitting}
            >
              {cancelSubmitting ? 'Cancelling…' : 'Cancel booking'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OTP VERIFICATION MODAL */}
      {showOTPModal && selectedBooking && (() => {
        const isDogWalking = bookingNeedsWalkLiveTracker(selectedBooking, vendorData);
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
          bookingId={chatBooking.bookingId || chatBooking.id}
          vendorId={vendorId}
          vendorPhone={vendorPhone || vendorData?.phone || vendorData?.mobile}
          vendorName={vendorName || vendorData?.fullName || vendorData?.businessName || 'Vendor'}
          customerPhone={chatBooking.phone}
          customerName={chatBooking.customerName}
          bookingStatus={chatBooking.status}
          serviceName={chatBooking.serviceName}
          serviceType={chatBooking.serviceType || chatBooking.service_type} // ✅ CRITICAL FIX: Pass service type
          meetingId={chatBooking.meetingId || chatBooking.meeting_id} // ✅ CRITICAL FIX: Pass meeting ID
          onClose={() => {
            setShowChatModal(false);
            setChatBooking(null);
            loadBookings(); // Reload to clear unread badges
          }}
          onSupportHandoff={(bookingId, reason) => {
            // Handle support handoff - redirect to support ticket creation
            setShowChatModal(false);
            setChatBooking(null);
            // Could navigate to support page or open support modal
            console.log('Support handoff requested for booking:', bookingId, reason);
          }}
          onVideoCallStart={(bookingId, meetingId) => {
            // ✅ CRITICAL FIX: Handle video call start
            console.log('Video call started for booking:', bookingId, 'Meeting:', meetingId);
            // Could update booking state or show notification
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

      {/* PRESCRIPTION HISTORY MODAL */}
      {showPrescriptionModal && prescriptionBookingId && (
        <PrescriptionHistoryModal
          bookingId={prescriptionBookingId}
          vendorId={vendorId}
          vendorPhone={vendorPhone || ''}
          onClose={() => {
            setShowPrescriptionModal(false);
            setPrescriptionBookingId(null);
          }}
          onUploadSuccess={() => loadBookings()}
        />
      )}
    </>
  );
}