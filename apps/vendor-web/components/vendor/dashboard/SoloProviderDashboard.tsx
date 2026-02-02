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

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { clearVendorSession } from '@/lib/session-utils';
import { useVendorCapabilities } from '../hooks/useVendorCapabilities';
import { getRoleIcon, getRoleColorScheme } from '@/lib/vendor-icon-themes';
import { hasVendorRole } from '@/lib/vendor-utils';
import CapabilityHelper from '@/lib/capability-helper';
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
  FileText,
  Gift,
  Heart,
  MapPin,
  CheckCircle2,
  X,
  DollarSign,
  Briefcase,
  ClipboardList
} from 'lucide-react';
import { Badge } from '../../ui/badge';
import { VendorAnalytics } from '../VendorAnalytics';
import { VendorSettingsScreen } from '../VendorSettingsScreen';
import { VendorNotificationModal } from '../VendorNotificationModal';
import { CommunicationHub } from '../../communication/CommunicationHub';
import { AppointmentDetailModal } from '../AppointmentDetailModal';
import { AIChatBot } from '../../customer/AIChatBot';
import { CapabilityDebugOverlay } from '../CapabilityDebugOverlay';
import { DashboardStats } from '../../shared/DashboardStats';
import { AppointmentCard } from '../../shared/AppointmentCard';
import { toast } from 'sonner';
import { Navigation, Map, Radio } from 'lucide-react';

interface SoloProviderDashboardProps {
  session: {
    vendorId: string;
    centerId: string;
    staffId: string;
    isSoloProvider: boolean;
    ownerName: string;
    businessName?: string;
    roleName: string;
    defaultMode?: 'CENTER' | 'STAFF';
  };
  vendorData: any;
}

interface DashboardStats {
  appointments: number;
  consultations: number;
  earnings: number;
  pendingEarnings: number;
  completedServices: number;
  rating: number;
  totalReviews: number;
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
  hasUnreadMessages?: boolean;
  unreadMessageCount?: number;
  chatEnabled?: boolean;
  isFollowUp?: boolean;
}

