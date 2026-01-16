'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_minutes: number;
  is_active: boolean;
  category: string;
}

interface VendorServicesPageProps {
  vendorId: string;
}

export function VendorServicesPage({ vendorId }: VendorServicesPageProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  useEffect(() => {
    loadServices();
  }, [vendorId]);

  const loadServices = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/${vendorId}/services`);
      if (response.success) {
        setServices(response.services || []);
      }
    } catch (err) {
      console.error('Error loading services:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleService = async (serviceId: string, isActive: boolean) => {
    try {
      await apiClient.put(`/vendor/${vendorId}/services/${serviceId}`, {
        isActive: !isActive,
      });
      loadServices();
    } catch (err) {
      console.error('Error toggling service:', err);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;
    try {
      await apiClient.delete(`/vendor/${vendorId}/services/${serviceId}`);
      loadServices();
    } catch (err) {
      console.error('Error deleting service:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="p-0">
      <div className="flex items-center justify-between mb-0">
        <h1 className="text-2xl font-bold text-gray-900">Service Management</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-0 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition flex items-center gap-3"
        >
          <span>➕</span> Add Service
        </button>
      </div>

      {services.length === 0 ? (
        <div className="text-center py-0 bg-white rounded-2xl">
          <span className="text-6xl">📋</span>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">No services yet</h2>
          <p className="text-gray-500 mt-0">Add your first service to start accepting bookings</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 px-0 py-0 bg-orange-500 text-white rounded-full"
          >
            Add Service
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {services.map((service) => (
            <div
              key={service.id}
              className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-gray-900">{service.name}</h3>
                  <span className={`text-xs px-0 py-0 rounded-full ${
                    service.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {service.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0">{service.description}</p>
                <div className="flex items-center gap-4 mt-0 text-sm">
                  <span className="text-orange-600 font-semibold">₹{service.price}</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-500">{service.duration_minutes} mins</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-500">{service.category}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleToggleService(service.id, service.is_active)}
                  className={`p-0 rounded-lg ${
                    service.is_active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {service.is_active ? '✓' : '○'}
                </button>
                <button
                  onClick={() => setEditingService(service)}
                  className="p-0 bg-blue-100 text-blue-600 rounded-lg"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDeleteService(service.id)}
                  className="p-0 bg-red-100 text-red-600 rounded-lg"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal would go here */}
      {(showAddModal || editingService) && (
        <ServiceModal
          vendorId={vendorId}
          service={editingService}
          onClose={() => {
            setShowAddModal(false);
            setEditingService(null);
          }}
          onSave={() => {
            setShowAddModal(false);
            setEditingService(null);
            loadServices();
          }}
        />
      )}
    </div>
  );
}

function ServiceModal({
  vendorId,
  service,
  onClose,
  onSave,
}: {
  vendorId: string;
  service: Service | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    name: service?.name || '',
    description: service?.description || '',
    price: service?.price || 0,
    duration_minutes: service?.duration_minutes || 30,
    category: service?.category || 'general',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (service) {
        await apiClient.put(`/vendor/${vendorId}/services/${service.id}`, formData);
      } else {
        await apiClient.post(`/vendor/${vendorId}/services`, formData);
      }
      onSave();
    } catch (err) {
      console.error('Error saving service:', err);
      alert('Failed to save service');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-0 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">
          {service ? 'Edit Service' : 'Add Service'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">Service Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-0 py-0 border rounded-lg focus:ring-2 focus:ring-orange-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">Description</label>
            <textarea
              value={formData.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-0 py-0 border rounded-lg focus:ring-2 focus:ring-orange-500"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">Price (₹)</label>
              <input
                type="number"
                value={formData.price}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, price: Number(e.target.value) })}
                className="w-full px-0 py-0 border rounded-lg focus:ring-2 focus:ring-orange-500"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">Duration (mins)</label>
              <input
                type="number"
                value={formData.duration_minutes}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, duration_minutes: Number(e.target.value) })}
                className="w-full px-0 py-0 border rounded-lg focus:ring-2 focus:ring-orange-500"
                min="15"
                step="15"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">Category</label>
            <select
              value={formData.category}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-0 py-0 border rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="general">General</option>
              <option value="consultation">Consultation</option>
              <option value="grooming">Grooming</option>
              <option value="training">Training</option>
              <option value="boarding">Boarding</option>
              <option value="diagnostic">Diagnostic</option>
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-0 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-0 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

