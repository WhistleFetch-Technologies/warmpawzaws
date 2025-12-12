/**
 * useDashboardData Hook
 * Cached dashboard data fetching with React Query
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { cacheManager } from '../utils/cache-manager';
import PerformanceMonitor from '../utils/performance-monitor';
import Analytics from '../utils/analytics';
import CapabilityHelper from '../utils/capability-helper';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

export interface DashboardStats {
  appointments: number;
  consultations: number;
  earnings: number;
  pendingEarnings: number;
  completedServices: number;
  rating: number;
  totalReviews: number;
  activeOrders?: number;
}

export interface ScheduleItem {
  id: string;
  bookingId: string;
  time: string;
  duration: number;
  petName: string;
  petBreed?: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  serviceType: string;
  status: string;
  price: number;
  address: string;
  specialInstructions?: string;
  prescriptionUrl?: string;
  prescriptionNotes?: string;
  hasPrescription?: boolean;
  hasUnreadMessages?: boolean;
  unreadMessageCount?: number;
  chatEnabled?: boolean;
  isFollowUp?: boolean;
}

export interface WatchlistItem {
  watchlistId: string;
  petName: string;
  customerName: string;
  issue: string;
  lastUpdated: string;
}

export interface NotificationItem {
  notificationId: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}

export interface DashboardData {
  stats: DashboardStats;
  schedule?: ScheduleItem[];
  watchlist?: WatchlistItem[];
  notifications?: NotificationItem[];
  services?: any[];
  vendor?: any;
}

/**
 * Fetch complete dashboard data with parallel requests
 */
export function useDashboardData(
  vendorId?: string,
  timeframe: 'today' | 'week' | 'month' = 'today',
  capabilities?: any
) {
  return useQuery({
    queryKey: ['dashboard', vendorId, timeframe],
    queryFn: async (): Promise<DashboardData> => {
      if (!vendorId) throw new Error('Vendor ID is required');

      console.log('📊 Fetching dashboard data for:', vendorId);
      PerformanceMonitor.markStart(`dashboard-load-${vendorId}`);

      // Try cache first
      const cacheKey = `dashboard_${vendorId}_${timeframe}`;
      const cached = cacheManager.get<DashboardData>(cacheKey);
      if (cached) {
        console.log('💾 Using cached dashboard data');
        PerformanceMonitor.markEnd(`dashboard-load-${vendorId}`);
        return cached;
      }

      // Prepare parallel fetch promises based on capabilities
      const today = new Date().toISOString().split('T')[0];

      const fetchPromises: Promise<Response | null>[] = [
        // 1. Always fetch dashboard stats
        fetch(`${API_BASE}/vendor/dashboard/${vendorId}?timeframe=${timeframe}`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }),

        // 2. Fetch schedule if booking enabled
        CapabilityHelper.hasBooking(capabilities)
          ? fetch(`${API_BASE}/vendor/schedule/${vendorId}?date=${today}`, {
              headers: { 'Authorization': `Bearer ${publicAnonKey}` }
            })
          : Promise.resolve(null),

        // 3. Fetch watchlist if medical records enabled
        CapabilityHelper.hasMedicalRecords(capabilities)
          ? fetch(`${API_BASE}/vendor/watchlist/${vendorId}`, {
              headers: { 'Authorization': `Bearer ${publicAnonKey}` }
            })
          : Promise.resolve(null),

        // 4. Always fetch notifications
        fetch(`${API_BASE}/vendor/notifications/${vendorId}?limit=5`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }),

        // 5. Fetch services if catalog or booking enabled
        (CapabilityHelper.hasCatalog(capabilities) || CapabilityHelper.hasBooking(capabilities))
          ? fetch(`${API_BASE}/vendor/services/${vendorId}`, {
              headers: { 'Authorization': `Bearer ${publicAnonKey}` }
            })
          : Promise.resolve(null)
      ];

      // Execute all fetches in parallel
      const [
        dashboardRes,
        scheduleRes,
        watchlistRes,
        notificationsRes,
        servicesRes
      ] = await Promise.all(fetchPromises);

      // Process responses
      const dashboardData: DashboardData = {
        stats: {
          appointments: 0,
          consultations: 0,
          earnings: 0,
          pendingEarnings: 0,
          completedServices: 0,
          rating: 4.8,
          totalReviews: 0,
          activeOrders: 0
        }
      };

      // Process dashboard stats
      if (dashboardRes && dashboardRes.ok) {
        const data = await dashboardRes.json();
        if (data.success) {
          dashboardData.stats = data.stats;
          dashboardData.vendor = data.vendor;
        }
      }

      // Process schedule
      if (scheduleRes && scheduleRes.ok) {
        const data = await scheduleRes.json();
        if (data.success) {
          dashboardData.schedule = data.schedule || [];
        }
      }

      // Process watchlist
      if (watchlistRes && watchlistRes.ok) {
        const data = await watchlistRes.json();
        if (data.success) {
          dashboardData.watchlist = data.watchlist || [];
        }
      }

      // Process notifications
      if (notificationsRes && notificationsRes.ok) {
        const data = await notificationsRes.json();
        if (data.success) {
          dashboardData.notifications = data.notifications || [];
        }
      }

      // Process services
      if (servicesRes && servicesRes.ok) {
        const data = await servicesRes.json();
        if (data.success) {
          dashboardData.services = data.services || [];
        }
      }

      // Cache for 2 minutes (dashboard data changes frequently)
      cacheManager.save(cacheKey, dashboardData, 2 * 60 * 1000);

      const duration = PerformanceMonitor.markEnd(`dashboard-load-${vendorId}`);

      // Track analytics
      Analytics.dashboardViewed(vendorId, dashboardData.vendor?.roleId || 'unknown', duration);

      console.log('✅ Dashboard data loaded successfully (parallel fetch)');

      return dashboardData;
    },
    enabled: !!vendorId,
    staleTime: 1 * 60 * 1000, // 1 minute (dashboard should be relatively fresh)
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: true, // Always refetch on mount for latest data
  });
}

