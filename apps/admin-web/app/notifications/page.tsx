'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';

// ============================================================================
// TYPES
// ============================================================================

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'promotion' | 'alert' | 'update';
  target_audience: 'all' | 'customers' | 'vendors' | 'admins';
  target_regions?: string[];
  target_user_ids?: string[];
  channels: ('push' | 'sms' | 'email' | 'in_app')[];
  scheduled_at?: string;
  sent_at?: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  sent_count: number;
  delivered_count: number;
  opened_count: number;
  created_at: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingNotification, setEditingNotification] = useState<Notification | null>(null);
  const [sending, setSending] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'promotion' | 'alert' | 'update',
    target_audience: 'all' as 'all' | 'customers' | 'vendors' | 'admins',
    channels: [] as ('push' | 'sms' | 'email' | 'in_app')[],
    scheduled_at: '',
  });

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiClient.get<any>('/admin/notifications');
      setNotifications(response.notifications || response || []);
    } catch (err: any) {
      console.error('Error loading notifications:', err);
      setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleCreate = () => {
    setEditingNotification(null);
    setFormData({
      title: '',
      message: '',
      type: 'info',
      target_audience: 'all',
      channels: [],
      scheduled_at: '',
    });
    setShowModal(true);
  };

  const handleSend = async () => {
    if (!formData.title || !formData.message || formData.channels.length === 0) {
      setError('Please fill all required fields and select at least one channel');
      return;
    }
    
    try {
      setSending(true);
      setError(null);
      
      await apiClient.post('/admin/notifications', {
        ...formData,
        scheduled_at: formData.scheduled_at || undefined,
      });
      
      setSuccess('Notification sent successfully');
      setShowModal(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const toggleChannel = (channel: 'push' | 'sms' | 'email' | 'in_app') => {
    setFormData(prev => ({
      ...prev,
      channels: prev.channels.includes(channel)
        ? prev.channels.filter(c => c !== channel)
        : [...prev.channels, channel],
    }));
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <AdminLayout>
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading notifications...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const typeIcons: Record<string, string> = {
    info: 'ℹ️',
    promotion: '🎁',
    alert: '⚠️',
    update: '🆕',
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    scheduled: 'bg-blue-100 text-blue-700',
    sending: 'bg-yellow-100 text-yellow-700',
    sent: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Notification Broadcast</h1>
              <p className="text-gray-500">Send notifications to users</p>
            </div>
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
            >
              + Send Notification
            </button>
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

          {/* Notifications List */}
          <div className="space-y-4">
            {notifications.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                <div className="text-5xl mb-4">📢</div>
                <p className="text-gray-500">No notifications sent yet</p>
              </div>
            ) : (
              notifications.map(notif => (
                <div key={notif.id} className="bg-white rounded-2xl p-6 shadow-sm">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-4">
                      <span className="text-3xl">{typeIcons[notif.type]}</span>
                      <div>
                        <h3 className="font-semibold text-gray-900">{notif.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{notif.message}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span>To: {notif.target_audience}</span>
                          <span>•</span>
                          <span>{notif.channels.join(', ')}</span>
                        </div>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[notif.status]}`}>
                      {notif.status}
                    </span>
                  </div>
                  
                  {notif.status === 'sent' && (
                    <div className="grid grid-cols-4 gap-4 pt-4 border-t">
                      <div>
                        <p className="text-xs text-gray-500">Sent</p>
                        <p className="font-medium">{notif.sent_count.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Delivered</p>
                        <p className="font-medium text-green-600">{notif.delivered_count.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Opened</p>
                        <p className="font-medium text-blue-600">{notif.opened_count.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Open Rate</p>
                        <p className="font-medium">
                          {notif.delivered_count > 0 
                            ? `${Math.round((notif.opened_count / notif.delivered_count) * 100)}%`
                            : '0%'}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {notif.scheduled_at && notif.status === 'scheduled' && (
                    <div className="pt-4 border-t">
                      <p className="text-sm text-gray-600">
                        Scheduled for: {new Date(notif.scheduled_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </main>
      </div>

      {/* Notification Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Send Notification</h3>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                  placeholder="Notification title"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                <textarea
                  value={formData.message}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none resize-none"
                  placeholder="Notification message"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                  >
                    <option value="info">Info</option>
                    <option value="promotion">Promotion</option>
                    <option value="alert">Alert</option>
                    <option value="update">Update</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
                  <select
                    value={formData.target_audience}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, target_audience: e.target.value as any }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                  >
                    <option value="all">All Users</option>
                    <option value="customers">Customers Only</option>
                    <option value="vendors">Vendors Only</option>
                    <option value="admins">Admins Only</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Channels *</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['push', 'sms', 'email', 'in_app'] as const).map(channel => (
                    <label key={channel} className="flex items-center gap-2 p-3 border rounded-xl hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.channels.includes(channel)}
                        onChange={() => toggleChannel(channel)}
                        className="rounded text-orange-500"
                      />
                      <span className="text-sm text-gray-700 capitalize">{channel.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Schedule (optional)</label>
                <input
                  type="datetime-local"
                  value={formData.scheduled_at}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, scheduled_at: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty to send immediately</p>
              </div>
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition disabled:opacity-50"
              >
                {sending ? 'Sending...' : formData.scheduled_at ? 'Schedule' : 'Send Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

