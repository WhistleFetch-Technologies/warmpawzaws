'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Check, Loader2, Search } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
  icon?: string;
}

interface VendorServiceSelectionProps {
  vendorId: string;
  roleId?: string;
  onComplete: () => void;
}

export function VendorServiceSelection({ vendorId, roleId, onComplete }: VendorServiceSelectionProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadServices();
  }, [roleId]);

  const loadServices = async () => {
    try {
      setLoading(true);
      const endpoint = roleId ? `/vendor/services/available?roleId=${roleId}` : '/vendor/services/available';
      const response = await apiClient.get<any>(endpoint);
      if (response.success && response.services) {
        setServices(response.services);
      }
    } catch (error) {
      console.error('Error loading services:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleService = (serviceId: string) => {
    setSelectedServices(prev =>
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const handleSubmit = async () => {
    if (selectedServices.length === 0) {
      alert('Please select at least one service');
      return;
    }

    try {
      setSaving(true);
      const response = await apiClient.post<any>('/vendor/services/select', {
        vendorId,
        serviceIds: selectedServices,
      });

      if (response.success) {
        onComplete();
      } else {
        alert('Failed to save service selection');
      }
    } catch (error) {
      console.error('Error saving services:', error);
      alert('Error saving services');
    } finally {
      setSaving(false);
    }
  };

  const filteredServices = services.filter(service =>
    service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    service.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedServices = filteredServices.reduce((acc, service) => {
    if (!acc[service.category]) {
      acc[service.category] = [];
    }
    acc[service.category].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto p-4">
      <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Select Your Services</h1>
        <p className="text-sm text-gray-600 mb-6">
          Choose the services you want to offer. You can add more later from your dashboard.
        </p>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            placeholder="Search services..."
            className="w-full pl-10 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
          />
        </div>

        <div className="space-y-4 max-h-96 overflow-y-auto mb-6">
          {Object.entries(groupedServices).map(([category, categoryServices]) => (
            <div key={category}>
              <h3 className="font-semibold text-gray-900 mb-2">{category}</h3>
              <div className="space-y-2">
                {categoryServices.map((service) => {
                  const isSelected = selectedServices.includes(service.id);
                  return (
                    <button
                      key={service.id}
                      onClick={() => toggleService(service.id)}
                      className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                        isSelected
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {isSelected && (
                          <Check className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{service.name}</div>
                          <div className="text-sm text-gray-600">{service.description}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
          <span className="text-sm text-gray-600">Selected:</span>
          <span className="font-semibold text-gray-900">{selectedServices.length} services</span>
        </div>

        <button
          onClick={handleSubmit}
          disabled={saving || selectedServices.length === 0}
          className="w-full py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving...
            </>
          ) : (
            'Continue'
          )}
        </button>
      </div>
    </div>
  );
}