/**
 * Fetch dashboard stats only (lighter query)
 */
export function useDashboardStats(
  vendorId?: string,
  timeframe: 'today' | 'week' | 'month' = 'today'
) {
  return useQuery({
    queryKey: ['dashboard', 'stats', vendorId, timeframe],
    queryFn: async (): Promise<DashboardStats> => {
      if (!vendorId) throw new Error('Vendor ID is required');

      const response = await fetch(
        `${API_BASE}/vendor/dashboard/${vendorId}?timeframe=${timeframe}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch stats: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch stats');
      }

      return data.stats;
    },
    enabled: !!vendorId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Fetch today's schedule only
 */
export function useTodaySchedule(vendorId?: string, date?: string) {
  return useQuery({
    queryKey: ['schedule', vendorId, date || 'today'],
    queryFn: async (): Promise<ScheduleItem[]> => {
      if (!vendorId) throw new Error('Vendor ID is required');

      const today = date || new Date().toISOString().split('T')[0];

      const response = await fetch(
        `${API_BASE}/vendor/schedule/${vendorId}?date=${today}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch schedule: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch schedule');
      }

      return data.schedule || [];
    },
    enabled: !!vendorId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Fetch vendor notifications
 */
export function useNotifications(vendorId?: string, limit: number = 10) {
  return useQuery({
    queryKey: ['notifications', vendorId, limit],
    queryFn: async (): Promise<NotificationItem[]> => {
      if (!vendorId) throw new Error('Vendor ID is required');

      const response = await fetch(
        `${API_BASE}/vendor/notifications/${vendorId}?limit=${limit}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch notifications: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch notifications');
      }

      return data.notifications || [];
    },
    enabled: !!vendorId,
    staleTime: 30 * 1000, // 30 seconds (notifications should be fresh)
    refetchInterval: 60 * 1000, // Auto-refresh every minute
  });
}

/**
 * Invalidate dashboard cache
 */
export function useInvalidateDashboard() {
  const queryClient = useQueryClient();

  return (vendorId: string) => {
    // Clear localStorage cache
    cacheManager.invalidateDashboard(vendorId);

    // Invalidate React Query cache
    queryClient.invalidateQueries({ queryKey: ['dashboard', vendorId] });
    queryClient.invalidateQueries({ queryKey: ['schedule', vendorId] });
    queryClient.invalidateQueries({ queryKey: ['notifications', vendorId] });

    console.log('🔄 Dashboard cache invalidated');
  };
}

/**
 * Prefetch dashboard data for faster navigation
 */
export function usePrefetchDashboard() {
  const queryClient = useQueryClient();

  return (vendorId: string, timeframe: 'today' | 'week' | 'month' = 'today') => {
    queryClient.prefetchQuery({
      queryKey: ['dashboard', vendorId, timeframe],
      queryFn: async () => {
        const response = await fetch(
          `${API_BASE}/vendor/dashboard/${vendorId}?timeframe=${timeframe}`,
          {
            headers: { 'Authorization': `Bearer ${publicAnonKey}` }
          }
        );
        const data = await response.json();
        return data.success ? data : null;
      },
      staleTime: 2 * 60 * 1000,
    });

    console.log('⚡ Dashboard data prefetched');
  };
}
