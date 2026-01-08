import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export interface KPIData {
  totalGMV: number;
  commissionEarned: number;
  activeCustomers: number;
  activeVendors: number;
  totalOrders: number;
  completionRate: number;
  totalRevenue: number;
  avgOrderValue: number;
  conversionRate?: number;
  customerLTV?: number;
  customerCAC?: number;
  retentionRate?: number;
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  commission: number;
  count?: number;
}

export interface CategoryDataPoint {
  name: string;
  value: number;
  revenue?: number;
  count?: number;
}

export interface VendorPerformanceData {
  id: string;
  name: string;
  category: string;
  totalRevenue: number;
  totalBookings: number;
  rating: number;
  status: string;
  growth: number;
}

export interface UseAnalyticsDataReturn {
  kpiData: KPIData | null;
  revenueData: RevenueDataPoint[];
  categoryData: CategoryDataPoint[];
  vendorData: VendorPerformanceData[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useAnalyticsData(dateRange: string = '7d'): UseAnalyticsDataReturn {
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueDataPoint[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryDataPoint[]>([]);
  const [vendorData, setVendorData] = useState<VendorPerformanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch analytics data from API
      const [kpisRes, revenueRes, categoryRes, vendorRes] = await Promise.all([
        apiClient.get<any>(`/admin/analytics/kpis?period=${dateRange}`).catch(() => ({})),
        apiClient.get<any>(`/admin/analytics/revenue?period=${dateRange}`).catch(() => ({ data: [] })),
        apiClient.get<any>(`/admin/analytics/categories?period=${dateRange}`).catch(() => ({ data: [] })),
        apiClient.get<any>(`/admin/analytics/vendors?period=${dateRange}`).catch(() => ({ data: [] })),
      ]);

      // Process KPI data
      if (kpisRes && (kpisRes.kpis || kpisRes.totalGMV !== undefined)) {
        const kpis = kpisRes.kpis || kpisRes;
        setKpiData({
          totalGMV: kpis.totalGMV || 0,
          commissionEarned: kpis.commissionEarned || 0,
          activeCustomers: kpis.activeCustomers || 0,
          activeVendors: kpis.activeVendors || 0,
          totalOrders: kpis.totalOrders || 0,
          completionRate: kpis.completionRate || 0,
          totalRevenue: kpis.totalRevenue || 0,
          avgOrderValue: kpis.avgOrderValue || 0,
          conversionRate: kpis.conversionRate,
          customerLTV: kpis.customerLTV,
          customerCAC: kpis.customerCAC,
          retentionRate: kpis.retentionRate,
        });
      } else {
        // Default empty data
        setKpiData({
          totalGMV: 0,
          commissionEarned: 0,
          activeCustomers: 0,
          activeVendors: 0,
          totalOrders: 0,
          completionRate: 0,
          totalRevenue: 0,
          avgOrderValue: 0,
        });
      }

      // Process revenue data
      const revenue = revenueRes.data || revenueRes.revenue || revenueRes || [];
      setRevenueData(Array.isArray(revenue) ? revenue : []);

      // Process category data
      const categories = categoryRes.data || categoryRes.categories || categoryRes || [];
      setCategoryData(Array.isArray(categories) ? categories : []);

      // Process vendor data
      const vendors = vendorRes.data || vendorRes.vendors || vendorRes || [];
      setVendorData(Array.isArray(vendors) ? vendors : []);

    } catch (err: any) {
      console.error('Error fetching analytics data:', err);
      setError(err.message || 'Failed to load analytics data');
      
      // Set default empty data on error
      setKpiData({
        totalGMV: 0,
        commissionEarned: 0,
        activeCustomers: 0,
        activeVendors: 0,
        totalOrders: 0,
        completionRate: 0,
        totalRevenue: 0,
        avgOrderValue: 0,
      });
      setRevenueData([]);
      setCategoryData([]);
      setVendorData([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    kpiData,
    revenueData,
    categoryData,
    vendorData,
    loading,
    error,
    refresh: fetchData,
  };
}

