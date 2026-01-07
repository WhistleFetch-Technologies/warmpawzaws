'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { CheckCircle, XCircle, AlertTriangle, Loader2, Activity } from 'lucide-react';

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  services: {
    name: string;
    status: 'up' | 'down';
    responseTime?: number;
  }[];
}

export function SystemHealthTab() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHealth();
    const interval = setInterval(loadHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadHealth = async () => {
    try {
      const response = await apiClient.get<any>('/admin/operations/health');
      if (response.success && response.health) {
        setHealth(response.health);
      }
    } catch (error) {
      console.error('Error loading system health:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!health) {
    return <div className="text-center py-12 text-gray-500">No health data available</div>;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': case 'up': return 'text-green-600';
      case 'degraded': return 'text-yellow-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
        <div className="flex items-center gap-0 mb-4">
          <Activity className="w-5 h-5 text-orange-600" />
          <h2 className="text-lg font-semibold text-gray-900">System Status</h2>
        </div>
        <div className={`text-2xl font-bold ${getStatusColor(health.status)}`}>
          {health.status.toUpperCase()}
        </div>
      </div>

      <div className="bg-white rounded-lg border-2 border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-0">Services</h3>
        <div className="space-y-2">
          {health.services.map((service) => (
            <div key={service.name} className="flex items-center justify-between p-0 hover:bg-gray-50 rounded">
              <div className="flex items-center gap-0">
                {service.status === 'up' ? (
                  <CheckCircle className={`w-4 h-4 ${getStatusColor(service.status)}`} />
                ) : (
                  <XCircle className={`w-4 h-4 ${getStatusColor(service.status)}`} />
                )}
                <span className="text-sm text-gray-900">{service.name}</span>
              </div>
              {service.responseTime && (
                <span className="text-xs text-gray-500">{service.responseTime}ms</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

