'use client';

/**
 * Vendor Analytics Component
 * Copied from Figma Design System
 * Source: Warmpawz Ecosystem Development/src/components/vendor/VendorAnalytics.tsx
 * Updated to use apiClient instead of direct fetch
 * ENHANCED: Now includes comprehensive Earnings & Settlements Dashboard
 * FIX: Load Earnings dashboard via dynamic import (ssr: false) to avoid 500 when embedded in Reporting
 */

import { useState, useEffect, Component, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  TrendingUp,
  DollarSign,
  Users,
  Calendar,
  Star,
  BarChart3,
  PieChart,
  TrendingDown,
  Award,
  Wallet
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

const VendorEarningsSettlementDashboard = dynamic(
  () => import('./VendorEarningsSettlementDashboard').then((m) => ({ default: m.VendorEarningsSettlementDashboard })),
  { ssr: false, loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4" />
        <p className="text-gray-600">Loading Earnings & Settlements...</p>
      </div>
    </div>
  ) }
);

class EarningsTabErrorBoundary extends Component<{ onBack?: () => void; children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError = () => ({ hasError: true });
  componentDidCatch(err: unknown) {
    console.error('[VendorAnalytics] Earnings tab error:', err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <p className="text-gray-700 mb-2">Something went wrong loading Earnings & Settlements.</p>
            <p className="text-sm text-gray-500 mb-4">Please try again or use the Earnings page from the menu.</p>
            {this.props.onBack && (
              <Button onClick={this.props.onBack} variant="outline">Back to Reporting</Button>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface VendorAnalyticsProps {
  vendorId: string;
  vendorData?: any;
  onBack?: () => void;
  onClose?: () => void;
}

export function VendorAnalytics({ vendorId, vendorData, onBack, onClose }: VendorAnalyticsProps) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [staffPerformance, setStaffPerformance] = useState<any[]>([]);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'performance' | 'earnings'>('performance');

  useEffect(() => {
    loadAnalytics();
  }, [vendorId, period]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setStaffPerformance([]);

      // Load vendor analytics
      const analyticsRes = await apiClient.get<{ data?: { analytics?: any }; analytics?: any }>(`/vendor/${vendorId}/analytics?period=${period}`) as { data?: { analytics?: any }; analytics?: any };

      if (analyticsRes?.data?.analytics) {
        setAnalytics(analyticsRes.data.analytics);
      } else if (analyticsRes?.analytics) {
        setAnalytics(analyticsRes.analytics);
      }

      // Load staff performance (non-blocking; 404 or failure leaves list empty)
      try {
        const staffRes = await apiClient.get<{ data?: { staffPerformance?: any[] }; staffPerformance?: any[] }>(`/vendor/${vendorId}/staff-performance?period=${period}`);
        const list = staffRes?.data?.staffPerformance ?? staffRes?.staffPerformance;
        if (Array.isArray(list)) {
          setStaffPerformance(list);
        }
      } catch (e) {
        console.warn('Staff performance unavailable:', e);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (roleId: string) => {
    switch (roleId) {
      case 'vet':
      case 'pet_clinic':
        return 'Veterinary Clinic';
      case 'groomer':
        return 'Grooming Salon';
      case 'trainer':
        return 'Training Center';
      default:
        return 'Business';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  // If user selects Earnings & Settlements tab, show the comprehensive dashboard (client-only via dynamic import)
  if (activeTab === 'earnings') {
    if (!vendorId || typeof vendorId !== 'string' || vendorId.trim() === '') {
      return (
        <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-600 mb-4">Vendor session not found.</p>
            {onBack && (
              <Button onClick={onBack} variant="outline">Back to Reporting</Button>
            )}
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-gray-50 w-full flex justify-center">
        <div className="w-full max-w-[430px] mx-auto">
          <EarningsTabErrorBoundary onBack={onBack}>
            <VendorEarningsSettlementDashboard
              vendorId={vendorId.trim()}
              onBack={onBack}
            />
          </EarningsTabErrorBoundary>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-[#FF8C42] text-white p-4">
        <div className="flex items-center gap-3 mb-4">
          {onBack && (
            <Button
              onClick={onBack}
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20 -ml-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div>
            <h1 className="text-white text-xl">Analytics & Reporting</h1>
            <p className="text-sm text-white/90">{getRoleLabel(vendorData?.roleId || '')}</p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setActiveTab('performance')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'performance'
                ? 'bg-white text-[#FF8C42]'
                : 'bg-white/20 text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-1" />
            Performance
          </button>
          <button
            onClick={() => setActiveTab('earnings')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === 'earnings'
                ? 'bg-white text-[#FF8C42]'
                : 'bg-white/20 text-white'
            }`}
          >
            <Wallet className="w-4 h-4 inline mr-1" />
            Earnings & Settlements
          </button>
        </div>

        {/* Period Selector - Only for Performance tab */}
        {activeTab === 'performance' && (
          <div className="flex gap-2">
            <button
              onClick={() => setPeriod('week')}
              className={`px-4 py-2 rounded-lg text-sm ${
                period === 'week'
                  ? 'bg-white text-[#FF8C42]'
                  : 'bg-white/20 text-white'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-4 py-2 rounded-lg text-sm ${
                period === 'month'
                  ? 'bg-white text-[#FF8C42]'
                  : 'bg-white/20 text-white'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setPeriod('year')}
              className={`px-4 py-2 rounded-lg text-sm ${
                period === 'year'
                  ? 'bg-white text-[#FF8C42]'
                  : 'bg-white/20 text-white'
              }`}
            >
              Year
            </button>
          </div>
        )}
      </div>

      {analytics && (
        <div className="p-4 space-y-6">
          {/* Key Metrics */}
          <div>
            <h3 className="text-gray-900 mb-3">Performance Overview</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <span className="text-xs text-gray-600">Total Earnings</span>
                </div>
                <p className="text-2xl text-gray-900">
                  ₹{analytics.overview?.totalEarnings?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Avg: ₹{analytics.overview?.avgBookingValue || 0}
                </p>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-5 h-5 text-[#FF8C42]" />
                  <span className="text-xs text-gray-600">Appointments</span>
                </div>
                <p className="text-2xl text-gray-900">
                  {analytics.overview?.totalBookings || 0}
                </p>
                <p className="text-xs text-green-600 mt-1">
                  {analytics.overview?.completed || 0} completed
                </p>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span className="text-xs text-gray-600">Customers</span>
                </div>
                <p className="text-2xl text-gray-900">
                  {analytics.overview?.uniqueCustomers || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {analytics.overview?.returningCustomers || 0} returning
                </p>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  <span className="text-xs text-gray-600">Rating</span>
                </div>
                <p className="text-2xl text-gray-900">
                  {analytics.overview?.avgRating || 'N/A'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {analytics.overview?.reviewCount || 0} reviews
                </p>
              </div>
            </div>
          </div>

          {/* Completion & Retention Rates */}
          {analytics.overview && (
            <div>
              <h3 className="text-gray-900 mb-3">Business Health</h3>
              <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-700">Completion Rate</span>
                    <span className="text-sm text-green-600">{analytics.overview.completionRate || 0}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-600 rounded-full"
                      style={{ width: `${analytics.overview.completionRate || 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-700">Customer Retention</span>
                    <span className="text-sm text-blue-600">{analytics.overview.customerRetentionRate || 0}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${analytics.overview.customerRetentionRate || 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-700">Cancellation Rate</span>
                    <span className="text-sm text-red-600">{analytics.overview.cancellationRate || 0}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-600 rounded-full"
                      style={{ width: `${analytics.overview.cancellationRate || 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Top Services */}
          {analytics.serviceBreakdown && analytics.serviceBreakdown.length > 0 && (
            <div>
              <h3 className="text-gray-900 mb-3">Top Services</h3>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {analytics.serviceBreakdown.slice(0, 5).map((service: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex-1">
                      <p className="text-sm text-gray-900 mb-1">{service.serviceName}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{service.count} bookings</span>
                        <span>•</span>
                        <span>{service.completed} completed</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-[#FF8C42]">
                        ₹{service.revenue?.toLocaleString() || 0}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Staff Performance */}
          {staffPerformance.length > 0 && (
            <div>
              <h3 className="text-gray-900 mb-3">Staff Performance</h3>
              <div className="space-y-3">
                {staffPerformance.map((staff: any) => (
                  <div
                    key={staff.staffId}
                    className="bg-white rounded-xl p-4 border border-gray-200"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      {staff.photo ? (
                        <img
                          src={staff.photo}
                          alt={staff.fullName}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">{staff.fullName}</p>
                        <p className="text-xs text-gray-500">{staff.role}</p>
                      </div>
                      {staff.rating > 0 && (
                        <Badge variant="secondary" className="bg-yellow-50 text-yellow-700">
                          <Star className="w-3 h-3 mr-1" />
                          {staff.rating}
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Appointments</p>
                        <p className="text-sm text-gray-900">{staff.totalAppointments || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Earnings</p>
                        <p className="text-sm text-gray-900">₹{staff.totalEarnings?.toLocaleString() || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Completion</p>
                        <p className="text-sm text-gray-900">{staff.completionRate || 0}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily Earnings Trend */}
          {analytics.dailyEarnings && analytics.dailyEarnings.length > 0 && (
            <div>
              <h3 className="text-gray-900 mb-3">Daily Earnings (Last 7 Days)</h3>
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="space-y-2">
                  {analytics.dailyEarnings.map((day: any, index: number) => {
                    const maxEarnings = Math.max(...analytics.dailyEarnings.map((d: any) => d.earnings || 0));
                    const widthPercent = maxEarnings > 0 ? ((day.earnings || 0) / maxEarnings) * 100 : 0;

                    return (
                      <div key={index}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-600">
                            {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                          <span className="text-xs text-gray-900">₹{(day.earnings || 0).toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#FF8C42] rounded-full"
                            style={{ width: `${widthPercent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!analytics && !loading && (
        <div className="p-4 text-center">
          <p className="text-gray-500">No analytics data available</p>
        </div>
      )}
    </div>
  );
}

