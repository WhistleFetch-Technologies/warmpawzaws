'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Package } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration: number;
  category: string;
}

interface ServiceCatalogManagerProps {
  centerId: string;
  center: any;
  isSoloProvider: boolean;
  onUpdate: () => void;
}

export function ServiceCatalogManager({ centerId, center, isSoloProvider, onUpdate }: ServiceCatalogManagerProps) {
  const [services, setServices] = useState<Service[]>(center?.services || []);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', price: 0, duration: 30, category: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadServices();
  }, [centerId]);

  const loadServices = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${centerId}/services`);
      const list = Array.isArray(response.services) ? response.services : (response.allServices || []);
      setServices(list);
    } catch (error) {
      console.error('Error loading services:', error);
    }
  };

  const handleOpenModal = (service?: Service) => {
    if (service) {
      setEditingService(service);
      setFormData(service);
    } else {
      setEditingService(null);
      setFormData({ name: '', description: '', price: 0, duration: 30, category: '' });
    }
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (editingService) {
        await apiClient.put(`/vendor/${centerId}/services/${editingService.id}`, formData);
        alert('✅ Service updated successfully!');
      } else {
        await apiClient.post(`/vendor/${centerId}/services`, formData);
        alert('✅ Service added successfully!');
      }
      setModalOpen(false);
      loadServices();
      onUpdate();
    } catch (error: any) {
      alert(error.message || 'Failed to save service');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (serviceId: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;

    try {
      await apiClient.delete(`/vendor/${centerId}/services/${serviceId}`);
      alert('✅ Service deleted successfully!');
      loadServices();
      onUpdate();
    } catch (error: any) {
      alert(error.message || 'Failed to delete service');
    }
  };

  return (
    <>
      <div className="border border-gray-200 rounded-xl p-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Service Catalog</h2>
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-0 bg-primary text-white rounded-lg font-medium flex items-center gap-3"
          >
            <Plus className="w-4 h-4" />
            Add Service
          </button>
        </div>

        {isSoloProvider && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-0 mb-4">
            <p className="text-sm text-blue-800">
              ℹ️ Services configured here will automatically sync to your staff profile
            </p>
          </div>
        )}

        {services.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-0" />
            <p className="text-gray-600 mb-4">No services added yet</p>
            <button
              onClick={() => handleOpenModal()}
              className="px-4 py-0 bg-[#FF8C42] text-white rounded-lg font-medium flex items-center gap-3 mx-auto"
            >
              <Plus className="w-4 h-4" />
              Add Your First Service
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {services.map(service => (
              <div key={service.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{service.name}</h3>
                    <p className="text-sm text-gray-600 mt-0">{service.description}</p>
                    <div className="flex items-center gap-4 mt-0">
                      <span className="px-0 py-0 bg-orange-100 text-orange-700 rounded text-sm font-medium">₹{service.price}</span>
                      <span className="px-0 py-0 bg-gray-100 text-gray-700 rounded text-sm">{service.duration} mins</span>
                      {service.category && (
                        <span className="px-0 py-0 border border-gray-300 rounded text-sm">{service.category}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleOpenModal(service)}
                      className="p-0 hover:bg-gray-100 rounded-lg"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(service.id)}
                      className="p-0 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-0">
              <h3 className="text-xl font-bold mb-4">{editingService ? 'Edit Service' : 'Add Service'}</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">
                    Service Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Basic Grooming"
                    className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe what's included..."
                    rows={3}
                    className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-0">
                      Price (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={formData.price}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-0">
                      Duration (mins)
                    </label>
                    <input
                      type="number"
                      value={formData.duration}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, duration: parseInt(e.target.value) || 30 })}
                      className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">
                    Category
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g., Grooming"
                    className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-0">
                <button
                  onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-0 border border-gray-300 text-gray-700 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !formData.name || formData.price <= 0}
                  className="flex-1 px-4 py-0 bg-[#FF8C42] text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingService ? 'Update' : 'Add Service'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

