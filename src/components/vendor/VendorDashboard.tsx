import { useState, useEffect, useMemo, useCallback } from 'react';
import { CapabilityDebugOverlay } from './CapabilityDebugOverlay';
import { ModuleDisabledMessage, ModuleMessages } from './ModuleDisabledMessage';
import { SoloProviderDashboard } from './dashboard/SoloProviderDashboard'; // ✅ INTEGRATION: Solo provider dashboard
import { useVendorCapabilities } from './hooks/useVendorCapabilities';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { getVendorIconTheme, getRoleIcon, getRoleColorScheme } from '../../utils/vendor-icon-themes';
import VendorUtils from '../../utils/vendor-utils';
import CapabilityHelper from '../../utils/capability-helper';
import PerformanceMonitor from '../../utils/performance-monitor';
import Analytics from '../../utils/analytics';
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
  MapPin
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { VendorNotificationModal } from './VendorNotificationModal';
import { CommunicationHub } from './CommunicationHub';
import { AppointmentDetailModal } from './AppointmentDetailModal';
import { VendorAnalytics } from './VendorAnalytics';
import { VendorPaymentSettings } from './VendorPaymentSettings';
import { AIChatBot } from '../customer/AIChatBot';

interface VendorDashboardProps {
  vendorId: string;
  vendorData: any;
  onNavigateToConsultation?: () => void;
  onNavigateToServiceManagement?: () => void;
  onNavigateToBookingManagement?: () => void;
  onNavigateToTeleConsultation?: () => void;
  onNavigateToScheduleManagement?: () => void;
  onNavigateToCenterProfile?: () => void; // ✅ NEW: Navigate to Center Profile Manager
  onNavigateToFacilityManagement?: () => void;
  onNavigateToStaffManagement?: () => void;
  onNavigateToBusinessHub?: () => void;
  onNavigateToLiveTracking?: () => void;
  onNavigateToSpecializedServices?: () => void; // ✅ NEW: Navigate to Vet Specialized Services (Pharmacy, Diagnostics, Ambulance)
  // ✅ NEW: Additional navigation handlers for all capabilities
  onNavigateToGallery?: () => void;
  onNavigateToPortfolio?: () => void;
  onNavigateToCCTV?: () => void;
  onNavigateToControlledSubstances?: () => void;
  onNavigateToPrescription?: () => void;
  onNavigateToProgressTracking?: () => void;
  onNavigateToPackages?: () => void;
  onNavigateToCustomServices?: () => void;
  onNavigateToAdoptionSystem?: () => void;
  onNavigateToMemorialServices?: () => void;
  onNavigateToExpiryManagement?: () => void;
  onNavigateToDonationManagement?: () => void;
  onNavigateToEventManagement?: () => void;
  onNavigateToPatientMonitoring?: () => void;
  onNavigateToCafeMenuManagement?: () => void;
  // ✅ NEW: Additional capability navigation handlers (Phase 2)
  onNavigateToPrescriptionVerification?: () => void;
  onNavigateToDeliveryManagement?: () => void;
  onNavigateToDietCharts?: () => void;
  onNavigateToCounseling?: () => void;
  onNavigateToDistancePricing?: () => void;
  onNavigateToMultiDoctorManagement?: () => void;
  onNavigateToPolicyManagement?: () => void;
}

interface DashboardStats {
  appointments: number;
  consultations: number;
  earnings: number;
  pendingEarnings: number;
  completedServices: number;
  rating: number;
  totalReviews: number;
  activeOrders?: number;
}

interface ScheduleItem {
  id: string;
  bookingId: string;
  time: string;
  duration: number;
  petName: string;
  petBreed?: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  serviceType: string;
  status: string;
  price: number;
  address: string;
  specialInstructions?: string;
  prescriptionUrl?: string;
  prescriptionNotes?: string;
  hasPrescription?: boolean;
  hasUnreadMessages?: boolean;
  unreadMessageCount?: number;
  chatEnabled?: boolean;
  isFollowUp?: boolean;
}

interface WatchlistItem {
  watchlistId: string;
  petName: string;
  customerName: string;
  issue: string;
  lastUpdated: string;
}

interface NotificationItem {
  notificationId: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}

