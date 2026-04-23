'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar, User, Activity, Clock } from 'lucide-react';
import { Card, Badge } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import { formatDistanceToNow } from 'date-fns';

interface CustomerActivityRow {
  id: string;
  vendorId: string;
  vendorName: string;
  activityType: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  severity: string;
}

export function CustomerActivityTracker() {
  const [activities, setActivities] = useState<CustomerActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'booking' | 'payment' | 'review' | 'status_change'>('all');

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<{ activities: CustomerActivityRow[] }>(
        `/admin/customers/activities?filter=${filter}&limit=50`
      );
      setActivities(data?.activities || []);
    } catch (error) {
      console.error('Error loading customer activities:', error);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadActivities();
    const interval = setInterval(loadActivities, 30000);
    return () => clearInterval(interval);
  }, [loadActivities]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'booking':
        return <Calendar className="w-4 h-4" />;
      case 'payment':
        return <Activity className="w-4 h-4" />;
      case 'review':
        return <User className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'success':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'error':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  if (loading && activities.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Recent customer activity</h3>
          <p className="text-sm text-gray-500 mt-1">Bookings and payments linked to customers</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['all', 'booking', 'payment', 'review', 'status_change'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === f ? 'bg-white text-[#FF8C42] shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {f === 'all' ? 'All' : f.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {activities.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No activities found</p>
          </div>
        ) : (
          activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
            >
              <div className={`p-2 rounded-lg ${getSeverityColor(activity.severity)}`}>{getActivityIcon(activity.activityType)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{activity.vendorName}</span>
                      <Badge variant="outline" className="text-xs">
                        {activity.activityType.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{activity.description}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    <span>{formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
