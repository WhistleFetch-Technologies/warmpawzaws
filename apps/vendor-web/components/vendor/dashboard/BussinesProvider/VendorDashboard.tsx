'use client';

import { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { clearVendorSession } from '@/lib/session-utils';
import { CapabilityDebugOverlay } from '../../CapabilityDebugOverlay';
// Removed unused import: ModuleDisabledMessage, ModuleMessages
import { CapabilityGate } from '../../CapabilityGate';
import { useVendorCapabilities } from '../../hooks/useVendorCapabilities';
// AWS Serverless: apiClient with Cognito auth
import { getVendorIconTheme, getRoleIconComponent, getRoleColorScheme, renderRoleIcon } from '@/lib/vendor-icon-themes';
import { getVendorRoleId, normalizeServiceStyle, hasVendorRole } from '@/lib/vendor-utils';
import { getRoleLabels, getServiceStyleLabel } from '@/lib/role-labels';
import CapabilityHelper from '@/lib/capability-helper';
import PerformanceMonitor from '@/lib/performance-monitor';
// Removed unused import: Analytics
import { copyTextToClipboard } from '@/lib/shareUtils';
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
  Stethoscope,
  Monitor,
  Users,
  Building2,
  ShoppingBag,
  Camera,
  Briefcase,
  Pill,
  TrendingUp,
  FileText,
  Gift,
  Heart,
  Shield,
  Truck,
  MapPin,
  HelpCircle,
  CheckCircle2,
  User,
  X,
  ClipboardList,
  icons
} from 'lucide-react';

const IndianRupee = icons?.IndianRupee ?? icons?.DollarSign;
import { Badge } from '../../../ui/badge';
import { VendorNotificationModal } from '../../VendorNotificationModal';
import { Dashboardstats, DashboardWarnings, NotificationItem, ScheduleItem, VendorDashboardProps, WatchlistItem } from '../types';
import { formatBookingTime } from '../helpers';
import { toast } from 'sonner';

// Lazy-load heavy/cyclic components to avoid TDZ when dashboard chunk loads
const SoloProviderDashboard = lazy(() =>
  import('../Soloprovider/SoloProviderDashboard').then((m) => ({ default: m.SoloProviderDashboard }))
);
const CommunicationHub = lazy(() =>
  import('../../../communication/CommunicationHub').then((m) => ({ default: m.CommunicationHub }))
);
const AppointmentDetailModal = lazy(() =>
  import('../../AppointmentDetailModal').then((m) => ({ default: m.AppointmentDetailModal }))
);
const VendorAnalytics = lazy(() =>
  import('../../VendorAnalytics').then((m) => ({ default: m.VendorAnalytics }))
);
const ChatWidget = lazy(() =>
  import('../../../customer/ChatWidget').then((m) => ({ default: m.ChatWidget }))
);
const PharmacyOrderAlerts = lazy(() =>
  import('../../pharmacy/PharmacyOrderAlerts').then((m) => ({ default: m.PharmacyOrderAlerts }))
);
const PendingReportsPanel = lazy(() =>
  import('../../appointments/PendingReportsPanel').then((m) => ({ default: m.PendingReportsPanel }))
);

