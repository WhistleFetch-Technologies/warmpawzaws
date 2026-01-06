'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { AdminLayout } from '@/components/AdminLayout';

// ============================================================================
// TYPES
// ============================================================================

interface KPI {
  id: string;
  name: string;
  value: number;
  previousValue: number;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  format: 'number' | 'currency' | 'percentage';
  icon: string;
}

interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    color: string;
  }>;
}

interface TopItem {
  id: string;
  name: string;
  value: number;
  subtext?: string;
  change?: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | '12m'>('30d');
  
  // Data
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [revenueChart, setRevenueChart] = useState<ChartData | null>(null);
  const [bookingsChart, setBookingsChart] = useState<ChartData | null>(null);
  const [topVendors, setTopVendors] = useState<TopItem[]>([]);
  const [topServices, setTopServices] = useState<TopItem[]>([]);
  const [topCities, setTopCities] = useState<TopItem[]>([]);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadData();
  }, [dateRange]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [kpisRes, chartsRes, topsRes] = await Promise.all([
        apiClient.get<any>(`/admin/analytics/kpis?period=${dateRange}`),
        apiClient.get<any>(`/admin/analytics/charts?period=${dateRange}`),
        apiClient.get<any>(`/admin/analytics/top-performers?period=${dateRange}`),
      ]);
      
      setKpis(kpisRes.kpis || kpisRes || []);
      setRevenueChart(chartsRes.revenue || chartsRes?.data?.revenue);
      setBookingsChart(chartsRes.bookings || chartsRes?.data?.bookings);
      setTopVendors(topsRes.vendors || topsRes?.data?.vendors || []);
      setTopServices(topsRes.services || topsRes?.data?.services || []);
      setTopCities(topsRes.cities || topsRes?.data?.cities || []);
    } catch (err: any) {
      console.error('Error loading analytics:', err);
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // HELPERS
  // ============================================================================

  const formatValue = (value: number, format: string) => {
    if (format === 'currency') return `₹${value.toLocaleString('en-IN')}`;
    if (format === 'percentage') return `${value}%`;
    return value.toLocaleString('en-IN');
  };

  // Simple bar chart renderer
  const renderBarChart = (data: ChartData, height: number = 200) => {
    const maxValue = Math.max(...data.datasets.flatMap(d => d.data));
    const step = Math.ceil(data.labels.length / 15); // Show max 15 labels
    
    return (
      <div className="relative" style={{ height }}>
        <div className="absolute inset-0 flex items-end gap-1">
          {data.datasets[0].data.map((value, i) => (
            <div key={i} className="flex-1 flex flex-col items-center">
              <div
                className="w-full rounded-t transition-all hover:opacity-80"
                style={{
                  height: `${(value / maxValue) * 100}%`,
                  backgroundColor: data.datasets[0].color,
                  minHeight: 2,
                }}
                title={`${data.labels[i]}: ${value.toLocaleString()}`}
              />
            </div>
          ))}
        </div>
        <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-400 transform translate-y-5">
          {data.labels.filter((_, i) => i % step === 0).map((label, i) => (
            <span key={i}>{label}</span>
          ))}
        </div>
      </div>
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <AdminLayout>
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading analytics...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
              <p className="text-gray-500">Platform performance insights</p>
            </div>
            <div className="flex items-center gap-3">
              {(['7d', '30d', '90d', '12m'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    dateRange === range
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : range === '90d' ? '90 Days' : '12 Months'}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main className="p-8">
          {/* Error */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
            </div>
          )}

          {/* KPIs Grid */}
          <div className="grid grid-cols-6 gap-4 mb-8">
            {kpis.map(kpi => (
              <div key={kpi.id} className="bg-white rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{kpi.icon}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    kpi.changeType === 'increase' ? 'bg-green-100 text-green-700' :
                    kpi.changeType === 'decrease' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {kpi.changeType === 'increase' ? '↑' : kpi.changeType === 'decrease' ? '↓' : '→'} {Math.abs(kpi.change)}%
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatValue(kpi.value, kpi.format)}</p>
                <p className="text-sm text-gray-500 mt-1">{kpi.name}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            {/* Revenue Chart */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Revenue Trend</h3>
                  <p className="text-sm text-gray-500">Daily revenue over time</p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                    Revenue
                  </span>
                </div>
              </div>
              {revenueChart && renderBarChart(revenueChart, 200)}
            </div>

            {/* Bookings Chart */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Bookings Trend</h3>
                  <p className="text-sm text-gray-500">Daily bookings over time</p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                    Bookings
                  </span>
                </div>
              </div>
              {bookingsChart && renderBarChart(bookingsChart, 200)}
            </div>
          </div>

          {/* Top Performers */}
          <div className="grid grid-cols-3 gap-6">
            {/* Top Vendors */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Vendors</h3>
              <div className="space-y-4">
                {topVendors.map((vendor, idx) => (
                  <div key={vendor.id} className="flex items-center gap-4">
                    <span className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-sm">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{vendor.name}</p>
                      <p className="text-sm text-gray-500">{vendor.subtext}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">₹{(vendor.value / 1000).toFixed(0)}K</p>
                      {vendor.change !== undefined && (
                        <p className={`text-xs ${vendor.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {vendor.change >= 0 ? '+' : ''}{vendor.change}%
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Services */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Services</h3>
              <div className="space-y-4">
                {topServices.map((service, idx) => (
                  <div key={service.id} className="flex items-center gap-4">
                    <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{service.name}</p>
                      <p className="text-sm text-gray-500">{service.subtext}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{service.value.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">bookings</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Cities */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Cities</h3>
              <div className="space-y-4">
                {topCities.map((city, idx) => (
                  <div key={city.id} className="flex items-center gap-4">
                    <span className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold text-sm">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{city.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{city.value.toLocaleString()}</p>
                      {city.change !== undefined && (
                        <p className={`text-xs ${city.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {city.change >= 0 ? '+' : ''}{city.change}%
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </AdminLayout>
  );
}

