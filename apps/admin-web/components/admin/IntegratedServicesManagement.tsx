'use client';

import React, { useState, useEffect } from 'react';
import { Zap, Plus, Edit2, Trash2, Loader2, Save, X, AlertCircle, CheckCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface IntegratedService {
  serviceId: string;
  serviceName: string;
  provider: string;
  category: 'payment' | 'shipping' | 'sms' | 'email' | 'maps' | 'analytics' | 'storage';
  isActive: boolean;
  config: {
    apiKey?: string;
    apiSecret?: string;
    webhookUrl?: string;
    [key: string]: any;
  };
  status: 'connected' | 'disconnected' | 'error';
  lastSync?: string;
  createdAt: string;
}

const SERVICE_CATEGORIES = [
  { id: 'payment', name: 'Payment Gateway', icon: '💳' },
  { id: 'shipping', name: 'Shipping & Logistics', icon: '📦' },
  { id: 'sms', name: 'SMS Provider', icon: '📱' },
  { id: 'email', name: 'Email Service', icon: '📧' },
  { id: 'maps', name: 'Maps & Location', icon: '🗺️' },
  { id: 'analytics', name: 'Analytics', icon: '📊' },
  { id: 'storage', name: 'Cloud Storage', icon: '☁️' },
];

const PROVIDERS = {
  payment: ['Razorpay', 'Stripe', 'PayPal', 'Paytm'],
  shipping: ['Delhivery', 'Shiprocket', 'DHL', 'FedEx'],
  sms: ['Twilio', 'MSG91', 'AWS SNS', 'Gupshup'],
  email: ['SendGrid', 'AWS SES', 'Mailgun', 'Postmark'],
  maps: ['Google Maps', 'Mapbox', 'HERE Maps'],
  analytics: ['Google Analytics', 'Mixpanel', 'Amplitude'],
  storage: ['AWS S3', 'Google Cloud Storage', 'Azure Blob'],
};

export function IntegratedServicesManagement() {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<IntegratedService[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<IntegratedService | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    serviceName: '',
    provider: '',
    category: 'payment' as IntegratedService['category'],
    apiKey: '',
    apiSecret: '',
    webhookUrl: '',
    isActive: true,
  });

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/integrations');
      setServices(data.services || []);
    } catch (error) {
      console.error('Error loading services:', error);
      alert('Failed to load integrated services');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (service?: IntegratedService) => {
    if (service) {
      setEditingService(service);
      setFormData({
        serviceName: service.serviceName,
        provider: service.provider,
        category: service.category,
        apiKey: service.config.apiKey || '',
        apiSecret: service.config.apiSecret || '',
        webhookUrl: service.config.webhookUrl || '',
        isActive: service.isActive,
      });
    } else {
      setEditingService(null);
      setFormData({
        serviceName: '',
        provider: '',
        category: 'payment',
        apiKey: '',
        apiSecret: '',
        webhookUrl: '',
        isActive: true,
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.serviceName || !formData.provider) {
      alert('Service name and provider are required');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        serviceName: formData.serviceName,
        provider: formData.provider,
        category: formData.category,
        config: {
          apiKey: formData.apiKey,
          apiSecret: formData.apiSecret,
          webhookUrl: formData.webhookUrl,
        },
        isActive: formData.isActive,
      };

      if (editingService) {
        const data = await apiClient.put<any>(`/admin/integrations/${editingService.serviceId}`, payload);
        if (data.success) {
          alert('Service updated successfully');
          setShowModal(false);
          loadServices();
        } else {
          alert(data.error || 'Failed to update service');
        }
      } else {
        const data = await apiClient.post<any>('/admin/integrations', payload);
        if (data.success) {
          alert('Service added successfully');
          setShowModal(false);
          loadServices();
        } else {
          alert(data.error || 'Failed to add service');
        }
      }
    } catch (error) {
      console.error('Error saving service:', error);
      alert('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this integration?')) return;

    try {
      const data = await apiClient.delete<any>(`/admin/integrations/${serviceId}`);
      if (data.success) {
        alert('Service deleted successfully');
        loadServices();
      } else {
        alert(data.error || 'Failed to delete service');
      }
    } catch (error) {
      console.error('Error deleting service:', error);
      alert('An error occurred while deleting');
    }
  };

  const handleTestConnection = async (serviceId: string) => {
    try {
      setTesting(serviceId);
      const data = await apiClient.post<any>(`/admin/integrations/${serviceId}/test`, {});
      if (data.success) {
        alert('Connection test successful!');
        loadServices();
      } else {
        alert(data.error || 'Connection test failed');
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      alert('Connection test failed');
    } finally {
      setTesting(null);
    }
  };

  const toggleActive = async (serviceId: string, isActive: boolean) => {
    try {
      const data = await apiClient.put<any>(`/admin/integrations/${serviceId}/status`, { isActive: !isActive });
      if (data.success) {
        loadServices();
      } else {
        alert(data.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('An error occurred');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-0">
          <div className="p-0 bg-indigo-100 rounded-xl">
            <Zap className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Integrated Services</h1>
            <p className="text-sm text-gray-600">Manage third-party service integrations</p>
          </div>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-0 px-4 py-0 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
        >
          <Plus className="w-4 h-4" />
          Add Integration
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {SERVICE_CATEGORIES.map((category) => {
          const categoryServices = services.filter(s => s.category === category.id);
          if (categoryServices.length === 0) return null;

          return (
            <div key={category.id} className="bg-white rounded-xl border-2 border-gray-200 p-0">
              <div className="flex items-center gap-0 mb-4">
                <span className="text-2xl">{category.icon}</span>
                <h3 className="font-semibold text-gray-900">{category.name}</h3>
                <span className="ml-auto text-sm text-gray-600">{categoryServices.length} service(s)</span>
              </div>

              <div className="space-y-3">
                {categoryServices.map((service) => (
                  <div key={service.serviceId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div>
                        <h4 className="font-medium text-gray-900">{service.serviceName}</h4>
                        <p className="text-sm text-gray-600">{service.provider}</p>
                      </div>
                      <div className="flex items-center gap-0">
                        {service.status === 'connected' && (
                          <span className="flex items-center gap-0 px-0 py-0 bg-green-100 text-green-700 text-xs font-medium rounded">
                            <CheckCircle className="w-3 h-3" />
                            Connected
                          </span>
                        )}
                        {service.status === 'error' && (
                          <span className="flex items-center gap-0 px-0 py-0 bg-red-100 text-red-700 text-xs font-medium rounded">
                            <AlertCircle className="w-3 h-3" />
                            Error
                          </span>
                        )}
                        {service.status === 'disconnected' && (
                          <span className="px-0 py-0 bg-gray-200 text-gray-700 text-xs font-medium rounded">
                            Disconnected
                          </span>
                        )}
                        <button
                          onClick={() => toggleActive(service.serviceId, service.isActive)}
                          className={`px-0 py-0 text-xs font-medium rounded ${
                            service.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {service.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-0">
                      <button
                        onClick={() => handleTestConnection(service.serviceId)}
                        disabled={testing === service.serviceId}
                        className="px-0 py-0 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-sm font-medium disabled:opacity-50"
                      >
                        {testing === service.serviceId ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Test'
                        )}
                      </button>
                      <button
                        onClick={() => handleOpenModal(service)}
                        className="p-0 hover:bg-gray-200 rounded-lg"
                      >
                        <Edit2 className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        onClick={() => handleDelete(service.serviceId)}
                        className="p-0 hover:bg-red-100 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-0 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingService ? 'Edit Integration' : 'Add Integration'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-0 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-0 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">Service Name *</label>
                <input
                  type="text"
                  value={formData.serviceName}
                  onChange={(e) => setFormData(prev => ({ ...prev, serviceName: e.target.value }))}
                  className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="e.g., Primary Payment Gateway"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">Category *</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as any, provider: '' }))}
                  className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  {SERVICE_CATEGORIES.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">Provider *</label>
                <select
                  value={formData.provider}
                  onChange={(e) => setFormData(prev => ({ ...prev, provider: e.target.value }))}
                  className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select Provider</option>
                  {PROVIDERS[formData.category]?.map(provider => (
                    <option key={provider} value={provider}>{provider}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">API Key</label>
                <input
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                  className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="Enter API key"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">API Secret</label>
                <input
                  type="password"
                  value={formData.apiSecret}
                  onChange={(e) => setFormData(prev => ({ ...prev, apiSecret: e.target.value }))}
                  className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="Enter API secret"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">Webhook URL</label>
                <input
                  type="url"
                  value={formData.webhookUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, webhookUrl: e.target.value }))}
                  className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
                  placeholder="https://api.warmpawz.com/webhooks/..."
                />
              </div>

              <div>
                <label className="flex items-center gap-0">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Active Integration</span>
                </label>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-0 py-4 flex gap-0">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-0 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-0 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium flex items-center justify-center gap-0 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {editingService ? 'Update' : 'Add'} Integration
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
