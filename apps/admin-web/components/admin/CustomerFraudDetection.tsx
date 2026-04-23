'use client';

import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, TrendingDown, Eye } from 'lucide-react';
import { Card, Badge, Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';

interface FraudAlert {
  id: string;
  vendorId: string;
  vendorName: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  alertType: string;
  description: string;
  detectedAt: string;
  evidence: {
    transactionCount?: number;
    cancellationRate?: number;
  };
  status: 'new' | 'investigating' | 'resolved' | 'false_positive';
}

interface AbnormalBehavior {
  vendorId: string;
  vendorName: string;
  behaviorType: string;
  severity: 'warning' | 'alert';
  description: string;
  metrics: {
    value: number;
    threshold: number;
    trend: 'up' | 'down';
  };
}

export function CustomerFraudDetection() {
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);
  const [abnormalBehaviors, setAbnormalBehaviors] = useState<AbnormalBehavior[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFraudData();
    const interval = setInterval(loadFraudData, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadFraudData = async () => {
    try {
      setLoading(true);
      const [alertsData, behaviorsData] = await Promise.all([
        apiClient.get<any>('/admin/customers/fraud-alerts').catch(() => ({ alerts: [] })),
        apiClient.get<any>('/admin/customers/abnormal-behavior').catch(() => ({ behaviors: [] })),
      ]);

      setFraudAlerts(alertsData?.alerts || []);
      setAbnormalBehaviors(behaviorsData?.behaviors || []);
    } catch (error) {
      console.error('Error loading customer fraud data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'critical':
        return 'bg-red-600 text-white';
      case 'high':
        return 'bg-orange-500 text-white';
      case 'medium':
        return 'bg-yellow-500 text-white';
      default:
        return 'bg-blue-500 text-white';
    }
  };

  const getSeverityColor = (severity: string) => {
    return severity === 'alert'
      ? 'bg-red-50 border-red-200 text-red-700'
      : 'bg-yellow-50 border-yellow-200 text-yellow-700';
  };

  const handleAction = async (alertId: string, action: 'investigate' | 'resolve' | 'dismiss') => {
    try {
      await apiClient.post(`/admin/customers/fraud-alerts/${alertId}/${action}`, {});
      loadFraudData();
    } catch (error) {
      console.error('Error handling alert:', error);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 border-red-200 bg-red-50/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Shield className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Customer risk alerts</h3>
              <p className="text-sm text-gray-500">Suspicious cancellation / refund patterns</p>
            </div>
          </div>
          <Badge className="bg-red-600 text-white">{fraudAlerts.filter((a) => a.status === 'new').length} New</Badge>
        </div>

        {loading && fraudAlerts.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
          </div>
        ) : fraudAlerts.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-gray-600">No alerts</p>
          </div>
        ) : (
          <div className="space-y-3">
            {fraudAlerts.map((alert) => (
              <div key={alert.id} className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge className={getRiskColor(alert.riskLevel)}>{alert.riskLevel.toUpperCase()}</Badge>
                      <span className="font-semibold text-gray-900">{alert.vendorName}</span>
                      <Badge variant="outline" className="text-xs">
                        {alert.alertType.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{alert.description}</p>
                    <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                      {alert.evidence.transactionCount != null && (
                        <span>Transactions: {alert.evidence.transactionCount}</span>
                      )}
                      {alert.evidence.cancellationRate != null && (
                        <span>Cancellation: {alert.evidence.cancellationRate}%</span>
                      )}
                      <span>Detected: {new Date(alert.detectedAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {alert.status === 'new' && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => handleAction(alert.id, 'investigate')}>
                          <Eye className="w-4 h-4 mr-1" />
                          Investigate
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleAction(alert.id, 'dismiss')}>
                          Dismiss
                        </Button>
                      </>
                    )}
                    {alert.status === 'investigating' && (
                      <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleAction(alert.id, 'resolve')}>
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Abnormal behaviors</h3>
              <p className="text-sm text-gray-500">Customers with unusual booking patterns</p>
            </div>
          </div>
        </div>

        {abnormalBehaviors.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-gray-600">None detected</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {abnormalBehaviors.map((behavior, idx) => (
              <div key={idx} className={`p-4 rounded-lg border-2 ${getSeverityColor(behavior.severity)}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">{behavior.vendorName}</span>
                      <Badge className={behavior.severity === 'alert' ? 'bg-red-600' : 'bg-yellow-500'}>
                        {behavior.severity.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{behavior.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-orange-600" />
                    <span className="text-sm font-medium">
                      {behavior.metrics.value}
                      {behavior.behaviorType.includes('rating') ? '/5' : '%'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