export function VendorDashboard({
  vendorId,
  vendorData,
  onNavigateToConsultation,
  onNavigateToServiceManagement,
  onNavigateToBookingManagement,
  onNavigateToTeleConsultation,
  onNavigateToScheduleManagement, // ⚠️ DEPRECATED: Routes to Advanced Availability
  onNavigateToAdvancedAvailability, // ✅ STANDARD: Navigate to Advanced Availability Manager
  onNavigateToProfile, // ✅ RENAMED: Navigate to Profile Manager (works for both center and solo)
  onNavigateToFacilityManagement,
  onNavigateToBusinessHub,
  onNavigateToLiveTracking,
  onNavigateToSpecializedServices, // ✅ NEW: Navigate to Vet Specialized Services (Pharmacy, Diagnostics, Ambulance)
  // ✅ NEW: Additional navigation handlers for all capabilities
  onNavigateToGallery,
  onNavigateToPortfolio,
  onNavigateToCCTV,
  onNavigateToControlledSubstances,
  onNavigateToPrescription,
  onNavigateToPrescriptionList, // ✅ NEW
  onNavigateToDiagnostics, // ✅ NEW
  onNavigateToPricing, // ✅ NEW
  onNavigateToProgressTracking,
  onNavigateToPackages,
  onNavigateToCustomServices,
  onNavigateToAdoptionSystem,
  onNavigateToMemorialServices,
  onNavigateToExpiryManagement,
  onNavigateToDonationManagement,
  onNavigateToEventManagement,
  onNavigateToPatientMonitoring,
  onNavigateToCafeMenuManagement,
  onNavigateToCafeTables,
  // ✅ NEW: Additional capability navigation handlers (Phase 2)
  onNavigateToPrescriptionVerification,
  onNavigateToDeliveryManagement,
  onNavigateToDietCharts,
  onNavigateToCounseling,
  onNavigateToDistancePricing,
  onNavigateToMultiDoctorManagement,
  onNavigateToPolicyManagement,
  onNavigateToSupport,
  onNavigateToDashboard
}: VendorDashboardProps) {
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'month'>('today');
  const [activeBottomTab, setActiveBottomTab] = useState<'home' | 'bookings' | 'reporting' | 'settings'>('home');
  const [appointmentTypeFilter, setAppointmentTypeFilter] = useState<'all' | 'clinic' | 'home' | 'tele'>('all');
  const [stats, setStats] = useState<Dashboardstats>({
    appointments: 0,
    consultations: 0,
    earnings: 0,
    pendingEarnings: 0,
    completedServices: 0,
    rating: 4.8,
    totalReviews: 0,
    activeOrders: 0
  });
  const [todaySchedule, setTodaySchedule] = useState<ScheduleItem[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vendor, setVendor] = useState(vendorData);
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [communicationMode, setCommunicationMode] = useState<'chat' | 'video' | null>(null);
  const [appointmentDetailModalOpen, setAppointmentDetailModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<ScheduleItem | null>(null);
  // ✅ NEW: OTP modal state for completing appointments
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [processingOtp, setProcessingOtp] = useState(false);

  // ✅ NEW: Dashboard warnings state
  const [warnings, setWarnings] = useState<DashboardWarnings>({
    profileIncomplete: false,
    bankNotVerified: true, // Default to true until verified
    servicesNotConfigured: true, // Default to true until configured
  });
  const [bankDetails, setBankDetails] = useState<any>(null);

  const router = useRouter();
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

  // 🔌 CORE: Load dynamic capabilities
  const effectiveRoleId = vendorData?.roleId || vendorData?.role_id || (vendorData as any)?.selected_role_id;
  const { capabilities, loading: capsLoading, roleName, initialLoadComplete } = useVendorCapabilities(effectiveRoleId);

  const vendorConfiguration = vendorData?.vendorConfiguration || vendorData?.vendorType || vendorData?.vendor_type || null;
  const selectedServiceStyles = vendorData?.serviceStyles || vendorData?.selectedServiceStyles || [];
  const profileType = vendorData?.profileType || (vendorConfiguration === 'solo' ? 'professional' : 'center');
  const allowedServiceStyles = vendorData?.allowedServiceStyles || [];
  const customerService = vendorData?.customer_service || null;

  const isVet = hasVendorRole(vendorData, ['veterinarian', 'veterinary_clinic', 'pet_clinic', 'vet']);
  const isPharmacy = hasVendorRole(vendorData, ['pharmacy', 'pet_pharmacy']);

  const isSoloProvider = vendorConfiguration === 'solo' || vendorData?.isSoloProvider || vendorData?.is_solo_provider || false;


  // for solo provider, return the solo provider dashboard
  if (isSoloProvider) {
    const soloSession = {
      vendorId: vendorData.id || vendorId,
      centerId: vendorData.centerId,
      staffId: vendorData.autoLinkedStaffId,
      isSoloProvider: true,
      ownerName: vendorData.ownerName,
      businessName: vendorData.businessName,
      roleName: vendorData.roleName || 'Service Provider',
      defaultMode: 'CENTER' as const
    };

    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
        </div>
      }>
        <SoloProviderDashboard
          session={soloSession}
          vendorData={vendorData}
        />
      </Suspense>
    );
  }

  // Fetch dashboard data
  const fetchDashboardData = async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      console.log('📊 Fetching vendor dashboard data for:', vendorId);
      console.log('⚡ Using parallel API calls for better performance');

      // ✅ PERFORMANCE: Start tracking dashboard load time
      PerformanceMonitor.markStart('dashboard-load');

      // Prepare all fetch promises based on capabilities
      const today = new Date().toISOString().split('T')[0];

      // ✅ OPTIMIZATION: Split critical and non-critical data
      // Critical data: dashboard stats + schedule (needed for initial render)
      const criticalPromises: Promise<any>[] = [
        // 1. Always fetch dashboard stats
        apiClient.get(`/vendor/${vendorId}/dashboard?timeframe=${activeTab}`).catch(() => ({ success: false })),

        // 2. Fetch schedule for non-pharmacy vendors (all service providers receive bookings)
        !isPharmacy
          ? apiClient.get(`/vendor/${vendorId}/bookings/today`).catch(() => ({ success: false, bookings: [] }))
          : Promise.resolve({ success: false, bookings: [] })
      ];

      // Non-critical data: notifications, watchlist, services (can load after)
      const nonCriticalPromises: Promise<any>[] = [
        // 3. Fetch watchlist if medical records enabled - USE UTILITY
        CapabilityHelper.hasMedicalRecords(capabilities)
          ? apiClient.get(`/vendor/${vendorId}/watchlist`).catch(() => ({ success: false, watchlist: [] }))
          : Promise.resolve({ success: false, watchlist: [] }),

        // 4. Always fetch notifications
        apiClient.get(`/vendor/${vendorId}/notifications?limit=5`).catch(() => ({ success: false, notifications: [] })),

        // 5. Fetch services if catalog, booking, services capability, or service-offering role - USE UTILITY
        (CapabilityHelper.hasCatalog(capabilities) || CapabilityHelper.hasBooking(capabilities) || CapabilityHelper.hasCapability(capabilities, 'services') || hasVendorRole(vendorData, ['pharmacy', 'pet_pharmacy', 'pet_cafe', 'cafe', 'pet_insurance', 'insurance', 'pet_holidays', 'holidays', 'pet_resort', 'resort', 'pet_ambulance', 'ambulance']))
          ? apiClient.get(`/vendor/${vendorId}/services`).catch(() => ({ success: false, services: [] }))
          : Promise.resolve({ success: false, services: [] })
      ];

      // ✅ OPTIMIZATION: Execute critical fetches first, hide loading screen ASAP
      const [dashboardRes, scheduleRes] = await Promise.all(criticalPromises);

      // ✅ OPTIMIZATION: Parse JSON responses in parallel
      const criticalParsing = [];

      if (dashboardRes && dashboardRes.success) {
        criticalParsing.push(
          Promise.resolve().then(() => {
            setStats(dashboardRes.stats || dashboardRes);
            setVendor(dashboardRes.vendor || vendorData);
            // ✅ FIX: Use bookings from dashboard response (sorted by date/time, includes upcoming)
            if (dashboardRes.bookings && dashboardRes.bookings.length > 0) {
              console.log(`✅ [DASHBOARD] Loaded ${dashboardRes.bookings.length} bookings from dashboard`);
              // Transform API response to match ScheduleItem interface
              const transformedBookings: ScheduleItem[] = dashboardRes.bookings.map((b: any) => ({
                id: b.id || b.booking_id,
                bookingId: b.id || b.booking_id,
                time: b.booking_time ? formatBookingTime(b.booking_time) : 'N/A',
                duration: b.duration_minutes || 30,
                petName: b.pet_name || 'Pet',
                petBreed: b.pet_breed,
                customerName: b.customer_name || 'Customer',
                customerPhone: b.customer_phone || '',
                serviceName: b.service_name || 'Service',
                serviceType: b.service_type || 'at_center',
                status: b.status || 'pending',
                price: parseFloat(b.total_amount || '0'),
                address: b.address || '',
                specialInstructions: b.notes,
                hasPrescription: b.hasPrescription || false,
                hasUnreadMessages: b.hasUnreadMessages || false,
                unreadMessageCount: b.unreadMessageCount || 0,
                chatEnabled: b.chatEnabled || true,
                isFollowUp: b.isFollowUp || false,
              }));
              setTodaySchedule(transformedBookings);
            }
          })
        );
      }

      // ✅ FIX: Only use scheduleRes if dashboardRes didn't have bookings; ensure each item has bookingId so Details works
      if (scheduleRes && scheduleRes.success && scheduleRes.bookings?.length > 0) {
        criticalParsing.push(
          Promise.resolve().then(() => {
            const scheduleBookings = (scheduleRes.bookings || scheduleRes.schedule || []) as any[];
            const mapped: ScheduleItem[] = scheduleBookings.map((b: any) => ({
              id: b.id || b.booking_id,
              bookingId: b.id || b.booking_id,
              time: b.booking_time ? formatBookingTime(b.booking_time) : 'N/A',
              duration: b.duration_minutes ?? 30,
              petName: b.pet_name || 'Pet',
              petBreed: b.pet_breed,
              customerName: b.customer_name || 'Customer',
              customerPhone: b.customer_phone || '',
              serviceName: b.service_name || 'Service',
              serviceType: b.service_type || 'at_center',
              status: b.status || 'pending',
              price: parseFloat(b.total_amount || '0'),
              address: b.address || '',
              specialInstructions: b.notes,
              hasPrescription: b.hasPrescription || false,
              hasUnreadMessages: b.hasUnreadMessages || false,
              unreadMessageCount: b.unreadMessageCount || 0,
              chatEnabled: b.chatEnabled !== false,
              isFollowUp: b.isFollowUp || false,
            }));
            setTodaySchedule((prev: ScheduleItem[]) => prev.length > 0 ? prev : mapped);
          })
        );
      }

      // Wait for critical parsing to complete
      await Promise.all(criticalParsing);

      // ✅ PERFORMANCE: End tracking for critical path
      PerformanceMonitor.markEnd('dashboard-load');

      // Hide loading screen now (critical data is ready)
      setLoading(false);
      setRefreshing(false);

      console.log('✅ Critical dashboard data loaded (fast path)');

      // ✅ OPTIMIZATION: Load non-critical data in background
      Promise.all(nonCriticalPromises).then(async ([watchlistRes, notificationsRes, servicesRes]) => {
        // Process watchlist
        if (watchlistRes && watchlistRes.success) {
          setWatchlist(watchlistRes.watchlist || []);
        }

        // Process notifications
        if (notificationsRes && notificationsRes.success) {
          setNotifications(notificationsRes.notifications || []);
        }

        // Process services
        if (servicesRes && servicesRes.success) {
          const servicesData = Array.isArray(servicesRes.services) ? servicesRes.services : [];
          setServices(servicesData);
          // ✅ NEW: Check if services are configured
          setWarnings(prev => ({
            ...prev,
            servicesNotConfigured: servicesData.length === 0,
          }));
        }

        console.log('✅ Non-critical dashboard data loaded (background)');
      }).catch(error => {
        console.error('⚠️ Error loading non-critical data:', error);
      });

      // ✅ NEW: Check profile and bank status in background
      Promise.all([
        apiClient.get(`/vendor/${vendorId}/bank-details`).catch(() => ({ success: false })),
        apiClient.get(`/vendor/${vendorId}/profile`).catch(() => ({ success: false })),
      ]).then(([bankRes, profileRes]: [any, any]) => {
        // Check bank verification status
        if (bankRes && bankRes.success && bankRes.bankDetails) {
          setBankDetails(bankRes.bankDetails);
          setWarnings(prev => ({
            ...prev,
            bankNotVerified: !bankRes.bankDetails.bank_verified && !bankRes.bankDetails.is_verified,
          }));
        }

        // Check profile completion
        if (profileRes && profileRes.success) {
          const profile = profileRes.vendor || profileRes;
          // FIX: Check all possible image field names (logo_url, profile_image_url, photo_url, photo)
          const hasLogo = !!(profile.logo_url || profile.profile_image_url || profile.photo_url || profile.photo);
          const isProfileComplete = !!(
            profile.business_name &&
            profile.phone &&
            profile.address &&
            (hasLogo || profileType === 'professional')
          );
          setWarnings(prev => ({
            ...prev,
            profileIncomplete: !isProfileComplete,
            reasonProfileIncomplete: !isProfileComplete
              ? `Missing: ${!profile.business_name ? 'Business Name, ' : ''}${!profile.phone ? 'Phone, ' : ''}${!profile.address ? 'Address, ' : ''}${!hasLogo && profileType !== 'professional' ? 'Logo' : ''}`.replace(/, $/, '')
              : undefined,
          }));
        }
      }).catch(error => {
        console.error('⚠️ Error checking profile/bank status:', error);
      });

    } catch (error) {
      console.error('❌ Error fetching dashboard data:', error);
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch data on mount and when activeTab changes
  // ✅ FIX: Load dashboard data immediately, don't wait for capabilities
  // Capabilities are used for conditional fetching but shouldn't block initial load
  useEffect(() => {
    if (vendorId) {
      // Don't wait for capsLoading - fetch dashboard data immediately
      // The fetchDashboardData already handles capability-based conditional fetching
      fetchDashboardData();
    }
  }, [vendorId, activeTab]);

  // ✅ FIX: Refresh when capabilities are loaded to fetch capability-specific data
  useEffect(() => {
    if (vendorId && initialLoadComplete && !capsLoading) {
      // Capabilities are now loaded, refresh to fetch any capability-specific data
      fetchDashboardData(true);
    }
  }, [initialLoadComplete]);

  // ✅ NEW: OTP handler for completing appointments
  const handleCompleteWithOtp = async () => {
    if (!selectedAppointment) return;
    if (otp.length !== 4) {
      setOtpError('Please enter a valid 4-digit OTP');
      return;
    }

    setProcessingOtp(true);
    setOtpError(null);

    try {
      const data = await apiClient.post(`/vendor/bookings/${selectedAppointment.bookingId}/otp/verify`, {
        otp,
        action: 'complete'
      }) as any;

      setShowOtpModal(false);
      setOtp('');
      setOtpError(null);
      setSelectedAppointment(null);

      // Refresh dashboard data
      fetchDashboardData(true);

      // Show success message
      if (data.message) {
        // Using a simple alert for now - can be replaced with toast
        alert(data.message || 'Service completed successfully!');
      }
    } catch (error: any) {
      console.error('Error completing service:', error);
      setOtpError(error.message || 'OTP verification failed. Please try again.');
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

  // 🎨 GET DYNAMIC ICON THEME FOR THIS VENDOR
  const RoleIcon = getRoleIconComponent(vendorData?.roleId);
  const colorScheme = getRoleColorScheme(vendorData?.roleId);

  // 🏷️ GET ROLE-AWARE LABELS
  const labels = useMemo(() => getRoleLabels(vendorData?.roleId), [vendorData?.roleId]);

  // ✅ FIX: Wait for initialLoadComplete to prevent flickering
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[430px] mx-auto bg-white min-h-screen">
        {/* Header */}
        <div className="p-4 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${colorScheme.secondary} rounded-lg flex items-center justify-center`}>
                <RoleIcon className={`w-6 h-6 ${colorScheme.primary}`} />
              </div>
              <div>
                <h1 className="font-semibold text-gray-900">
                  {isSoloProvider
                    ? (vendor?.ownerName || vendor?.owner_name || vendor?.fullName || 'Service Provider')
                    : (vendor?.businessName || vendor?.business_name || vendor?.fullName || 'Vendor Dashboard')
                  }
                </h1>
                <p className="text-xs text-gray-500">
                  {isSoloProvider ? 'Solo Provider' : (vendorData?.address || vendor?.address || 'Business Center')} • {roleName || 'Service Provider'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => fetchDashboardData(true)} disabled={refreshing}>
                <RefreshCw className={`w-5 h-5 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
              </button>

              {capabilities.chat && (
                <MessageSquare className="w-5 h-5 text-gray-400" />
              )}

              <button
                className="relative"
                onClick={() => setNotificationModalOpen(true)}
              >
                <Bell className="w-5 h-5 text-gray-400 hover:text-[#FF8C42] transition-colors" />
                {notifications.filter(n => !n.isRead).length > 0 && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                )}
              </button>

              {/* ✅ NEW: Logout Button */}
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

          {/* Online Status Badge */}
          <div className="flex items-center justify-between">
            <Badge className="bg-green-100 text-green-700 border-green-200">
              ONLINE
            </Badge>
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span className="text-sm font-semibold">{stats.rating.toFixed(1)}</span>
              <span className="text-xs text-gray-500">({stats.totalReviews} reviews)</span>
            </div>
          </div>

          {/* Service Summary - Hide for Pharmacy (they don't do appointments) */}
          {capabilities.booking && !isPharmacy && (
            <div className="mt-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-orange-600" />
                <span className="text-gray-700">
                  Service Availability: <span className="font-semibold text-orange-600">Mon-Fri 9AM-6PM</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ✅ PHARMACY: Incoming Order Alerts for Pharmacy Vendors */}
        {isPharmacy && vendorId && (
          <div className="border-b border-gray-200">
            <Suspense fallback={null}>
              <PharmacyOrderAlerts
                pharmacyId={vendorId}
                pharmacyName={vendor?.businessName || vendor?.business_name || 'Pharmacy'}
              />
            </Suspense>
          </div>
        )}

        {/* ✅ VET: Pending Lab Reports for Review (shared by customers) */}
        {isVet && vendorId && (
          <div className="border-b border-gray-200">
            <Suspense fallback={null}>
              <PendingReportsPanel
                vetId={vendorId}
                onReportReviewed={() => fetchDashboardData(true)}
              />
            </Suspense>
          </div>
        )}

        {/* 🧱 DYNAMIC QUICK ACTIONS */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex flex-wrap gap-3">
            {/* ✅ PHARMA: Pharmacy vendors get Orders (accept orders, prescriptions, proforma) — NOT Service Management */}
            {isPharmacy && (
              <button
                onClick={() => router.push('/pharmacy/orders')}
                className="flex-1 min-w-[140px] bg-white border-2 border-[#FF8C42] text-[#FF8C42] rounded-xl p-4 flex flex-col items-center justify-center hover:bg-[#FF8C42] hover:text-white transition-colors group text-center"
              >
                <ClipboardList className="w-6 h-6 mb-2" />
                <span className="font-semibold text-sm">Orders</span>
              </button>
            )}
            {/* Service Management - For non-pharmacy vendors with catalog, booking, or services */}
            {/* ✅ FIX: Route directly to /services to show VendorServiceManagementComplete UI */}
            {!isPharmacy && (CapabilityHelper.hasCatalog(capabilities) || CapabilityHelper.hasBooking(capabilities) || CapabilityHelper.hasCapability(capabilities, 'services') || hasVendorRole(vendorData, ['pet_cafe', 'cafe', 'pet_insurance', 'insurance', 'pet_holidays', 'holidays', 'pet_resort', 'resort', 'pet_ambulance', 'ambulance'])) && (
              <button
                onClick={() => router.push('/services')}
                className="flex-1 min-w-[140px] bg-white border-2 border-[#FF8C42] text-[#FF8C42] rounded-xl p-4 flex flex-col items-center justify-center hover:bg-[#FF8C42] hover:text-white transition-colors group text-center"
              >
                <Activity className="w-6 h-6 mb-2" />
                <span className="font-semibold text-sm">Service Management</span>
              </button>
            )}

            {/* ✅ Profile - Works for both center and solo vendors */}
            {onNavigateToProfile && (
              <button
                onClick={onNavigateToProfile}
                className="flex-1 min-w-[140px] bg-white border-2 border-purple-500 text-purple-600 rounded-xl p-4 flex flex-col items-center justify-center hover:bg-purple-500 hover:text-white transition-colors group text-center"
              >
                <Building2 className="w-6 h-6 mb-2" />
                <span className="font-semibold text-sm">Profile</span>
              </button>
            )}

            {/* ✅ STANDARD: Advanced Availability - For all service-oriented vendors with booking capability */}
            {/* This is the ONLY availability management - no basic schedule management anymore */}
            {onNavigateToAdvancedAvailability && CapabilityHelper.hasBooking(capabilities) && (
              <button
                onClick={onNavigateToAdvancedAvailability}
                className="flex-1 min-w-[140px] bg-white border-2 border-green-500 text-green-600 rounded-xl p-4 flex flex-col items-center justify-center hover:bg-green-500 hover:text-white transition-colors group text-center"
              >
                <Calendar className="w-6 h-6 mb-2" />
                <span className="font-semibold text-sm">Availability</span>
              </button>
            )}

            {/* ✅ Fallback: Professional Profile - Only show if vendor is solo and no onNavigateToProfile */}
            {!onNavigateToProfile && profileType === 'professional' && (
              <button
                onClick={() => {
                  router.push(`/profile`);
                }}
                className="flex-1 min-w-[140px] bg-white border-2 border-blue-500 text-blue-600 rounded-xl p-4 flex flex-col items-center justify-center hover:bg-blue-500 hover:text-white transition-colors group text-center"
              >
                <User className="w-6 h-6 mb-2" />
                <span className="font-semibold text-sm">Professional Profile</span>
              </button>
            )}

            {/* Inventory/Store - For product-oriented roles EXCEPT pharmacy (pharmacy has no inventory management) */}
            {onNavigateToBusinessHub && !isPharmacy && (
              (hasVendorRole(vendorData, ['pet_products_store', 'seller', 'retailer', 'pet_seller']) ||
                capabilities.inventory) && (
                <button
                  onClick={onNavigateToBusinessHub}
                  className="flex-1 min-w-[140px] bg-white border-2 border-blue-500 text-blue-600 rounded-xl p-4 flex flex-col items-center justify-center hover:bg-blue-500 hover:text-white transition-colors group text-center"
                >
                  <Package className="w-6 h-6 mb-2" />
                  <span className="font-semibold text-sm">Inventory & Store</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* ✅ CANONICAL: VET-SPECIFIC SERVICES SECTION - For veterinary roles only (not pharmacy-only) */}
        {!isPharmacy && (
          vendorData?.roleId === 'pet_clinic' ||
          vendorData?.roleId === 'veterinarian' ||
          vendorData?.roleId === 'veterinary_clinic' ||
          vendorData?.roleId?.includes('vet') ||
          vendorData?.serviceCategory === 'veterinary'
        ) && (
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 mb-3">Vet Center Services</h2>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => onNavigateToSupport?.()}
                  className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-blue-100 transition-colors"
                >
                  <HelpCircle className="w-6 h-6 text-blue-600 mb-1" />
                  <span className="text-xs font-medium text-gray-900">Support</span>
                </button>

                <button
                  onClick={() => onNavigateToSpecializedServices?.()}
                  className="bg-teal-50 border border-teal-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-teal-100 transition-colors"
                >
                  <svg className="w-6 h-6 text-teal-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="text-xs font-medium text-gray-900">Pharmacy</span>
                </button>

                <button
                  onClick={() => onNavigateToSpecializedServices?.()}
                  className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-blue-100 transition-colors"
                >
                  <svg className="w-6 h-6 text-blue-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                  <span className="text-xs font-medium text-gray-900">Diagnostics</span>
                </button>

                <button
                  onClick={() => onNavigateToSpecializedServices?.()}
                  className="bg-red-50 border border-red-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-red-100 transition-colors"
                >
                  <svg className="w-6 h-6 text-red-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="text-xs font-medium text-gray-900">Ambulance</span>
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Manage specialized vet services, equipment, and protocols
              </p>
            </div>
          )}

        {/* ✅ NEW: ADDITIONAL CAPABILITIES QUICK ACTIONS — hidden for pharmacy (flow is Orders + Profile only) */}
        {!isPharmacy && ((capabilities.gallery || capabilities.portfolio || capabilities.cctv_access || capabilities.progress_tracking || capabilities.package_management || capabilities.custom_services || capabilities.diet_charts || capabilities.counseling || capabilities.policy_management || capabilities.distance_pricing) ||
          capabilities.controlled_substances ||
          capabilities.prescription ||
          capabilities.prescription_verification ||
          capabilities.delivery) && (
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 mb-3">Additional Features</h2>
              <div className="grid grid-cols-3 gap-2">
                {/* Gallery Management */}
                {onNavigateToGallery && capabilities.gallery && (
                  <button
                    onClick={onNavigateToGallery}
                    className="bg-pink-50 border border-pink-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-pink-100 transition-colors"
                  >
                    <Camera className="w-6 h-6 text-pink-600 mb-1" />
                    <span className="text-xs font-medium text-gray-900">Gallery</span>
                  </button>
                )}

                {/* Portfolio Management */}
                {onNavigateToPortfolio && capabilities.portfolio && (
                  <button
                    onClick={onNavigateToPortfolio}
                    className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-indigo-100 transition-colors"
                  >
                    <Briefcase className="w-6 h-6 text-indigo-600 mb-1" />
                    <span className="text-xs font-medium text-gray-900">Portfolio</span>
                  </button>
                )}

                {/* CCTV Access */}
                {onNavigateToCCTV && capabilities.cctv_access && (
                  <button
                    onClick={onNavigateToCCTV}
                    className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-gray-100 transition-colors"
                  >
                    <Monitor className="w-6 h-6 text-gray-600 mb-1" />
                    <span className="text-xs font-medium text-gray-900">CCTV</span>
                  </button>
                )}

                {/* Controlled Substances */}
                {onNavigateToControlledSubstances && capabilities.controlled_substances && (
                  <button
                    onClick={onNavigateToControlledSubstances}
                    className="bg-red-50 border border-red-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-red-100 transition-colors"
                  >
                    <Pill className="w-6 h-6 text-red-600 mb-1" />
                    <span className="text-xs font-medium text-gray-900">Substances</span>
                  </button>
                )}

                {/* Prescription Builder */}
                <CapabilityGate capability="prescription_create">
                  {onNavigateToPrescription && (
                    <button
                      onClick={onNavigateToPrescription}
                      className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-blue-100 transition-colors"
                      title="Create Prescription"
                    >
                      <FileText className="w-6 h-6 text-blue-600 mb-1" />
                      <span className="text-xs font-medium text-gray-900">Rx</span>
                    </button>
                  )}
                </CapabilityGate>

                {/* Prescription List */}
                <CapabilityGate capability="prescription_create">
                  {onNavigateToPrescriptionList && (
                    <button
                      onClick={onNavigateToPrescriptionList}
                      className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-blue-100 transition-colors"
                      title="View Prescriptions"
                    >
                      <FileText className="w-6 h-6 text-blue-600 mb-1" />
                      <span className="text-xs font-medium text-gray-900">Rx List</span>
                    </button>
                  )}
                </CapabilityGate>

                {/* Diagnostic Results - Show for diagnostic_results capability OR diagnostics_center/diagnostic role */}
                <CapabilityGate capability="diagnostic_results" allowIfRoleContains="diagnostic">
                  {onNavigateToDiagnostics && (
                    <button
                      onClick={onNavigateToDiagnostics}
                      className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-purple-100 transition-colors"
                      title="Lab Orders & Diagnostic Tests"
                    >
                      <Monitor className="w-6 h-6 text-purple-600 mb-1" />
                      <span className="text-xs font-medium text-gray-900">Lab / Tests</span>
                    </button>
                  )}
                </CapabilityGate>

                {/* Service Pricing */}
                <CapabilityGate capability="service_pricing">
                  {onNavigateToPricing && (
                    <button
                      onClick={onNavigateToPricing}
                      className="bg-green-50 border border-green-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-green-100 transition-colors"
                      title="Manage Pricing"
                    >
                      <IndianRupee className="w-6 h-6 text-green-600 mb-1" />
                      <span className="text-xs font-medium text-gray-900">Pricing</span>
                    </button>
                  )}
                </CapabilityGate>

                {/* Progress Tracking */}
                {onNavigateToProgressTracking && capabilities.progress_tracking && (
                  <button
                    onClick={onNavigateToProgressTracking}
                    className="bg-green-50 border border-green-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-green-100 transition-colors"
                  >
                    <TrendingUp className="w-6 h-6 text-green-600 mb-1" />
                    <span className="text-xs font-medium text-gray-900">Progress</span>
                  </button>
                )}

                {/* DETACHED: Package Management - 500 errors, will fix later */}

                {/* ❌ REMOVED: Custom Services button - removed per user request */}

                {/* Adoption Management */}
                {onNavigateToAdoptionSystem && capabilities.adoption && (
                  <button
                    onClick={onNavigateToAdoptionSystem}
                    className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-rose-100 transition-colors"
                  >
                    <Heart className="w-6 h-6 text-rose-600 mb-1" />
                    <span className="text-xs font-medium text-gray-900">Adoption</span>
                  </button>
                )}

                {/* Memorial Services */}
                {onNavigateToMemorialServices && capabilities.memorial && (
                  <button
                    onClick={onNavigateToMemorialServices}
                    className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-purple-100 transition-colors"
                  >
                    <Heart className="w-6 h-6 text-purple-600 mb-1" />
                    <span className="text-xs font-medium text-gray-900">Memorial</span>
                  </button>
                )}

                {/* Expiry Management */}
                {onNavigateToExpiryManagement && capabilities.expiry_management && (
                  <button
                    onClick={onNavigateToExpiryManagement}
                    className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-amber-100 transition-colors"
                  >
                    <svg className="w-6 h-6 text-amber-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs font-medium text-gray-900">Expiry</span>
                  </button>
                )}

                {/* Donation Management */}
                {onNavigateToDonationManagement && capabilities.donation && (
                  <button
                    onClick={onNavigateToDonationManagement}
                    className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-emerald-100 transition-colors"
                  >
                    <svg className="w-6 h-6 text-emerald-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs font-medium text-gray-900">Donations</span>
                  </button>
                )}

                {/* Event Management */}
                {onNavigateToEventManagement && capabilities.events && (
                  <button
                    onClick={onNavigateToEventManagement}
                    className="bg-sky-50 border border-sky-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-sky-100 transition-colors"
                  >
                    <svg className="w-6 h-6 text-sky-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs font-medium text-gray-900">Events</span>
                  </button>
                )}

                {/* Patient Monitoring */}
                {onNavigateToPatientMonitoring && capabilities.patient_monitoring && (
                  <button
                    onClick={onNavigateToPatientMonitoring}
                    className="bg-red-50 border border-red-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-red-100 transition-colors"
                  >
                    <Activity className="w-6 h-6 text-red-600 mb-1" />
                    <span className="text-xs font-medium text-gray-900">Monitor</span>
                  </button>
                )}

                {/* ✅ NEW: Prescription Verification */}
                {onNavigateToPrescriptionVerification && capabilities.prescription_verification && (
                  <button
                    onClick={onNavigateToPrescriptionVerification}
                    className="bg-teal-50 border border-teal-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-teal-100 transition-colors"
                  >
                    <FileText className="w-6 h-6 text-teal-600 mb-1" />
                    <span className="text-xs font-medium text-gray-900">Rx Verify</span>
                  </button>
                )}

                {/* ✅ NEW: Delivery Management */}
                {onNavigateToDeliveryManagement && capabilities.delivery && (
                  <button
                    onClick={onNavigateToDeliveryManagement}
                    className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-orange-100 transition-colors"
                  >
                    <Truck className="w-6 h-6 text-orange-600 mb-1" />
                    <span className="text-xs font-medium text-gray-900">Delivery</span>
                  </button>
                )}

                {/* ✅ NEW: Diet Charts */}
                {onNavigateToDietCharts && capabilities.diet_charts && (
                  <button
                    onClick={onNavigateToDietCharts}
                    className="bg-lime-50 border border-lime-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-lime-100 transition-colors"
                  >
                    <svg className="w-6 h-6 text-lime-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-xs font-medium text-gray-900">Diet</span>
                  </button>
                )}

                {/* ✅ NEW: Counseling */}
                {onNavigateToCounseling && capabilities.counseling && (
                  <button
                    onClick={onNavigateToCounseling}
                    className="bg-violet-50 border border-violet-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-violet-100 transition-colors"
                  >
                    <svg className="w-6 h-6 text-violet-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                    </svg>
                    <span className="text-xs font-medium text-gray-900">Counsel</span>
                  </button>
                )}

                {/* ✅ NEW: Policy Management */}
                {onNavigateToPolicyManagement && capabilities.policy_management && (
                  <button
                    onClick={onNavigateToPolicyManagement}
                    className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-cyan-100 transition-colors"
                  >
                    <Shield className="w-6 h-6 text-cyan-600 mb-1" />
                    <span className="text-xs font-medium text-gray-900">Policies</span>
                  </button>
                )}

                {/* ✅ NEW: Distance Pricing */}
                {onNavigateToDistancePricing && capabilities.distance_pricing && (
                  <button
                    onClick={onNavigateToDistancePricing}
                    className="bg-fuchsia-50 border border-fuchsia-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-fuchsia-100 transition-colors"
                  >
                    <MapPin className="w-6 h-6 text-fuchsia-600 mb-1" />
                    <span className="text-xs font-medium text-gray-900">Pricing</span>
                  </button>
                )}

                {/* Cafe Menu Management */}
                {onNavigateToCafeMenuManagement && capabilities.menu && (
                  <button
                    onClick={onNavigateToCafeMenuManagement}
                    className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-orange-100 transition-colors"
                  >
                    <svg className="w-6 h-6 text-orange-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <span className="text-xs font-medium text-gray-900">Menu</span>
                  </button>
                )}

                {/* Cafe Tables Management */}
                {onNavigateToCafeTables && capabilities.cafe_tables && (
                  <button
                    onClick={onNavigateToCafeTables}
                    className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-amber-100 transition-colors"
                  >
                    <svg className="w-6 h-6 text-amber-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    <span className="text-xs font-medium text-gray-900">Tables</span>
                  </button>
                )}
              </div>
            </div>
          )}

        {/* Stats Dashboard - Conditionally Rendered */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex gap-2 mb-3">
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

          <div className="grid grid-cols-3 gap-3">
            {/* ✅ PHARMACY FIX: Show Orders first for Pharmacy, Appointments for others */}
            {isPharmacy ? (
              <>
                {/* Orders Stat - Primary for Pharmacy */}
                <div key="stat-orders" className="text-center p-3 bg-blue-50 rounded-lg">
                  <ShoppingBag className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-gray-900">{stats.activeOrders || 0}</div>
                  <div className="text-xs text-gray-500">Orders</div>
                </div>
                {/* Prescriptions Stat - Secondary for Pharmacy */}
                <div key="stat-prescriptions" className="text-center p-3 bg-purple-50 rounded-lg">
                  <FileText className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                  <div className="text-2xl font-bold text-gray-900">{stats.completedServices || 0}</div>
                  <div className="text-xs text-gray-500">Rx Verified</div>
                </div>
              </>
            ) : (
              <>
                {/* ✅ Stat card with role-aware labels - Always show for non-pharmacy (receive bookings) */}
                {!isPharmacy && (
                  <button
                    key="stat-appointments"
                    onClick={() => {
                      setActiveBottomTab('bookings');
                      onNavigateToBookingManagement?.();
                    }}
                    className={`text-center p-3 ${colorScheme.secondary} rounded-lg hover:shadow-md transition-all cursor-pointer border-2 border-transparent hover:border-[#FF8C42]`}
                  >
                    <Calendar className={`w-5 h-5 ${colorScheme.primary} mx-auto mb-1`} />
                    <div className="text-2xl font-bold text-gray-900">{stats.appointments}</div>
                    <div className="text-xs text-gray-500">{labels.bookings}</div>
                    <div className="text-[10px] text-[#FF8C42] mt-1">Tap to view</div>
                  </button>
                )}

                {/* Orders Stat (if booking is disabled or orders enabled) */}
                {capabilities.orders && (
                  <div key="stat-orders" className={`text-center p-3 bg-blue-50 rounded-lg`}>
                    <ShoppingBag className={`w-5 h-5 text-blue-600 mx-auto mb-1`} />
                    <div className="text-2xl font-bold text-gray-900">{stats.activeOrders || 0}</div>
                    <div className="text-xs text-gray-500">Orders</div>
                  </div>
                )}

                {/* ✅ Sessions/Consultations Stat with role-aware labels - Always show for non-pharmacy */}
                {!isPharmacy && (capabilities.tele || CapabilityHelper.hasBooking(capabilities)) && (
                  <button
                    key="stat-consultations"
                    onClick={() => {
                      if (capabilities.tele) {
                        onNavigateToTeleConsultation?.();
                      } else {
                        setActiveBottomTab('bookings');
                        onNavigateToBookingManagement?.();
                      }
                    }}
                    className={`text-center p-3 ${colorScheme.secondary} rounded-lg hover:shadow-md transition-all cursor-pointer border-2 border-transparent hover:border-[#FF8C42]`}
                  >
                    <Users className={`w-5 h-5 ${colorScheme.primary} mx-auto mb-1`} />
                    <div className="text-2xl font-bold text-gray-900">{stats.consultations}</div>
                    <div className="text-xs text-gray-500">{labels.sessions}</div>
                    <div className="text-[10px] text-[#FF8C42] mt-1">Tap to view</div>
                  </button>
                )}
              </>
            )}

            {/* Earnings Stat - Always show */}
            <div key="stat-earnings" className="text-center p-3 bg-green-50 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600 mx-auto mb-1" />
              <div className="text-2xl font-bold text-green-600">₹{stats.earnings.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Earnings</div>
            </div>
          </div>
        </div>

        {/* 🗓️ TODAY'S SCHEDULE - Open appointments on landing page (always for non-pharmacy) */}
        {!isPharmacy && (
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-center mb-3">
              {activeTab === 'today' ? labels.todayLabel : activeTab === 'week' ? `This Week's ${labels.bookings}` : `This Month's ${labels.bookings}`}
            </h2>

            {/* Appointment Type Filter */}
            <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
              <button onClick={() => setAppointmentTypeFilter('all')} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${appointmentTypeFilter === 'all' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-600'}`}>All Types</button>

              {/* ✅ Filter service style tabs based on selectedServiceStyles from backend with role-aware labels */}
              {selectedServiceStyles.includes('at_center') && (
                <button onClick={() => setAppointmentTypeFilter('clinic')} className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${appointmentTypeFilter === 'clinic' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  <Stethoscope className="w-3.5 h-3.5" /> {labels.atCenterLabel}
                </button>
              )}

              {selectedServiceStyles.includes('at_home') && (
                <button onClick={() => setAppointmentTypeFilter('home')} className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${appointmentTypeFilter === 'home' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  <Home className="w-3.5 h-3.5" /> {labels.atHomeLabel}
                </button>
              )}

              {selectedServiceStyles.includes('tele') && capabilities.tele && (
                <button onClick={() => setAppointmentTypeFilter('tele')} className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${appointmentTypeFilter === 'tele' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  <Monitor className="w-3.5 h-3.5" /> {labels.teleLabel}
                </button>
              )}
            </div>

            {todaySchedule.length === 0 ? (
              <div className="text-center py-8 px-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Calendar className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-gray-900 font-semibold mb-1">No {labels.bookings} Yet</h3>
                <p className="text-sm text-gray-500 mb-4 max-w-[250px] mx-auto">
                  Share your profile with {labels.customers.toLowerCase()} to start getting {labels.bookings.toLowerCase()}!
                </p>
                <button
                  onClick={async () => {
                    const shareData = {
                      title: vendor?.businessName || 'My Pet Service',
                      text: `Book your pet appointment with ${vendor?.businessName || 'us'} on Warmpawz!`,
                      url: window.location.origin
                    };

                    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
                      try {
                        await navigator.share(shareData);
                      } catch (err) {
                        console.error('Share failed:', err);
                      }
                    } else {
                      copyTextToClipboard(window.location.origin);
                      alert('Profile link copied to clipboard!');
                    }
                  }}
                  className="px-4 py-2 bg-[#FF8C42] hover:bg-[#FF7A2E] text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Share Profile
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-end mb-2">
                  <button className="text-sm text-[#FF8C42]" onClick={() => { onNavigateToBookingManagement ? onNavigateToBookingManagement() : router.push('/bookings'); }}>View All →</button>
                </div>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {todaySchedule
                    .filter(appointment => {
                      if (appointmentTypeFilter === 'all') return true;
                      const typeMap: Record<string, string> = {
                        'at_center': 'clinic',
                        'clinic': 'clinic',
                        'at_home': 'home',
                        'home': 'home',
                        'tele': 'tele',
                        'teleconsultation': 'tele'
                      };
                      return typeMap[appointment.serviceType?.toLowerCase()] === appointmentTypeFilter;
                    })
                    .map(appointment => {
                      const serviceType = appointment.serviceType?.toLowerCase();
                      let typeIcon = Stethoscope;
                      let typeColor = 'bg-blue-100';
                      let typeTextColor = 'text-blue-700';
                      let typeLabel = 'Clinic';

                      if (serviceType === 'at_home' || serviceType === 'home') {
                        typeIcon = Home;
                        typeColor = 'bg-green-100';
                        typeTextColor = 'text-green-700';
                        typeLabel = 'Home Visit';
                      } else if (serviceType === 'tele' || serviceType === 'teleconsultation') {
                        typeIcon = Monitor;
                        typeColor = 'bg-purple-100';
                        typeTextColor = 'text-purple-700';
                        typeLabel = 'Tele';
                      }

                      const TypeIcon = typeIcon;

                      return (
                        <div key={appointment.id} className="bg-white border-2 border-gray-200 rounded-xl p-3 hover:border-[#FF8C42] transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="flex flex-col items-center gap-1">
                              <div className={`w-12 h-12 ${typeColor} rounded-xl flex items-center justify-center`}>
                                <TypeIcon className={`w-6 h-6 ${typeTextColor}`} />
                              </div>
                              <span className={`text-xs font-medium ${typeTextColor}`}>{typeLabel}</span>
                            </div>

                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm font-semibold text-gray-900">{appointment.time}</span>
                                </div>
                                <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">{appointment.status}</span>
                              </div>
                              {/* ✅ FIX: Add labels for better clarity */}
                              <div className="flex items-center gap-1 mb-1">
                                <User className="w-3 h-3 text-gray-400" />
                                <span className="text-xs text-gray-500">Customer:</span>
                                <span className="text-sm font-medium text-gray-900">{appointment.customerName}</span>
                              </div>
                              <div className="text-sm font-medium text-gray-900 mb-1">{appointment.petName} {appointment.petBreed ? `(${appointment.petBreed})` : ''}</div>
                              <div className="flex items-center gap-1 mb-2">
                                <span className="text-xs text-gray-500">Service:</span>
                                <span className="text-xs font-medium text-[#FF8C42]">{appointment.serviceName}</span>
                              </div>

                              <div className="flex gap-2 flex-wrap">
                                <button
                                  onClick={() => {
                                    setSelectedAppointment(appointment);
                                    setAppointmentDetailModalOpen(true);
                                  }}
                                  className="flex-1 min-w-[80px] py-1.5 px-3 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium flex items-center justify-center gap-1"
                                >
                                  Details
                                </button>
                                <button
                                  onClick={() => window.location.href = `tel:${appointment.customerPhone}`}
                                  className="flex-1 min-w-[80px] py-1.5 px-3 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium flex items-center justify-center gap-1"
                                >
                                  <Phone className="w-3.5 h-3.5" /> Call
                                </button>
                                {/* ✅ NEW: Complete Service button with OTP */}
                                {(appointment.status === 'confirmed' || appointment.status === 'in_progress' || appointment.status === 'arrived') && (
                                  <button
                                    onClick={() => {
                                      setSelectedAppointment(appointment);
                                      setShowOtpModal(true);
                                      setOtp('');
                                      setOtpError(null);
                                    }}
                                    className="flex-1 min-w-[100px] py-1.5 px-3 bg-green-500 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1 hover:bg-green-600"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                                  </button>
                                )}
                                {capabilities.chat && (
                                  <button
                                    onClick={() => {
                                      setSelectedAppointment(appointment);
                                      setCommunicationMode('chat');
                                    }}
                                    className="relative flex-1 min-w-[80px] py-1.5 px-3 bg-[#FF8C42] text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" /> Chat
                                    {appointment.hasUnreadMessages && (
                                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                                    )}
                                  </button>
                                )}
                                {/* TELE: P2P video call (Chime, in-app) */}
                                {(serviceType === 'tele' || serviceType === 'teleconsultation') && (
                                  <button
                                    type="button"
                                    disabled={appointment.status === 'completed' || appointment.status === 'cancelled' || !appointment.bookingId}
                                    onClick={async (e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const bid = appointment.bookingId || appointment.id;
                                      
                                      // ✅ VALIDATION: Only allow video call for valid booking statuses
                                      if (!bid) {
                                        toast.error('Booking ID is missing');
                                        return;
                                      }
                                      
                                      const validStatuses = ['confirmed', 'in_progress', 'active', 'arrived'];
                                      if (!validStatuses.includes(appointment.status?.toLowerCase())) {
                                        toast.error(`Video call is not available. Booking status: ${appointment.status}`);
                                        return;
                                      }
                                      
                                      // ✅ VALIDATION: Check if meeting exists or can be created
                                      try {
                                        toast.info('Preparing video call...');
                                        
                                        // Create meeting then notify customer (so they see incoming call) before navigating
                                        const createRes = await apiClient.post('/video-call/create-meeting', {
                                          bookingId: bid,
                                          customerId: (appointment as any).customerId || '',
                                          vendorId: vendorData?.id || vendorId,
                                        }) as any;
                                        
                                        if (!createRes?.success && !createRes?.meetingId) {
                                          toast.error('Failed to create video call. Please try again.');
                                          return;
                                        }
                                        
                                        const effectiveVendorId = vendorData?.id || vendorId;
                                        apiClient.post('/video-call/notify-ready', {
                                          bookingId: bid,
                                          participantType: 'vendor',
                                          participantId: effectiveVendorId,
                                        }).catch(() => {});
                                        
                                        window.location.href = `/video/${bid}?vendorId=${encodeURIComponent(effectiveVendorId)}`;
                                      } catch (err: any) {
                                        console.error('Error starting video call:', err);
                                        toast.error(err?.message || 'Failed to start video call');
                                      }
                                    }}
                                    className="flex-1 min-w-[80px] py-1.5 px-3 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium flex items-center justify-center gap-1 hover:bg-purple-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <Video className="w-3.5 h-3.5" /> Join
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </>
            )}
          </div>
        )}

        {/* 📦 YOUR SERVICES / PRODUCTS — for pharmacy show Orders instead */}
        {isPharmacy && (
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-center mb-3">Prescription Orders</h2>
            <div className="flex items-center justify-center mb-2">
              <button className="text-sm text-[#FF8C42]" onClick={() => router.push('/pharmacy/orders')}>
                View Orders →
              </button>
            </div>
            <p className="text-xs text-gray-500 text-center">
              Accept orders, confirm availability, and raise proforma invoice.
            </p>
          </div>
        )}
        {(capabilities.catalog || capabilities.booking || capabilities.services || hasVendorRole(vendorData, ['pet_cafe', 'cafe', 'pet_insurance', 'insurance', 'pet_holidays', 'holidays', 'pet_resort', 'resort', 'pet_ambulance', 'ambulance'])) && !isPharmacy && (
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-center mb-3">
              {capabilities.catalog && !capabilities.booking ? 'Your Products' : 'Your Services'}
            </h2>
            <div className="flex items-center justify-center mb-2">
              <button className="text-sm text-[#FF8C42]" onClick={() => router.push('/services')}>See All →</button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 justify-center">
              <button
                onClick={() => router.push('/services')}
                className="flex-shrink-0 w-16 h-16 bg-purple-100 rounded-xl flex flex-col items-center justify-center hover:bg-purple-200 transition-colors"
              >
                <Plus className="w-6 h-6 text-purple-600 mb-1" />
                <span className="text-xs">Add</span>
              </button>
              {Array.isArray(services) && services.slice(0, 4).map((service) => (
                <div key={service.serviceId} className="flex-shrink-0 w-16 h-16 bg-blue-100 rounded-xl flex flex-col items-center justify-center">
                  {capabilities.catalog && !capabilities.booking ? (
                    <Package className="w-6 h-6 text-blue-600 mb-1" />
                  ) : (
                    <Activity className="w-6 h-6 text-blue-600 mb-1" />
                  )}
                  <span className="text-xs truncate w-full text-center px-1">{service.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Watchlisted Patients */}
        {capabilities.medical_records && watchlist.length > 0 && (
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">Watchlisted</h2>
              <button className="flex items-center gap-1 text-sm text-[#FF8C42]">
                <Plus className="w-4 h-4" />
                Add visit
              </button>
            </div>
            <div className="space-y-2">
              {watchlist.slice(0, 3).map(patient => (
                <div key={patient.watchlistId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold text-blue-600">
                      {patient.customerName.split(' ').map((n, idx) => n[0]).join('')}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{patient.customerName}</div>
                    <div className="text-xs text-gray-500">{patient.petName}</div>
                    <div className="text-xs text-gray-400">{patient.issue}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">{formatTimeAgo(patient.lastUpdated)}</div>
                    <ChevronRight className="w-4 h-4 text-gray-400 ml-auto mt-1" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom padding for fixed nav */}
        <div className="pb-24"></div>

        {/* Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10">
          <div className="max-w-[430px] mx-auto flex items-center justify-around py-3">
            <button
              onClick={() => setActiveBottomTab('home')}
              className={`flex flex-col items-center gap-1 ${activeBottomTab === 'home' ? 'text-[#FF8C42]' : 'text-gray-400'
                }`}
            >
              <Home className="w-6 h-6" />
              <span className="text-xs">Home</span>
            </button>

            {/* ✅ PHARMACY: Orders tab goes to Pharmacy Orders page (accept orders, prescriptions, proforma) */}
            {isPharmacy ? (
              <button
                onClick={() => router.push('/pharmacy/orders')}
                className="flex flex-col items-center gap-1 text-gray-400 hover:text-[#FF8C42]"
              >
                <ClipboardList className="w-6 h-6" />
                <span className="text-xs">Orders</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  onNavigateToBookingManagement?.();
                  setActiveBottomTab('bookings');
                }}
                className={`flex flex-col items-center gap-1 ${activeBottomTab === 'bookings' ? 'text-[#FF8C42]' : 'text-gray-400'
                  }`}
              >
                <Calendar className="w-6 h-6" />
                <span className="text-xs">{labels.bookings}</span>
              </button>
            )}

            <button
              onClick={() => setActiveBottomTab('reporting')}
              className={`flex flex-col items-center gap-1 ${activeBottomTab === 'reporting' ? 'text-[#FF8C42]' : 'text-gray-400'
                }`}
            >
              <BarChart3 className="w-6 h-6" />
              <span className="text-xs">Reporting</span>
            </button>

            <button
              onClick={() => router.push('/settings')}
              className={`flex flex-col items-center gap-1 ${activeBottomTab === 'settings' ? 'text-[#FF8C42]' : 'text-gray-400'
                }`}
            >
              <Settings className="w-6 h-6" />
              <span className="text-xs">Settings</span>
            </button>
          </div>
        </div>

      </div>

      {/* Modals */}
      <VendorNotificationModal
        vendorId={vendorId}
        open={notificationModalOpen}
        onClose={() => setNotificationModalOpen(false)}
        onNotificationsRead={() => fetchDashboardData(true)}
      />

      {/* Communication Hub (Unified Chat/Video) */}
      {communicationMode && selectedAppointment && (
        <Suspense fallback={null}>
          <CommunicationHub
            mode={communicationMode}
            bookingId={selectedAppointment.bookingId}
            userId={vendorData?.phone || vendorData?.mobile || '+91'}
            userName={vendorData?.fullName || vendorData?.businessName || 'Vendor'}
            otherUserName={selectedAppointment.customerName}
            userType="vendor"
            onClose={() => {
              setCommunicationMode(null);
              setSelectedAppointment(null);
              fetchDashboardData(true); // Reload to clear unread badges
            }}
          />
        </Suspense>
      )}

      {/* Appointment Detail Modal */}
      {appointmentDetailModalOpen && selectedAppointment && (
        <Suspense fallback={null}>
          <AppointmentDetailModal
            bookingId={selectedAppointment.bookingId}
            vendorData={vendorData}
            roleId={vendorData?.roleId || vendorData?.role_id}
            roleName={roleName}
            capabilities={capabilities}
            onClose={() => {
              setAppointmentDetailModalOpen(false);
              setSelectedAppointment(null);
            }}
            onRefresh={() => fetchDashboardData(true)}
          />
        </Suspense>
      )}

      {/* ✅ NEW: OTP Modal for Completing Appointments */}
      {showOtpModal && selectedAppointment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Complete Service</h3>
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
              Ask the customer for the 6-digit OTP sent to their phone to complete the service.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter OTP
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit OTP"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                maxLength={6}
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
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                disabled={processingOtp}
              >
                Cancel
              </button>
              <button
                onClick={handleCompleteWithOtp}
                disabled={otp.length !== 4 || processingOtp}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processingOtp ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Verify & Complete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Analytics */}
      {activeBottomTab === 'reporting' && (
        <div className="fixed inset-0 bg-gray-50 z-20 overflow-y-auto pb-24">
          <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading analytics...</div>}>
            <VendorAnalytics
              vendorId={vendorId}
              vendorData={vendorData}
              onBack={() => setActiveBottomTab('home')}
            />
          </Suspense>
        </div>
      )}

      {/* Vendor Settings - navigates to /settings (mobile-optimized VendorSettingsScreen) */}

      {/* AI Support Chat Widget for Vendors */}
      <Suspense fallback={null}>
        <ChatWidget
          userId={vendorId}
          userName={vendor?.fullName || vendor?.businessName || 'Vendor'}
          userType="vendor"
        />
      </Suspense>

      {/* Capability Debug Overlay (Dev Only) */}
      <CapabilityDebugOverlay
        roleId={vendorData?.roleId || 'unknown'}
        roleName={roleName || 'Unknown Role'}
        capabilities={capabilities}
        vendorData={vendorData}
      />

    </div>
  );
}