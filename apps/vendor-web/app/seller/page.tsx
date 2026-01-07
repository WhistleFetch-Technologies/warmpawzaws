'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClientWithMock as apiClient } from '@/lib/api-client-with-mock';
import { SalesOverview } from '@/components/vendor/seller/SalesOverview';
import { RevenueChart } from '@/components/vendor/seller/RevenueChart';
import { ProductPerformance } from '@/components/vendor/seller/ProductPerformance';
import { OrderTrends } from '@/components/vendor/seller/OrderTrends';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SellerDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year'>('month');
  
  // Analytics Data
  const [salesData, setSalesData] = useState<any>(null);
  const [productData, setProductData] = useState<any>(null);
  const [orderStats, setOrderStats] = useState<any>(null);

  useEffect(() => {
    // Set mock vendorId if not exists (for local testing)
    if (typeof window !== 'undefined' && !localStorage.getItem('vendorId')) {
      localStorage.setItem('vendorId', 'mock-vendor-id');
    }
    const vendorId = localStorage.getItem('vendorId');
    if (!vendorId) {
      router.push('/onboarding');
      return;
    }
    loadAnalytics();
  }, [router, period]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) return;

      const [salesRes, productRes, statsRes] = await Promise.all([
        apiClient.get<any>(`/vendor/${vendorId}/analytics/sales?period=${period}`).catch(() => ({ salesStats: {}, revenueByDay: [], orderTrends: [] })),
        apiClient.get<any>(`/vendor/${vendorId}/analytics/products?period=${period}`).catch(() => ({ topProducts: [], productByCategory: [] })),
        apiClient.get<any>(`/vendor/${vendorId}/orders/stats`).catch(() => ({ stats: {} })),
      ]);

      setSalesData({
        salesStats: salesRes.salesStats || salesRes.salesStats || {},
        revenueByDay: salesRes.revenueByDay || [],
        orderTrends: salesRes.orderTrends || [],
      });

      setProductData({
        topProducts: productRes.topProducts || [],
        productByCategory: productRes.productByCategory || [],
      });

      setOrderStats(statsRes.stats || statsRes || {});
    } catch (err: any) {
      console.error('Error loading analytics:', err);
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) return;

      // TODO: Implement export endpoint
      alert(`Export ${format.toUpperCase()} functionality coming soon!`);
    } catch (err: any) {
      console.error('Error exporting:', err);
      alert('Failed to export data');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading seller dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Seller Dashboard</h1>
            <p className="text-gray-500 mt-1">E-commerce sales analytics and insights</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:border-orange-500 outline-none"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
            </select>
            <button
              onClick={() => handleExport('csv')}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
            >
              Export CSV
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              ← Back
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Sales Overview */}
        <SalesOverview 
          salesStats={salesData?.salesStats} 
          orderStats={orderStats}
          period={period}
        />

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <RevenueChart 
            data={salesData?.revenueByDay || []}
            period={period}
          />
          <OrderTrends 
            data={salesData?.orderTrends || []}
            period={period}
          />
        </div>

        {/* Product Performance */}
        <ProductPerformance 
          topProducts={productData?.topProducts || []}
          productByCategory={productData?.productByCategory || []}
          period={period}
        />
      </div>
    </div>
  );
}

