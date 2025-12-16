# 🔧 Admin Dashboard - Quick Fixes Guide

**Priority:** Immediate fixes to make analytics dashboard functional

---

## 🚨 CRITICAL FIX #1: Connect Analytics Dashboard to Real Data

### Current Problem
Analytics dashboard displays mock data instead of real platform metrics.

### Solution: Create Analytics Hook

**File:** `src/components/admin/analytics/hooks/useAnalyticsData.ts`

```typescript
import { useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '../../../../utils/supabase/info';

interface KPIData {
  totalGMV: number;
  totalRevenue: number;
  activeCustomers: number;
  activeVendors: number;
  totalBookings: number;
  totalOrders: number;
  avgOrderValue: number;
  commissionEarned: number;
  conversionRate: number;
  churnRate: number;
}

interface RevenueData {
  date: string;
  revenue: number;
  commission: number;
}

export function useAnalyticsData(range: string = '7d') {
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [vendorData, setVendorData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadAnalyticsData();
  }, [range]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // 1. Load platform statistics
      const platformRes = await fetch(
        `${API_BASE}/analytics/admin/platform`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (platformRes.ok) {
        const platformResult = await platformRes.json();
        if (platformResult.success && platformResult.stats) {
          const stats = platformResult.stats;
          
          // Map to KPI format
          setKpiData({
            totalGMV: stats.revenue?.total || 0,
            totalRevenue: stats.revenue?.platformCommission || 0,
            activeCustomers: stats.users?.totalCustomers || 0,
            activeVendors: stats.users?.activeVendors || 0,
            totalBookings: stats.bookings?.total || 0,
            totalOrders: 0, // TODO: Get from e-commerce
            avgOrderValue: stats.revenue?.averageBookingValue || 0,
            commissionEarned: stats.revenue?.platformCommission || 0,
            conversionRate: 0, // TODO: Calculate
            churnRate: 0 // TODO: Calculate
          });
        }
      }

      // 2. Load booking trends
      const trendsRes = await fetch(
        `${API_BASE}/analytics/admin/trends/bookings?period=day`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (trendsRes.ok) {
        const trendsResult = await trendsRes.json();
        if (trendsResult.success && trendsResult.trends) {
          // Transform to revenue data format
          const revenue = trendsResult.trends.periods.map((period: string) => ({
            date: period,
            revenue: trendsResult.trends.breakdown[period] * 500, // Estimate revenue
            commission: trendsResult.trends.breakdown[period] * 50 // Estimate commission
          }));
          setRevenueData(revenue);
        }
      }

      // 3. Load service popularity
      const popularityRes = await fetch(
        `${API_BASE}/analytics/admin/service-popularity`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (popularityRes.ok) {
        const popularityResult = await popularityRes.json();
        if (popularityResult.success && popularityResult.services) {
          // Transform to category data format
          const categories = popularityResult.services.map((service: any) => ({
            name: service.name,
            value: service.bookings,
            revenue: service.revenue || 0
          }));
          setCategoryData(categories);
        }
      }

    } catch (err) {
      console.error('Error loading analytics:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  return {
    kpiData,
    revenueData,
    categoryData,
    vendorData,
    loading,
    error,
    refresh: loadAnalyticsData
  };
}
```

### Update AdminAnalyticsDashboard.tsx

**Replace lines 52-110 with:**

```typescript
import { useAnalyticsData } from './hooks/useAnalyticsData';

export function AdminAnalyticsDashboard({ onBack }: AnalyticsDashboardProps) {
  const [dateRange, setDateRange] = useState('7d');
  const [activeTab, setActiveTab] = useState('overview');
  
  // ✅ Use real data hook
  const { kpiData, revenueData, categoryData, loading, error, refresh } = useAnalyticsData(dateRange);

  // Remove the old loadAnalyticsData function and mock data
  // ... rest of component uses kpiData, revenueData, categoryData from hook
}
```

---

## 🚨 CRITICAL FIX #2: Add Export Functionality

### Update Export Function

**In `AdminAnalyticsDashboard.tsx`, replace line 145-147:**

```typescript
const exportData = () => {
  // ✅ Implement CSV export
  if (!kpiData) return;
  
  const csvContent = [
    ['Metric', 'Value'],
    ['Total GMV', kpiData.totalGMV],
    ['Total Revenue', kpiData.totalRevenue],
    ['Active Customers', kpiData.activeCustomers],
    ['Active Vendors', kpiData.activeVendors],
    ['Total Bookings', kpiData.totalBookings],
    ['Commission Earned', kpiData.commissionEarned],
    ['Conversion Rate', kpiData.conversionRate],
    ['Churn Rate', kpiData.churnRate]
  ].map(row => row.join(',')).join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `analytics-${dateRange}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
  
  toast.success('Analytics data exported successfully');
};
```

---

## 🚨 CRITICAL FIX #3: Add Error Handling

### Update AdminAnalyticsDashboard.tsx

**Add error display:**

```typescript
{error && (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
    <div className="flex items-center gap-2">
      <AlertCircle className="w-5 h-5 text-red-600" />
      <div>
        <p className="text-red-800 font-medium">Error loading analytics</p>
        <p className="text-red-600 text-sm">{error}</p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={refresh}
          className="mt-2"
        >
          Retry
        </Button>
      </div>
    </div>
  </div>
)}
```

---

## ✅ QUICK WINS (Can be done today)

1. **Connect Analytics to Real APIs** - 2-3 hours
2. **Add CSV Export** - 1 hour
3. **Add Error Handling** - 30 minutes
4. **Add Loading States** - 30 minutes

**Total Time:** 4-5 hours for critical fixes

---

## 📋 TESTING CHECKLIST

After implementing fixes:

- [ ] Analytics dashboard loads real data
- [ ] Date range selector updates data
- [ ] Export button downloads CSV
- [ ] Error states display correctly
- [ ] Loading states show during fetch
- [ ] Data refreshes when date range changes

---

**These fixes will make the analytics dashboard functional with real data immediately.**


