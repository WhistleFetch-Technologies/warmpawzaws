'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface Service {
  id: string;
  service_name: string;
  description: string;
  category: string;
  price: number;
  duration_minutes: number;
  service_style: 'at_vendor' | 'at_home' | 'online';
  is_enabled: boolean;
  publish_status: 'draft' | 'published' | 'archived';
}

export default function ServiceManagementPage() {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newService, setNewService] = useState<Partial<Service>>({
    service_style: 'at_vendor',
    is_enabled: true,
    publish_status: 'draft',
  });

  useEffect(() => {
    const vendorId = localStorage.getItem('vendorId');
    if (!vendorId) {
      router.push('/onboarding');
      return;
    }
    loadServices();
  }, [router]);

  const loadServices = async () => {
    try {
      const vendorId = localStorage.getItem('vendorId');
      if (vendorId) {
        const response = await apiClient.get<{ services: Service[] }>(`/vendor/${vendorId}/services`);
        setServices(response.services || []);
      }
    } catch (err) {
      console.error('Error loading services:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddService = async () => {
    try {
      const vendorId = localStorage.getItem('vendorId');
      await apiClient.post('/vendor-services/create', {
        vendorId,
        ...newService,
      });
      setShowAddForm(false);
      setNewService({ service_style: 'at_vendor', is_enabled: true, publish_status: 'draft' });
      loadServices();
    } catch (err) {
      console.error('Error adding service:', err);
    }
  };

  const toggleServiceStatus = async (serviceId: string, isEnabled: boolean) => {
    try {
      await apiClient.put(`/vendor-services/${serviceId}`, { is_enabled: !isEnabled });
      loadServices();
    } catch (err) {
      console.error('Error updating service:', err);
    }
  };

  const publishService = async (serviceId: string) => {
    try {
      await apiClient.put(`/vendor-services/${serviceId}`, { publish_status: 'published' });
      loadServices();
    } catch (err) {
      console.error('Error publishing service:', err);
    }
  };

  const getStyleIcon = (style: string) => {
    switch (style) {
      case 'at_vendor': return '🏥';
      case 'at_home': return '🏠';
      case 'online': return '💻';
      default: return '📋';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Service Management</h1>
            <p className="text-gray-500 mt-1">Configure your services and pricing</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              ← Back
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
            >
              + Add Service
            </button>
          </div>
        </div>

        {services.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <div className="text-6xl mb-4">🛠️</div>
            <p className="text-gray-500">No services configured yet</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
            >
              Add Your First Service
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <div key={service.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">{getStyleIcon(service.service_style)}</span>
                      <h3 className="font-semibold text-gray-800">{service.service_name}</h3>
                    </div>
                    <p className="text-sm text-gray-500">{service.category}</p>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      service.publish_status === 'published'
                        ? 'bg-green-100 text-green-700'
                        : service.publish_status === 'draft'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {service.publish_status}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      service.is_enabled ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {service.is_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>

                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{service.description}</p>

                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-gray-500">Price</span>
                    <p className="font-semibold text-orange-600">₹{service.price}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Duration</span>
                    <p className="font-medium">{service.duration_minutes} mins</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <button
                    onClick={() => toggleServiceStatus(service.id, service.is_enabled)}
                    className={`flex-1 p-2 rounded-lg text-sm font-medium ${
                      service.is_enabled
                        ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        : 'bg-green-100 text-green-600 hover:bg-green-200'
                    }`}
                  >
                    {service.is_enabled ? 'Disable' : 'Enable'}
                  </button>
                  {service.publish_status === 'draft' && (
                    <button
                      onClick={() => publishService(service.id)}
                      className="flex-1 p-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
                    >
                      Publish
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {showAddForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-semibold mb-4">Add New Service</h2>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Service Name"
                  value={newService.service_name || ''}
                  onChange={(e) => setNewService({ ...newService, service_name: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                />
                <textarea
                  placeholder="Description"
                  value={newService.description || ''}
                  onChange={(e) => setNewService({ ...newService, description: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                  rows={3}
                />
                <input
                  type="text"
                  placeholder="Category"
                  value={newService.category || ''}
                  onChange={(e) => setNewService({ ...newService, category: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                />
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="number"
                    placeholder="Price (₹)"
                    value={newService.price || ''}
                    onChange={(e) => setNewService({ ...newService, price: parseFloat(e.target.value) })}
                    className="w-full p-3 border rounded-lg"
                  />
                  <input
                    type="number"
                    placeholder="Duration (mins)"
                    value={newService.duration_minutes || ''}
                    onChange={(e) => setNewService({ ...newService, duration_minutes: parseInt(e.target.value) })}
                    className="w-full p-3 border rounded-lg"
                  />
                </div>
                <select
                  value={newService.service_style}
                  onChange={(e) => setNewService({ ...newService, service_style: e.target.value as any })}
                  className="w-full p-3 border rounded-lg"
                >
                  <option value="at_vendor">At Clinic/Centre</option>
                  <option value="at_home">Home Visit</option>
                  <option value="online">Online/Tele</option>
                </select>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 p-3 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddService}
                  className="flex-1 p-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  Add Service
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

