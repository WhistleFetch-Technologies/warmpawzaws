'use client';

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  ShoppingCart,
  Users,
  Activity,
  Shield,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Award,
} from 'lucide-react';
import { Card } from '@warmpawz/ui';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { apiClient } from '@/lib/api-client';

interface CustomerInsights {
  sales: {
    total: number;
    growth: number;
    thisMonth: number;
    lastMonth: number;
    trend: 'up' | 'down';
  };
  activities: {
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    cancellationRate: number;
    avgRating: number;
  };
  distribution: {
    byCategory: Array<{ name: string; value: number; color: string }>;
    byStatus: Array<{ name: string; value: number; color: string }>;
  };
  trends: Array<{ date: string; sales: number; bookings: number; vendors: number }>;
}

const COLORS = ['#FF8C42', '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];

export function CustomerInsightsDashboard() {
  const [insights, setInsights] = useState<CustomerInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    loadInsights();
  }, [timeRange]);

  const loadInsights = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>(`/admin/customers/insights?range=${timeRange}`);

      if (data && !data.error) {
        setInsights(data);
      } else {
        setInsights(emptyInsights());
      }
    } catch (error) {
      console.error('Error loading customer insights:', error);
      setInsights(emptyInsights());
    } finally {
      setLoading(false);
    }
  };

  function emptyInsights(): CustomerInsights {
    return {
      sales: {
        total: 0,
        growth: 0,
        thisMonth: 0,
        lastMonth: 0,
        trend: 'up',
      },
      activities: {
        totalBookings: 0,
        completedBookings: 0,
        cancelledBookings: 0,
        cancellationRate: 0,
        avgRating: 0,
      },
      distribution: {
        byCategory: [],
        byStatus: [],
      },
      trends: [],
    };
  }

  if (loading || !insights) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  const totalBookings = insights.activities.totalBookings || 0;
  const completedPct =
    totalBookings > 0 ? ((insights.activities.completedBookings / totalBookings) * 100).toFixed(1) : '0';
  const statusTotal = insights.distribution.byStatus.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Customer insights</h2>
        <div className="flex gap-2">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                timeRange === range
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Booking revenue</p>
              <p className="text-2xl font-bold text-gray-900">₹{insights.sales.total.toLocaleString()}</p>
              <div className="flex items-center gap-1 mt-2">
                {insights.sales.trend === 'up' ? (
                  <ArrowUpRight className="w-4 h-4 text-green-600" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-red-600" />
                )}
                <span
                  className={`text-sm font-medium ${insights.sales.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}
                >
                  {insights.sales.growth}%
                </span>
                <span className="text-sm text-gray-500">vs prior window</span>
              </div>
            </div>
            <div className="p-3 bg-green-200 rounded-xl">
              <IndianRupee className="w-6 h-6 text-green-700" />
            </div>
          </div>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Bookings</p>
              <p className="text-2xl font-bold text-gray-900">{insights.activities.totalBookings.toLocaleString()}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm text-gray-600">{insights.activities.completedBookings} completed</span>
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{completedPct}%</span>
              </div>
            </div>
            <div className="p-3 bg-blue-200 rounded-xl">
              <ShoppingCart className="w-6 h-6 text-blue-700" />
            </div>
          </div>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Avg rating</p>
              <p className="text-2xl font-bold text-gray-900">{insights.activities.avgRating.toFixed(1)}</p>
              <div className="flex items-center gap-1 mt-2">
                <Award className="w-4 h-4 text-purple-600" />
                <span className="text-sm text-gray-600">{insights.activities.cancellationRate}% cancellation rate</span>
              </div>
            </div>
            <div className="p-3 bg-purple-200 rounded-xl">
              <Target className="w-6 h-6 text-purple-700" />
            </div>
          </div>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Active customers</p>
              <p className="text-2xl font-bold text-gray-900">
                {insights.distribution.byStatus.find((s) => s.name === 'Active')?.value || 0}
              </p>
              <div className="flex items-center gap-1 mt-2">
                <Users className="w-4 h-4 text-orange-600" />
                <span className="text-sm text-gray-600">{statusTotal} total accounts</span>
              </div>
            </div>
            <div className="p-3 bg-orange-200 rounded-xl">
              <Users className="w-6 h-6 text-orange-700" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">Sales & bookings trend</h3>
            <Activity className="w-5 h-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={insights.trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" stroke="#6b7280" fontSize={12} tickLine={false} />
              <YAxis stroke="#6b7280" fontSize={12} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="sales" stroke="#FF8C42" strokeWidth={2} dot={{ fill: '#FF8C42', r: 4 }} name="Sales (₹)" />
              <Line type="monotone" dataKey="bookings" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6', r: 4 }} name="Bookings" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">Customers by city</h3>
            <PieChart className="w-5 h-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <RechartsPieChart>
              <Pie
                data={insights.distribution.byCategory}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {insights.distribution.byCategory.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </RechartsPieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">Booking outcomes</h3>
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={[
                { name: 'Completed', value: insights.activities.completedBookings, color: COLORS[1] },
                { name: 'Cancelled', value: insights.activities.cancelledBookings, color: COLORS[4] },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="value" fill="#FF8C42" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">Customer status</h3>
            <Shield className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {insights.distribution.byStatus.map((status) => (
              <div key={status.name} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }} />
                  <span className="text-sm font-medium text-gray-700">{status.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${statusTotal > 0 ? (status.value / statusTotal) * 100 : 0}%`,
                        backgroundColor: status.color,
                      }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-900 w-8 text-right">{status.value}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