export function VendorDashboard({ 
  vendorId, 
  vendorData, 
  onNavigateToConsultation, 
  onNavigateToServiceManagement, 
  onNavigateToBookingManagement, 
  onNavigateToTeleConsultation, 
  onNavigateToScheduleManagement, 
  onNavigateToCenterProfile, // ✅ NEW: Navigate to Center Profile Manager
  onNavigateToFacilityManagement, 
  onNavigateToStaffManagement, 
  onNavigateToBusinessHub,
  onNavigateToLiveTracking,
  onNavigateToSpecializedServices, // ✅ NEW: Navigate to Vet Specialized Services (Pharmacy, Diagnostics, Ambulance)
  // ✅ NEW: Additional navigation handlers for all capabilities
  onNavigateToGallery,
  onNavigateToPortfolio,
  onNavigateToCCTV,
  onNavigateToControlledSubstances,
  onNavigateToPrescription,
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
  // ✅ NEW: Additional capability navigation handlers (Phase 2)
  onNavigateToPrescriptionVerification,
  onNavigateToDeliveryManagement,
  onNavigateToDietCharts,
  onNavigateToCounseling,
  onNavigateToDistancePricing,
  onNavigateToMultiDoctorManagement,
  onNavigateToPolicyManagement
}: VendorDashboardProps) {
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'month'>('today');
  const [activeBottomTab, setActiveBottomTab] = useState<'home' | 'bookings' | 'reporting' | 'settings'>('home');
  const [appointmentTypeFilter, setAppointmentTypeFilter] = useState<'all' | 'clinic' | 'home' | 'tele'>('all');
  const [stats, setStats] = useState<DashboardStats>({
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

  // 🔌 CORE: Load dynamic capabilities
  const { capabilities, loading: capsLoading, roleName } = useVendorCapabilities(vendorData?.roleId);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;
  
  // ✅ USE UTILITY: Replace duplicated role check with centralized utility
  const isVet = VendorUtils.isVet(vendorData?.roleId);

  // ✅ INTEGRATION: Check if solo provider and route to solo dashboard
  if (VendorUtils.isSoloProvider(vendorData)) {
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
      <SoloProviderDashboard 
        session={soloSession}
        vendorData={vendorData}
      />
    );
  }

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async (showRefresh = false) => {
    try {
      // ✅ PERFORMANCE: Check cache first (unless explicitly refreshing)
      if (!showRefresh) {
        const cacheKey = `dashboard_${vendorId}_${activeTab}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          try {
            const { data, timestamp } = JSON.parse(cached);
            const age = Date.now() - timestamp;
            // Use cache if less than 2 minutes old
            if (age < 120000) {
              console.log('📦 Using cached dashboard data (age:', Math.round(age / 1000), 's)');
              setStats(data.stats);
              setTodaySchedule(data.schedule || []);
              setNotifications(data.notifications || []);
              setServices(data.services || []);
              setWatchlist(data.watchlist || []);
              setVendor(data.vendor);
              setLoading(false);
              return;
            }
          } catch (e) {
            console.warn('Cache parse error, fetching fresh data');
          }
        }
      }

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
      const criticalPromises: Promise<Response | null>[] = [
        // 1. Always fetch dashboard stats
        fetch(`${API_BASE}/vendor/dashboard/${vendorId}?timeframe=${activeTab}`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }),
        
        // 2. Fetch schedule if booking enabled - USE UTILITY
        CapabilityHelper.hasBooking(capabilities)
          ? fetch(`${API_BASE}/vendor/schedule/${vendorId}?date=${today}`, {
              headers: { 'Authorization': `Bearer ${publicAnonKey}` }
            })
          : Promise.resolve(null)
      ];
      
      // Non-critical data: notifications, watchlist, services (can load after)
      const nonCriticalPromises: Promise<Response | null>[] = [
        // 3. Fetch watchlist if medical records enabled - USE UTILITY
        CapabilityHelper.hasMedicalRecords(capabilities)
          ? fetch(`${API_BASE}/vendor/watchlist/${vendorId}`, {
              headers: { 'Authorization': `Bearer ${publicAnonKey}` }
            })
          : Promise.resolve(null),
        
        // 4. Always fetch notifications
        fetch(`${API_BASE}/vendor/notifications/${vendorId}?limit=5`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }),
        
        // 5. Fetch services if catalog or booking enabled - USE UTILITY
        (CapabilityHelper.hasCatalog(capabilities) || CapabilityHelper.hasBooking(capabilities))
          ? fetch(`${API_BASE}/vendor/services/${vendorId}`, {
              headers: { 'Authorization': `Bearer ${publicAnonKey}` }
            })
          : Promise.resolve(null)
      ];
      
      // ✅ OPTIMIZATION: Execute critical fetches first, hide loading screen ASAP
      const [dashboardRes, scheduleRes] = await Promise.all(criticalPromises);
      
      // ✅ OPTIMIZATION: Parse JSON responses in parallel
      const criticalParsing = [];
      
      if (dashboardRes && dashboardRes.ok) {
        criticalParsing.push(
          dashboardRes.json().then(data => {
            if (data.success) {
              setStats(data.stats);
              setVendor(data.vendor);
            }
          })
        );
      }
      
      if (scheduleRes && scheduleRes.ok) {
        criticalParsing.push(
          scheduleRes.json().then(data => {
            if (data.success) {
              setTodaySchedule(data.schedule || []);
            }
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
        const backgroundParsing = [];
        
        // Process watchlist
        if (watchlistRes && watchlistRes.ok) {
          backgroundParsing.push(
            watchlistRes.json().then(data => {
              if (data.success) {
                setWatchlist(data.watchlist || []);
              }
            })
          );
        }
        
        // Process notifications
        if (notificationsRes && notificationsRes.ok) {
          backgroundParsing.push(
            notificationsRes.json().then(data => {
              if (data.success) {
                setNotifications(data.notifications || []);
              }
            })
          );
        }
        
        // Process services
        if (servicesRes && servicesRes.ok) {
          backgroundParsing.push(
            servicesRes.json().then(data => {
              if (data.success) {
                const servicesData = Array.isArray(data.services) ? data.services : [];
                setServices(servicesData);
              }
            }).catch(error => {
              console.error('Error parsing services data:', error);
              setServices([]);
            })
          );
        }
        
        await Promise.all(backgroundParsing);
        console.log('✅ Non-critical dashboard data loaded (background)');
        
        // ✅ PERFORMANCE: Save to cache for next visit (capture all state in closure)
        setTimeout(() => {
          try {
            const cacheKey = `dashboard_${vendorId}_${activeTab}`;
            const cacheData = {
              data: {
                stats,
                schedule: todaySchedule,
                notifications,
                services,
                watchlist,
                vendor
              },
              timestamp: Date.now()
            };
            sessionStorage.setItem(cacheKey, JSON.stringify(cacheData));
          } catch (e) {
            console.warn('Failed to cache dashboard data:', e);
          }
        }, 0);
      }).catch(error => {
        console.error('⚠️ Error loading non-critical data:', error);
      });

    } catch (error) {
      console.error('❌ Error fetching dashboard data:', error);
      setLoading(false);
      setRefreshing(false);
    }
  }, [vendorId, activeTab, capabilities, stats, todaySchedule, notifications, services, watchlist, vendor]); // ✅ FIX: Memoize with proper deps

  // Fetch data on mount and when activeTab changes
  // ✅ PERFORMANCE FIX: Only re-fetch when vendorId or activeTab changes, not on every capability change
  useEffect(() => {
    if (vendorId && !capsLoading) {
      fetchDashboardData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId, activeTab, capsLoading]); // ✅ FIX: Intentionally excluding fetchDashboardData to prevent infinite loop

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

  // 🎨 GET DYNAMIC ICON THEME FOR THIS VENDOR (memoized)
  const iconTheme = useMemo(() => getVendorIconTheme(vendorData?.roleId), [vendorData?.roleId]);
  const RoleIconComponent = useMemo(() => getRoleIcon(vendorData?.roleId), [vendorData?.roleId]);
  const colorScheme = useMemo(() => getRoleColorScheme(vendorData?.roleId), [vendorData?.roleId]);

  // ✅ PERFORMANCE: Memoize filtered schedule to avoid re-filtering on every render
  const filteredSchedule = useMemo(() => {
    return todaySchedule.filter(appointment => {
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
    });
  }, [todaySchedule, appointmentTypeFilter]);

  // ✅ PERFORMANCE: Memoize unread notification count
  const unreadNotificationCount = useMemo(() => {
    return notifications.filter(n => !n.isRead).length;
  }, [notifications]);

  if (loading || capsLoading) {
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
              <div className={`w-10 h-10 ${colorScheme.primary} rounded-lg flex items-center justify-center`}>
                <RoleIconComponent className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-gray-900">
                  {vendor?.businessName || vendor?.fullName || 'Vendor Dashboard'}
                </h1>
                <p className="text-xs text-gray-500">{vendor?.address || 'India'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => fetchDashboardData(true)} disabled={refreshing}>
                <RefreshCw className={`w-5 h-5 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              
              {capabilities.chat && (
                <iconTheme.actions.messages className="w-5 h-5 text-gray-400" />
              )}

              <button 
                className="relative"
                onClick={() => setNotificationModalOpen(true)}
              >
                <iconTheme.actions.notifications className="w-5 h-5 text-gray-400 hover:text-[#FF8C42] transition-colors" />
                {unreadNotificationCount > 0 && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                )}
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

          {/* Service Summary */}
          {capabilities.booking && (
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

        {/* 🧱 DYNAMIC QUICK ACTIONS */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex flex-wrap gap-3">
            {/* Staff Management - For Clinics/Hospitals */}
            {onNavigateToStaffManagement && (capabilities.staff_management || VendorUtils.isHealthcareProvider(vendorData?.roleId)) && (
              <button
                onClick={onNavigateToStaffManagement}
                className="flex-1 min-w-[140px] bg-white border-2 border-[#FF8C42] text-[#FF8C42] rounded-xl p-4 flex flex-col items-center justify-center hover:bg-[#FF8C42] hover:text-white transition-colors group text-center"
              >
                <Users className="w-6 h-6 mb-2" />
                <span className="font-semibold text-sm">Manage Staff</span>
              </button>
            )}
            
            {/* ✅ FIX: Center Profile - Use capability-based check with fallbacks */}
            {onNavigateToCenterProfile && (
              capabilities.facility_management ||  // ✅ PRIMARY: Check capability
              VendorUtils.canOfferCenter(vendorData?.roleId) ||  // ✅ FALLBACK: Check if role can offer center services
              vendorData?.serviceStyle === 'at_center' ||  // ✅ FALLBACK: Check service style
              vendorData?.serviceStyles?.includes('at_center')  // ✅ FALLBACK: Check if array includes at_center
            ) && (
              <button
                onClick={onNavigateToCenterProfile}
                className="flex-1 min-w-[140px] bg-white border-2 border-purple-500 text-purple-600 rounded-xl p-4 flex flex-col items-center justify-center hover:bg-purple-500 hover:text-white transition-colors group text-center"
              >
                <Building2 className="w-6 h-6 mb-2" />
                <span className="font-semibold text-sm">Center Profile</span>
              </button>
            )}
            
            {/* Inventory/Store - For Pet Stores/Pharmacies */}
            {onNavigateToBusinessHub && (capabilities.inventory || VendorUtils.isStore(vendorData?.roleId)) && (
              <button
                onClick={onNavigateToBusinessHub}
                className="flex-1 min-w-[140px] bg-white border-2 border-blue-500 text-blue-600 rounded-xl p-4 flex flex-col items-center justify-center hover:bg-blue-500 hover:text-white transition-colors group text-center"
              >
                <Package className="w-6 h-6 mb-2" />
                <span className="font-semibold text-sm">Inventory & Store</span>
              </button>
            )}
          </div>
        </div>
        
        {/* ✅ CANONICAL: VET-SPECIFIC SERVICES SECTION - For all veterinary roles */}
        {(
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

        {/* ✅ NEW: ADDITIONAL CAPABILITIES QUICK ACTIONS */}
        {(capabilities.gallery || capabilities.portfolio || capabilities.cctv_access || capabilities.controlled_substances || 
          capabilities.prescription || capabilities.progress_tracking || capabilities.package_management || capabilities.custom_services ||
          capabilities.prescription_verification || capabilities.delivery || capabilities.diet_charts || 
          capabilities.counseling || capabilities.policy_management || capabilities.distance_pricing) && (
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
              {onNavigateToPrescription && capabilities.prescription && (
                <button
                  onClick={onNavigateToPrescription}
                  className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-blue-100 transition-colors"
                >
                  <FileText className="w-6 h-6 text-blue-600 mb-1" />
                  <span className="text-xs font-medium text-gray-900">Rx</span>
                </button>
              )}
              
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
              
              {/* Package Management */}
              {onNavigateToPackages && capabilities.package_management && (
                <button
                  onClick={onNavigateToPackages}
                  className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-purple-100 transition-colors"
                >
                  <Gift className="w-6 h-6 text-purple-600 mb-1" />
                  <span className="text-xs font-medium text-gray-900">Packages</span>
                </button>
              )}
              
              {/* Custom Services */}
              {onNavigateToCustomServices && capabilities.custom_services && (
                <button
                  onClick={onNavigateToCustomServices}
                  className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-yellow-100 transition-colors"
                >
                  <Plus className="w-6 h-6 text-yellow-600 mb-1" />
                  <span className="text-xs font-medium text-gray-900">Custom</span>
                </button>
              )}
              
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
            {/* Appointments Stat */}
            {capabilities.booking && (
              <div key="stat-appointments" className={`text-center p-3 ${colorScheme.light} rounded-lg`}>
                <iconTheme.stats.bookings className={`w-5 h-5 ${colorScheme.dark} mx-auto mb-1`} />
                <div className="text-2xl font-bold text-gray-900">{stats.appointments}</div>
                <div className="text-xs text-gray-500">Appointments</div>
              </div>
            )}

            {/* Orders Stat (if booking is disabled or orders enabled) */}
            {capabilities.orders && (
              <div key="stat-orders" className={`text-center p-3 bg-blue-50 rounded-lg`}>
                <ShoppingBag className={`w-5 h-5 text-blue-600 mx-auto mb-1`} />
                <div className="text-2xl font-bold text-gray-900">{stats.activeOrders || 0}</div>
                <div className="text-xs text-gray-500">Orders</div>
              </div>
            )}

            {/* Consultations Stat */}
            {(capabilities.tele || capabilities.booking) && (
              <div key="stat-consultations" className={`text-center p-3 ${colorScheme.light} rounded-lg`}>
                <iconTheme.stats.customers className={`w-5 h-5 ${colorScheme.dark} mx-auto mb-1`} />
                <div className="text-2xl font-bold text-gray-900">{stats.consultations}</div>
                <div className="text-xs text-gray-500">Consultations</div>
              </div>
            )}

            {/* Earnings Stat - Always show */}
            <div key="stat-earnings" className="text-center p-3 bg-green-50 rounded-lg">
              <iconTheme.stats.revenue className="w-5 h-5 text-green-600 mx-auto mb-1" />
              <div className="text-2xl font-bold text-green-600">₹{stats.earnings.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Earnings</div>
            </div>
          </div>
        </div>

        {/* 🗓️ TODAY'S SCHEDULE (Conditional) */}
        {capabilities.booking && (
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-center mb-3">Today's Schedule</h2>
            
            {/* Appointment Type Filter */}
            <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
              <button onClick={() => setAppointmentTypeFilter('all')} className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${appointmentTypeFilter === 'all' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-600'}`}>All Types</button>
              
              <button onClick={() => setAppointmentTypeFilter('clinic')} className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${appointmentTypeFilter === 'clinic' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                <Stethoscope className="w-3.5 h-3.5" /> Clinic
              </button>
              
              <button onClick={() => setAppointmentTypeFilter('home')} className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${appointmentTypeFilter === 'home' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                <Home className="w-3.5 h-3.5" /> Home
              </button>
              
              {capabilities.tele && (
                <button onClick={() => setAppointmentTypeFilter('tele')} className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${appointmentTypeFilter === 'tele' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
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
                  Share your profile with customers to start getting bookings!
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
                  <button className="text-sm text-[#FF8C42]" onClick={onNavigateToBookingManagement}>View All →</button>
                </div>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                  {filteredSchedule.map(appointment => {
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
                                   <Badge>{appointment.status}</Badge>
                                </div>
                                <div className="text-sm font-medium text-gray-900">{appointment.petName}</div>
                                <div className="text-xs text-gray-500">{appointment.customerName} • {appointment.petBreed || 'Pet'}</div>
                                <div className="text-xs font-medium text-[#FF8C42] mt-1 mb-2">{appointment.serviceName}</div>
                                
                                 <div className="flex gap-2">
                                   <button 
                                     onClick={() => {
                                        setSelectedAppointment(appointment);
                                        setAppointmentDetailModalOpen(true);
                                     }}
                                     className="flex-1 py-1.5 px-3 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium flex items-center justify-center gap-1"
                                   >
                                      Details
                                   </button>
                                   <button 
                                     onClick={() => window.location.href = `tel:${appointment.customerPhone}`}
                                     className="flex-1 py-1.5 px-3 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium flex items-center justify-center gap-1"
                                   >
                                      <Phone className="w-3.5 h-3.5" /> Call
                                   </button>
                                   {capabilities.chat && (
                                     <button 
                                       onClick={() => {
                                          setSelectedAppointment(appointment);
                                          setCommunicationMode('chat');
                                       }}
                                       className="relative flex-1 py-1.5 px-3 bg-[#FF8C42] text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1"
                                     >
                                        <MessageSquare className="w-3.5 h-3.5" /> Chat
                                        {appointment.hasUnreadMessages && (
                                          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                                        )}
                                     </button>
                                   )}
                                   {/* TELE-HEALTH DIRECT JOIN */}
                                   {(serviceType === 'tele' || serviceType === 'teleconsultation') && (
                                      <a
                                        href={`https://meet.jit.si/warmpawz-${appointment.bookingId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 py-1.5 px-3 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium flex items-center justify-center gap-1"
                                        onClick={(e) => e.stopPropagation()} 
                                      >
                                         <Video className="w-3.5 h-3.5" /> Join
                                      </a>
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

        {/* 📦 YOUR SERVICES / PRODUCTS */}
        {(capabilities.catalog || capabilities.booking) && (
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-center mb-3">
              {capabilities.catalog && !capabilities.booking ? 'Your Products' : 'Your Services'}
            </h2>
            <div className="flex items-center justify-center mb-2">
              <button className="text-sm text-[#FF8C42]" onClick={onNavigateToServiceManagement}>See All →</button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 justify-center">
              <button 
                onClick={onNavigateToServiceManagement}
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
              className={`flex flex-col items-center gap-1 ${
                activeBottomTab === 'home' ? 'text-[#FF8C42]' : 'text-gray-400'
              }`}
            >
              <div className="w-6 h-6">🏠</div>
              <span className="text-xs">Home</span>
            </button>
            
            {capabilities.booking && (
              <button 
                onClick={() => {
                  onNavigateToBookingManagement?.();
                  setActiveBottomTab('bookings');
                }}
                className={`flex flex-col items-center gap-1 ${
                  activeBottomTab === 'bookings' ? 'text-[#FF8C42]' : 'text-gray-400'
                }`}
              >
                <Calendar className="w-6 h-6" />
                <span className="text-xs">Bookings</span>
              </button>
            )}

            <button 
              onClick={() => setActiveBottomTab('reporting')}
              className={`flex flex-col items-center gap-1 ${
                activeBottomTab === 'reporting' ? 'text-[#FF8C42]' : 'text-gray-400'
              }`}
            >
              <BarChart3 className="w-6 h-6" />
              <span className="text-xs">Reporting</span>
            </button>
            
            <button 
              onClick={() => {
                setActiveBottomTab('settings');
                // onNavigateToFacilityManagement?.(); // Using internal settings now
              }}
              className={`flex flex-col items-center gap-1 ${
                activeBottomTab === 'settings' ? 'text-[#FF8C42]' : 'text-gray-400'
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
      )}

      {/* Appointment Detail Modal */}
      {appointmentDetailModalOpen && selectedAppointment && (
        <AppointmentDetailModal
          bookingId={selectedAppointment.bookingId}
          vendorData={vendorData}
          onClose={() => {
            setAppointmentDetailModalOpen(false);
            setSelectedAppointment(null);
          }}
          onRefresh={() => fetchDashboardData(true)}
        />
      )}

      {/* Vendor Analytics */}
      {activeBottomTab === 'reporting' && (
        <div className="fixed inset-0 bg-gray-50 z-20 overflow-y-auto pb-24">
          <VendorAnalytics
            vendorId={vendorId}
            vendorData={vendorData}
            onBack={() => setActiveBottomTab('home')}
          />
        </div>
      )}

      {/* Vendor Payment Settings */}
      {activeBottomTab === 'settings' && (
        <div className="fixed inset-0 bg-gray-50 z-20 overflow-y-auto pb-24">
          <div className="p-4 bg-white border-b border-gray-200 sticky top-0 z-30 flex items-center gap-3">
            <button onClick={() => setActiveBottomTab('home')} className="p-2 hover:bg-gray-100 rounded-full">
              <ChevronRight className="w-5 h-5 rotate-180 text-gray-600" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900">Settings & Payouts</h2>
          </div>
          <div className="p-4">
            <VendorPaymentSettings vendorId={vendorId} vendorData={vendor || vendorData} />
          </div>
        </div>
      )}

      {/* AI Support Bot for Vendors */}
      <AIChatBot 
        customerId={vendorId} // Using vendorId as customerId for CRM tracking
        customerName={vendor?.fullName || vendor?.businessName || 'Vendor'} 
      />

      {/* Capability Debug Overlay (Dev Only) */}
      <CapabilityDebugOverlay
        roleId={vendorData?.roleId || 'unknown'}
        roleName={roleName}
        capabilities={capabilities}
        vendorData={vendorData}
      />

    </div>
  );
}