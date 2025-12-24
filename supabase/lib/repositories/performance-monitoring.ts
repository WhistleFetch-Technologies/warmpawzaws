/**
 * ============================================================================
 * PERFORMANCE MONITORING REPOSITORY
 * ============================================================================
 * 
 * Repository for performance metrics tracking.
 * Replaces: metric:{metricId} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ All queries use prepared statements
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient } from "../db.ts";

// ============================================================================
// TYPES
// ============================================================================

export interface PerformanceMetric {
  id: string;
  metric_id?: string | null;
  metric_name: string;
  metric_value: number;
  metric_type: string;
  endpoint?: string | null;
  method?: string | null;
  status_code?: number | null;
  user_id?: string | null;
  user_type?: 'customer' | 'vendor' | 'admin' | null;
  error_message?: string | null;
  metadata?: any | null;
  recorded_at: string;
}

export interface CreatePerformanceMetricInput {
  metric_id?: string;
  metric_name: string;
  metric_value: number;
  metric_type: string;
  endpoint?: string;
  method?: string;
  status_code?: number;
  user_id?: string;
  user_type?: 'customer' | 'vendor' | 'admin';
  error_message?: string;
  metadata?: any;
}

// ============================================================================
// REPOSITORY
// ============================================================================

export function getPerformanceMonitoringRepository() {
  const client = getDbClient();

  return {
    async createMetric(input: CreatePerformanceMetricInput): Promise<PerformanceMetric> {
      const metric_id = input.metric_id || `METRIC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const { data, error } = await client
        .from('performance_metrics')
        .insert({
          metric_id: metric_id,
          metric_name: input.metric_name || input.endpoint || 'api_request',
          metric_value: input.metric_value || 0, // responseTime in milliseconds
          metric_type: input.metric_type || 'api_response_time',
          endpoint: input.endpoint,
          method: input.method,
          status_code: input.status_code,
          user_id: input.user_id,
          user_type: input.user_type,
          error_message: input.error_message,
          metadata: input.metadata,
          recorded_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data as PerformanceMetric;
    },

    async getMetrics(filters?: {
      endpoint?: string;
      minutes?: number;
      limit?: number;
    }): Promise<PerformanceMetric[]> {
      let query = client
        .from('performance_metrics')
        .select('*');

      if (filters?.endpoint) {
        query = query.eq('endpoint', filters.endpoint);
      }

      if (filters?.minutes) {
        const cutoffTime = new Date();
        cutoffTime.setMinutes(cutoffTime.getMinutes() - filters.minutes);
        query = query.gte('recorded_at', cutoffTime.toISOString());
      }

      query = query
        .order('recorded_at', { ascending: false })
        .limit(filters?.limit || 100);

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as PerformanceMetric[];
    }
  };
}

