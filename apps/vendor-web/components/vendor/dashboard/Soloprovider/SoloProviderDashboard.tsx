'use client';

/**
 * Solo Provider Dashboard
 * 
 * This dashboard is for solo vendors (individual providers who don't have a center/business).
 * Key differences from Center/Business dashboard:
 * - No Center Profile (Professional Profile instead)
 * - No Staff Management (solo vendor IS the service provider)
 * - No predefined service catalog from admin (only custom services if allowed)
 * - Service styles restricted (no at_center style - solo providers visit customer or do tele)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { clearVendorSession } from '@/lib/session-utils';
import { getVendorAllowedServiceStyles, hasVendorRole } from '@/lib/vendor-utils';
import CapabilityHelper from '@/lib/capability-helper';

const logoImage = '/warmpawz-logo.svg';
import {
  Calendar,
  Clock,
  Star,
  MessageSquare,
  Phone,
  Video,
  ChevronRight,
  Plus,
  Activity,
  Package,
  Home,
  Settings,
  BarChart3,
  Bell,
  RefreshCw,
  Monitor,
  User,
  TrendingUp,
  Gift,
  Heart,
  MapPin,
  CheckCircle2,
  X,
  Briefcase,
  ClipboardList,
  Shield,
  Badge,
  Navigation,
  Footprints,
  Map,
  Radio,
  icons
} from 'lucide-react';
const IndianRupee = icons?.IndianRupee ?? icons?.DollarSign;
import { toast } from 'sonner';
import { AppointmentCard } from '@/components/shared/AppointmentCard';
import { VendorNotificationModal } from '../../modals/VendorNotificationModal';
import { VendorReviewsModal } from '../../modals/VendorReviewsModal';
import { VendorChatConversationsModal } from '../../VendorChatConversationsModal';
import { VendorChatModal } from '../../VendorChatModal';
import { AppointmentDetailModal } from '../../AppointmentDetailModal';
import { CommunicationHub } from '@/components/communication/CommunicationHub';
import { VendorAnalytics } from '../../VendorAnalytics';
import { ChatWidget } from '@/components/customer/ChatWidget';
import { CapabilityDebugOverlay } from '../../CapabilityDebugOverlay';
import { useVendorCapabilities } from '@/hooks/useVendorCapabilities';
import {
  formatBookingTime,
  vendorNotificationUnreadCount,
  SHOW_VENDOR_FOOTER_REPORTING_TAB,
  getVendorDashboardRatingPresentation,
  mergeVendorDashboardStats,
} from '../helpers';
import { VendorChromeLayout } from '@/components/vendor/layout/VendorChromeLayout';
import { Dashboardstats, ScheduleItem, SoloProviderDashboardProps } from '../types';
import { DashboardStats } from '@/components/shared/DashboardStats';


export function SoloProviderDashboard({
  session,
  vendorData,
}: SoloProviderDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'month'>('today');
  const [activeBottomTab, setActiveBottomTab] = useState<'home' | 'bookings' | 'reporting' | 'settings'>('home');
  const [appointmentTypeFilter, setAppointmentTypeFilter] = useState<'all' | 'home' | 'tele'>('all');
  const [stats, setStats] = useState<Dashboardstats>({
    appointments: 0,
    consultations: 0,
    earnings: 0,
    pendingEarnings: 0,
    completedServices: 0,
    rating: null,
    totalReviews: 0,
  });
  const [todaySchedule, setTodaySchedule] = useState<ScheduleItem[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vendor, setVendor] = useState(vendorData);
  const effectiveVendor = useMemo(() => {
    const merged = { ...(vendorData || {}), ...(vendor || {}) };
    const bn =
      vendorData?.businessName ||
      vendorData?.business_name ||
      vendor?.businessName ||
      vendor?.business_name;
    if (bn) {
      merged.businessName = bn;
      merged.business_name = bn;
    }
    return merged;
  }, [vendor, vendorData]);

  // Modals
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [reviewsModalOpen, setReviewsModalOpen] = useState(false);
  const [chatConversationsOpen, setChatConversationsOpen] = useState(false);
  const [selectedChatConversation, setSelectedChatConversation] = useState<{
    bookingId: string;
    customerName: string;
    customerPhone: string;
    serviceName: string;
    bookingStatus: string;
    packageUtilization?: { packageName?: string; totalSessions?: number; remainingSessions?: number; usedSessions?: number; isUnlimited?: boolean; expiresAt?: string } | null;
  } | null>(null);
  const [communicationMode, setCommunicationMode] = useState<'chat' | 'video' | null>(null);
  const [appointmentDetailModalOpen, setAppointmentDetailModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<ScheduleItem | null>(null);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  // OTP modal for completing appointments
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [processingOtp, setProcessingOtp] = useState(false);
  const [otpAction, setOtpAction] = useState<'start' | 'complete'>('complete');

  // GPS tracking state (use /vendor/bookings/:bookingId/start-travel so customer can track via GET /tracking/booking/:bookingId)
  const [isTracking, setIsTracking] = useState<{ [key: string]: boolean }>({});
  const [trackingSessionIds, setTrackingSessionIds] = useState<{ [key: string]: string }>({});
  const [trackingLocation, setTrackingLocation] = useState<{ [key: string]: { lat: number; lng: number; updated: string } }>({});

  // Dashboard warnings state
  const [warnings, setWarnings] = useState({
    profileIncomplete: false,
    bankNotVerified: true,
    servicesNotConfigured: true,
  });

  // Handle logout – clear all vendor session data so login prompt and dashboard load correctly
  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      try {
        await apiClient.post('/auth/logout', {});
      } catch (e) {
        // Ignore logout API errors
      }
      clearVendorSession();
      window.location.replace('/auth');
    }
  };

  // Load capabilities from role
  // ✅ CRITICAL FIX: Check both roleId formats (camelCase and snake_case)
  const effectiveRoleId = vendorData?.roleId || vendorData?.role_id || vendorData?.selected_role_id;
  const { capabilities, loading: capsLoading, roleName, initialLoadComplete } = useVendorCapabilities(effectiveRoleId);

  const allowedServiceStyles = useMemo(() => {
    const list = getVendorAllowedServiceStyles(vendorData);
    return list.length > 0 ? list : (['at_home', 'tele'] as const);
  }, [vendorData]);

  // Copy-only role hints (allowedServiceStyles comes from admin launch config — do not override here)
  const isSoloGroomer = hasVendorRole(vendorData, ['pet_groomer', 'groomer', 'groomer_solo']);
  const isWalker = hasVendorRole(vendorData, ['pet_walker', 'walker', 'dog_walker']);
  const isNutritionist = hasVendorRole(vendorData, [
    'nutritionist',
    'pet_nutritionist',
    'nutritionist_center',
  ]);

  // Check if custom_services capability is enabled
  const hasCustomServices = capabilities.custom_services || capabilities.customServices || false;
  const hasPackagesCapability = capabilities.package_management || capabilities.packages || false;

  // ✅ Check if trainer/walker/sitter/groomer who can create session packages (solo trainer, solo groomer)
  const isTrainerWalkerSitter = hasVendorRole(vendorData, ['pet_trainer', 'trainer', 'trainer_solo', 'pet_behaviorist', 'behaviorist_solo', 'behaviorist_center', 'pet_walker', 'walker', 'dog_walker', 'pet_sitter', 'sitter', 'pet_groomer', 'groomer', 'groomer_solo']);
  const isPharmacy = hasVendorRole(vendorData, ['pharmacy', 'pet_pharmacy']);

  // ✅ Solo trainers/walkers/sitters CAN create session packages even without explicit package capability
  const hasPackages = hasPackagesCapability || isTrainerWalkerSitter;

  // Get role theme

  const vendorId = session.vendorId;

  const ratingPresentation = useMemo(
    () => getVendorDashboardRatingPresentation(stats.totalReviews, stats.rating),
    [stats.totalReviews, stats.rating]
  );

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      console.log('📊 [Solo] Fetching dashboard data for:', vendorId);

      // Fetch dashboard stats
      const dashboardRes = await apiClient.get<any>(`/vendor/dashboard/${vendorId}?timeframe=${activeTab}`).catch(() => ({ success: false }));

      if (dashboardRes && dashboardRes.success) {
        const rawStats = dashboardRes.stats || dashboardRes.data?.stats;
        setStats((prev) =>
          mergeVendorDashboardStats(
            prev,
            rawStats && typeof rawStats === 'object' ? (rawStats as Record<string, unknown>) : null
          )
        );
        setVendor(dashboardRes.vendor || dashboardRes.data?.vendor || vendorData);

        // Transform bookings
        const bookings = dashboardRes.bookings || dashboardRes.data?.bookings || [];
        if (bookings.length > 0) {
          const transformedBookings: ScheduleItem[] = bookings.map((b: any) => ({
            id: b.id || b.booking_id,
            bookingId: b.id || b.booking_id,
            time: b.booking_time ? formatBookingTime(b.booking_time) : 'N/A',
            duration: b.duration_minutes || 30,
            petName: b.pet_name || 'Pet',
            petBreed: b.pet_breed,
            customerName: b.customer_name || 'Customer',
            customerPhone: b.customer_phone || '',
            serviceName: b.service_name || 'Service',
            serviceType: b.service_type || 'at_home',
            status: b.status || 'pending',
            price: parseFloat(b.total_amount || '0'),
            address: b.address || '',
            specialInstructions: b.notes,
            hasUnreadMessages: b.hasUnreadMessages || false,
            unreadMessageCount: b.unreadMessageCount || 0,
            chatEnabled: b.chatEnabled || true,
            isFollowUp: b.isFollowUp || false,
            // Track rescheduled bookings: true if booking was rescheduled (has rescheduled_at timestamp)
            isRescheduled: b.isRescheduled || b.rescheduled_at != null,
            rescheduledAt: b.rescheduled_at || null,
            packagePurchaseId: b.packagePurchaseId ?? b.package_purchase_id,
            packageSessionNumber:
              b.packageSessionNumber != null
                ? Number(b.packageSessionNumber)
                : b.package_session_number != null
                  ? Number(b.package_session_number)
                  : undefined,
            packageTotalSessions:
              b.packageTotalSessions != null
                ? Number(b.packageTotalSessions)
                : b.package_total_sessions != null
                  ? Number(b.package_total_sessions)
                  : b.total_sessions != null
                    ? Number(b.total_sessions)
                    : undefined,
          }));
          setTodaySchedule(transformedBookings);
        }
      }

      // Fetch services (catalog/custom) for solo provider - include pharmacy, cafe, insurance, etc.
      const hasServiceManagement = CapabilityHelper.hasBooking(capabilities) || CapabilityHelper.hasCapability(capabilities, 'services') || hasVendorRole(vendorData, ['pharmacy', 'pet_pharmacy', 'pet_cafe', 'cafe', 'pet_insurance', 'insurance', 'pet_holidays', 'holidays', 'pet_resort', 'resort', 'pet_ambulance', 'ambulance']);
      if (hasCustomServices || hasServiceManagement) {
        const servicesRes = await apiClient.get<any>(`/vendor/${vendorId}/services`).catch(() => ({ success: false, services: [] }));
        if (servicesRes && servicesRes.success) {
          const servicesList = Array.isArray(servicesRes.services) ? servicesRes.services : (servicesRes.allServices || []);
          const customServices = servicesList.filter((s: any) =>
            s.is_custom === true || s.source === 'custom' || !s.catalog_service_id
          );
          setServices(customServices);
        }
      }

      // Fetch notifications
      const notificationsRes = await apiClient.get<any>(`/vendor/${vendorId}/notifications?limit=5`).catch(() => ({ success: false, notifications: [] }));
      setNotificationUnreadCount(
        notificationsRes && notificationsRes.success
          ? vendorNotificationUnreadCount(notificationsRes)
          : 0
      );

      // Chat unread count for message icon badge
      if (capabilities.chat) {
        const chatUnreadRes = await apiClient.get<any>(`/chat/vendor/${vendorId}/unread-count`).catch(() => ({ totalUnread: 0 }));
        setChatUnreadCount(chatUnreadRes?.totalUnread ?? 0);
      } else {
        setChatUnreadCount(0);
      }

      // Check profile, bank and services status for warnings
      const [bankRes, profileRes] = await Promise.all([
        apiClient.get<any>(`/vendor/${vendorId}/bank-details`).catch(() => ({ success: false })),
        apiClient.get<any>(`/vendor/${vendorId}/profile`).catch(() => ({ success: false })),
      ]);

      // Check bank verification
      if (bankRes && bankRes.success && bankRes.bankDetails) {
        setWarnings(prev => ({
          ...prev,
          bankNotVerified: !bankRes.bankDetails.bank_verified && !bankRes.bankDetails.is_verified,
        }));
      }

      // Check profile completion + merge display name from API (stale local state fix)
      if (profileRes && profileRes.success) {
        const profile = profileRes.vendor || profileRes;
        const biz = profile.businessName || profile.business_name || profile.name;
        const owner =
          profile.ownerName ||
          profile.owner_name ||
          profile.fullName ||
          profile.full_name;
        if (biz || owner) {
          setVendor((prev: any) => ({
            ...(prev || {}),
            ...(biz ? { businessName: biz, business_name: biz } : {}),
            ...(owner
              ? {
                  ownerName: profile.ownerName || profile.owner_name,
                  owner_name: profile.owner_name || profile.ownerName,
                  fullName: profile.fullName || profile.full_name,
                  full_name: profile.full_name || profile.fullName,
                }
              : {}),
          }));
        }
        const isProfileComplete = !!(
          (profile.owner_name || profile.full_name) &&
          profile.phone &&
          profile.specializations?.length > 0
        );
        setWarnings(prev => ({
          ...prev,
          profileIncomplete: !isProfileComplete,
        }));
      }

      // Check services
      setWarnings(prev => ({
        ...prev,
        servicesNotConfigured: services.length === 0,
      }));

    } catch (error) {
      console.error('❌ [Solo] Error fetching dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vendorId, activeTab, capabilities, hasCustomServices, services.length]);

  // ✅ FIX: Load dashboard data immediately, don't wait for capabilities
  useEffect(() => {
    if (vendorId) {
      fetchDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId, activeTab]);

  // ✅ FIX: Refresh when capabilities are loaded for capability-specific data
  useEffect(() => {
    if (vendorId && initialLoadComplete && !capsLoading) {
      fetchDashboardData(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLoadComplete]);

  // GPS tracking: use /vendor/bookings/:bookingId/start-travel so customer can track via GET /tracking/booking/:bookingId
  const startLocationTracking = async (bookingId: string, _customerLat: string, _customerLng: string) => {
    if (!vendorId) return;

    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;

            const res = await apiClient.post<any>(`/vendor/bookings/${bookingId}/start-travel`, {
              vendorId,
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

  // OTP handler for starting/completing appointments
  const handleOtpAction = async () => {
    if (!selectedAppointment) return;
    if (otp.length !== 4) {
      setOtpError('Please enter a valid 4-digit OTP');
      return;
    }

    setProcessingOtp(true);
    setOtpError(null);

    try {
      const sessionNum = (selectedAppointment as any).packageSessionNumber;
      const data = await apiClient.post<any>(`/vendor/bookings/${selectedAppointment.bookingId}/otp/verify`, {
        otp,
        action: otpAction,
        ...(sessionNum != null && Number.isFinite(Number(sessionNum))
          ? { sessionNumber: Number(sessionNum) }
          : {}),
      });

      if (otpAction === 'start') {
        // Start GPS tracking for at_home services
        const serviceType = selectedAppointment.serviceType?.toLowerCase();
        if (serviceType === 'at_home' || serviceType === 'home') {
          const lat = (selectedAppointment as any).customerLat || (selectedAppointment as any).customer_lat;
          const lng = (selectedAppointment as any).customerLng || (selectedAppointment as any).customer_lng;
          if (lat && lng) {
            await startLocationTracking(selectedAppointment.bookingId, lat, lng);
          }
        }
      } else if (otpAction === 'complete') {
        // Stop GPS tracking if active
        if (isTracking[selectedAppointment.bookingId]) {
          await stopLocationTracking(selectedAppointment.bookingId);
        }
      }

      setShowOtpModal(false);
      setOtp('');
      setOtpError(null);
      setSelectedAppointment(null);
      fetchDashboardData(true);
      toast.success(data.message || (otpAction === 'start' ? 'Service started successfully!' : 'Service completed successfully!'));
    } catch (error: any) {
      console.error(`Error ${otpAction === 'start' ? 'starting' : 'completing'} service:`, error);
      setOtpError(error.message || `OTP verification failed. Please try again.`);
    } finally {
      setProcessingOtp(false);
    }
  };

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''}`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  // Loading state
  if (loading || capsLoading || !initialLoadComplete) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-[#FF8C42] animate-spin mx-auto mb-2" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const soloDashboardChromeFooter = (
    <div className="w-full border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-2px_10px_rgba(0,0,0,0.06)] safe-area-bottom">
      <div className="vendor-app-column mx-auto w-full">
        <div className="flex items-center justify-around py-2">
          <button
            type="button"
            onClick={() => setActiveBottomTab('home')}
            className={`flex min-h-[44px] min-w-[3rem] flex-col items-center justify-center gap-0.5 px-2 ${activeBottomTab === 'home' ? 'text-[#FF8C42]' : 'text-gray-400'
              }`}
          >
            <div className="h-5 w-5 text-center">🏠</div>
            <span className="text-[10px]">Home</span>
          </button>

          {isPharmacy ? (
            <button
              type="button"
              onClick={() => router.push('/pharmacy/orders')}
              className="flex min-h-[44px] min-w-[3rem] flex-col items-center justify-center gap-0.5 px-2 text-gray-400 active:text-[#FF8C42]"
            >
              <ClipboardList className="h-5 w-5" />
              <span className="text-[10px]">Orders</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                router.push('/bookings');
                setActiveBottomTab('bookings');
              }}
              className={`flex min-h-[44px] min-w-[3rem] flex-col items-center justify-center gap-0.5 px-2 ${activeBottomTab === 'bookings' ? 'text-[#FF8C42]' : 'text-gray-400'
                }`}
            >
              <Calendar className="h-5 w-5" />
              <span className="text-[10px]">Bookings</span>
            </button>
          )}

          {SHOW_VENDOR_FOOTER_REPORTING_TAB && (
            <button
              type="button"
              onClick={() => setActiveBottomTab('reporting')}
              className={`flex min-h-[44px] min-w-[3rem] flex-col items-center justify-center gap-0.5 px-2 ${activeBottomTab === 'reporting' ? 'text-[#FF8C42]' : 'text-gray-400'
                }`}
            >
              <BarChart3 className="h-5 w-5" />
              <span className="text-[10px]">Reporting</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => router.push('/settings')}
            className={`flex min-h-[44px] min-w-[3rem] flex-col items-center justify-center gap-0.5 px-2 ${activeBottomTab === 'settings' ? 'text-[#FF8C42]' : 'text-gray-400'
              }`}
          >
            <Settings className="h-5 w-5" />
            <span className="text-[10px]">Settings</span>
          </button>
        </div>
      </div>
    </div>
  );

  // ✅ FIX: Prioritize vendorData.address (prop) over vendor.address (API response)
  // This ensures consistency with VendorBookingManagement which uses vendorData.address
  const displayAddress = (() => {
    const a = vendorData?.address ?? vendor?.address;
    if (!a) return '';
    if (typeof a === 'string') return a;
    return [a.line1, a.line2, a.city, a.state].filter(Boolean).join(', ') || '';
  })();

  const soloDashboardChromeHeader = (
    <div className="safe-area-top w-full border-b border-gray-200 bg-white shadow-sm">
      <div className="vendor-app-column mx-auto w-full">
        <div className="p-4 bg-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-11 h-11 flex-shrink-0 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden">
                <img src={logoImage} alt="Warmpawz" className="w-full h-full object-contain p-1" />
              </div>
              <div className="min-w-0">
                <h1 className="font-semibold text-gray-900 truncate">
                  {effectiveVendor?.ownerName || effectiveVendor?.owner_name || effectiveVendor?.fullName || effectiveVendor?.full_name || session.ownerName || 'Solo Provider'}
                </h1>
                <p className="text-xs text-gray-500">Solo Provider • {session.roleName || roleName || 'Service Provider'}</p>
                {displayAddress && (
                  <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span>{displayAddress}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => fetchDashboardData(true)} disabled={refreshing}>
                <RefreshCw className={`w-5 h-5 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
              </button>

              {capabilities.chat && (
                <button
                  type="button"
                  className="relative p-1 rounded-lg hover:bg-gray-100 transition-colors"
                  onClick={() => setChatConversationsOpen(true)}
                  title="Messages"
                  aria-label="Open messages"
                >
                  <MessageSquare className="w-5 h-5 text-gray-400 hover:text-[#FF8C42]" />
                  {chatUnreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-xs font-medium">
                      {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                    </span>
                  )}
                </button>
              )}

              <button
                className="relative"
                onClick={() => setNotificationModalOpen(true)}
              >
                <Bell className="w-5 h-5 text-gray-400 hover:text-[#FF8C42] transition-colors" />
                {notificationUnreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                )}
              </button>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                title="Logout"
              >
                <svg className="w-5 h-5 text-gray-400 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>

          {/* Online Status Badge + Rating */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-700 border-green-200">
                ONLINE
              </Badge>
              <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                Solo Provider
              </Badge>
            </div>
            <button
              type="button"
              onClick={() => setReviewsModalOpen(true)}
              className="flex items-center gap-1 rounded-lg px-1 py-0.5 -mr-1 hover:bg-gray-100 active:bg-gray-200 transition-colors text-left"
              title="View customer reviews"
              aria-label={ratingPresentation.ariaLabel}
            >
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span
                className={`text-sm font-semibold ${ratingPresentation.showNumeric ? '' : 'text-gray-500 font-normal text-xs max-w-[7rem] leading-tight'}`}
              >
                {ratingPresentation.label}
              </span>
              <span className="text-xs text-gray-500">
                ({stats.totalReviews} {stats.totalReviews === 1 ? 'review' : 'reviews'})
              </span>
            </button>
          </div>

          {/* Service Availability Note - for non-pharmacy service providers */}
          {!isPharmacy && (
            <div className="mt-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-orange-600" />
                <span className="text-gray-700">
                  Service Types: <span className="font-semibold text-orange-600">
                    {allowedServiceStyles.includes('at_home') && 'Home Visit'}
                    {allowedServiceStyles.includes('at_home') && allowedServiceStyles.includes('tele') && !isWalker && ', '}
                    {!isSoloGroomer && !isWalker && allowedServiceStyles.includes('tele') && 'Tele-consultation'}
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>
        </div>
        </div>
  );

  return (
    <>
    <VendorChromeLayout
      className="bg-gray-50"
      header={soloDashboardChromeHeader}
      footer={soloDashboardChromeFooter}
    >
      <div className="vendor-app-column mx-auto w-full min-h-full bg-white">

        {/* Quick Actions for Solo Provider */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex flex-wrap gap-3">
            {/* Professional Profile - Primary action for solo providers */}
            <button
              onClick={() => router.push('/profile')}
              className="flex-1 min-w-[140px] bg-white border-2 border-blue-500 text-blue-600 rounded-xl p-4 flex flex-col items-center justify-center hover:bg-blue-500 hover:text-white transition-colors group text-center"
            >
              <User className="w-6 h-6 mb-2" />
              <span className="font-semibold text-sm">My Profile</span>
            </button>

            {/* ✅ PHARMA: Pharmacy solo vendors get Orders — NOT Manage Services */}
            {isPharmacy && (
              <button
                onClick={() => router.push('/pharmacy/orders')}
                className="flex-1 min-w-[140px] bg-white border-2 border-[#FF8C42] text-[#FF8C42] rounded-xl p-4 flex flex-col items-center justify-center hover:bg-[#FF8C42] hover:text-white transition-colors group text-center"
              >
                <ClipboardList className="w-6 h-6 mb-2" />
                <span className="font-semibold text-sm">Orders</span>
              </button>
            )}
            {/* Manage Services - For non-pharmacy solo vendors */}
            {/* ✅ FIX: Route to /services (not /services/manage) to show VendorServiceManagementComplete UI */}
            {!isPharmacy && (capabilities.booking || CapabilityHelper.hasCapability(capabilities, 'services') || hasVendorRole(vendorData, ['pet_cafe', 'cafe', 'pet_insurance', 'insurance', 'pet_holidays', 'holidays', 'pet_resort', 'resort', 'pet_ambulance', 'ambulance'])) && (
              <button
                onClick={() => router.push('/services')}
                className="flex-1 min-w-[140px] bg-white border-2 border-indigo-500 text-indigo-600 rounded-xl p-4 flex flex-col items-center justify-center hover:bg-indigo-500 hover:text-white transition-colors group text-center"
              >
                <Package className="w-6 h-6 mb-2" />
                <span className="font-semibold text-sm">Manage Services</span>
              </button>
            )}
          </div>

          {/* Info Banner - Pharmacy: Orders + proforma only; others: Solo Provider */}
          <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              {isPharmacy ? (
                <><strong>Pharmacy:</strong> Receive prescription orders, confirm availability, and send proforma invoice. Customer approves and pays; then track delivery.</>
              ) : (
                <><strong>Solo Provider Mode:</strong> You provide services directly to customers via {isSoloGroomer || isWalker ? 'home visits' : 'home visits or tele-consultation'}. Use "Manage Services" to enable and publish services from the platform catalog.</>
              )}
            </p>
          </div>
        </div>

        {/* Additional Capabilities Section - hidden for pharmacy */}
        {!isPharmacy &&
          (capabilities.progress_tracking ||
            isWalker ||
            isNutritionist ||
            capabilities.diet_charts ||
            capabilities.meal_plans ||
            capabilities.distance_pricing ||
            capabilities.counseling ||
            hasVendorRole(vendorData, ['pet_insurance', 'insurance'])) && (
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-3">Additional Features</h2>
            <div className="grid grid-cols-3 gap-2">
              {hasVendorRole(vendorData, ['pet_insurance', 'insurance']) && (
                <button
                  type="button"
                  onClick={() => router.push('/insurance/policies')}
                  className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-indigo-100 transition-colors"
                  title="Issued policies, plans, and claims"
                >
                  <Shield className="w-6 h-6 text-indigo-600 mb-1" />
                  <span className="text-xs font-medium text-gray-900">Pet policies</span>
                </button>
              )}
              {(capabilities.progress_tracking || isWalker) && (
                <button
                  type="button"
                  onClick={() => {
                    if (isWalker) {
                      router.push('/bookings?walkSessions=1');
                    } else {
                      router.push('/training/progress');
                    }
                  }}
                  className="bg-green-50 border border-green-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-green-100 transition-colors"
                  title={
                    isWalker
                      ? 'Opens your walk booking and Live tracker when one is confirmed or in progress'
                      : 'Training and program progress'
                  }
                >
                  {isWalker ? (
                    <Footprints className="w-6 h-6 text-green-600 mb-1" />
                  ) : (
                    <TrendingUp className="w-6 h-6 text-green-600 mb-1" />
                  )}
                  <span className="text-xs font-medium text-gray-900">
                    {isWalker ? 'Walk sessions' : 'Progress'}
                  </span>
                </button>
              )}

              {(capabilities.diet_charts || capabilities.meal_plans || isNutritionist) && (
                <button
                  type="button"
                  onClick={() => router.push('/nutrition/dashboard')}
                  className="bg-lime-50 border border-lime-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-lime-100 transition-colors"
                  title="Diet, meal products, and orders"
                >
                  <ClipboardList className="w-6 h-6 text-lime-600 mb-1" />
                  <span className="text-xs font-medium text-gray-900">Diet</span>
                </button>
              )}

              {capabilities.distance_pricing && (
                <button
                  onClick={() => router.push('/settings')}
                  className="bg-fuchsia-50 border border-fuchsia-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-fuchsia-100 transition-colors"
                >
                  <MapPin className="w-6 h-6 text-fuchsia-600 mb-1" />
                  <span className="text-xs font-medium text-gray-900">Distance Pricing</span>
                </button>
              )}

              {capabilities.counseling && (
                <button
                  onClick={() => router.push('/counseling')}
                  className="bg-violet-50 border border-violet-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-violet-100 transition-colors"
                >
                  <Heart className="w-6 h-6 text-violet-600 mb-1" />
                  <span className="text-xs font-medium text-gray-900">Counseling</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Stats Dashboard - Time Period Tabs Only (No Earnings Display) */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex gap-2 mb-3 justify-center">
            <button
              onClick={() => setActiveTab('today')}
              className={`px-4 py-1.5 rounded-full text-sm ${activeTab === 'today' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-600'}`}
            >Today</button>
            <button
              onClick={() => setActiveTab('week')}
              className={`px-4 py-1.5 rounded-full text-sm ${activeTab === 'week' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-600'}`}
            >Week</button>
            <button
              onClick={() => setActiveTab('month')}
              className={`px-4 py-1.5 rounded-full text-sm ${activeTab === 'month' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-600'}`}
            >Month</button>
          </div>
        </div>

        {/* Today's Schedule - Open appointments on landing page (always for non-pharmacy) */}
        {!isPharmacy && (
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-center mb-3">
              {activeTab === 'today' ? "Today's" : activeTab === 'week' ? 'This Week' : "This Month's"} Schedule
            </h2>

            {/* Service Style Tabs - Only allowed styles */}
            <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
              <button
                onClick={() => setAppointmentTypeFilter('all')}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${appointmentTypeFilter === 'all' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-600'
                  }`}
              >
                All Types
              </button>

              {allowedServiceStyles.includes('at_home') && (
                <button
                  onClick={() => setAppointmentTypeFilter('home')}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${appointmentTypeFilter === 'home' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                >
                  <Home className="w-3.5 h-3.5" /> Home Visit
                </button>
              )}

              {allowedServiceStyles.includes('tele') && !isWalker && (
                <button
                  onClick={() => setAppointmentTypeFilter('tele')}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${appointmentTypeFilter === 'tele' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                >
                  <Monitor className="w-3.5 h-3.5" /> Tele
                </button>
              )}
            </div>

            {todaySchedule.length === 0 ? (
              <div className="text-center py-8 px-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Calendar className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-gray-900 font-semibold mb-1">No Appointments Yet</h3>
                <p className="text-sm text-gray-500 mb-4 max-w-[250px] mx-auto">
                  Complete your profile and add services to start getting bookings!
                </p>
                <button
                  onClick={() => router.push('/profile')}
                  className="px-4 py-2 bg-[#FF8C42] hover:bg-[#FF7A2E] text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Complete Profile
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-end mb-2">
                  <button className="text-sm text-[#FF8C42]" onClick={() => router.push('/bookings')}>View All →</button>
                </div>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {todaySchedule
                    .filter(appointment => {
                      if (appointmentTypeFilter === 'all') return true;
                      const typeMap: Record<string, string> = {
                        'at_home': 'home',
                        'home': 'home',
                        'tele': 'tele',
                        'teleconsultation': 'tele'
                      };
                      return typeMap[appointment.serviceType?.toLowerCase()] === appointmentTypeFilter;
                    })
                    .map(appointment => {
                      // Get customer location from appointment data
                      const customerLat = (appointment as any).customerLat || (appointment as any).customer_lat;
                      const customerLng = (appointment as any).customerLng || (appointment as any).customer_lng;

                      return (
                        <AppointmentCard
                          key={appointment.id}
                          appointment={{
                            ...appointment,
                            customerLat,
                            customerLng,
                          }}
                          onViewDetails={(bookingId) => {
                            const apt = todaySchedule.find(a => a.bookingId === bookingId);
                            if (apt) {
                              setSelectedAppointment(apt);
                              setAppointmentDetailModalOpen(true);
                            }
                          }}
                          onCall={(phone) => window.location.href = `tel:${phone}`}
                          onChat={(bookingId) => {
                            const apt = todaySchedule.find(a => a.bookingId === bookingId);
                            if (apt) {
                              setSelectedAppointment(apt);
                              setCommunicationMode('chat');
                            }
                          }}
                          onStart={(bookingId) => {
                            const apt = todaySchedule.find(a => a.bookingId === bookingId);
                            if (apt) {
                              setSelectedAppointment(apt);
                              setOtpAction('start');
                              setShowOtpModal(true);
                              setOtp('');
                              setOtpError(null);
                            }
                          }}
                          onComplete={(bookingId) => {
                            const apt = todaySchedule.find(a => a.bookingId === bookingId);
                            if (apt) {
                              setSelectedAppointment(apt);
                              setOtpAction('complete');
                              setShowOtpModal(true);
                              setOtp('');
                              setOtpError(null);
                            }
                          }}
                          onNavigate={(lat, lng) => {
                            const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                            window.open(url, '_blank');
                          }}
                          onStartGPS={(bookingId) => {
                            const apt = todaySchedule.find(a => a.bookingId === bookingId);
                            if (apt && apt.address) {
                              const lat = (apt as any).customerLat || (apt as any).customer_lat;
                              const lng = (apt as any).customerLng || (apt as any).customer_lng;
                              if (lat && lng) {
                                startLocationTracking(bookingId, lat, lng);
                              }
                            }
                          }}
                          onStopGPS={(bookingId) => stopLocationTracking(bookingId)}
                          isTracking={isTracking[appointment.bookingId] || false}
                          showActions={true}
                        />
                      );
                    })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ✅ PHARMA: Prescription Orders — for pharmacy solo vendors */}
        {isPharmacy && (
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-center mb-3">Prescription Orders</h2>
            <div className="flex items-center justify-center mb-2">
              <button className="text-sm text-[#FF8C42]" onClick={() => router.push('/pharmacy/orders')}>View Orders →</button>
            </div>
            <p className="text-xs text-gray-500 text-center">Accept orders, confirm availability, raise proforma invoice.</p>
          </div>
        )}

      </div>
    </VendorChromeLayout>

      {/* Modals */}
      <VendorNotificationModal
        vendorId={vendorId}
        open={notificationModalOpen}
        onClose={() => setNotificationModalOpen(false)}
        onNotificationsRead={() => fetchDashboardData(true)}
      />
      {vendorId ? (
        <VendorReviewsModal
          vendorId={vendorId}
          open={reviewsModalOpen}
          onClose={() => setReviewsModalOpen(false)}
        />
      ) : null}

      {/* Chat conversations list - wire message button */}
      {capabilities.chat && (
        <VendorChatConversationsModal
          vendorId={vendorId}
          vendorPhone={vendorData?.phone || vendorData?.mobile}
          vendorName={effectiveVendor?.fullName || effectiveVendor?.businessName || effectiveVendor?.business_name}
          open={chatConversationsOpen}
          onClose={() => {
            setChatConversationsOpen(false);
            fetchDashboardData(true);
          }}
          onSelectConversation={(conv) => {
            setSelectedChatConversation({
              bookingId: conv.bookingId,
              customerName: conv.customerName,
              customerPhone: conv.customerPhone,
              serviceName: conv.serviceName,
              bookingStatus: conv.bookingStatus,
              packageUtilization: conv.packageUtilization ?? undefined,
            });
          }}
        />
      )}

      {/* Chat modal when a conversation is selected from the list */}
      {capabilities.chat && selectedChatConversation && (
        <VendorChatModal
          bookingId={selectedChatConversation.bookingId}
          vendorId={vendorId}
          vendorPhone={vendorData?.phone || vendorData?.mobile}
          vendorName={effectiveVendor?.fullName || effectiveVendor?.businessName || effectiveVendor?.business_name || 'Vendor'}
          customerPhone={selectedChatConversation.customerPhone}
          customerName={selectedChatConversation.customerName}
          bookingStatus={selectedChatConversation.bookingStatus}
          serviceName={selectedChatConversation.serviceName}
          packageUtilization={selectedChatConversation.packageUtilization}
          onClose={() => {
            setSelectedChatConversation(null);
            fetchDashboardData(true);
          }}
        />
      )}

      {/* Communication Hub */}
      {communicationMode && selectedAppointment && (
        <CommunicationHub
          mode={communicationMode}
          bookingId={selectedAppointment.bookingId}
          userId={vendorData?.phone || vendorData?.mobile || '+91'}
          userName={effectiveVendor?.fullName || effectiveVendor?.businessName || effectiveVendor?.business_name || 'Provider'}
          otherUserName={selectedAppointment.customerName}
          userType="vendor"
          onClose={() => {
            setCommunicationMode(null);
            setSelectedAppointment(null);
            fetchDashboardData(true);
          }}
        />
      )}

      {/* Appointment Detail Modal */}
      {appointmentDetailModalOpen && selectedAppointment && (
        <AppointmentDetailModal
          bookingId={selectedAppointment.bookingId}
          vendorData={vendorData}
          roleId={vendorData?.roleId || vendorData?.role_id}
          roleName={roleName ?? undefined}
          capabilities={capabilities}
          onClose={() => {
            setAppointmentDetailModalOpen(false);
            setSelectedAppointment(null);
          }}
          onRefresh={() => fetchDashboardData(true)}
        />
      )}

      {/* OTP Modal */}
      {showOtpModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                {otpAction === 'start' ? 'Start Service' : 'Complete Service'}
              </h3>
              <button
                onClick={() => {
                  setShowOtpModal(false);
                  setOtp('');
                  setOtpError(null);
                  setSelectedAppointment(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Ask the customer for the 4-digit booking OTP sent to their phone to {otpAction === 'start' ? 'start' : 'complete'} the service.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter OTP
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="Enter 4-digit OTP"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                maxLength={4}
                autoFocus
              />
              {otpError && (
                <p className="text-sm text-red-600 mt-2">{otpError}</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowOtpModal(false);
                  setOtp('');
                  setOtpError(null);
                  setSelectedAppointment(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                disabled={processingOtp}
              >
                Cancel
              </button>
              <button
                onClick={handleOtpAction}
                disabled={otp.length !== 4 || processingOtp}
                className={`flex-1 px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${otpAction === 'start'
                  ? 'bg-blue-500 hover:bg-blue-600'
                  : 'bg-green-500 hover:bg-green-600'
                  }`}
              >
                {processingOtp ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Verify & {otpAction === 'start' ? 'Start' : 'Complete'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Analytics */}
      {activeBottomTab === 'reporting' && (
        <div className="fixed inset-0 z-30 overflow-y-auto bg-gray-50 pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
          <VendorAnalytics
            vendorId={vendorId}
            vendorData={vendorData}
            onBack={() => setActiveBottomTab('home')}
          />
        </div>
      )}

      {/* Vendor Settings - navigates to /settings (mobile-optimized VendorSettingsScreen) */}

      {/* AI Support Chat (same widget as business vendor dashboard) */}
      <ChatWidget
        userId={vendorId}
        userName={effectiveVendor?.fullName || effectiveVendor?.businessName || effectiveVendor?.business_name || 'Provider'}
        userType="vendor"
      />

      {/* Debug Overlay */}
      <CapabilityDebugOverlay
        roleId={vendorData?.roleId || 'unknown'}
        roleName={roleName || 'Solo Provider'}
        capabilities={capabilities}
        vendorData={vendorData}
      />
    </>
  );
}
