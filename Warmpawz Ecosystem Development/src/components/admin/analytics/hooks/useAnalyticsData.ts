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
  customerLTV: number;
  customerCAC: number;
  retentionRate: number;
  repeatPurchaseRate: number;
  profitMargin: number;
}

interface RevenueData {
  date: string;
  revenue: number;
  commission: number;
  count: number;
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
      // Load KPI data
      const kpiResponse = await fetch(
        `${API_BASE}/admin/analytics/kpi?range=${range}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (kpiResponse.ok) {
        const kpiResult = await kpiResponse.json();
        if (kpiResult.success) {
          setKpiData(kpiResult.data);
        }
      }

      // Load revenue data
      const revenueResponse = await fetch(
        `${API_BASE}/admin/analytics/revenue?range=${range}&groupBy=day`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (revenueResponse.ok) {
        const revenueResult = await revenueResponse.json();
        if (revenueResult.success) {
          setRevenueData(revenueResult.data);
        }
      }

      // Load category data
      const categoryResponse = await fetch(
        `${API_BASE}/admin/analytics/revenue?range=${range}&groupBy=category`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (categoryResponse.ok) {
        const categoryResult = await categoryResponse.json();
        if (categoryResult.success) {
          setCategoryData(categoryResult.data);
        }
      }

      // Load vendor performance
      const vendorResponse = await fetch(
        `${API_BASE}/admin/analytics/vendor-performance?range=${range}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      if (vendorResponse.ok) {
        const vendorResult = await vendorResponse.json();
        if (vendorResult.success) {
          setVendorData(vendorResult.data);
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
