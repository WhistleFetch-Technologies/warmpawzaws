/**
 * VendorDashboardCached
 * Example implementation using React Query caching hooks
 * This is a reference implementation showing best practices
 */

import { useState } from 'react';
import { RefreshCw, Calendar, Star } from 'lucide-react';
import { useDashboardData, useInvalidateDashboard } from '../../hooks/useDashboardData';
import { useVendorData } from '../../hooks/useVendorData';
import { useRoleCapabilities } from '../../hooks/useRoleConfig';
import { Badge } from '../ui/badge';
import VendorUtils from '../../utils/vendor-utils';
import CapabilityHelper from '../../utils/capability-helper';

interface VendorDashboardCachedProps {
  vendorId: string;
}

export function VendorDashboardCached({ vendorId }: VendorDashboardCachedProps) {
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'month'>('today');

  // ✅ CACHED: Fetch vendor data with React Query
  const { 
    data: vendorData, 
    isLoading: vendorLoading,
    error: vendorError,
    refetch: refetchVendor
  } = useVendorData(vendorId);

  // ✅ CACHED: Fetch role capabilities (1 hour cache)
  const { 
    capabilities, 
    roleName, 
    loading: capsLoading 
  } = useRoleCapabilities(vendorData?.roleId);

  // ✅ CACHED: Fetch dashboard data with parallel requests
  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    error: dashboardError,
    refetch: refetchDashboard,
    isFetching
  } = useDashboardData(vendorId, activeTab, capabilities);

  // ✅ INVALIDATE: Manual refresh function
  const invalidateDashboard = useInvalidateDashboard();

  // Handle manual refresh
  const handleRefresh = () => {
    invalidateDashboard(vendorId);
    refetchVendor();
    refetchDashboard();
  };

  // Loading state
  if (vendorLoading || capsLoading || dashboardLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-[#FF8C42] animate-spin mx-auto mb-2" />
          <p className="text-gray-600">Loading dashboard...</p>
          <p className="text-xs text-gray-400 mt-1">
            {vendorLoading && '• Loading vendor data'}
            {capsLoading && '• Loading capabilities'}
            {dashboardLoading && '• Loading dashboard'}
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (vendorError || dashboardError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <span className="text-4xl">⚠️</span>
          </div>
          <p className="text-gray-900 font-semibold mb-2">Failed to load dashboard</p>
          <p className="text-sm text-gray-600 mb-4">
            {vendorError?.message || dashboardError?.message || 'Unknown error'}
          </p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-[#FF8C42] text-white rounded-lg hover:bg-[#FF7A2E]"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // No data state
  if (!vendorData || !dashboardData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">No data available</p>
          <button
            onClick={handleRefresh}
            className="mt-4 px-4 py-2 bg-[#FF8C42] text-white rounded-lg hover:bg-[#FF7A2E]"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  const { stats, schedule, notifications } = dashboardData;
  const isVet = VendorUtils.isVet(vendorData.roleId);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-[430px] mx-auto bg-white min-h-screen">
        {/* Header */}
        <div className="p-4 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#FF8C42] rounded-lg flex items-center justify-center">
                <span className="text-white text-xl">
                  {VendorUtils.getRoleIcon(vendorData.roleId)}
                </span>
              </div>
              <div>
                <h1 className="font-semibold text-gray-900">
                  {vendorData.businessName || vendorData.fullName}
                </h1>
                <p className="text-xs text-gray-500">{roleName}</p>
              </div>
            </div>
            
            {/* Refresh Button with Loading State */}
            <button 
              onClick={handleRefresh}
              disabled={isFetching}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <RefreshCw 
                className={`w-5 h-5 text-gray-400 ${isFetching ? 'animate-spin' : ''}`} 
              />
            </button>
          </div>

          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <Badge className={VendorUtils.getStatusColor(vendorData.status)}>
              {VendorUtils.getStatusLabel(vendorData.status)}
            </Badge>
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span className="text-sm font-semibold">{stats.rating.toFixed(1)}</span>
              <span className="text-xs text-gray-500">({stats.totalReviews} reviews)</span>
            </div>
          </div>
        </div>

        {/* Cache Status Indicator (Dev Only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
            <div className="flex items-center justify-between text-xs">
              <span className="text-blue-700">
                💾 Cache Status: {isFetching ? 'Fetching...' : 'Loaded'}
              </span>
              <span className="text-blue-600">
                {dashboardData ? 'Using cached data' : 'Fresh from API'}
              </span>
            </div>
          </div>
        )}

        {/* Timeframe Tabs */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('today')}
              className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
                activeTab === 'today' 
                  ? 'bg-[#FF8C42] text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setActiveTab('week')}
              className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
                activeTab === 'week' 
                  ? 'bg-[#FF8C42] text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setActiveTab('month')}
              className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
                activeTab === 'month' 
                  ? 'bg-[#FF8C42] text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Month
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="p-4 border-b border-gray-100">
          <div className="grid grid-cols-3 gap-3">
            {/* Appointments */}
            {CapabilityHelper.hasBooking(capabilities) && (
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <Calendar className="w-5 h-5 text-orange-600 mx-auto mb-1" />
                <div className="text-2xl font-bold text-gray-900">{stats.appointments}</div>
                <div className="text-xs text-gray-500">Appointments</div>
              </div>
            )}

            {/* Consultations */}
            {(CapabilityHelper.hasTele(capabilities) || CapabilityHelper.hasBooking(capabilities)) && (
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{stats.consultations}</div>
                <div className="text-xs text-gray-500">Consultations</div>
              </div>
            )}

            {/* Earnings */}
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                ₹{stats.earnings.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">Earnings</div>
            </div>
          </div>
        </div>

        {/* Today's Schedule */}
        {CapabilityHelper.shouldShowSchedule(capabilities) && schedule && (
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 mb-3">Today's Schedule</h2>
            
            {schedule.length === 0 ? (
              <div className="text-center py-8 px-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No appointments scheduled</p>
              </div>
            ) : (
              <div className="space-y-3">
                {schedule.map((appointment) => (
                  <div 
                    key={appointment.id} 
                    className="bg-white border-2 border-gray-200 rounded-xl p-3"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {appointment.time}
                        </div>
                        <div className="text-xs text-gray-500">
                          {appointment.customerName} • {appointment.petName}
                        </div>
                      </div>
                      <Badge>{appointment.status}</Badge>
                    </div>
                    <div className="text-xs font-medium text-[#FF8C42]">
                      {appointment.serviceName}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notifications */}
        {notifications && notifications.length > 0 && (
          <div className="p-4">
            <h2 className="font-semibold text-gray-900 mb-3">Recent Notifications</h2>
            <div className="space-y-2">
              {notifications.slice(0, 3).map((notification) => (
                <div 
                  key={notification.notificationId}
                  className={`p-3 rounded-lg ${
                    notification.isRead ? 'bg-gray-50' : 'bg-blue-50'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-900">
                    {notification.title}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {notification.message}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Capability Features Info (Dev Only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="p-4 bg-gray-50 border-t border-gray-200">
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-700 font-medium mb-2">
                🔧 Capability Debug Info
              </summary>
              <div className="space-y-1 text-gray-600">
                <div>Role: {vendorData.roleId} ({roleName})</div>
                <div>Status: {vendorData.status}</div>
                <div>Booking: {CapabilityHelper.hasBooking(capabilities) ? '✅' : '❌'}</div>
                <div>Chat: {CapabilityHelper.hasChat(capabilities) ? '✅' : '❌'}</div>
                <div>Tele: {CapabilityHelper.hasTele(capabilities) ? '✅' : '❌'}</div>
                <div>Medical: {CapabilityHelper.hasMedicalRecords(capabilities) ? '✅' : '❌'}</div>
                <div>Catalog: {CapabilityHelper.hasCatalog(capabilities) ? '✅' : '❌'}</div>
                <div>Staff: {CapabilityHelper.hasStaffManagement(capabilities) ? '✅' : '❌'}</div>
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

export default VendorDashboardCached;
