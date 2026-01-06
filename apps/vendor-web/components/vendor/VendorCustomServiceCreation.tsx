'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Save, X, Clock, DollarSign, Package } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface VendorCustomServiceCreationProps {
  vendorId: string;
  vendorData: any;
  serviceStyle: 'at_center' | 'both';
  onClose: () => void;
  onServiceCreated: () => void;
}

export function VendorCustomServiceCreation({
  vendorId,
  vendorData,
  serviceStyle,
  onClose,
  onServiceCreated
}: VendorCustomServiceCreationProps) {
  const [customServices, setCustomServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  const [serviceName, setServiceName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(60);
  const [price, setPrice] = useState(0);
  const [categoryName, setCategoryName] = useState('');
  const [isPackage, setIsPackage] = useState(false);

  useEffect(() => {
    if (serviceStyle !== 'at_center' && serviceStyle !== 'both') {
      alert('Custom services are only available for center-based vendors');
      onClose();
      return;
    }
    loadCustomServices();
  }, [vendorId, serviceStyle]);

  const loadCustomServices = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/${vendorId}/services?custom=true`);
      setCustomServices(response.services || []);
    } catch (error) {
      console.error('Error loading custom services:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!serviceName.trim() || !categoryName.trim() || price <= 0) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      await apiClient.post(`/vendor/${vendorId}/services`, {
        serviceName,
        description,
        duration,
        price,
        categoryName,
        serviceStyle: 'at_center',
        isCustomService: true,
        isEnabled: true,
        publishStatus: 'pending_approval'
      });
      alert('✅ Custom service created! Pending admin approval.');
      setShowCreateDialog(false);
      resetForm();
      loadCustomServices();
      onServiceCreated();
    } catch (error: any) {
      alert(error.message || 'Failed to create custom service');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setServiceName('');
    setDescription('');
    setDuration(60);
    setPrice(0);
    setCategoryName('');
    setIsPackage(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      <div className="bg-white border-b sticky top-0 z-10 p-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="font-semibold text-gray-900">Custom Services</h1>
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="w-full bg-[#FF8C42] text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Create Custom Service
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42]"></div>
        </div>
      ) : customServices.length === 0 ? (
        <div className="text-center py-20">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No custom services yet</p>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {customServices.map((service) => (
            <div key={service.id} className="border border-gray-200 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900">{service.serviceName || service.name}</h3>
              <p className="text-sm text-gray-600 mt-1">{service.description}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-sm font-medium text-[#FF8C42]">₹{service.price || service.customPrice}</span>
                <span className="text-xs text-gray-500">{service.duration || service.customDuration} mins</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  service.publishStatus === 'published' ? 'bg-green-100 text-green-700' :
                  service.publishStatus === 'pending_approval' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {service.publishStatus}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Create Custom Service</h2>
                <button
                  onClick={() => {
                    setShowCreateDialog(false);
                    resetForm();
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Service Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    placeholder="e.g., Premium Grooming Package"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="e.g., Grooming"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your custom service..."
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42] resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Price (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Duration (mins)
                    </label>
                    <input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPackage"
                    checked={isPackage}
                    onChange={(e) => setIsPackage(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="isPackage" className="text-sm text-gray-700">
                    This is a package service
                  </label>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => {
                    setShowCreateDialog(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving || !serviceName.trim() || !categoryName.trim() || price <= 0}
                  className="flex-1 px-4 py-2 bg-[#FF8C42] text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create Service'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

