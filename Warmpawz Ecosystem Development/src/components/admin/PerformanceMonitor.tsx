import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import {
  Activity,
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  Server,
  Database,
  TrendingUp,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

const BASE_URL = `${getApiBaseUrl()}`;

interface PerformanceMetrics {
  timestamp: string;
  responseTime: {
    average: number;
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: {
    requestsPerSecond: number;
    requestsPerMinute: number;
  };
  errorRates: {
    total4xx: number;
    total5xx: number;
    errorRate: number;
  };
  systemHealth: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
  endpoints: Array<{
    path: string;
    avgResponseTime: number;
    requestCount: number;
    errorRate: number;
  }>;
}

interface Alert {
  alertId: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: string;
  resolved: boolean;
}

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchMetrics();
    fetchAlerts();

    let interval: any;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchMetrics();
        fetchAlerts();
      }, 30000); // Refresh every 30 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${BASE_URL}/performance/metrics`,
        {
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        const data = await response.json();
        setMetrics(data.metrics);
      }
    } catch (error) {
      console.error('Error fetching metrics:', error);
      toast.error('Failed to load performance metrics');
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await fetch(
        `${BASE_URL}/performance/alerts?limit=10`,
        {
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const response = await fetch(
        `${BASE_URL}/performance/alerts/${alertId}/resolve`,
        {
          method: 'POST',
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        toast.success('Alert resolved');
        fetchAlerts();
      }
    } catch (error) {
      console.error('Error resolving alert:', error);
      toast.error('Failed to resolve alert');
    }
  };

  const getHealthColor = (value: number) => {
    if (value >= 90) return 'text-red-600 bg-red-100';
    if (value >= 70) return 'text-orange-600 bg-orange-100';
    return 'text-green-600 bg-green-100';
  };

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-orange-600" />;
      default:
        return <CheckCircle className="w-5 h-5 text-blue-600" />;
    }
  };

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-red-200 bg-red-50';
      case 'warning':
        return 'border-orange-200 bg-orange-50';
      default:
        return 'border-blue-200 bg-blue-50';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Performance Monitor
            </h1>
            <p className="text-gray-600">
              Real-time system performance and health metrics
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300"
              />
              Auto-refresh (30s)
            </label>

            <Button
              onClick={fetchMetrics}
              variant="outline"
              className="border-2 border-gray-200"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {loading && !metrics ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600" />
        </div>
      ) : !metrics ? (
        <div className="bg-white rounded-xl border-2 border-gray-200 p-12 text-center">
          <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="font-bold text-gray-900 mb-2">No Data Available</h3>
          <p className="text-gray-600">Performance metrics are not available</p>
        </div>
      ) : (
        <>
          {/* Response Time Metrics */}
          <div className="grid md:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-sm text-gray-600">Average Response</p>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {metrics.responseTime.average.toFixed(0)}ms
              </p>
            </div>

            <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Zap className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-sm text-gray-600">P95 Latency</p>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {metrics.responseTime.p95.toFixed(0)}ms
              </p>
            </div>

            <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <p className="text-sm text-gray-600">Requests/min</p>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {metrics.throughput.requestsPerMinute.toFixed(0)}
              </p>
            </div>

            <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                </div>
                <p className="text-sm text-gray-600">Error Rate</p>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {metrics.errorRates.errorRate.toFixed(2)}%
              </p>
            </div>
          </div>

          {/* System Health */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Server className="w-5 h-5 text-orange-600" />
              System Health
            </h3>

            <div className="grid md:grid-cols-4 gap-6">
              {/* CPU */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">CPU Usage</span>
                  <span className={`text-sm font-bold px-2 py-1 rounded ${getHealthColor(metrics.systemHealth.cpu)}`}>
                    {metrics.systemHealth.cpu.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-orange-500"
                    style={{ width: `${metrics.systemHealth.cpu}%` }}
                  />
                </div>
              </div>

              {/* Memory */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Memory Usage</span>
                  <span className={`text-sm font-bold px-2 py-1 rounded ${getHealthColor(metrics.systemHealth.memory)}`}>
                    {metrics.systemHealth.memory.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-orange-500"
                    style={{ width: `${metrics.systemHealth.memory}%` }}
                  />
                </div>
              </div>

              {/* Disk */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Disk Usage</span>
                  <span className={`text-sm font-bold px-2 py-1 rounded ${getHealthColor(metrics.systemHealth.disk)}`}>
                    {metrics.systemHealth.disk.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-orange-500"
                    style={{ width: `${metrics.systemHealth.disk}%` }}
                  />
                </div>
              </div>

              {/* Network */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Network Usage</span>
                  <span className={`text-sm font-bold px-2 py-1 rounded ${getHealthColor(metrics.systemHealth.network)}`}>
                    {metrics.systemHealth.network.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-orange-500"
                    style={{ width: `${metrics.systemHealth.network}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Top Endpoints */}
          <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-600" />
              Top Endpoints by Traffic
            </h3>

            <div className="space-y-3">
              {metrics.endpoints.slice(0, 10).map((endpoint, idx) => (
                <div key={idx} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-mono text-sm text-gray-900 mb-1">
                      {endpoint.path}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <span>{endpoint.requestCount.toLocaleString()} requests</span>
                      <span>{endpoint.avgResponseTime.toFixed(0)}ms avg</span>
                      <span className={endpoint.errorRate > 5 ? 'text-red-600' : 'text-green-600'}>
                        {endpoint.errorRate.toFixed(2)}% errors
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
              <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                Active Alerts ({alerts.filter(a => !a.resolved).length})
              </h3>

              <div className="space-y-3">
                {alerts.filter(a => !a.resolved).map((alert) => (
                  <div
                    key={alert.alertId}
                    className={`flex items-center gap-4 p-4 border-2 rounded-lg ${getAlertColor(alert.severity)}`}
                  >
                    {getAlertIcon(alert.severity)}
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{alert.message}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      onClick={() => resolveAlert(alert.alertId)}
                      size="sm"
                      variant="outline"
                      className="border-2"
                    >
                      Resolve
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
