'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Button,
  Card,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
} from '@warmpawz/ui';
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Users,
  ShoppingCart,
  Package,
  ArrowLeft,
  Download,
  Activity,
  Target,
  Percent,
  RefreshCw,
  BarChart3,
  Brain,
  UserCheck,
  TrendingUp as TrendingUpIcon,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Legend,
  Bar,
} from 'recharts';
import { RevenueChart, VendorPerformanceTable } from '@/components/admin/analytics';
import { useAnalyticsData } from '@/hooks/analytics/useAnalyticsData';
import { apiClient } from '@/lib/api-client';
import { toast, Toaster } from 'sonner';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';

interface KPICard {
  title: string;
  value: string | number;
  change: number;
  icon: React.ReactNode;
  color: string;
}

// Peak times data interface
interface PeakTimeData {
  time: string;
  bookings: number;
}

// Funnel data interface
interface FunnelData {
  visitors: number;
  registeredUsers: number;
  firstBooking: number;
  repeatCustomers: number;
  registrationRate: number;
  bookingRate: number;
  retentionRate: number;
}

// Sales by role interface
interface SalesByRoleData {
  role: string;
  revenue: number;
  orders: number;
  percentage: number;
}

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState('7d');
  const [activeTab, setActiveTab] = useState('overview');
  
  // New state for behavioral analytics
  const [peakTimesData, setPeakTimesData] = useState<PeakTimeData[]>([]);
  const [funnelData, setFunnelData] = useState<FunnelData | null>(null);
  const [salesByRoleData, setSalesByRoleData] = useState<SalesByRoleData[]>([]);
  const [loadingBehavioral, setLoadingBehavioral] = useState(false);

  // Use real data from hook
  const {
    kpiData,
    revenueData,
    categoryData,
    vendorData,
    loading,
    error,
    refresh,
  } = useAnalyticsData(dateRange);

  // Load behavioral analytics data
  const loadBehavioralData = async () => {
    setLoadingBehavioral(true);
    try {
      const [peakTimesRes, funnelRes, salesByRoleRes] = await Promise.all([
        apiClient.get<any>(`/admin/analytics/peak-times?period=${dateRange}`).catch(() => ({ data: [] })),
        apiClient.get<any>(`/admin/analytics/funnel?period=${dateRange}`).catch(() => ({ data: null })),
        apiClient.get<any>(`/admin/analytics/sales-by-role?period=${dateRange}`).catch(() => ({ data: [] })),
      ]);

      if (peakTimesRes?.data) {
        setPeakTimesData(peakTimesRes.data);
      }
      if (funnelRes?.data) {
        setFunnelData(funnelRes.data);
      }
      if (salesByRoleRes?.data) {
        setSalesByRoleData(salesByRoleRes.data);
      }
    } catch (error) {
      console.error('Error loading behavioral data:', error);
    } finally {
      setLoadingBehavioral(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'behavioral' || activeTab === 'sales') {
      loadBehavioralData();
    }
  }, [activeTab, dateRange]);

  // Add null checks and default values
  const safeKpiData = kpiData || {
    totalGMV: 0,
    commissionEarned: 0,
    activeCustomers: 0,
    activeVendors: 0,
    totalOrders: 0,
    completionRate: 0,
    totalRevenue: 0,
    avgOrderValue: 0,
  };

  const kpiCards: KPICard[] = [
    {
      title: 'Total GMV',
      value: `₹${(safeKpiData.totalGMV / 1000).toFixed(0)}K`,
      change: 12.5,
      icon: <IndianRupee className="w-5 h-5" />,
      color: 'bg-green-500',
    },
    {
      title: 'Commission Earned',
      value: `₹${(safeKpiData.commissionEarned / 1000).toFixed(0)}K`,
      change: 8.3,
      icon: <Target className="w-5 h-5" />,
      color: 'bg-[#FF8C42]',
    },
    {
      title: 'Active Customers',
      value: safeKpiData.activeCustomers.toLocaleString(),
      change: 15.2,
      icon: <Users className="w-5 h-5" />,
      color: 'bg-blue-500',
    },
    {
      title: 'Active Vendors',
      value: safeKpiData.activeVendors.toLocaleString(),
      change: 5.7,
      icon: <Package className="w-5 h-5" />,
      color: 'bg-purple-500',
    },
  ];

  const COLORS = [
    '#FF8C42',
    '#4F46E5',
    '#10B981',
    '#F59E0B',
    '#EF4444',
    '#8B5CF6',
  ];


  const exportData = () => {
    try {
      // Create CSV content
      const csvRows = [];

      // Header
      csvRows.push('Warmpawz Analytics Export');
      csvRows.push(`Date Range: ${dateRange}`);
      csvRows.push(`Generated: ${new Date().toLocaleString()}`);
      csvRows.push('');

      // KPI Section
      csvRows.push('KEY PERFORMANCE INDICATORS');
      csvRows.push('Metric,Value');
      csvRows.push(`Total GMV,₹${safeKpiData.totalGMV.toLocaleString()}`);
      csvRows.push(
        `Total Revenue,₹${safeKpiData.totalRevenue.toLocaleString()}`
      );
      csvRows.push(
        `Commission Earned,₹${safeKpiData.commissionEarned.toLocaleString()}`
      );
      csvRows.push(
        `Active Customers,${safeKpiData.activeCustomers.toLocaleString()}`
      );
      csvRows.push(
        `Active Vendors,${safeKpiData.activeVendors.toLocaleString()}`
      );
      csvRows.push(`Total Orders,${safeKpiData.totalOrders.toLocaleString()}`);
      csvRows.push(
        `Average Order Value,₹${safeKpiData.avgOrderValue.toLocaleString()}`
      );
      csvRows.push(
        `Conversion Rate,${(safeKpiData.conversionRate || 0).toFixed(2)}%`
      );
      csvRows.push(
        `Customer LTV,₹${(safeKpiData.customerLTV || 0).toLocaleString()}`
      );
      csvRows.push(
        `Customer CAC,₹${(safeKpiData.customerCAC || 0).toLocaleString()}`
      );
      csvRows.push(
        `Retention Rate,${(safeKpiData.retentionRate || 0).toFixed(2)}%`
      );
      csvRows.push('');

      // Revenue Data Section
      if (revenueData && revenueData.length > 0) {
        csvRows.push('REVENUE TREND');
        csvRows.push('Date,Revenue,Commission,Orders');
        revenueData.forEach((item) => {
          csvRows.push(
            `${item.date},₹${item.revenue},₹${item.commission},${item.count || 0}`
          );
        });
        csvRows.push('');
      }

      // Category Data Section
      if (categoryData && categoryData.length > 0) {
        csvRows.push('CATEGORY PERFORMANCE');
        csvRows.push('Category,Revenue,Orders');
        categoryData.forEach((item) => {
          csvRows.push(`${item.name},₹${item.revenue || item.value || 0},${item.count || 0}`);
        });
        csvRows.push('');
      }

      // Vendor Data Section
      if (vendorData && vendorData.length > 0) {
        csvRows.push('TOP VENDOR PERFORMANCE');
        csvRows.push('Vendor,Revenue,Orders,Rating');
        vendorData.slice(0, 20).forEach((vendor) => {
          csvRows.push(
            `${vendor.name},₹${vendor.totalRevenue},${vendor.totalBookings},${vendor.rating}`
          );
        });
      }

      // Create blob and download
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `warmpawz-analytics-${dateRange}-${Date.now()}.csv`
      );
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      console.log('✅ Analytics exported successfully');
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export analytics data');
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Toaster position="top-right" richColors />

          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading analytics...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Toaster position="top-right" richColors />

          <div className="text-center max-w-md">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
              <h3 className="text-red-800 font-semibold mb-2">
                Failed to Load Analytics
              </h3>
              <p className="text-red-600 text-sm mb-4">{error}</p>
              <Button
                onClick={refresh}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-50">
        <Toaster position="top-right" richColors />

        {/* Header - Match wireframe: px-20 border-b, max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 */}
        <div className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <div>
                  {/* ✅ FIX: Match wireframe - text-xl font-semibold (consistent with wireframe) */}
                  <h1 className="text-xl font-semibold">Analytics Dashboard</h1>
                  <p className="text-sm text-gray-500">
                    Platform performance metrics
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-white shadow-lg border border-gray-200 rounded-md">
                    <SelectItem
                      className="px-4 hover:bg-gray-100 rounded-md cursor-pointer"
                      value="24h"
                    >
                      Last 24 Hours
                    </SelectItem>
                    <SelectItem
                      className="px-4 hover:bg-gray-100 rounded-md cursor-pointer"
                      value="7d"
                    >
                      Last 7 Days
                    </SelectItem>
                    <SelectItem
                      className="px-4 hover:bg-gray-100 rounded-md cursor-pointer"
                      value="30d"
                    >
                      Last 30 Days
                    </SelectItem>
                    <SelectItem
                      className="px-4 hover:bg-gray-100 rounded-md cursor-pointer"
                      value="90d"
                    >
                      Last 90 Days
                    </SelectItem>
                    <SelectItem
                      className="px-4 hover:bg-gray-100 rounded-md cursor-pointer"
                      value="1y"
                    >
                      Last Year
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={exportData}
                  className="bg-[#FF8C42] hover:bg-[#ff7a28]"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {kpiCards.map((kpi, index) => (
              <Card key={index} className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`${kpi.color} text-white p-3 rounded-lg`}>
                    {kpi.icon}
                  </div>
                  <div
                    className={`flex items-center text-sm ${
                      kpi.change >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {kpi.change >= 0 ? (
                      <TrendingUp className="w-4 h-4 mr-1" />
                    ) : (
                      <TrendingDown className="w-4 h-4 mr-1" />
                    )}
                    {Math.abs(kpi.change)}%
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-1">{kpi.value}</h3>
                <p className="text-sm text-gray-500">{kpi.title}</p>
              </Card>
            ))}
          </div>

          {/* Tabs for Different Views */}
          <Tabs value={activeTab} onValueChange={(value: string) => {
            console.log('🔧 Analytics tab clicked:', value);
            setActiveTab(value);
          }}>
            <TabsList className="mb-6 flex-wrap">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="revenue">Revenue</TabsTrigger>
              <TabsTrigger value="vendors">Vendor Performance</TabsTrigger>
              <TabsTrigger value="customers">Customer Reports</TabsTrigger>
              <TabsTrigger value="behavioral">Behavioral Patterns</TabsTrigger>
              <TabsTrigger value="sales">Sales by Category/Role</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Main Revenue Chart */}
                <RevenueChart data={revenueData} title="Platform Revenue Trend" />

                {/* Category Distribution */}
                <Card className="col-span-2">
                  <h3 className="text-lg font-semibold mb-4">
                    Revenue by Category
                  </h3>
                  <div className="h-[300px] w-full">
                    {!categoryData || categoryData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-gray-500">
                        <div className="text-center">
                          <p className="text-sm">No category data available</p>
                          <p className="text-xs mt-1">No completed bookings found for this period</p>
                        </div>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={(entry) => entry.name}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {categoryData?.map((entry: any, index: number) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </Card>
              </div>
            </TabsContent>

            {/* Revenue Tab */}
            <TabsContent value="revenue" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-6">
                  <h4 className="text-sm text-gray-500 mb-2">Total Revenue</h4>
                  <p className="text-3xl font-bold text-[#FF8C42]">
                    ₹{(safeKpiData.totalRevenue / 1000).toFixed(0)}K
                  </p>
                  <p className="text-sm text-green-600 mt-2">
                    +12.5% from last period
                  </p>
                </Card>
                <Card className="p-6">
                  <h4 className="text-sm text-gray-500 mb-2">Commission</h4>
                  <p className="text-3xl font-bold text-purple-600">
                    ₹{(safeKpiData.commissionEarned / 1000).toFixed(0)}K
                  </p>
                  <p className="text-sm text-green-600 mt-2">
                    +8.3% from last period
                  </p>
                </Card>
                <Card className="p-6">
                  <h4 className="text-sm text-gray-500 mb-2">Avg Order Value</h4>
                  <p className="text-3xl font-bold text-blue-600">
                    ₹{safeKpiData.avgOrderValue}
                  </p>
                  <p className="text-sm text-red-600 mt-2">
                    -3.2% from last period
                  </p>
                </Card>
              </div>

              <RevenueChart
                data={revenueData}
                title="Detailed Revenue Analysis"
              />
            </TabsContent>

            {/* Vendors Tab */}
            <TabsContent value="vendors" className="space-y-6">
              <Card className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold">Vendor Performance</h3>
                  <div className="flex gap-2">
                    <Select defaultValue="revenue">
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="revenue">Revenue</SelectItem>
                        <SelectItem value="bookings">Bookings</SelectItem>
                        <SelectItem value="rating">Rating</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline">
                      <Download className="w-4 h-4 mr-2" /> Export
                    </Button>
                  </div>
                </div>

                {/* Updated Table Component */}
                <VendorPerformanceTable data={vendorData} />
              </Card>
            </TabsContent>

            {/* Customer Reports Tab */}
            <TabsContent value="customers" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-blue-500 text-white p-3 rounded-lg">
                      <Users className="w-5 h-5" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold mb-1">
                    {safeKpiData.activeCustomers}
                  </h3>
                  <p className="text-sm text-gray-500">Active Customers</p>
                  <p className="text-xs text-green-600 mt-2">
                    +15.2% from last period
                  </p>
                </Card>
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-green-500 text-white p-3 rounded-lg">
                      <UserCheck className="w-5 h-5" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold mb-1">
                    {(
                      ((safeKpiData.retentionRate || 0) *
                        safeKpiData.activeCustomers) /
                      100
                    ).toFixed(0)}
                  </h3>
                  <p className="text-sm text-gray-500">Retained Customers</p>
                  <p className="text-xs text-green-600 mt-2">
                    Retention: {(safeKpiData.retentionRate || 0).toFixed(1)}%
                  </p>
                </Card>
                <Card className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-purple-500 text-white p-3 rounded-lg">
                      <TrendingUpIcon className="w-5 h-5" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold mb-1">
                    ₹{(safeKpiData.customerLTV || 0).toLocaleString()}
                  </h3>
                  <p className="text-sm text-gray-500">Avg Customer LTV</p>
                  <p className="text-xs text-green-600 mt-2">
                    +8.5% from last period
                  </p>
                </Card>
              </div>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">
                  Customer Acquisition & Retention
                </h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { name: 'New', value: safeKpiData.activeCustomers * 0.3 },
                        {
                          name: 'Returning',
                          value: safeKpiData.activeCustomers * 0.5,
                        },
                        {
                          name: 'Loyal',
                          value: safeKpiData.activeCustomers * 0.2,
                        },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#FF8C42" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </TabsContent>

            {/* Behavioral Patterns Tab */}
            <TabsContent value="behavioral" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">
                    Peak Booking Times
                  </h3>
                  {loadingBehavioral ? (
                    <div className="h-[250px] flex items-center justify-center">
                      <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={peakTimesData.length > 0 ? peakTimesData : [
                            { time: '6-9 AM', bookings: 0 },
                            { time: '9-12 PM', bookings: 0 },
                            { time: '12-3 PM', bookings: 0 },
                            { time: '3-6 PM', bookings: 0 },
                            { time: '6-9 PM', bookings: 0 },
                            { time: '9-12 AM', bookings: 0 },
                          ]}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="bookings" fill="#4F46E5" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">
                    Service Preference Patterns
                  </h3>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData || []}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry) => `${entry.name}: ${entry.value}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {(categoryData || []).map(
                            (entry: any, index: number) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            )
                          )}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">
                  Customer Journey Funnel
                </h3>
                {loadingBehavioral ? (
                  <div className="h-[200px] flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                      <span className="font-medium">Visitors</span>
                      <span className="text-2xl font-bold">{(funnelData?.visitors || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                      <span className="font-medium">Registered Users</span>
                      <span className="text-2xl font-bold">{(funnelData?.registeredUsers || 0).toLocaleString()}</span>
                      <Badge className="bg-green-100 text-green-800">{funnelData?.registrationRate || 0}%</Badge>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
                      <span className="font-medium">First Booking</span>
                      <span className="text-2xl font-bold">{(funnelData?.firstBooking || 0).toLocaleString()}</span>
                      <Badge className="bg-yellow-100 text-yellow-800">{funnelData?.bookingRate || 0}%</Badge>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
                      <span className="font-medium">Repeat Customers</span>
                      <span className="text-2xl font-bold">{(funnelData?.repeatCustomers || 0).toLocaleString()}</span>
                      <Badge className="bg-orange-100 text-orange-800">{funnelData?.retentionRate || 0}%</Badge>
                    </div>
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* Sales by Category/Role Tab */}
            <TabsContent value="sales" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">
                    Sales by Category
                  </h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categoryData || []} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={100} />
                        <Tooltip />
                        <Bar dataKey="revenue" fill="#FF8C42" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">
                    Sales by Vendor Role
                  </h3>
                  {loadingBehavioral ? (
                    <div className="h-[200px] flex items-center justify-center">
                      <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                  ) : salesByRoleData.length > 0 ? (
                    <div className="space-y-3">
                      {salesByRoleData.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div>
                            <p className="font-medium">{item.role}</p>
                            <p className="text-sm text-gray-500">
                              {item.orders} orders
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-[#FF8C42]">
                              ₹{item.revenue >= 1000 ? (item.revenue / 1000).toFixed(0) + 'K' : item.revenue.toFixed(0)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {item.percentage}%
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No sales data available for this period
                    </div>
                  )}
                </Card>
              </div>

              <Card className="p-6">
                <h3 className="text-lg font-semibold mb-4">
                  Category Performance Matrix
                </h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Revenue</TableHead>
                        <TableHead>Orders</TableHead>
                        <TableHead>Avg Order Value</TableHead>
                        <TableHead>Growth</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(categoryData || []).map((cat: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">
                            {cat.name}
                          </TableCell>
                          <TableCell>
                            ₹{cat.revenue?.toLocaleString() || cat.value?.toLocaleString() || 0}
                          </TableCell>
                          <TableCell>{cat.count || 0}</TableCell>
                          <TableCell>
                            ₹{((cat.revenue || cat.value || 0) / (cat.count || 1)).toFixed(0)}
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-green-100 text-green-800">
                              +12.5%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </TabsContent>

          </Tabs>
        </div>
      </div>
    </AdminLayout>
  );
}
