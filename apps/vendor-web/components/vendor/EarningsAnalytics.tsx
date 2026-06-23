'use client';

/**
 * Earnings Analytics Component
 * Copied from Figma Design System
 * Source: Warmpawz Ecosystem Development/src/components/vendor/EarningsAnalytics.tsx
 * Updated to use apiClient instead of direct fetch
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, IndianRupee, Calendar, Package, Clock,
  ChevronLeft, RefreshCw, Download, TrendingDown
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { downloadBlob } from '@/lib/download-file';

interface EarningsData {
  totalBookings: number;
  totalRevenue: number;
  totalEarnings?: number;
  platformFees?: number;
}

interface EarningsAnalyticsProps {
  vendorId?: string;
  staffId?: string;
  userType: 'vendor' | 'staff';
  onBack: () => void;
}

export function EarningsAnalytics({ vendorId, staffId, userType, onBack }: EarningsAnalyticsProps) {
  const [activePeriod, setActivePeriod] = useState<'day' | 'month' | 'lifetime'>('month');
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);

  const id = userType === 'vendor' ? vendorId : staffId;

  useEffect(() => {
    loadEarnings();
  }, [activePeriod, id]);

  const loadEarnings = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const endpoint = userType === 'vendor' 
        ? `/vendor/${id}/earnings?period=${activePeriod}`
        : `/staff/${id}/earnings?period=${activePeriod}`;

      const response = await apiClient.get<{ data?: { earnings?: any } }>(endpoint) as { data?: { earnings?: any } };

      if (response?.data?.earnings) {
        setEarnings(response.data.earnings);
      }
    } catch (error) {
      console.error('Error loading earnings:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return `₹${new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)}`;
  };

  const getPeriodLabel = () => {
    switch (activePeriod) {
      case 'day':
        return 'Today';
      case 'month':
        return 'This Month';
      case 'lifetime':
        return 'All Time';
    }
  };

  const handleExport = () => {
    if (!earnings) return;

    // Create CSV content
    const csvContent = [
      ['Earnings Report', getPeriodLabel()],
      ['Generated', new Date().toLocaleString()],
      [''],
      ['Metric', 'Value'],
      ['Total Bookings', earnings.totalBookings],
      ['Total Revenue', `₹${earnings.totalRevenue}`],
      ['Platform Fees', `₹${earnings.platformFees || 0}`],
      ['Net Earnings', `₹${earnings.totalEarnings || earnings.totalRevenue}`],
    ].map(row => row.join(',')).join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    void downloadBlob({
      blob,
      fileName: `earnings_${activePeriod}_${new Date().toISOString().split('T')[0]}.csv`,
      title: 'Earnings report',
      previewHtmlInBrowser: false,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center justify-between p-4 max-w-md mx-auto">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold">Earnings Analytics</h1>
          <button onClick={loadEarnings} className="p-2 hover:bg-gray-100 rounded-lg">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Period Tabs */}
        <div className="flex gap-2 px-4 pb-3 max-w-md mx-auto">
          {[
            { id: 'day', label: 'Today' },
            { id: 'month', label: 'Month' },
            { id: 'lifetime', label: 'All Time' }
          ].map((period) => (
            <button
              key={period.id}
              onClick={() => setActivePeriod(period.id as any)}
              className={`flex-1 py-2 px-4 rounded-lg text-sm transition-colors ${
                activePeriod === period.id
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <RefreshCw className="w-8 h-8 text-[#FF8C42] animate-spin" />
          </div>
        ) : earnings ? (
          <>
            {/* Main Earnings Card */}
            <div className="bg-gradient-to-br from-[#FF8C42] to-[#FF7029] rounded-2xl p-6 text-white">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5" />
                <span className="text-sm opacity-90">{getPeriodLabel()} Earnings</span>
              </div>
              <div className="text-4xl font-bold mb-1">
                {formatCurrency(userType === 'vendor' ? (earnings.totalEarnings || 0) : (earnings.totalRevenue || 0))}
              </div>
              <div className="text-sm opacity-90">
                from {earnings.totalBookings} {earnings.totalBookings === 1 ? 'booking' : 'bookings'}
              </div>
            </div>

            {/* Breakdown Cards - Only for Vendors */}
            {userType === 'vendor' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-2 text-gray-600">
                    <IndianRupee className="w-4 h-4" />
                    <span className="text-xs">Total Revenue</span>
                  </div>
                  <p className="text-xl font-semibold text-gray-900">
                    {formatCurrency(earnings.totalRevenue || 0)}
                  </p>
                </div>

                <div className="bg-white rounded-xl p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-2 text-gray-600">
                    <TrendingDown className="w-4 h-4" />
                    <span className="text-xs">Platform Fees</span>
                  </div>
                  <p className="text-xl font-semibold text-red-600">
                    {formatCurrency(earnings.platformFees || 0)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">15% commission</p>
                </div>
              </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-2 text-gray-600">
                  <Package className="w-4 h-4" />
                  <span className="text-xs">Bookings</span>
                </div>
                <p className="text-2xl font-semibold text-gray-900">
                  {earnings.totalBookings}
                </p>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-2 text-gray-600">
                  <IndianRupee className="w-4 h-4" />
                  <span className="text-xs">Avg. per Booking</span>
                </div>
                <p className="text-2xl font-semibold text-gray-900">
                  {earnings.totalBookings > 0
                    ? formatCurrency(
                        (userType === 'vendor' ? (earnings.totalEarnings || 0) : (earnings.totalRevenue || 0)) /
                        earnings.totalBookings
                      )
                    : '₹0'}
                </p>
              </div>
            </div>

            {/* Info Card */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="font-medium text-blue-900 mb-2">💡 About Earnings</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                {userType === 'vendor' ? (
                  <>
                    <li>• Earnings are calculated after 15% platform commission</li>
                    <li>• Updated in real-time when services are completed</li>
                    <li>• Requires customer OTP verification for completion</li>
                  </>
                ) : (
                  <>
                    <li>• Shows total revenue from bookings you completed</li>
                    <li>• Updated when you complete services with OTP</li>
                    <li>• Contact your employer for salary details</li>
                  </>
                )}
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <Button
                className="w-full bg-[#FF8C42] text-white hover:bg-[#FF7029]"
                onClick={handleExport}
              >
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-20">
            <IndianRupee className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No earnings data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
