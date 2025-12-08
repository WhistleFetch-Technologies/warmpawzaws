import { useState, useEffect } from 'react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { 
  TrendingUp, TrendingDown, DollarSign, Users, ShoppingCart, Package, 
  ArrowLeft, Download, Calendar, Activity, Target, Percent, RefreshCw
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Legend, Bar 
} from 'recharts';
import { RevenueChart } from './RevenueChart';
import { VendorPerformanceTable } from './VendorPerformanceTable';
import { useAnalyticsData } from './hooks/useAnalyticsData';

interface AnalyticsDashboardProps {
  onBack: () => void;
}

interface KPICard {
  title: string;
  value: string | number;
  change: number;
  icon: React.ReactNode;
  color: string;
}

export function AdminAnalyticsDashboard({ onBack }: AnalyticsDashboardProps) {
  const [dateRange, setDateRange] = useState('7d');
  const [activeTab, setActiveTab] = useState('overview');
  
  // Use real data from hook
  const { kpiData, revenueData, categoryData, vendorData, loading, error, refresh } = useAnalyticsData(dateRange);

  // Add null checks and default values
  const safeKpiData = kpiData || {
    totalGMV: 0,
    commissionEarned: 0,
    activeCustomers: 0,
    activeVendors: 0,
    totalOrders: 0,
    completionRate: 0,
    totalRevenue: 0,
    avgOrderValue: 0
  };

  const kpiCards: KPICard[] = [
    {
      title: 'Total GMV',
      value: `₹${(safeKpiData.totalGMV / 1000).toFixed(0)}K`,
      change: 12.5,
      icon: <DollarSign className="w-5 h-5" />,
      color: 'bg-green-500'
    },
    {
      title: 'Commission Earned',
      value: `₹${(safeKpiData.commissionEarned / 1000).toFixed(0)}K`,
      change: 8.3,
      icon: <Target className="w-5 h-5" />,
      color: 'bg-[#FF8C42]'
    },
    {
      title: 'Active Customers',
      value: safeKpiData.activeCustomers.toLocaleString(),
      change: 15.2,
      icon: <Users className="w-5 h-5" />,
      color: 'bg-blue-500'
    },
    {
      title: 'Active Vendors',
      value: safeKpiData.activeVendors.toLocaleString(),
      change: 5.7,
      icon: <Package className="w-5 h-5" />,
      color: 'bg-purple-500'
    },
  ];
  
  const COLORS = ['#FF8C42', '#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

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
      csvRows.push(`Total Revenue,₹${safeKpiData.totalRevenue.toLocaleString()}`);
      csvRows.push(`Commission Earned,₹${safeKpiData.commissionEarned.toLocaleString()}`);
      csvRows.push(`Active Customers,${safeKpiData.activeCustomers.toLocaleString()}`);
      csvRows.push(`Active Vendors,${safeKpiData.activeVendors.toLocaleString()}`);
      csvRows.push(`Total Orders,${safeKpiData.totalOrders.toLocaleString()}`);
      csvRows.push(`Average Order Value,₹${safeKpiData.avgOrderValue.toLocaleString()}`);
      csvRows.push(`Conversion Rate,${(safeKpiData.conversionRate || 0).toFixed(2)}%`);
      csvRows.push(`Customer LTV,₹${(safeKpiData.customerLTV || 0).toLocaleString()}`);
      csvRows.push(`Customer CAC,₹${(safeKpiData.customerCAC || 0).toLocaleString()}`);
      csvRows.push(`Retention Rate,${(safeKpiData.retentionRate || 0).toFixed(2)}%`);
      csvRows.push('');
      
      // Revenue Data Section
      if (revenueData && revenueData.length > 0) {
        csvRows.push('REVENUE TREND');
        csvRows.push('Date,Revenue,Commission,Orders');
        revenueData.forEach(item => {
          csvRows.push(`${item.date},₹${item.revenue},₹${item.commission},${item.count}`);
        });
        csvRows.push('');
      }
      
      // Category Data Section
      if (categoryData && categoryData.length > 0) {
        csvRows.push('CATEGORY PERFORMANCE');
        csvRows.push('Category,Revenue,Orders');
        categoryData.forEach(item => {
          csvRows.push(`${item.name},₹${item.revenue},${item.count}`);
        });
        csvRows.push('');
      }
      
      // Vendor Data Section
      if (vendorData && vendorData.length > 0) {
        csvRows.push('TOP VENDOR PERFORMANCE');
        csvRows.push('Vendor,Revenue,Orders,Rating');
        vendorData.slice(0, 20).forEach(vendor => {
          csvRows.push(`${vendor.name},₹${vendor.revenue},${vendor.bookings},${vendor.rating}`);
        });
      }
      
      // Create blob and download
      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `warmpawz-analytics-${dateRange}-${Date.now()}.csv`);
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-red-800 font-semibold mb-2">Failed to Load Analytics</h3>
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
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold">Analytics Dashboard</h1>
                <p className="text-sm text-gray-500">Platform performance metrics</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="90d">Last 90 Days</SelectItem>
                  <SelectItem value="1y">Last Year</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={exportData} className="bg-[#FF8C42] hover:bg-[#ff7a28]">
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
                <div className={`flex items-center text-sm ${kpi.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {kpi.change >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                  {Math.abs(kpi.change)}%
                </div>
              </div>
              <h3 className="text-2xl font-bold mb-1">{kpi.value}</h3>
              <p className="text-sm text-gray-500">{kpi.title}</p>
            </Card>
          ))}
        </div>

        {/* Tabs for Different Views */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="vendors">Vendors</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Main Revenue Chart */}
              <RevenueChart data={revenueData} title="Platform Revenue Trend" />

              {/* Category Distribution */}
              <Card className="col-span-2">
                <h3 className="text-lg font-semibold mb-4">Revenue by Category</h3>
                <div className="h-[300px] w-full">
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
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Revenue Tab */}
          <TabsContent value="revenue" className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <Card className="p-6">
                 <h4 className="text-sm text-gray-500 mb-2">Total Revenue</h4>
                 <p className="text-3xl font-bold text-[#FF8C42]">₹{(safeKpiData.totalRevenue / 1000).toFixed(0)}K</p>
                 <p className="text-sm text-green-600 mt-2">+12.5% from last period</p>
               </Card>
               <Card className="p-6">
                 <h4 className="text-sm text-gray-500 mb-2">Commission</h4>
                 <p className="text-3xl font-bold text-purple-600">₹{(safeKpiData.commissionEarned / 1000).toFixed(0)}K</p>
                 <p className="text-sm text-green-600 mt-2">+8.3% from last period</p>
               </Card>
               <Card className="p-6">
                 <h4 className="text-sm text-gray-500 mb-2">Avg Order Value</h4>
                 <p className="text-3xl font-bold text-blue-600">₹{safeKpiData.avgOrderValue}</p>
                 <p className="text-sm text-red-600 mt-2">-3.2% from last period</p>
               </Card>
             </div>
             
             <RevenueChart data={revenueData} title="Detailed Revenue Analysis" />
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
        </Tabs>
      </div>
    </div>
  );
}