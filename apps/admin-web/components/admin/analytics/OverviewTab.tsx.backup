'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Users, DollarSign, TrendingUp, Loader2 } from 'lucide-react';

interface OverviewStats {
  totalUsers: number;
  totalRevenue: number;
  totalBookings: number;
  growthRate: number;
}

export function OverviewTab() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>('/admin/analytics/overview');
      if (response.success && response.stats) {
        setStats(response.stats);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!stats) {
    return <div className="text-center py-12 text-gray-500">No data available</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-orange-600" />
            <span className="text-sm text-gray-600">Total Users</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.totalUsers.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-orange-600" />
            <span className="text-sm text-gray-600">Revenue</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">${stats.totalRevenue.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-orange-600" />
            <span className="text-sm text-gray-600">Bookings</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.totalBookings.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <span className="text-sm text-gray-600">Growth</span>
          </div>
          <div className="text-2xl font-bold text-green-600">+{stats.growthRate}%</div>
        </div>
      </div>
    </div>
  );
}

