'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';

// ============================================================================
// TYPES
// ============================================================================

type DeliveryStatus =
  | 'created'
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'failed'
  | 'expired';

interface DeliveryNotification {
  id: string;
  recipient_type: string;
  recipient_id: string;
  notification_type: string;
  title: string;
  message: string;
  delivery_status: DeliveryStatus;
  is_read: boolean;
  channel_count: number;
  failed_channels: number;
  queued_at?: string;
  sent_at?: string;
  delivered_at?: string;
  opened_at?: string;
  failed_at?: string;
  failure_reason?: string;
  created_at: string;
}

interface DeliveryLogEntry {
  id: string;
  channel: string;
  attempt_number: number;
  status: string;
  provider?: string;
  error_message?: string;
  queued_at?: string;
  sent_at?: string;
  delivered_at?: string;
  opened_at?: string;
  failed_at?: string;
}

interface DeliveryStats {
  created: number;
  queued: number;
  sent: number;
  delivered: number;
  opened: number;
  failed: number;
  expired: number;
}

const STATUS_FILTERS: Array<{ value: '' | DeliveryStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'created', label: 'Created' },
  { value: 'queued', label: 'Queued' },
  { value: 'sent', label: 'Sent' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'opened', label: 'Opened' },
  { value: 'failed', label: 'Failed' },
  { value: 'expired', label: 'Expired' },
];

