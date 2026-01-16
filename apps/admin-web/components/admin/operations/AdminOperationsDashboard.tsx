'use client';

import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, Users, Package, DollarSign, Calendar, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface OperationsStats {
  todayBookings: number;
  activeVendors: number;
  totalRevenue: number;
  completionRate: number;
  avgRating: number;
  pendingPayouts: number;
}

interface RecentActivity {
  activityId: string;
  type: string;
  description: string;
  timestamp: string;
}

export function AdminOperationsDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<OperationsStats>({
    todayBookings: 0,
    activeVendors: 0,
    totalRevenue: 0,
    completionRate: 0,
    avgRating: 0,
    pendingPayouts: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsData, activityData] = await Promise.all([
        apiClient.get<any>('/admin/operations/stats'),
        apiClient.get<any>('/admin/operations/activity'),
      ]);

      if (statsData.success) setStats(statsData.stats);
      if (activityData.success) setRecentActivity(activityData.activities || []);
    } catch (error) {
      console.error('Error loading operations data:', error);
      alert('Failed to load operations data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-0 bg-purple-100 rounded-xl">
          <Activity className="w-6 h-6 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Operations Dashboard</h1>
          <p className="text-sm text-gray-600">Real-time platform operations overview</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-0">
            <Calendar className="w-4 h-4 text-gray-400" />
            <p className="text-sm text-gray-600">Today's Bookings</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.todayBookings}</p>
        </div>

        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-0">
            <Users className="w-4 h-4 text-gray-400" />
            <p className="text-sm text-gray-600">Active Vendors</p>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.activeVendors}</p>
        </div>

        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-0">
            <DollarSign className="w-4 h-4 text-gray-400" />
            <p className="text-sm text-gray-600">Total Revenue</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">₹{stats.totalRevenue.toLocaleString()}</p>
        </div>

        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-0">
            <TrendingUp className="w-4 h-4 text-gray-400" />
            <p className="text-sm text-gray-600">Completion Rate</p>
          </div>
          <p className="text-2xl font-bold text-blue-600">{stats.completionRate}%</p>
        </div>

        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-0">
            <Package className="w-4 h-4 text-gray-400" />
            <p className="text-sm text-gray-600">Avg Rating</p>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{stats.avgRating.toFixed(1)}</p>
        </div>

        <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-0">
            <DollarSign className="w-4 h-4 text-gray-400" />
            <p className="text-sm text-gray-600">Pending Payouts</p>
          </div>
          <p className="text-2xl font-bold text-orange-600">₹{stats.pendingPayouts.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border-2 border-gray-200">
        <div className="border-b border-gray-200 px-0 py-4">
          <h3 className="font-semibold text-gray-900">Recent Activity</h3>
        </div>
        <div className="p-0">
          {recentActivity.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div key={activity.activityId} className="flex items-start gap-3 p-0 bg-gray-50 rounded-lg">
                  <Activity className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{activity.description}</p>
                    <p className="text-xs text-gray-600 mt-0">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
