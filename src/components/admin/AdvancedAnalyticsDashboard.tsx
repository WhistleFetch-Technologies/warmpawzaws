import { useState, useEffect } from 'react';
import { 
  TrendingUp, Users, DollarSign, Activity, BarChart3, 
  LineChart, PieChart, Download, Filter, RefreshCw 
} from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

export function AdvancedAnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Real-time data
  const [realtimeData, setRealtimeData] = useState<any>(null);
  
  // Revenue data
  const [revenueData, setRevenueData] = useState<any>(null);
  const [growthData, setGrowthData] = useState<any>(null);
  
  // Service performance
  const [servicePerformance, setServicePerformance] = useState<any[]>([]);
  
  // Conversion funnel
  const [funnelData, setFunnelData] = useState<any>(null);
  
  // User behavior
  const [behaviorData, setBehaviorData] = useState<any>(null);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadDashboardData();
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(() => {
      loadDashboardData(true);
    }, 300000);
    
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      await Promise.all([
        fetchRealtimeData(),
        fetchRevenueData(),
        fetchGrowthData(),
        fetchServicePerformance(),
        fetchFunnelData(),
        fetchBehaviorData()
      ]);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchRealtimeData = async () => {
    try {
      const response = await fetch(`${API_BASE}/analytics/realtime`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setRealtimeData(data.realtime);
        }
      }
    } catch (error) {
      console.error('Failed to fetch realtime data:', error);
    }
  };

  const fetchRevenueData = async () => {
    try {
      const response = await fetch(`${API_BASE}/analytics/revenue/overview?period=month`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setRevenueData(data.revenue);
        }
      }
    } catch (error) {
      console.error('Failed to fetch revenue data:', error);
    }
  };

  const fetchGrowthData = async () => {
    try {
      const response = await fetch(`${API_BASE}/analytics/revenue/growth`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setGrowthData(data.growth);
        }
      }
    } catch (error) {
      console.error('Failed to fetch growth data:', error);
    }
  };

  const fetchServicePerformance = async () => {
    try {
      const response = await fetch(`${API_BASE}/analytics/services/performance`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setServicePerformance(data.services || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch service performance:', error);
    }
  };

  const fetchFunnelData = async () => {
    try {
      const response = await fetch(`${API_BASE}/analytics/funnel/booking`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setFunnelData(data.funnel);
        }
      }
    } catch (error) {
      console.error('Failed to fetch funnel data:', error);
    }
  };

  const fetchBehaviorData = async () => {
    try {
      const response = await fetch(`${API_BASE}/analytics/behavior/summary`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setBehaviorData(data.summary);
        }
      }
    } catch (error) {
      console.error('Failed to fetch behavior data:', error);
    }
  };

  const handleGenerateReport = async (reportType: string) => {
    try {
      const response = await fetch(`${API_BASE}/analytics/reports/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          reportType,
          period: 'month',
          format: 'json'
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Download report as JSON
          const blob = new Blob([JSON.stringify(data.report, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${reportType}-report-${Date.now()}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    } catch (error) {
      console.error('Failed to generate report:', error);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-500">Loading analytics dashboard...</p>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'revenue', label: 'Revenue', icon: DollarSign },
    { id: 'services', label: 'Services', icon: BarChart3 },
    { id: 'conversion', label: 'Conversion', icon: TrendingUp },
    { id: 'behavior', label: 'User Behavior', icon: Users }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Real-time insights and performance metrics
          </p>
        </div>
        
        <div className="flex gap-3">
          <Button
            onClick={() => loadDashboardData(true)}
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button
            onClick={() => handleGenerateReport('revenue')}
            variant="outline"
            size="sm"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Real-time Stats */}
      {realtimeData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Active Users</p>
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {realtimeData.activeUsers}
            </p>
            <p className="text-xs text-gray-500 mt-1">Last 5 minutes</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Bookings/Hour</p>
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {realtimeData.bookingsPerHour}
            </p>
            <p className="text-xs text-gray-500 mt-1">Last hour</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Revenue/Hour</p>
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
              ₹{realtimeData.revenuePerHour.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">Last hour</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-600">Total Vendors</p>
              <BarChart3 className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {realtimeData.totalVendors}
            </p>
            <p className="text-xs text-gray-500 mt-1">Active vendors</p>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Growth Cards */}
            {growthData && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Revenue Growth</h3>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">This Month</p>
                      <p className="text-2xl font-bold text-gray-900">
                        ₹{growthData.currentMonth.revenue.toLocaleString()}
                      </p>
                    </div>
                    <div className={`text-right ${
                      growthData.revenueGrowthPercent >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      <p className="text-2xl font-bold">
                        {growthData.revenueGrowthPercent >= 0 ? '+' : ''}
                        {growthData.revenueGrowthPercent}%
                      </p>
                      <p className="text-xs">vs last month</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Booking Growth</h3>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">This Month</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {growthData.currentMonth.bookings}
                      </p>
                    </div>
                    <div className={`text-right ${
                      growthData.bookingGrowthPercent >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      <p className="text-2xl font-bold">
                        {growthData.bookingGrowthPercent >= 0 ? '+' : ''}
                        {growthData.bookingGrowthPercent}%
                      </p>
                      <p className="text-xs">vs last month</p>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* Top Services */}
            {realtimeData && realtimeData.topServices && (
              <Card className="p-6">
                <h3 className="font-bold text-gray-900 mb-4">Top Services (24h)</h3>
                <div className="space-y-3">
                  {realtimeData.topServices.map((service: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 capitalize">
                          {service.service}
                        </p>
                        <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{
                              width: `${(service.count / realtimeData.topServices[0].count) * 100}%`
                            }}
                          ></div>
                        </div>
                      </div>
                      <span className="ml-4 text-sm font-bold text-gray-900">
                        {service.count}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Revenue Tab */}
        {activeTab === 'revenue' && revenueData && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-6">
                <p className="text-sm text-gray-600 mb-2">Total Revenue</p>
                <p className="text-3xl font-bold text-gray-900">
                  ₹{revenueData.totalRevenue.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {revenueData.period} period
                </p>
              </Card>

              <Card className="p-6">
                <p className="text-sm text-gray-600 mb-2">Total Commission</p>
                <p className="text-3xl font-bold text-gray-900">
                  ₹{revenueData.totalCommission.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">15% commission rate</p>
              </Card>

              <Card className="p-6">
                <p className="text-sm text-gray-600 mb-2">Avg Transaction</p>
                <p className="text-3xl font-bold text-gray-900">
                  ₹{Math.round(revenueData.avgTransactionValue).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {revenueData.totalBookings} bookings
                </p>
              </Card>
            </div>

            {/* Top Categories */}
            <Card className="p-6">
              <h3 className="font-bold text-gray-900 mb-4">Top Revenue Categories</h3>
              <div className="space-y-3">
                {revenueData.topCategories.map((cat: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 capitalize">
                        {cat.category}
                      </p>
                      <p className="text-xs text-gray-500">{cat.percentage}% of total</p>
                    </div>
                    <span className="text-sm font-bold text-gray-900">
                      ₹{cat.revenue.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Top Vendors */}
            <Card className="p-6">
              <h3 className="font-bold text-gray-900 mb-4">Top Revenue Vendors</h3>
              <div className="space-y-2">
                {revenueData.topVendors.slice(0, 5).map((vendor: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-700">
                      #{idx + 1} {vendor.vendorId}
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                      ₹{vendor.revenue.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Services Tab */}
        {activeTab === 'services' && (
          <div className="space-y-4">
            {servicePerformance.map((service, idx) => (
              <Card key={idx} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900 capitalize">{service.serviceType}</h3>
                    <p className="text-sm text-gray-500">{service.totalBookings} total bookings</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-yellow-600">
                      ⭐ {service.avgRating}
                    </span>
                    <span className="text-xs text-gray-500">({service.reviewCount} reviews)</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Completed</p>
                    <p className="text-lg font-bold text-green-600">
                      {service.completedBookings}
                    </p>
                    <p className="text-xs text-gray-500">{service.completionRate}% rate</p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-600 mb-1">Cancelled</p>
                    <p className="text-lg font-bold text-red-600">
                      {service.cancelledBookings}
                    </p>
                    <p className="text-xs text-gray-500">{service.cancellationRate}% rate</p>
                  </div>

                  <div className="col-span-2">
                    <p className="text-xs text-gray-600 mb-1">Revenue</p>
                    <p className="text-lg font-bold text-gray-900">
                      ₹{service.totalRevenue.toLocaleString()}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Conversion Tab */}
        {activeTab === 'conversion' && funnelData && (
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="font-bold text-gray-900 mb-4">Booking Funnel</h3>
              
              <div className="space-y-4">
                {[
                  { label: 'Service Views', count: funnelData.stages.serviceView, color: 'bg-blue-500' },
                  { label: 'Service Clicks', count: funnelData.stages.serviceClick, color: 'bg-blue-600', rate: funnelData.conversionRates.viewToClick },
                  { label: 'Booking Started', count: funnelData.stages.bookingStarted, color: 'bg-purple-500', rate: funnelData.conversionRates.clickToStart },
                  { label: 'Form Completed', count: funnelData.stages.formCompleted, color: 'bg-purple-600', rate: funnelData.conversionRates.startToComplete },
                  { label: 'Payment Initiated', count: funnelData.stages.paymentInitiated, color: 'bg-green-500', rate: funnelData.conversionRates.completeToPayment },
                  { label: 'Booking Confirmed', count: funnelData.stages.bookingConfirmed, color: 'bg-green-600', rate: funnelData.conversionRates.paymentToConfirmed }
                ].map((stage, idx) => (
                  <div key={idx} className="relative">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{stage.label}</span>
                      <span className="text-sm text-gray-600">
                        {stage.count.toLocaleString()}
                        {stage.rate && <span className="ml-2 text-xs text-green-600">({stage.rate}%)</span>}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-8">
                      <div
                        className={`${stage.color} h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold transition-all`}
                        style={{ width: `${(stage.count / funnelData.stages.serviceView) * 100}%` }}
                      >
                        {Math.round((stage.count / funnelData.stages.serviceView) * 100)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">Overall Conversion Rate</span>
                  <span className="text-2xl font-bold text-green-600">
                    {funnelData.conversionRates.overallConversion}%
                  </span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Behavior Tab */}
        {activeTab === 'behavior' && behaviorData && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-6">
                <p className="text-sm text-gray-600 mb-2">Total Events</p>
                <p className="text-3xl font-bold text-gray-900">
                  {behaviorData.totalEvents.toLocaleString()}
                </p>
              </Card>

              <Card className="p-6 col-span-2">
                <p className="text-sm text-gray-600 mb-2">Date Range</p>
                <p className="text-sm text-gray-900">
                  {new Date(behaviorData.dateRange.start).toLocaleDateString()} - {new Date(behaviorData.dateRange.end).toLocaleDateString()}
                </p>
              </Card>
            </div>

            <Card className="p-6">
              <h3 className="font-bold text-gray-900 mb-4">Events by Type</h3>
              <div className="space-y-2">
                {Object.entries(behaviorData.eventsByType || {}).map(([type, count]: [string, any]) => (
                  <div key={type} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-700 capitalize">{type.replace('_', ' ')}</span>
                    <span className="text-sm font-bold text-gray-900">{count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-bold text-gray-900 mb-4">Most Active Users</h3>
              <div className="space-y-2">
                {behaviorData.topUsers.map((user: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-700">
                      #{idx + 1} {user.userId}
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                      {user.eventCount} events
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