// Helper to format booking time
function formatBookingTime(time: string): string {
  if (!time) return 'N/A';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

export function SoloProviderDashboard({ session, vendorData }: SoloProviderDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'month'>('today');
  const [activeBottomTab, setActiveBottomTab] = useState<'home' | 'bookings' | 'reporting' | 'settings'>('home');
  // Solo providers don't have at_center - only at_home and tele
  const [appointmentTypeFilter, setAppointmentTypeFilter] = useState<'all' | 'home' | 'tele'>('all');
  
  const [stats, setStats] = useState<DashboardStats>({
    appointments: 0,
    consultations: 0,
    earnings: 0,
    pendingEarnings: 0,
    completedServices: 0,
    rating: 4.8,
    totalReviews: 0,
  });
  const [todaySchedule, setTodaySchedule] = useState<ScheduleItem[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vendor, setVendor] = useState(vendorData);
  
  // Modals
  const [notificationModalOpen, setNotificationModalOpen] = useState(false);
  const [communicationMode, setCommunicationMode] = useState<'chat' | 'video' | null>(null);
  const [appointmentDetailModalOpen, setAppointmentDetailModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<ScheduleItem | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  
  // OTP modal for completing appointments
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [processingOtp, setProcessingOtp] = useState(false);
  const [otpAction, setOtpAction] = useState<'start' | 'complete'>('complete');
  
  // GPS tracking state
  const [isTracking, setIsTracking] = useState<{ [key: string]: boolean }>({});
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
  
  // Service styles allowed for solo provider (no at_center)
  const allowedServiceStyles = vendorData?.allowedServiceStyles || vendorData?.serviceStyles || ['at_home', 'tele'];
  
  // Check if custom_services capability is enabled
  const hasCustomServices = capabilities.custom_services || capabilities.customServices || false;
  const hasPackagesCapability = capabilities.package_management || capabilities.packages || false;
  
  // ✅ Check if trainer/walker/sitter/groomer who can create session packages (solo trainer, solo groomer)
  const isTrainerWalkerSitter = hasVendorRole(vendorData, ['pet_trainer', 'trainer', 'trainer_solo', 'pet_walker', 'walker', 'dog_walker', 'pet_sitter', 'sitter', 'pet_groomer', 'groomer', 'groomer_solo']);
  const isPharmacy = hasVendorRole(vendorData, ['pharmacy', 'pet_pharmacy']);
  
  // ✅ Solo trainers/walkers/sitters CAN create session packages even without explicit package capability
  const hasPackages = hasPackagesCapability || isTrainerWalkerSitter;
  
  // Get role theme
  const roleIcon = getRoleIcon(vendorData?.roleId);
  const colorScheme = getRoleColorScheme(vendorData?.roleId);
  
  const vendorId = session.vendorId;

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      console.log('📊 [Solo] Fetching dashboard data for:', vendorId);

      // Fetch dashboard stats
      const dashboardRes = await apiClient.get<any>(`/vendor/dashboard/${vendorId}?timeframe=${activeTab}`).catch(() => ({ success: false }));
      
      if (dashboardRes && dashboardRes.success) {
        setStats(dashboardRes.stats || dashboardRes.data?.stats || {
          appointments: 0,
          consultations: 0,
          earnings: 0,
          pendingEarnings: 0,
          completedServices: 0,
          rating: 4.8,
          totalReviews: 0,
        });
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
      if (notificationsRes && notificationsRes.success) {
        setNotifications(notificationsRes.notifications || []);
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
      
      // Check profile completion
      if (profileRes && profileRes.success) {
        const profile = profileRes.vendor || profileRes;
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

  // GPS tracking functions
  const startLocationTracking = async (bookingId: string, customerLat: string, customerLng: string) => {
    if (!vendorId) return;

    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const location = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };

            // Start location sharing
            const appointment = todaySchedule.find(a => a.bookingId === bookingId);
            await apiClient.post<any>('/location/start-sharing', {
              bookingId,
              vendorId: vendorId,
              customerId: (appointment as any)?.customerId || 'unknown',
              location,
            });

            setIsTracking(prev => ({ ...prev, [bookingId]: true }));
            setTrackingLocation(prev => ({
              ...prev,
              [bookingId]: {
                lat: location.latitude,
                lng: location.longitude,
                updated: new Date().toISOString(),
              },
            }));

            // Update location every 45s, throttled to min 30s between server updates (P3 performance)
            const throttleKey = `gps_last_sent_${bookingId}`;
            const interval = setInterval(async () => {
              const now = Date.now();
              if ((window as any)[throttleKey] && now - (window as any)[throttleKey] < 30000) return;
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  async (pos) => {
                    const loc = {
                      latitude: pos.coords.latitude,
                      longitude: pos.coords.longitude,
                    };

                    try {
                      await apiClient.post<any>('/location/update', {
                        bookingId,
                        location: loc,
                      });
                      (window as any)[throttleKey] = Date.now();

                      setTrackingLocation(prev => ({
                        ...prev,
                        [bookingId]: {
                          lat: loc.latitude,
                          lng: loc.longitude,
                          updated: new Date().toISOString(),
                        },
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
                    console.error('Error getting location:', error);
                    if (error?.code === error?.TIMEOUT || error?.code === 3) {
                      toast.error('Location timed out. Check signal; tracking will retry.');
                    }
                  }
                );
              }
            }, 45000);

            // Store interval ID for cleanup
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
    try {
      await apiClient.post<any>('/location/stop-sharing', { bookingId });
      
      // Clear interval
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
      const data = await apiClient.post<any>(`/vendor/bookings/${selectedAppointment.bookingId}/otp/verify`, {
        otp,
        action: otpAction
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

  const displayAddress = (() => {
    const a = vendor?.address ?? vendorData?.address;
    if (!a) return '';
    if (typeof a === 'string') return a;
    return [a.line1, a.line2, a.city, a.state].filter(Boolean).join(', ') || '';
  })();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[430px] mx-auto bg-white min-h-screen">
        {/* Header */}
        <div className="p-4 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${colorScheme.primary} rounded-lg flex items-center justify-center`}>
                <span className="text-2xl">{roleIcon}</span>
              </div>
              <div>
                <h1 className="font-semibold text-gray-900">
                  {vendor?.ownerName || vendor?.owner_name || vendor?.fullName || vendor?.full_name || session.ownerName || 'Solo Provider'}
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
                <MessageSquare className="w-5 h-5 text-gray-400" />
              )}

              <button 
                className="relative"
                onClick={() => setNotificationModalOpen(true)}
              >
                <Bell className="w-5 h-5 text-gray-400 hover:text-[#FF8C42] transition-colors" />
                {notifications.filter((n: any) => !n.isRead).length > 0 && (
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
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span className="text-sm font-semibold">{stats.rating.toFixed(1)}</span>
              <span className="text-xs text-gray-500">({stats.totalReviews} reviews)</span>
            </div>
          </div>

          {/* Service Availability Note - for non-pharmacy service providers */}
          {!isPharmacy && (
            <div className="mt-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-orange-600" />
                <span className="text-gray-700">
                  Service Types: <span className="font-semibold text-orange-600">
                    {allowedServiceStyles.includes('at_home') && 'Home Visit'}
                    {allowedServiceStyles.includes('at_home') && allowedServiceStyles.includes('tele') && ', '}
                    {allowedServiceStyles.includes('tele') && 'Tele-consultation'}
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>

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
            {!isPharmacy && (capabilities.booking || CapabilityHelper.hasCapability(capabilities, 'services') || hasVendorRole(vendorData, ['pet_cafe', 'cafe', 'pet_insurance', 'insurance', 'pet_holidays', 'holidays', 'pet_resort', 'resort', 'pet_ambulance', 'ambulance'])) && (
              <button
                onClick={() => router.push('/services/manage')}
                className="flex-1 min-w-[140px] bg-white border-2 border-indigo-500 text-indigo-600 rounded-xl p-4 flex flex-col items-center justify-center hover:bg-indigo-500 hover:text-white transition-colors group text-center"
              >
                <Package className="w-6 h-6 mb-2" />
                <span className="font-semibold text-sm">Manage Services</span>
              </button>
            )}
            
            {/* Schedule Management - for non-pharmacy (all service providers) */}
            {!isPharmacy && (
              <button
                onClick={() => router.push('/solo/schedule')}
                className="flex-1 min-w-[140px] bg-white border-2 border-green-500 text-green-600 rounded-xl p-4 flex flex-col items-center justify-center hover:bg-green-500 hover:text-white transition-colors group text-center"
              >
                <Calendar className="w-6 h-6 mb-2" />
                <span className="font-semibold text-sm">Schedule</span>
              </button>
            )}
            
            {/* Custom Services - hidden for pharmacy */}
            {!isPharmacy && hasCustomServices && (
              <button
                onClick={() => router.push('/services')}
                className="flex-1 min-w-[140px] bg-white border-2 border-[#FF8C42] text-[#FF8C42] rounded-xl p-4 flex flex-col items-center justify-center hover:bg-[#FF8C42] hover:text-white transition-colors group text-center"
              >
                <Activity className="w-6 h-6 mb-2" />
                <span className="font-semibold text-sm">Custom Services</span>
              </button>
            )}
            
            {/* Session Packages - hidden for pharmacy */}
            {!isPharmacy && hasPackages && (
              <button
                onClick={() => router.push('/packages')}
                className={`flex-1 min-w-[140px] bg-white border-2 ${isTrainerWalkerSitter ? 'border-green-500 text-green-600 hover:bg-green-500' : 'border-purple-500 text-purple-600 hover:bg-purple-500'} rounded-xl p-4 flex flex-col items-center justify-center hover:text-white transition-colors group text-center`}
              >
                <Gift className="w-6 h-6 mb-2" />
                <span className="font-semibold text-sm">
                  {isTrainerWalkerSitter ? 'Session Packages' : 'Packages'}
                </span>
                {isTrainerWalkerSitter && (
                  <span className="text-xs mt-1 opacity-70 group-hover:opacity-100">Track sessions & usage</span>
                )}
              </button>
            )}
          </div>
          
          {/* Info Banner - Pharmacy: Orders + proforma only; others: Solo Provider */}
          <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              {isPharmacy ? (
                <><strong>Pharmacy:</strong> Receive prescription orders, confirm availability, and send proforma invoice. Customer approves and pays; then track delivery.</>
              ) : (
                <><strong>Solo Provider Mode:</strong> You provide services directly to customers via home visits or tele-consultation. Use "Manage Services" to enable and publish services from the platform catalog.{hasCustomServices && ' You can also create custom services using the "Custom Services" option.'}</>
              )}
            </p>
          </div>
        </div>

        {/* Additional Capabilities Section - hidden for pharmacy */}
        {!isPharmacy && (capabilities.progress_tracking || capabilities.distance_pricing || capabilities.counseling) && (
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-3">Additional Features</h2>
            <div className="grid grid-cols-3 gap-2">
              {capabilities.progress_tracking && (
                <button
                  onClick={() => router.push('/training/progress')}
                  className="bg-green-50 border border-green-200 rounded-lg p-3 flex flex-col items-center justify-center hover:bg-green-100 transition-colors"
                >
                  <TrendingUp className="w-6 h-6 text-green-600 mb-1" />
                  <span className="text-xs font-medium text-gray-900">Progress</span>
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

        {/* Stats Dashboard */}
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

          {/* Use shared DashboardStats component */}
          <DashboardStats
            stats={{
              appointments: stats.appointments,
              consultations: stats.consultations,
              earnings: stats.earnings,
              completedServices: stats.completedServices,
              rating: stats.rating,
              totalReviews: stats.totalReviews,
            }}
            onStatClick={(statType) => {
              if (statType === 'appointments' || statType === 'consultations') {
                router.push('/bookings');
              } else if (statType === 'earnings') {
                setActiveBottomTab('reporting');
              }
            }}
          />
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
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  appointmentTypeFilter === 'all' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                All Types
              </button>
              
              {allowedServiceStyles.includes('at_home') && (
                <button 
                  onClick={() => setAppointmentTypeFilter('home')} 
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    appointmentTypeFilter === 'home' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  <Home className="w-3.5 h-3.5" /> Home Visit
                </button>
              )}
              
              {allowedServiceStyles.includes('tele') && (
                <button 
                  onClick={() => setAppointmentTypeFilter('tele')} 
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    appointmentTypeFilter === 'tele' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600'
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

        {/* Your Services (Custom Services Only) — not for pharmacy */}
        {hasCustomServices && !isPharmacy && (
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-center mb-3">Your Services</h2>
            <div className="flex items-center justify-center mb-2">
              <button className="text-sm text-[#FF8C42]" onClick={() => router.push('/services')}>Manage Services →</button>
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
                <div key={service.id || service.serviceId} className="flex-shrink-0 w-16 h-16 bg-blue-100 rounded-xl flex flex-col items-center justify-center">
                  <Activity className="w-6 h-6 text-blue-600 mb-1" />
                  <span className="text-xs truncate w-full text-center px-1">{service.name || service.service_name}</span>
                </div>
              ))}
            </div>
            {services.length === 0 && (
              <p className="text-xs text-gray-500 text-center mt-2">
                Create custom services to offer to your customers
              </p>
            )}
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
                  router.push('/bookings');
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
              onClick={() => setActiveBottomTab('settings')}
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

      {/* Communication Hub */}
      {communicationMode && selectedAppointment && (
        <CommunicationHub
          mode={communicationMode}
          bookingId={selectedAppointment.bookingId}
          userId={vendorData?.phone || vendorData?.mobile || '+91'}
          userName={vendorData?.fullName || vendorData?.businessName || 'Provider'}
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
              Ask the customer for the 6-digit OTP sent to their phone to {otpAction === 'start' ? 'start' : 'complete'} the service.
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
                className={`flex-1 px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                  otpAction === 'start' 
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
        <div className="fixed inset-0 bg-gray-50 z-20 overflow-y-auto pb-24">
          <VendorAnalytics
            vendorId={vendorId}
            vendorData={vendorData}
            onBack={() => setActiveBottomTab('home')}
          />
        </div>
      )}

      {/* Vendor Settings */}
      {activeBottomTab === 'settings' && (
        <VendorSettingsScreen
          vendorId={vendorId}
          vendorData={vendor || vendorData}
          onBack={() => setActiveBottomTab('home')}
        />
      )}

      {/* AI Support Bot */}
      <AIChatBot 
        customerId={vendorId}
        customerName={vendor?.fullName || vendor?.businessName || 'Provider'} 
      />

      {/* Debug Overlay */}
      <CapabilityDebugOverlay
        roleId={vendorData?.roleId || 'unknown'}
        roleName={roleName || 'Solo Provider'}
        capabilities={capabilities}
        vendorData={vendorData}
      />
    </div>
  );
}
