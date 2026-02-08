'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Input, Label, Select, SelectTrigger, SelectContent, SelectItem, SelectValue, Switch } from '@warmpawz/ui';
import { Plus, Edit, Trash2, Webhook, CheckCircle2, XCircle, Clock, Activity } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { useCrud } from '@/hooks/useCrud';

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret?: string;
  is_active: boolean;
  retry_count: number;
  timeout_seconds: number;
  last_triggered_at?: string;
  success_count: number;
  failure_count: number;
  created_at: string;
}

interface WebhookEvent {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: any;
  status: 'pending' | 'success' | 'failed' | 'retrying';
  attempts: number;
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

const AVAILABLE_EVENTS = [
  { id: 'vendor.approved', name: 'Vendor Approved', description: 'Triggered when a vendor is approved' },
  { id: 'vendor.rejected', name: 'Vendor Rejected', description: 'Triggered when a vendor is rejected' },
  { id: 'vendor.updated', name: 'Vendor Updated', description: 'Triggered when vendor details are updated' },
  { id: 'order.created', name: 'Order Created', description: 'Triggered when a new order is created' },
  { id: 'order.completed', name: 'Order Completed', description: 'Triggered when an order is completed' },
  { id: 'order.cancelled', name: 'Order Cancelled', description: 'Triggered when an order is cancelled' },
  { id: 'payment.received', name: 'Payment Received', description: 'Triggered when payment is received' },
  { id: 'payment.refunded', name: 'Payment Refunded', description: 'Triggered when payment is refunded' },
  { id: 'settlement.processed', name: 'Settlement Processed', description: 'Triggered when settlement is processed' },
  { id: 'service.created', name: 'Service Created', description: 'Triggered when a service is created' },
  { id: 'service.updated', name: 'Service Updated', description: 'Triggered when a service is updated' },
  { id: 'booking.created', name: 'Booking Created', description: 'Triggered when a booking is created' },
  { id: 'booking.confirmed', name: 'Booking Confirmed', description: 'Triggered when a booking is confirmed' },
  { id: 'booking.cancelled', name: 'Booking Cancelled', description: 'Triggered when a booking is cancelled' },
];

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [selectedWebhook, setSelectedWebhook] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [] as string[],
    secret: '',
    is_active: true,
    retry_count: 3,
    timeout_seconds: 30,
  });

  const { saving, deleting, create, update, remove } = useCrud<Webhook, any>({
    endpoint: '/admin/webhooks',
    onSuccess: (message) => {
      toast.success(message);
      loadWebhooks();
      setShowModal(false);
      setEditingWebhook(null);
    },
    onError: (err) => {
      toast.error(err.message || 'Operation failed');
    },
  });

  useEffect(() => {
    loadWebhooks();
    loadWebhookEvents();
  }, []);

  const loadWebhooks = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/webhooks');
      setWebhooks(data.webhooks || data || []);
    } catch (error: any) {
      console.error('Error loading webhooks:', error);
      if (error.status !== 404) {
        toast.error('Failed to load webhooks');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadWebhookEvents = async (webhookId?: string) => {
    try {
      const url = webhookId 
        ? `/admin/webhooks/${webhookId}/events`
        : '/admin/webhooks/events';
      const data = await apiClient.get<any>(url);
      setWebhookEvents(data.events || data || []);
    } catch (error: any) {
      console.error('Error loading webhook events:', error);
    }
  };

  const handleOpenModal = (webhook?: Webhook) => {
    if (webhook) {
      setEditingWebhook(webhook);
      setFormData({
        name: webhook.name,
        url: webhook.url,
        events: webhook.events || [],
        secret: webhook.secret || '',
        is_active: webhook.is_active,
        retry_count: webhook.retry_count || 3,
        timeout_seconds: webhook.timeout_seconds || 30,
      });
    } else {
      setEditingWebhook(null);
      setFormData({
        name: '',
        url: '',
        events: [],
        secret: '',
        is_active: true,
        retry_count: 3,
        timeout_seconds: 30,
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.url) {
      toast.error('Name and URL are required');
      return;
    }

    if (formData.events.length === 0) {
      toast.error('Please select at least one event');
      return;
    }

    if (editingWebhook) {
      await update(editingWebhook.id, formData);
    } else {
      await create(formData);
    }
  };

  const handleDelete = async (webhookId: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return;
    await remove({ id: webhookId } as Webhook);
  };

  const toggleEvent = (eventId: string) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter(e => e !== eventId)
        : [...prev.events, eventId],
    }));
  };

  const handleTestWebhook = async (webhookId: string) => {
    try {
      await apiClient.post(`/admin/webhooks/${webhookId}/test`);
      toast.success('Test webhook sent successfully');
      loadWebhookEvents(webhookId);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send test webhook');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      case 'retrying':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading webhooks...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex-1 flex flex-col min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Webhook Management</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Configure webhooks to receive real-time updates from the platform
                </p>
              </div>
              <Button
                onClick={() => handleOpenModal()}
                className="bg-orange-500 text-white hover:bg-orange-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Webhook
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-8">
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">Total Webhooks</p>
                  <p className="text-2xl font-bold">{webhooks.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">Active Webhooks</p>
                  <p className="text-2xl font-bold text-green-600">
                    {webhooks.filter(w => w.is_active).length}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">Total Events</p>
                  <p className="text-2xl font-bold">{webhookEvents.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-gray-500">Success Rate</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {webhookEvents.length > 0
                      ? `${Math.round((webhookEvents.filter(e => e.status === 'success').length / webhookEvents.length) * 100)}%`
                      : '0%'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Webhooks List */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Webhooks</CardTitle>
              </CardHeader>
              <CardContent>
                {webhooks.length === 0 ? (
                  <div className="text-center py-12">
                    <Webhook className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">No webhooks configured</p>
                    <Button onClick={() => handleOpenModal()} variant="outline">
                      Create Your First Webhook
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {webhooks.map(webhook => (
                      <div
                        key={webhook.id}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-gray-900">{webhook.name}</h3>
                              <Badge variant={webhook.is_active ? 'default' : 'secondary'}>
                                {webhook.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-2 font-mono">{webhook.url}</p>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {webhook.events.map(eventId => {
                                const event = AVAILABLE_EVENTS.find(e => e.id === eventId);
                                return event ? (
                                  <Badge key={eventId} variant="outline" className="text-xs">
                                    {event.name}
                                  </Badge>
                                ) : null;
                              })}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-500">
                              <span>Success: {webhook.success_count || 0}</span>
                              <span>Failed: {webhook.failure_count || 0}</span>
                              {webhook.last_triggered_at && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  Last: {new Date(webhook.last_triggered_at).toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTestWebhook(webhook.id)}
                            >
                              Test
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedWebhook(webhook.id);
                                loadWebhookEvents(webhook.id);
                              }}
                            >
                              <Activity className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenModal(webhook)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleDelete(webhook.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Webhook Events */}
            {selectedWebhook && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Webhook Events</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedWebhook(null)}
                    >
                      Close
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {webhookEvents.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No events found</p>
                  ) : (
                    <div className="space-y-2">
                      {webhookEvents.map(event => (
                        <div
                          key={event.id}
                          className="border border-gray-200 rounded-lg p-4"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <Badge className={getStatusColor(event.status)}>
                                {event.status}
                              </Badge>
                              <span className="font-medium">{event.event_type}</span>
                            </div>
                            <span className="text-sm text-gray-500">
                              {new Date(event.created_at).toLocaleString()}
                            </span>
                          </div>
                          {event.error_message && (
                            <p className="text-sm text-red-600 mt-2">{event.error_message}</p>
                          )}
                          <div className="text-xs text-gray-500 mt-2">
                            Attempts: {event.attempts}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </main>

        {/* Create/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b sticky top-0 bg-white z-10">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {editingWebhook ? 'Edit Webhook' : 'Create Webhook'}
                  </h3>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      setEditingWebhook(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <Label>Webhook Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Customer App Webhook"
                  />
                </div>

                <div>
                  <Label>Webhook URL *</Label>
                  <Input
                    type="url"
                    value={formData.url}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData({ ...formData, url: e.target.value })
                    }
                    placeholder="https://your-app.com/webhooks"
                  />
                </div>

                <div>
                  <Label>Secret (optional)</Label>
                  <Input
                    type="password"
                    value={formData.secret}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData({ ...formData, secret: e.target.value })
                    }
                    placeholder="Webhook secret for verification"
                  />
                </div>

                <div>
                  <Label>Events *</Label>
                  <div className="border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                    {AVAILABLE_EVENTS.map(event => (
                      <label
                        key={event.id}
                        className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.events.includes(event.id)}
                          onChange={() => toggleEvent(event.id)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{event.name}</div>
                          <div className="text-xs text-gray-500">{event.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Retry Count</Label>
                    <Input
                      type="number"
                      value={formData.retry_count}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData({ ...formData, retry_count: Number(e.target.value) })
                      }
                      min="0"
                      max="10"
                    />
                  </div>
                  <div>
                    <Label>Timeout (seconds)</Label>
                    <Input
                      type="number"
                      value={formData.timeout_seconds}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData({ ...formData, timeout_seconds: Number(e.target.value) })
                      }
                      min="5"
                      max="120"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Active</Label>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked: boolean) =>
                      setFormData({ ...formData, is_active: checked })
                    }
                  />
                </div>
              </div>

              <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
                <Button
                  onClick={() => {
                    setShowModal(false);
                    setEditingWebhook(null);
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-orange-500 text-white hover:bg-orange-600"
                >
                  {saving ? 'Saving...' : editingWebhook ? 'Update Webhook' : 'Create Webhook'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
