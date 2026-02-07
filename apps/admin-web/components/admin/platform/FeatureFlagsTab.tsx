'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Flag, ToggleLeft, ToggleRight, Save, Loader2 } from 'lucide-react';

interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  category: string;
}

export function FeatureFlagsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadFeatureFlags();
  }, []);

  const loadFeatureFlags = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>('/admin/platform/feature-flags');
      if (response.success && response.flags) {
        setFlags(response.flags);
      } else {
        // Default feature flags if API doesn't return any
        setFlags([
          {
            id: 'veterinary',
            name: 'Veterinary Services',
            description: 'Enable veterinary service bookings',
            enabled: true,
            category: 'Services',
          },
          {
            id: 'grooming',
            name: 'Grooming Services',
            description: 'Enable grooming service bookings',
            enabled: true,
            category: 'Services',
          },
          {
            id: 'training',
            name: 'Training Services',
            description: 'Enable training service bookings',
            enabled: true,
            category: 'Services',
          },
          {
            id: 'walking',
            name: 'Walking Services',
            description: 'Enable dog walking service bookings',
            enabled: true,
            category: 'Services',
          },
          {
            id: 'boarding',
            name: 'Boarding Services',
            description: 'Enable pet boarding service bookings',
            enabled: true,
            category: 'Services',
          },
          {
            id: 'adoption',
            name: 'Adoption Services',
            description: 'Enable pet adoption features',
            enabled: false,
            category: 'Services',
          },
          {
            id: 'sunset',
            name: 'Sunset Services',
            description: 'Enable end-of-life pet care services',
            enabled: false,
            category: 'Services',
          },
          {
            id: 'insurance',
            name: 'Pet Insurance',
            description: 'Enable pet insurance features',
            enabled: false,
            category: 'Services',
          },
          {
            id: 'pharmacy',
            name: 'Pharmacy',
            description: 'Enable pet pharmacy features',
            enabled: false,
            category: 'Services',
          },
          {
            id: 'pet_cafe',
            name: 'Pet Cafe',
            description: 'Enable pet cafe features',
            enabled: false,
            category: 'Services',
          },
          {
            id: 'subscriptions',
            name: 'Service Subscriptions',
            description: 'Enable subscription-based services',
            enabled: true,
            category: 'Business',
          },
          {
            id: 'packages',
            name: 'Service Packages',
            description: 'Enable service package features',
            enabled: true,
            category: 'Business',
          },
          {
            id: 'reviews',
            name: 'Reviews & Ratings',
            description: 'Enable customer reviews and ratings',
            enabled: true,
            category: 'Social',
          },
          {
            id: 'chat',
            name: 'In-App Chat',
            description: 'Enable real-time chat between customers and vendors',
            enabled: true,
            category: 'Communication',
          },
          {
            id: 'notifications',
            name: 'Push Notifications',
            description: 'Enable push notifications',
            enabled: true,
            category: 'Communication',
          },
        ]);
      }
    } catch (error) {
      console.error('Error loading feature flags:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFlag = (flagId: string) => {
    setFlags(prev =>
      prev.map(flag =>
        flag.id === flagId ? { ...flag, enabled: !flag.enabled } : flag
      )
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await apiClient.post<any>('/admin/platform/feature-flags', { flags });
      if (response.success) {
        alert('Feature flags updated successfully!');
      } else {
        alert('Failed to update feature flags');
      }
    } catch (error) {
      console.error('Error saving feature flags:', error);
      alert('Error saving feature flags');
    } finally {
      setSaving(false);
    }
  };

  const filteredFlags = flags.filter(flag =>
    flag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    flag.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    flag.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedFlags = filteredFlags.reduce((acc, flag) => {
    if (!acc[flag.category]) {
      acc[flag.category] = [];
    }
    acc[flag.category].push(flag);
    return acc;
  }, {} as Record<string, FeatureFlag[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          placeholder="Search feature flags..."
          className="w-full px-4 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
      </div>

      {/* Feature Flags by Category */}
      {Object.entries(groupedFlags).map(([category, categoryFlags]) => (
        <div key={category} className="bg-white rounded-lg border-2 border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{category}</h3>
          <div className="space-y-3">
            {categoryFlags.map((flag) => (
              <div
                key={flag.id}
                className="flex items-start justify-between p-0 border-2 border-gray-100 rounded-lg hover:border-gray-200 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-0">
                    <Flag className={`w-4 h-4 ${flag.enabled ? 'text-orange-600' : 'text-gray-400'}`} />
                    <span className="font-medium text-gray-900">{flag.name}</span>
                  </div>
                  <p className="text-sm text-gray-500">{flag.description}</p>
                </div>
                <button
                  onClick={() => toggleFlag(flag.id)}
                  className={`ml-4 p-0 rounded-lg transition-colors ${
                    flag.enabled
                      ? 'bg-orange-100 text-orange-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {flag.enabled ? (
                    <ToggleRight className="w-6 h-6" />
                  ) : (
                    <ToggleLeft className="w-6 h-6" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-0 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="w-5 h-5" />
            Save Feature Flags
          </>
        )}
      </button>
    </div>
  );
}

