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
import { useVendorCapabilities } from '../hooks/useVendorCapabilities';
import { getRoleIcon, getRoleColorScheme } from '@/lib/vendor-icon-themes';
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
  Briefcase
} from 'lucide-react';
import { Badge } from '../../ui/badge';
import { VendorAnalytics } from '../VendorAnalytics';
import { VendorSettingsScreen } from '../VendorSettingsScreen';
import { VendorNotificationModal } from '../VendorNotificationModal';
import { CommunicationHub } from '../../communication/CommunicationHub';
import { AppointmentDetailModal } from '../AppointmentDetailModal';
import { AIChatBot } from '../../customer/AIChatBot';
import { CapabilityDebugOverlay } from '../CapabilityDebugOverlay';

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
  
  // Dashboard warnings state
  const [warnings, setWarnings] = useState({
    profileIncomplete: false,
    bankNotVerified: true,
    servicesNotConfigured: true,
  });
  
  // Handle logout
  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      try {
        await apiClient.post('/auth/logout', {});
      } catch (e) {
        // Ignore logout API errors
      }
      localStorage.removeItem('vendorId');
      localStorage.removeItem('vendorData');
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      router.push('/auth');
    }
  };
  
  // Load capabilities from role
  const { capabilities, loading: capsLoading, roleName, initialLoadComplete } = useVendorCapabilities(vendorData?.roleId);
  
  // Service styles allowed for solo provider (no at_center)
  const allowedServiceStyles = vendorData?.allowedServiceStyles || vendorData?.serviceStyles || ['at_home', 'tele'];
  
  // Check if custom_services capability is enabled
  const hasCustomServices = capabilities.custom_services || capabilities.customServices || false;
  const hasPackages = capabilities.package_management || capabilities.packages || false;
  
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
      
      // Fetch services (only custom services for solo provider)
      if (hasCustomServices || CapabilityHelper.hasBooking(capabilities)) {
        const servicesRes = await apiClient.get<any>(`/vendor/${vendorId}/services`).catch(() => ({ success: false, services: [] }));
        if (servicesRes && servicesRes.success) {
          // Only show custom services (not from predefined catalog)
          const customServices = (servicesRes.services || []).filter((s: any) => 
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

  useEffect(() => {
    if (vendorId && !capsLoading) {
      fetchDashboardData();
    }
  }, [vendorId, activeTab, capsLoading, fetchDashboardData]);

  // OTP handler for completing appointments
  const handleCompleteWithOtp = async () => {
    if (!selectedAppointment) return;
    if (otp.length !== 6) {
      setOtpError('Please enter a valid 6-digit OTP');
      return;
    }

    setProcessingOtp(true);
    setOtpError(null);

    try {
      const data = await apiClient.post<any>(`/vendor/bookings/${selectedAppointment.bookingId}/otp/verify`, {
        otp,
        action: 'complete'
      });
      
      setShowOtpModal(false);
      setOtp('');
      setOtpError(null);
      setSelectedAppointment(null);
      fetchDashboardData(true);
      alert(data.message || 'Service completed successfully!');
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

          {/* Service Availability Note */}
          {capabilities.booking && (
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
            
            {/* Custom Services - Only show if capability is enabled */}
            {hasCustomServices && (
              <button
                onClick={() => router.push('/services')}
                className="flex-1 min-w-[140px] bg-white border-2 border-[#FF8C42] text-[#FF8C42] rounded-xl p-4 flex flex-col items-center justify-center hover:bg-[#FF8C42] hover:text-white transition-colors group text-center"
              >
                <Activity className="w-6 h-6 mb-2" />
                <span className="font-semibold text-sm">Custom Services</span>
              </button>
            )}
            
            {/* Packages - Only show if capability is enabled */}
            {hasPackages && (
              <button
                onClick={() => router.push('/packages')}
                className="flex-1 min-w-[140px] bg-white border-2 border-purple-500 text-purple-600 rounded-xl p-4 flex flex-col items-center justify-center hover:bg-purple-500 hover:text-white transition-colors group text-center"
              >
                <Gift className="w-6 h-6 mb-2" />
                <span className="font-semibold text-sm">Packages</span>
              </button>
            )}
          </div>
          
          {/* Info Banner for Solo Provider */}
          <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>Solo Provider Mode:</strong> You provide services directly to customers. 
              {!hasCustomServices && ' Enable "Custom Services" capability to create your own service offerings.'}
            </p>
          </div>
        </div>
        
        {/* Dashboard Warnings Section */}
        {(warnings.profileIncomplete || warnings.bankNotVerified || warnings.servicesNotConfigured) && (
          <div className="p-4 border-b border-gray-100 bg-amber-50">
            <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Action Required for Settlements
            </h3>
            <div className="space-y-2">
              {/* Profile Incomplete Warning */}
              {warnings.profileIncomplete && (
                <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-200">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Professional Profile Incomplete</p>
                      <p className="text-xs text-gray-500">Add your specializations and qualifications</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => router.push('/profile')}
                    className="px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600"
                  >
                    Complete
                  </button>
                </div>
              )}
              
              {/* Bank Not Verified Warning */}
              {warnings.bankNotVerified && (
                <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-200">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                      <Briefcase className="w-4 h-4 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Bank Account Not Verified</p>
                      <p className="text-xs text-gray-500">Add and verify your bank for Razorpay settlements</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => router.push('/settings?tab=bank')}
                    className="px-3 py-1.5 bg-orange-500 text-white text-xs font-medium rounded-lg hover:bg-orange-600"
                  >
                    Add Bank
                  </button>
                </div>
              )}
              
              {/* Services Not Configured Warning */}
              {warnings.servicesNotConfigured && hasCustomServices && (
                <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-200">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                      <Activity className="w-4 h-4 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">No Custom Services Added</p>
                      <p className="text-xs text-gray-500">Create services to start receiving bookings</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => router.push('/services')}
                    className="px-3 py-1.5 bg-yellow-500 text-white text-xs font-medium rounded-lg hover:bg-yellow-600"
                  >
                    Add Services
                  </button>
                </div>
              )}
            </div>
            <p className="text-xs text-amber-700 mt-3">
              ⚠️ Complete all requirements to enable settlement payouts via Razorpay
            </p>
          </div>
        )}

        {/* Additional Capabilities Section (if enabled) */}
        {(capabilities.progress_tracking || capabilities.distance_pricing || capabilities.counseling) && (
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

          <div className="grid grid-cols-3 gap-3">
            {/* Appointments */}
            {capabilities.booking && (
              <button
                onClick={() => {
                  setActiveBottomTab('bookings');
                  router.push('/bookings');
                }}
                className={`text-center p-3 ${colorScheme.secondary} rounded-lg hover:shadow-md transition-all cursor-pointer border-2 border-transparent hover:border-[#FF8C42]`}
              >
                <Calendar className={`w-5 h-5 ${colorScheme.primary} mx-auto mb-1`} />
                <div className="text-2xl font-bold text-gray-900">{stats.appointments}</div>
                <div className="text-xs text-gray-500">Appointments</div>
              </button>
            )}

            {/* Consultations */}
            {capabilities.tele && (
              <button
                onClick={() => router.push('/bookings?type=tele')}
                className={`text-center p-3 ${colorScheme.secondary} rounded-lg hover:shadow-md transition-all cursor-pointer border-2 border-transparent hover:border-[#FF8C42]`}
              >
                <Video className={`w-5 h-5 ${colorScheme.primary} mx-auto mb-1`} />
                <div className="text-2xl font-bold text-gray-900">{stats.consultations}</div>
                <div className="text-xs text-gray-500">Tele Sessions</div>
              </button>
            )}

            {/* Earnings */}
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600 mx-auto mb-1" />
              <div className="text-2xl font-bold text-green-600">₹{stats.earnings.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Earnings</div>
            </div>
          </div>
        </div>

        {/* Today's Schedule - Service Style Filter (No at_center for solo) */}
        {capabilities.booking && (
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
                      const serviceType = appointment.serviceType?.toLowerCase();
                      let typeIcon = Home;
                      let typeColor = 'bg-green-100';
                      let typeTextColor = 'text-green-700';
                      let typeLabel = 'Home Visit';

                      if (serviceType === 'tele' || serviceType === 'teleconsultation') {
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
                                {(serviceType === 'tele' || serviceType === 'teleconsultation') && (
                                  <a
                                    href={`https://meet.jit.si/warmpawz-${appointment.bookingId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 min-w-[80px] py-1.5 px-3 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium flex items-center justify-center gap-1"
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

        {/* Your Services (Custom Services Only) */}
        {hasCustomServices && (
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
            
            {capabilities.booking && (
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
                disabled={otp.length !== 6 || processingOtp}
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
