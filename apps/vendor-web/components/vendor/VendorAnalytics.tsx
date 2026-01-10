'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Calendar, Users } from 'lucide-react';

interface VendorAnalyticsProps {
  vendorId: string;
  vendorData?: any;
  onBack?: () => void;
  onClose?: () => void;
}

export function VendorAnalytics({ vendorId, vendorData, onBack, onClose }: VendorAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [loading, setLoading] = useState(true);

  // Placeholder data
  const revenueData = [
    { date: 'Jan', revenue: 45000 },
    { date: 'Feb', revenue: 52000 },
    { date: 'Mar', revenue: 48000 },
    { date: 'Apr', revenue: 61000 },
  ];

  const bookingData = [
    { date: 'Jan', bookings: 45 },
    { date: 'Feb', bookings: 52 },
    { date: 'Mar', bookings: 48 },
    { date: 'Apr', bookings: 61 },
  ];

  useEffect(() => {
    // Load analytics data
    setLoading(false);
  }, [vendorId, timeRange]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <p className="text-gray-600">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Analytics</h2>
        {onClose && (
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">Close</button>
        )}
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTimeRange('7d')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            timeRange === '7d' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
          }`}
        >
          7 Days
        </button>
        <button
          onClick={() => setTimeRange('30d')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            timeRange === '30d' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
          }`}
        >
          30 Days
        </button>
        <button
          onClick={() => setTimeRange('90d')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            timeRange === '90d' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
          }`}
        >
          90 Days
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">₹2,06,000</p>
            </div>
            <DollarSign className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Bookings</p>
              <p className="text-2xl font-bold text-gray-900">206</p>
            </div>
            <Calendar className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Customers</p>
              <p className="text-2xl font-bold text-gray-900">142</p>
            </div>
            <Users className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg. Rating</p>
              <p className="text-2xl font-bold text-gray-900">4.8</p>
            </div>
            <TrendingUp className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4">Revenue Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={revenueData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Bookings Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={bookingData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="bookings" fill="#10B981" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

