'use client';

/**
 * Vendor Dashboard Screen
 * Main dashboard with all capabilities
 * Adapted for AWS Lambda, RDS, Cognito architecture
 */

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface VendorDashboardScreenProps {
  vendorId: string;
  vendorData: any;
  onNavigate: (screen: string, data?: any) => void;
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
  customerName: string;
  serviceName: string;
  status: string;
  price: number;
}

export function VendorDashboardScreen({
  vendorId,
  vendorData,
  onNavigate,
}: VendorDashboardScreenProps) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    appointments: 0,
    consultations: 0,
    earnings: 0,
    pendingEarnings: 0,
    completedServices: 0,
    rating: 0,
    totalReviews: 0,
  });
  const [todaySchedule, setTodaySchedule] = useState<ScheduleItem[]>([]);
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'month'>('today');

  useEffect(() => {
    loadDashboardData();
  }, [vendorId, activeTab]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // ✅ AWS Lambda: Using vendor dashboard endpoint with Cognito auth
      console.log(`[VendorDashboardScreen] Loading dashboard data for vendor: ${vendorId}`);
      const dashboardResponse = await apiClient.get<{
        success?: boolean;
        data?: {
          stats?: DashboardStats;
          bookings?: ScheduleItem[];
        };
      }>(`/vendor/dashboard/${vendorId}?timeframe=${activeTab}`);

      if (dashboardResponse.success && dashboardResponse.data) {
        const data = dashboardResponse.data;

        setStats({
          appointments: data.stats?.appointments || 0,
          consultations: data.stats?.consultations || 0,
          earnings: data.stats?.earnings || 0,
          pendingEarnings: data.stats?.pendingEarnings || 0,
          completedServices: data.stats?.completedServices || 0,
          rating: data.stats?.rating || 4.5,
          totalReviews: data.stats?.totalReviews || 0,
        });

        // Set today's schedule if available
        if (data.bookings) {
          setTodaySchedule(data.bookings.slice(0, 5)); // Show first 5 bookings
        }
      } else {
        // Fallback to basic stats
        console.log(`[VendorDashboardScreen] Using fallback stats for vendor: ${vendorId}`);
        setStats({
          appointments: 0,
          consultations: 0,
          earnings: 0,
          pendingEarnings: 0,
          completedServices: 0,
          rating: 4.5,
          totalReviews: 0,
        });
      }
    } catch (error: any) {
      console.error(`[VendorDashboardScreen] Error loading dashboard:`, error);
      toast.error('Failed to load dashboard data');

      // Fallback to basic stats on error
      setStats({
        appointments: 0,
        consultations: 0,
        earnings: 0,
        pendingEarnings: 0,
        completedServices: 0,
        rating: 4.5,
        totalReviews: 0,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const capabilityButtons = [
    { id: 'bookings', label: 'Bookings', icon: '📅', action: () => onNavigate('bookings') },
    { id: 'services', label: 'Services', icon: '⚙️', action: () => onNavigate('services') },
    { id: 'staff', label: 'Staff', icon: '👥', action: () => onNavigate('staff') },
    { id: 'schedule', label: 'Schedule', icon: '📆', action: () => onNavigate('schedule') },
    { id: 'analytics', label: 'Analytics', icon: '📊', action: () => onNavigate('analytics') },
    { id: 'settings', label: 'Settings', icon: '⚙️', action: () => onNavigate('settings') },
  ];

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
        return 'text-green-600 bg-green-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      case 'completed':
        return 'text-blue-600 bg-blue-100';
      case 'cancelled':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading && !refreshing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto bg-white min-h-screen">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-400 to-orange-600 text-white p-6 rounded-b-3xl">
          <div>
            <p className="text-orange-100 text-sm mb-1">Welcome back!</p>
            <h1 className="text-xl font-bold">
              {vendorData?.businessName || vendorData?.fullName || 'Vendor'}
            </h1>
          </div>
        </div>

        {/* Time Range Tabs */}
        <div className="flex bg-white mx-4 mt-4 rounded-xl border border-gray-200 p-1">
          {(['today', 'week', 'month'] as const).map((tab) => (
            <button
              key={tab}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Stats Cards */}
        <div className="px-4 py-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
              <div className="text-2xl mb-2">📅</div>
              <div className="text-xl font-bold text-gray-900">{stats.appointments}</div>
              <div className="text-xs text-gray-500">Appointments</div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
              <div className="text-2xl mb-2">💰</div>
              <div className="text-xl font-bold text-gray-900">₹{stats.earnings}</div>
              <div className="text-xs text-gray-500">Earnings</div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
              <div className="text-2xl mb-2">⭐</div>
              <div className="text-xl font-bold text-gray-900">{stats.rating.toFixed(1)}</div>
              <div className="text-xs text-gray-500">Rating</div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
              <div className="text-2xl mb-2">✅</div>
              <div className="text-xl font-bold text-gray-900">{stats.completedServices}</div>
              <div className="text-xs text-gray-500">Completed</div>
            </div>
          </div>
        </div>

        {/* Today's Schedule */}
        <div className="px-4 pb-6">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Today's Schedule</h2>
              <button
                onClick={() => onNavigate('schedule')}
                className="text-orange-500 text-sm font-medium"
              >
                See All
              </button>
            </div>

            {todaySchedule.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {todaySchedule.map((item) => (
                  <button
                    key={item.id}
                    className="w-full p-4 hover:bg-gray-50 transition-colors text-left"
                    onClick={() => onNavigate('booking-detail', { bookingId: item.bookingId })}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                          <span className="text-sm font-medium text-orange-600">{item.time}</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{item.customerName}</p>
                          <p className="text-sm text-gray-500">{item.serviceName}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <div className="text-4xl mb-2">📅</div>
                <p className="text-gray-500">No appointments scheduled for today</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-4 pb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-4">
            {capabilityButtons.map((cap) => (
              <button
                key={cap.id}
                className="bg-white rounded-xl p-4 border border-gray-200 hover:border-orange-300 hover:shadow-md transition-all text-center"
                onClick={cap.action}
              >
                <div className="text-2xl mb-2">{cap.icon}</div>
                <div className="text-sm font-medium text-gray-900">{cap.label}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