const statusColors: Record<string, string> = {
  created: 'bg-slate-100 text-slate-700',
  queued: 'bg-blue-100 text-blue-700',
  sent: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-green-100 text-green-700',
  opened: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-600',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<DeliveryNotification[]>([]);
  const [stats, setStats] = useState<DeliveryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'' | DeliveryStatus>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deliveryLogs, setDeliveryLogs] = useState<Record<string, DeliveryLogEntry[]>>({});
  const [loadingLogId, setLoadingLogId] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [formData, setFormData] = useState({
    recipientId: '',
    recipientType: 'customer' as 'customer' | 'vendor' | 'admin',
    title: '',
    message: '',
    sendPush: false,
    sendSms: false,
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const query = statusFilter ? `?status=${statusFilter}` : '';
      const [listRes, statsRes] = await Promise.all([
        apiClient.get<any>(`/admin/notifications/delivery${query}`),
        apiClient.get<any>('/admin/notifications/delivery/stats'),
      ]);

      setNotifications(listRes.notifications || []);
      setStats(statsRes.stats || null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load notifications';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadDeliveryLog = async (notificationId: string) => {
    if (deliveryLogs[notificationId]) {
      setExpandedId(expandedId === notificationId ? null : notificationId);
      return;
    }

    try {
      setLoadingLogId(notificationId);
      const res = await apiClient.get<any>(`/admin/notifications/${notificationId}/delivery-log`);
      setDeliveryLogs((prev) => ({ ...prev, [notificationId]: res.logs || [] }));
      setExpandedId(notificationId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load delivery log';
      setError(message);
    } finally {
      setLoadingLogId(null);
    }
  };

  const handleSendTest = async () => {
    if (!formData.recipientId || !formData.title || !formData.message) {
      setError('Recipient ID, title, and message are required');
      return;
    }

    try {
      setSending(true);
      setError(null);
      await apiClient.post('/admin/notifications/test', formData);
      setSuccess('Test notification sent through delivery engine');
      setShowModal(false);
      setFormData({
        recipientId: '',
        recipientType: 'customer',
        title: '',
        message: '',
        sendPush: false,
        sendSms: false,
      });
      loadData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send test notification';
      setError(message);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (value?: string) =>
    value ? new Date(value).toLocaleString() : '—';

  if (loading && notifications.length === 0) {
    return (
      <AdminLayout>
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto" />
            <p className="mt-4 text-gray-600">Loading notification delivery engine...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex-1 flex flex-col min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Notification Delivery Engine</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Monitor delivery lifecycle (created → queued → sent → delivered → opened)
                </p>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
              >
                + Send Test Notification
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-8 space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center justify-between">
                <span>{error}</span>
                <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
              </div>
            )}

            {success && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center justify-between">
                <span>{success}</span>
                <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-600">✕</button>
              </div>
            )}

            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {(Object.keys(stats) as Array<keyof DeliveryStats>).map((key) => (
                  <div key={key} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <p className="text-xs uppercase tracking-wide text-gray-500">{key}</p>
                    <p className="text-2xl font-semibold text-gray-900 mt-1">{stats[key]}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-sm font-medium text-gray-700">Filter by status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as '' | DeliveryStatus)}
                className="px-4 py-2 border border-gray-200 rounded-lg bg-white text-sm"
              >
                {STATUS_FILTERS.map((opt) => (
                  <option key={opt.value || 'all'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                onClick={loadData}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Refresh
              </button>
            </div>

            <div className="space-y-3">
              {notifications.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                  <div className="text-5xl mb-4">📬</div>
                  <p className="text-gray-500">No notifications match this filter</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div key={notif.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[notif.delivery_status] || statusColors.created}`}>
                              {notif.delivery_status}
                            </span>
                            <span className="text-xs text-gray-500">{notif.notification_type}</span>
                            {notif.is_read && (
                              <span className="text-xs text-emerald-600 font-medium">read</span>
                            )}
                          </div>
                          <h3 className="font-semibold text-gray-900">{notif.title}</h3>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{notif.message}</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-gray-500">
                            <span>{notif.recipient_type}: {notif.recipient_id.slice(0, 8)}…</span>
                            <span>Channels: {notif.channel_count}</span>
                            {notif.failed_channels > 0 && (
                              <span className="text-red-600">{notif.failed_channels} failed</span>
                            )}
                            <span>Created: {formatTime(notif.created_at)}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => loadDeliveryLog(notif.id)}
                          className="shrink-0 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                          {loadingLogId === notif.id
                            ? 'Loading…'
                            : expandedId === notif.id
                              ? 'Hide log'
                              : 'Delivery log'}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 pt-4 border-t text-xs">
                        <div><span className="text-gray-500">Queued</span><p className="font-medium">{formatTime(notif.queued_at)}</p></div>
                        <div><span className="text-gray-500">Sent</span><p className="font-medium">{formatTime(notif.sent_at)}</p></div>
                        <div><span className="text-gray-500">Delivered</span><p className="font-medium">{formatTime(notif.delivered_at)}</p></div>
                        <div><span className="text-gray-500">Opened</span><p className="font-medium">{formatTime(notif.opened_at)}</p></div>
                        <div><span className="text-gray-500">Failed</span><p className="font-medium text-red-600">{notif.failure_reason || formatTime(notif.failed_at)}</p></div>
                      </div>
                    </div>

                    {expandedId === notif.id && deliveryLogs[notif.id] && (
                      <div className="px-6 pb-6">
                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                              <tr>
                                <th className="px-4 py-2">Channel</th>
                                <th className="px-4 py-2">Status</th>
                                <th className="px-4 py-2">Delivered</th>
                                <th className="px-4 py-2">Opened</th>
                                <th className="px-4 py-2">Error</th>
                              </tr>
                            </thead>
                            <tbody>
                              {deliveryLogs[notif.id].length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="px-4 py-4 text-gray-500 text-center">
                                    No per-channel delivery log entries
                                  </td>
                                </tr>
                              ) : (
                                deliveryLogs[notif.id].map((log) => (
                                  <tr key={log.id} className="border-t border-gray-100">
                                    <td className="px-4 py-2 capitalize">{log.channel}</td>
                                    <td className="px-4 py-2">
                                      <span className={`px-2 py-0.5 rounded text-xs ${statusColors[log.status] || ''}`}>
                                        {log.status}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2">{formatTime(log.delivered_at)}</td>
                                    <td className="px-4 py-2">{formatTime(log.opened_at)}</td>
                                    <td className="px-4 py-2 text-red-600">{log.error_message || '—'}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Send Test Notification</h3>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipient ID (UUID) *</label>
                <input
                  type="text"
                  value={formData.recipientId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, recipientId: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                  placeholder="Customer or vendor UUID"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipient type</label>
                <select
                  value={formData.recipientType}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      recipientType: e.target.value as 'customer' | 'vendor' | 'admin',
                    }))
                  }
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none"
                >
                  <option value="customer">Customer</option>
                  <option value="vendor">Vendor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none resize-none"
                />
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.sendPush}
                    onChange={(e) => setFormData((prev) => ({ ...prev, sendPush: e.target.checked }))}
                  />
                  Also queue push
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.sendSms}
                    onChange={(e) => setFormData((prev) => ({ ...prev, sendSms: e.target.checked }))}
                  />
                  Also queue SMS
                </label>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSendTest}
                disabled={sending}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50"
              >
                {sending ? 'Sending…' : 'Send test'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
