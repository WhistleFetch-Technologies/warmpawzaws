'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { DollarSign, Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { CapabilityGate } from '../CapabilityGate';

interface Service {
  id: string;
  name: string;
  service_style: string;
  custom_price?: number;
  base_price?: number;
  custom_duration?: number;
  duration_minutes?: number;
}

interface ServicePricingProps {
  vendorId: string;
  serviceId?: string;
  onBack?: () => void;
}

export function ServicePricing({ vendorId, serviceId, onBack }: ServicePricingProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, { price: number; duration: number }>>({});

  useEffect(() => {
    loadServices();
  }, [vendorId]);

  const loadServices = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/${vendorId}/services`);
      
      if (response.success) {
        const allServices = Array.isArray(response.services) ? response.services : (response.allServices || []);
        setServices(allServices);
        
        // Initialize prices state
        const initialPrices: Record<string, { price: number; duration: number }> = {};
        allServices.forEach((service: Service) => {
          initialPrices[service.id] = {
            price: service.custom_price || service.base_price || 0,
            duration: service.custom_duration || service.duration_minutes || 30,
          };
        });
        setPrices(initialPrices);
      }
    } catch (error) {
      console.error('Error loading services:', error);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const updatePrice = (serviceId: string, field: 'price' | 'duration', value: number) => {
    setPrices({
      ...prices,
      [serviceId]: {
        ...prices[serviceId],
        [field]: value,
      },
    });
  };

  const savePrice = async (serviceId: string) => {
    const priceData = prices[serviceId];
    if (!priceData) return;

    try {
      setSaving(serviceId);
      const response = await apiClient.put<{ success: boolean; error?: string }>(`/vendor/services/${serviceId}/pricing`, {
        price: priceData.price,
        duration: priceData.duration,
      });

      if (response.success) {
        toast.success('Pricing updated successfully');
        loadServices(); // Reload to get updated data
      } else {
        throw new Error(response.error || 'Failed to update pricing');
      }
    } catch (error: any) {
      console.error('Error updating pricing:', error);
      toast.error(error.message || 'Failed to update pricing');
    } finally {
      setSaving(null);
    }
  };

  const saveAllPrices = async () => {
    try {
      setSaving('all');
      const updates = Object.entries(prices).map(([id, data]) => ({
        serviceId: id,
        price: data.price,
        duration: data.duration,
      }));

      const response = await apiClient.post<{ success: boolean; successful?: number; error?: string }>('/vendor/services/pricing/bulk', {
        vendorId,
        updates,
      });

      if (response.success) {
        toast.success(`Updated ${response.successful} services`);
        loadServices();
      } else {
        throw new Error(response.error || 'Failed to update pricing');
      }
    } catch (error: any) {
      console.error('Error bulk updating pricing:', error);
      toast.error(error.message || 'Failed to update pricing');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <CapabilityGate capability="service_pricing" showDisabledMessage>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Service Pricing</h1>
            <p className="text-gray-500 mt-1">Manage pricing for your services</p>
          </div>
          <button
            onClick={saveAllPrices}
            disabled={saving === 'all'}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving === 'all' ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save All
              </>
            )}
          </button>
        </div>

        {/* Services List */}
        {services.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <DollarSign className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No services found</h3>
            <p className="text-gray-500">Add services to manage their pricing</p>
          </div>
        ) : (
          <div className="space-y-4">
            {services.map((service) => (
              <div
                key={service.id}
                className="bg-white rounded-lg p-6 border border-gray-200"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{service.name}</h3>
                    <p className="text-sm text-gray-500 capitalize">
                      {service.service_style?.replace('_', ' ')}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Price (₹) *
                    </label>
                    <input
                      type="number"
                      value={prices[service.id]?.price || 0}
                      onChange={(e) => updatePrice(service.id, 'price', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Duration (minutes) *
                    </label>
                    <input
                      type="number"
                      value={prices[service.id]?.duration || 30}
                      onChange={(e) => updatePrice(service.id, 'duration', parseInt(e.target.value) || 30)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      min="1"
                      required
                    />
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => savePrice(service.id)}
                    disabled={saving === service.id}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving === service.id ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CapabilityGate>
  );
}
