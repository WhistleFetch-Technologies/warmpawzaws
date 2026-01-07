'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Building2, Loader2 } from 'lucide-react';

interface VendorStats {
  totalVendors: number;
  activeVendors: number;
  newVendors: number;
}

export function VendorAnalyticsTab() {
  const [stats, setStats] = useState<VendorStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>('/admin/analytics/vendors');
      if (response.success && response.stats) {
        setStats(response.stats);
      }
    } catch (error) {
      console.error('Error loading vendor stats:', error);
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
      <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
        <div className="flex items-center gap-0 mb-4">
          <Building2 className="w-5 h-5 text-orange-600" />
          <h3 className="font-semibold text-gray-900">Vendor Statistics</h3>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600">Total Vendors</span>
            <span className="font-semibold text-gray-900">{stats.totalVendors}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Active Vendors</span>
            <span className="font-semibold text-green-600">{stats.activeVendors}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">New This Month</span>
            <span className="font-semibold text-blue-600">{stats.newVendors}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

