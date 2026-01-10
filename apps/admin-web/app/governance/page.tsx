'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';

// ============================================================================
// TYPES
// ============================================================================

interface GovernanceStatus {
  cache: {
    status: 'healthy' | 'degraded' | 'down';
    lastInvalidated: string | null;
    hitRate: number;
    size: number;
  };
  config: {
    version: string;
    lastPropagated: string | null;
    pendingChanges: number;
  };
  services: {
    api: { status: 'up' | 'down'; latency: number };
    database: { status: 'up' | 'down'; connections: number };
    sns: { status: 'up' | 'down'; messagesQueued: number };
    s3: { status: 'up' | 'down' };
  };
  lastSync: string;
}

interface AuditLogEntry {
  id: string;
  action: string;
  actor: string;
  actorRole: string;
  target: string;
  details: Record<string, any>;
  status: 'success' | 'failure';
  timestamp: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function GovernancePage() {
  const [status, setStatus] = useState<GovernanceStatus | null>(null);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Action states
  const [invalidating, setInvalidating] = useState(false);
  const [propagating, setPropagating] = useState(false);
  const [selectedCacheType, setSelectedCacheType] = useState<string>('all');

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadData();
    // Refresh status every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [statusRes, auditRes] = await Promise.all([
        apiClient.get<any>('/admin/governance/status'),
        apiClient.get<any>('/admin/governance/audit-log?limit=50'),
      ]);
      
      setStatus(statusRes.status || statusRes);
      setAuditLog(auditRes.entries || auditRes || []);
    } catch (err: any) {
      console.error('Error loading governance data:', err);
      setError(err.message || 'Failed to load governance status');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleInvalidateCache = async () => {
    if (!confirm(`Invalidate ${selectedCacheType === 'all' ? 'ALL' : selectedCacheType} cache? This may temporarily impact performance.`)) return;
    
    try {
      setInvalidating(true);
      setError(null);
      
      await apiClient.post('/admin/governance/invalidate-cache', {
        cacheType: selectedCacheType,
      });
      
      setSuccess(`${selectedCacheType === 'all' ? 'All caches' : selectedCacheType + ' cache'} invalidated successfully`);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to invalidate cache');
    } finally {
      setInvalidating(false);
    }
  };

  const handlePropagateConfig = async () => {
    if (!confirm('Propagate configuration to all instances? This will update all connected services.')) return;
    
    try {
      setPropagating(true);
      setError(null);
      
      await apiClient.post('/admin/governance/propagate', {
        type: 'full_config_sync',
      });
      
      setSuccess('Configuration propagated to all instances');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to propagate configuration');
    } finally {
      setPropagating(false);
    }
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const StatusIndicator = ({ status }: { status: 'up' | 'down' | 'healthy' | 'degraded' }) => {
    const colors: Record<string, string> = {
      up: 'bg-green-500',
      healthy: 'bg-green-500',
      down: 'bg-red-500',
      degraded: 'bg-yellow-500',
    };
    return (
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${colors[status]} animate-pulse`}></div>
        <span className="text-sm capitalize">{status}</span>
      </div>
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading && !status) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading governance status...</p>
        </div>
      </div>
    );
  }

  const cacheTypes = [
    { id: 'all', label: 'All Caches', icon: '🗑️' },
    { id: 'vendors', label: 'Vendor Cache', icon: '🏪' },
    { id: 'services', label: 'Services Cache', icon: '📚' },
    { id: 'bookings', label: 'Bookings Cache', icon: '📅' },
    { id: 'roles', label: 'Roles Cache', icon: '👤' },
    { id: 'config', label: 'Config Cache', icon: '⚙️' },
  ];

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Governance Dashboard</h1>
            <p className="text-gray-500">System health, cache management, and configuration</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              Last sync: {status?.lastSync ? new Date(status.lastSync).toLocaleTimeString() : 'Never'}
            </span>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="p-8">
        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
          </div>
        )}
        
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-600">✕</button>
          </div>
        )}

        {/* Service Status Grid */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Service Health</h2>
          <div className="grid grid-cols-4 gap-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl">🌐</span>
                <StatusIndicator status={status?.services?.api?.status || 'down'} />
              </div>
              <h3 className="font-semibold text-gray-900">API Gateway</h3>
              <p className="text-sm text-gray-500">
                Latency: {status?.services?.api?.latency || 0}ms
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl">🗄️</span>
                <StatusIndicator status={status?.services?.database?.status || 'down'} />
              </div>
              <h3 className="font-semibold text-gray-900">Database (RDS)</h3>
              <p className="text-sm text-gray-500">
                Connections: {status?.services?.database?.connections || 0}
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl">📬</span>
                <StatusIndicator status={status?.services?.sns?.status || 'down'} />
              </div>
              <h3 className="font-semibold text-gray-900">SNS (Notifications)</h3>
              <p className="text-sm text-gray-500">
                Queued: {status?.services?.sns?.messagesQueued || 0}
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl">📦</span>
                <StatusIndicator status={status?.services?.s3?.status || 'down'} />
              </div>
              <h3 className="font-semibold text-gray-900">S3 Storage</h3>
              <p className="text-sm text-gray-500">File storage service</p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-8">
          {/* Cache Management */}
          <section className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Cache Management</h2>
            
            {/* Cache Status */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Cache Status</span>
                <StatusIndicator status={status?.cache?.status || 'down'} />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <p className="text-xs text-gray-500">Hit Rate</p>
                  <p className="text-2xl font-bold text-green-600">{status?.cache?.hitRate || 0}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Cache Size</p>
                  <p className="text-2xl font-bold text-gray-900">{status?.cache?.size || 0} MB</p>
                </div>
              </div>
              {status?.cache?.lastInvalidated && (
                <p className="text-xs text-gray-400 mt-4">
                  Last invalidated: {new Date(status.cache.lastInvalidated).toLocaleString()}
                </p>
              )}
            </div>

            {/* Cache Invalidation */}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">Select Cache to Invalidate</label>
              <div className="grid grid-cols-3 gap-2">
                {cacheTypes.map(cache => (
                  <button
                    key={cache.id}
                    onClick={() => setSelectedCacheType(cache.id)}
                    className={`p-3 rounded-lg text-sm transition ${
                      selectedCacheType === cache.id
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span className="block text-lg mb-1">{cache.icon}</span>
                    {cache.label}
                  </button>
                ))}
              </div>
              <button
                onClick={handleInvalidateCache}
                disabled={invalidating}
                className="w-full py-3 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition disabled:opacity-50"
              >
                {invalidating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⏳</span> Invalidating...
                  </span>
                ) : (
                  `🗑️ Invalidate ${selectedCacheType === 'all' ? 'All Caches' : selectedCacheType + ' Cache'}`
                )}
              </button>
            </div>
          </section>

          {/* Configuration Propagation */}
          <section className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuration Propagation</h2>
            
            {/* Config Status */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-700">Current Config Version</span>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-mono">
                  {status?.config?.version || 'v1.0.0'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Pending Changes</p>
                  <p className="text-2xl font-bold text-yellow-600">{status?.config?.pendingChanges || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Last Propagated</p>
                  <p className="text-sm font-medium text-gray-900">
                    {status?.config?.lastPropagated 
                      ? new Date(status.config.lastPropagated).toLocaleString()
                      : 'Never'
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Propagation Actions */}
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-700 text-sm">
                  ⚠️ Configuration propagation will update all connected Lambda functions and refresh cached data across the platform.
                </p>
              </div>
              <button
                onClick={handlePropagateConfig}
                disabled={propagating}
                className="w-full py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition disabled:opacity-50"
              >
                {propagating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⏳</span> Propagating...
                  </span>
                ) : (
                  '🚀 Propagate Configuration'
                )}
              </button>
            </div>
          </section>
        </div>

        {/* Audit Log */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Governance Actions</h2>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Actor</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {auditLog.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      <div className="text-4xl mb-2">📋</div>
                      <p>No recent governance actions</p>
                    </td>
                  </tr>
                ) : (
                  auditLog.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-gray-900">{entry.action}</span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div>
                          <p className="text-gray-900">{entry.actor}</p>
                          <p className="text-gray-400 text-xs">{entry.actorRole}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{entry.target}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          entry.status === 'success' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {entry.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      </div>
    </AdminLayout>
  );
}

