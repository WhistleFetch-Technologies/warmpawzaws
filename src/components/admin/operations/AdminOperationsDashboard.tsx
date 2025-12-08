/**
 * ADMIN OPERATIONS DASHBOARD
 * 
 * Comprehensive real-time operational monitoring
 * Features:
 * - Live booking activity
 * - Vendor performance monitoring
 * - Service quality metrics
 * - Financial overview
 * - Integration health
 * - System alerts
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown,
  Users, 
  DollarSign, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Star,
  Package,
  CreditCard,
  Truck,
  RefreshCw
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

interface DashboardData {
  liveBookings: any;
  vendorMetrics: any;
  serviceMetrics: any;
  financialMetrics: any;
  integrationHealth: any;
  systemAlerts: any;
}

interface AdminOperationsDashboardProps {
  onBack?: () => void;
}

export function AdminOperationsDashboard({ onBack }: AdminOperationsDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [timeRange, setTimeRange] = useState('24h');
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = async () => {
    try {
      setRefreshing(true);
      const response = await fetch(`${API_BASE}/admin/operations/dashboard?timeRange=${timeRange}`);
      const data = await response.json();
      
      if (data.success) {
        setDashboardData(data.dashboard);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, [timeRange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-orange-500" />
          <p className="text-slate-600">Loading operations dashboard...</p>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">No dashboard data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl mb-2">Operations Dashboard</h1>
          <p className="text-sm text-slate-600">
            Real-time operational monitoring and insights
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <Button
            onClick={loadDashboard}
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Alerts */}
      {dashboardData.systemAlerts?.alerts?.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <CardTitle className="text-lg">System Alerts</CardTitle>
              </div>
              <Badge variant="outline" className="bg-white">
                {dashboardData.systemAlerts.totalAlerts} Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dashboardData.systemAlerts.alerts.slice(0, 3).map((alert: any) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    {alert.severity === 'high' && <XCircle className="w-5 h-5 text-red-500" />}
                    {alert.severity === 'medium' && <AlertTriangle className="w-5 h-5 text-orange-500" />}
                    <div>
                      <p className="font-medium text-sm">{alert.title}</p>
                      <p className="text-xs text-slate-600">{alert.message}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">View</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Bookings"
          value={dashboardData.liveBookings?.activeBookings || 0}
          change={+12}
          icon={<Activity className="w-5 h-5" />}
          trend="up"
        />
        <MetricCard
          title="Total Revenue"
          value={`₹${(dashboardData.financialMetrics?.totalRevenue || 0).toLocaleString()}`}
          change={+8}
          icon={<DollarSign className="w-5 h-5" />}
          trend="up"
        />
        <MetricCard
          title="Active Vendors"
          value={dashboardData.vendorMetrics?.totalActiveVendors || 0}
          change={+5}
          icon={<Users className="w-5 h-5" />}
          trend="up"
        />
        <MetricCard
          title="Avg Rating"
          value={(dashboardData.serviceMetrics?.avgRating || 0).toFixed(1)}
          change={+0.3}
          icon={<Star className="w-5 h-5" />}
          trend="up"
        />
      </div>

      {/* Detailed Metrics Tabs */}
      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="activity">Live Activity</TabsTrigger>
          <TabsTrigger value="vendors">Vendor Performance</TabsTrigger>
          <TabsTrigger value="quality">Service Quality</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>

        {/* Live Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <LiveActivityPanel data={dashboardData.liveBookings} />
        </TabsContent>

        {/* Vendor Performance Tab */}
        <TabsContent value="vendors" className="space-y-4">
          <VendorPerformancePanel />
        </TabsContent>

        {/* Service Quality Tab */}
        <TabsContent value="quality" className="space-y-4">
          <ServiceQualityPanel data={dashboardData.serviceMetrics} />
        </TabsContent>

        {/* Financial Tab */}
        <TabsContent value="financial" className="space-y-4">
          <FinancialPanel data={dashboardData.financialMetrics} />
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-4">
          <IntegrationHealthPanel data={dashboardData.integrationHealth} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

interface MetricCardProps {
  title: string;
  value: string | number;
  change: number;
  icon: React.ReactNode;
  trend: 'up' | 'down';
}

function MetricCard({ title, value, change, icon, trend }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
            {icon}
          </div>
          <div className={`flex items-center gap-1 text-xs ${
            trend === 'up' ? 'text-green-600' : 'text-red-600'
          }`}>
            {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{change > 0 ? '+' : ''}{change}%</span>
          </div>
        </div>
        <div>
          <p className="text-2xl mb-1">{value}</p>
          <p className="text-xs text-slate-600">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function LiveActivityPanel({ data }: { data: any }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Booking Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <StatusRow label="Active" count={data?.activeBookings || 0} color="blue" />
            <StatusRow label="Completed" count={data?.completedBookings || 0} color="green" />
            <StatusRow label="Cancelled" count={data?.cancelledBookings || 0} color="red" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Service Style Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <StatusRow label="At Home" count={0} color="purple" />
            <StatusRow label="At Center" count={0} color="indigo" />
            <StatusRow label="Tele Consultation" count={0} color="cyan" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function VendorPerformancePanel() {
  const [performance, setPerformance] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`${API_BASE}/admin/operations/vendor-performance`);
        const data = await response.json();
        if (data.success) {
          setPerformance(data.vendorPerformance);
        }
      } catch (error) {
        console.error('Error loading vendor performance:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return <div className="text-center py-8 text-slate-600">Loading...</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top Performers</CardTitle>
          <CardDescription>Highest revenue vendors</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {performance?.topPerformers?.slice(0, 5).map((vendor: any, i: number) => (
              <div key={vendor.vendorId} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-semibold text-sm">
                    {i + 1}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{vendor.businessName}</p>
                    <p className="text-xs text-slate-600">{vendor.roleId}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">₹{vendor.totalRevenue?.toLocaleString()}</p>
                  <p className="text-xs text-slate-600">{vendor.totalBookings} bookings</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Underperformers</CardTitle>
          <CardDescription>Vendors needing attention</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {performance?.underperformers?.slice(0, 5).map((vendor: any) => (
              <div key={vendor.vendorId} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                <div>
                  <p className="font-medium text-sm">{vendor.businessName}</p>
                  <p className="text-xs text-slate-600">Completion: {vendor.completionRate?.toFixed(0)}%</p>
                </div>
                <Badge variant="outline" className="bg-white">
                  {vendor.avgRating?.toFixed(1)} ⭐
                </Badge>
              </div>
            ))}
            {(!performance?.underperformers || performance.underperformers.length === 0) && (
              <div className="text-center py-8 text-slate-600">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p className="text-sm">All vendors performing well!</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ServiceQualityPanel({ data }: { data: any }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Customer Satisfaction</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <div className="text-4xl mb-2">
              {(data?.satisfactionScore || 0).toFixed(0)}%
            </div>
            <p className="text-sm text-slate-600 mb-4">Satisfaction Score</p>
            <div className="flex items-center justify-center gap-1">
              <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              <span className="text-lg font-semibold">{(data?.avgRating || 0).toFixed(1)}</span>
              <span className="text-slate-600">/5.0</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Service Completion</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm">Total</span>
                <span className="font-semibold">{data?.totalBookings || 0}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm">Completed</span>
                <span className="font-semibold">{data?.completedBookings || 0}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full" 
                  style={{ 
                    width: `${data?.totalBookings ? (data.completedBookings / data.totalBookings) * 100 : 0}%` 
                  }}
                ></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Response Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Clock className="w-6 h-6 text-orange-500" />
              <span className="text-3xl">{data?.responseTime || 15}</span>
              <span className="text-slate-600">min</span>
            </div>
            <p className="text-sm text-slate-600">Average Response Time</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FinancialPanel({ data }: { data: any }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-5 h-5 text-green-600" />
            <p className="text-sm text-green-900">Total Revenue</p>
          </div>
          <p className="text-2xl text-green-900">
            ₹{(data?.totalRevenue || 0).toLocaleString()}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-5 h-5 text-blue-600" />
            <p className="text-sm text-blue-900">Transactions</p>
          </div>
          <p className="text-2xl text-blue-900">
            {(data?.transactionCount || 0).toLocaleString()}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            <p className="text-sm text-purple-900">Avg Transaction</p>
          </div>
          <p className="text-2xl text-purple-900">
            ₹{(data?.avgTransactionValue || 0).toFixed(0)}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-orange-600" />
            <p className="text-sm text-orange-900">Commission</p>
          </div>
          <p className="text-2xl text-orange-900">
            ₹{((data?.totalRevenue || 0) * 0.15).toLocaleString()}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function IntegrationHealthPanel({ data }: { data: any }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-lg">Razorpay Payment Gateway</CardTitle>
            </div>
            <Badge 
              variant="outline" 
              className={data?.razorpay === 'healthy' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50'}
            >
              {data?.razorpay === 'healthy' ? 'Healthy' : 'Disabled'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="text-sm">Status</span>
              <div className="flex items-center gap-2">
                {data?.razorpay === 'healthy' ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-slate-400" />
                )}
                <span className="text-sm font-medium">
                  {data?.razorpay === 'healthy' ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-purple-600" />
              <CardTitle className="text-lg">Shiprocket Logistics</CardTitle>
            </div>
            <Badge 
              variant="outline" 
              className={data?.shiprocket === 'healthy' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50'}
            >
              {data?.shiprocket === 'healthy' ? 'Healthy' : 'Disabled'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="text-sm">Status</span>
              <div className="flex items-center gap-2">
                {data?.shiprocket === 'healthy' ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-slate-400" />
                )}
                <span className="text-sm font-medium">
                  {data?.shiprocket === 'healthy' ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusRow({ label, count, color }: { label: string; count: number; color: string }) {
  const colors: { [key: string]: string } = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    purple: 'bg-purple-100 text-purple-700',
    indigo: 'bg-indigo-100 text-indigo-700',
    cyan: 'bg-cyan-100 text-cyan-700'
  };

  return (
    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
      <span className="text-sm text-slate-700">{label}</span>
      <Badge variant="outline" className={colors[color]}>
        {count}
      </Badge>
    </div>
  );
}