'use client';

import { useState, useEffect } from 'react';
import { Check, X, AlertCircle, MapPin, Building2, Radio, Lock } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface ServicePublishFormProps {
  vendorId: string;
  vendorData: any;
  roleConfiguration: any;
  onSuccess: () => void;
  onCancel: () => void;
}

interface ServiceCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  requiresGPSTracking?: boolean;
  isHomeService?: boolean;
}

export function ServicePublishForm({
  vendorId,
  vendorData,
  roleConfiguration,
  onSuccess,
  onCancel
}: ServicePublishFormProps) {
  const [formData, setFormData] = useState({
    serviceName: '',
    description: '',
    category: '',
    subcategory: '',
    price: '',
    duration: '30',
    serviceStyle: 'at_center' as 'at_center' | 'at_home' | 'tele',
    gpsTracking: false,
  });

  const [allowedCategories, setAllowedCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAllowedCategories();
  }, [vendorId]);

  useEffect(() => {
    if (formData.category && allowedCategories.length > 0) {
      const selectedCategory = allowedCategories.find(c => c.id === formData.category);
      if (selectedCategory?.isHomeService || formData.serviceStyle === 'at_home') {
        setFormData(prev => ({ ...prev, gpsTracking: true }));
      }
    }
  }, [formData.category, formData.serviceStyle, allowedCategories]);

  const loadAllowedCategories = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/service-catalog/categories`);
      if (response.success && response.categories) {
        setAllowedCategories(response.categories);
      } else {
        // Fallback categories
        setAllowedCategories([
          { id: 'veterinary', name: 'Veterinary Services', description: 'Medical care', icon: '🏥' },
          { id: 'grooming', name: 'Grooming Services', description: 'Pet grooming', icon: '✂️' },
          { id: 'training', name: 'Training Services', description: 'Behavior training', icon: '🎓', requiresGPSTracking: true, isHomeService: true },
          { id: 'walking', name: 'Walking Services', description: 'Dog walking', icon: '🐕', requiresGPSTracking: true, isHomeService: true },
        ]);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      setAllowedCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.serviceName || !formData.category || !formData.price) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      await apiClient.post(`/vendor/${vendorId}/services`, {
        serviceName: formData.serviceName,
        description: formData.description,
        category: formData.category,
        subcategory: formData.subcategory,
        price: parseFloat(formData.price),
        duration: parseInt(formData.duration),
        serviceStyle: formData.serviceStyle,
        gpsTracking: formData.gpsTracking,
        isEnabled: true,
        publishStatus: 'published'
      });
      alert('✅ Service published successfully!');
      onSuccess();
    } catch (error: any) {
      alert(error.message || 'Failed to publish service');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      <div className="bg-white border-b sticky top-0 z-10 p-4">
        <div className="flex items-center gap-0 mb-4">
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center">
            <X className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="font-semibold text-gray-900">Publish Service</h1>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-0">
            Service Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.serviceName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, serviceName: e.target.value })}
            placeholder="Enter service name"
            className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[primary]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-0">
            Category <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.category}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, category: e.target.value })}
            className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[primary]"
          >
            <option value="">Select category</option>
            {allowedCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-0">
            Service Style
          </label>
          <div className="grid grid-cols-3 gap-0">
            {['at_center', 'at_home', 'tele'].map((style) => (
              <button
                key={style}
                onClick={() => setFormData({ ...formData, serviceStyle: style as any })}
                className={`p-0 border-2 rounded-lg text-sm font-medium ${
                  formData.serviceStyle === style
                    ? 'border-[primary] bg-orange-50'
                    : 'border-gray-200'
                }`}
              >
                {style === 'at_center' ? '🏥 Center' : style === 'at_home' ? '🏠 Home' : '📱 Tele'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-0">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe your service..."
            rows={3}
            className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[primary] resize-none"
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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, price: e.target.value })}
              className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[primary]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Duration (mins)
            </label>
            <input
              type="number"
              value={formData.duration}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, duration: e.target.value })}
              className="w-full px-4 py-0 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[primary]"
            />
          </div>
        </div>

        {(formData.serviceStyle === 'at_home' || allowedCategories.find(c => c.id === formData.category)?.requiresGPSTracking) && (
          <div className="p-0 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-0">
              <Lock className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-800 font-medium">GPS Tracking Required</span>
            </div>
            <p className="text-xs text-blue-700 mt-0">
              GPS tracking is mandatory for home services
            </p>
          </div>
        )}

        <div className="flex gap-0 pt-4">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-0 border border-gray-300 text-gray-700 rounded-lg font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !formData.serviceName || !formData.category || !formData.price}
            className="flex-1 px-4 py-0 bg-[primary] text-white rounded-lg font-medium disabled:opacity-50"
          >
            {submitting ? 'Publishing...' : 'Publish Service'}
          </button>
        </div>
      </div>
    </div>
  );
}

