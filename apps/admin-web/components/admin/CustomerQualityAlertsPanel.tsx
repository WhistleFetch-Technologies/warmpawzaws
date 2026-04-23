'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, TrendingDown, XCircle, Eye } from 'lucide-react';
import { Button, Badge } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';

interface QualityAlert {
  vendor_id: string;
  vendor_name: string;
  cancelled_bookings: number;
  low_rated_bookings: number;
}

interface CustomerQualityAlertsPanelProps {
  onViewCustomer?: (customerId: string) => void;
  maxAlerts?: number;
}

export function CustomerQualityAlertsPanel({ onViewCustomer, maxAlerts = 5 }: CustomerQualityAlertsPanelProps) {
  const [alerts, setAlerts] = useState<QualityAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/quality/customer-alerts');
      const alertsList = (data.alerts || []).slice(0, maxAlerts);
      setAlerts(alertsList);
    } catch (error) {
      console.error('Error loading customer quality alerts:', error);
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const getPriority = (alert: QualityAlert): 'high' | 'medium' | 'low' => {
    if (alert.cancelled_bookings > 10 || alert.low_rated_bookings > 5) return 'high';
    if (alert.cancelled_bookings > 5 || alert.low_rated_bookings > 3) return 'medium';
    return 'low';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'medium':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'low':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-orange-600" />
          <h3 className="font-semibold text-gray-900">Customer quality alerts</h3>
        </div>
        <div className="text-sm text-gray-500">Loading alerts...</div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-green-600" />
          <h3 className="font-semibold text-gray-900">Customer quality alerts</h3>
        </div>
        <div className="text-sm text-gray-500 text-center py-4">
          No customer quality alerts. All clear.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-600" />
          <h3 className="font-semibold text-gray-900">Customer quality alerts</h3>
          <Badge className="bg-orange-100 text-orange-700">{alerts.length}</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={loadAlerts}>
          Refresh
        </Button>
      </div>

      <div className="space-y-3">
        {alerts.map((alert) => {
          const priority = getPriority(alert);
          const hasCancellationIssue = alert.cancelled_bookings > 5;
          const hasRatingIssue = alert.low_rated_bookings > 3;

          return (
            <div
              key={alert.vendor_id}
              className={`border rounded-lg p-4 ${getPriorityColor(priority)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-gray-900">{alert.vendor_name || 'Unknown'}</h4>
                    <Badge className={getPriorityColor(priority)}>{priority.toUpperCase()}</Badge>
                  </div>

                  <div className="space-y-1 text-sm">
                    {hasCancellationIssue && (
                      <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-600" />
                        <span>
                          <strong>{alert.cancelled_bookings}</strong> cancelled bookings
                        </span>
                      </div>
                    )}
                    {hasRatingIssue && (
                      <div className="flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-orange-600" />
                        <span>
                          <strong>{alert.low_rated_bookings}</strong> low-rated bookings (&lt;3 stars)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {onViewCustomer && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onViewCustomer(alert.vendor_id)}
                    className="ml-4"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
