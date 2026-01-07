'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Globe, Edit, Trash2, CheckCircle, XCircle, Loader2, Search } from 'lucide-react';

interface Region {
  regionId: string;
  regionName: string;
  regionCode: string;
  isActive: boolean;
  currency: {
    code: string;
    symbol: string;
  };
}

const REGION_FLAGS: Record<string, string> = {
  'IN': '🇮🇳',
  'US': '🇺🇸',
  'AE': '🇦🇪',
  'SG': '🇸🇬',
  'GB': '🇬🇧',
  'AU': '🇦🇺',
  'CA': '🇨🇦',
};

export function RegionsListTab() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadRegions();
  }, []);

  const loadRegions = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>('/admin/regions');
      if (response.success && response.regions) {
        setRegions(response.regions);
      }
    } catch (error) {
      console.error('Error loading regions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (regionId: string, currentStatus: boolean) => {
    try {
      const response = await apiClient.put<any>(`/admin/regions/${regionId}/status`, {
        isActive: !currentStatus,
      });
      if (response.success) {
        await loadRegions();
      } else {
        alert('Failed to update region status');
      }
    } catch (error) {
      console.error('Error updating region status:', error);
      alert('Error updating region status');
    }
  };

  const filteredRegions = regions.filter(region =>
    region.regionName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    region.regionCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-0/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          placeholder="Search regions..."
          className="w-full pl-0 pr-4 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
      </div>

      {/* Regions List */}
      {filteredRegions.length === 0 ? (
        <div className="text-center py-0 bg-white rounded-lg border-2 border-gray-200">
          <Globe className="w-12 h-12 text-gray-400 mx-auto mb-0" />
          <p className="text-gray-500">No regions found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRegions.map((region) => {
            const flag = REGION_FLAGS[region.regionCode] || '🌍';
            return (
              <div
                key={region.regionId}
                className="bg-white rounded-lg border-2 border-gray-200 p-4 hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-0 flex-1">
                    <span className="text-3xl">{flag}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-0 mb-0">
                        <h3 className="font-semibold text-gray-900">{region.regionName}</h3>
                        <span className="text-xs px-0 py-0.5 bg-gray-100 text-gray-600 rounded">
                          {region.regionCode}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {region.currency.symbol} {region.currency.code}
                      </div>
                      <div className="flex items-center gap-0 mt-0">
                        {region.isActive ? (
                          <span className="inline-flex items-center gap-0 text-xs text-green-700 bg-green-50 px-0 py-0 rounded">
                            <CheckCircle className="w-3 h-3" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0 text-xs text-gray-700 bg-gray-50 px-0 py-0 rounded">
                            <XCircle className="w-3 h-3" />
                            Inactive
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-0">
                    <button
                      onClick={() => handleToggleStatus(region.regionId, region.isActive)}
                      className={`p-0 rounded-lg transition-colors ${
                        region.isActive
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      title={region.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {region.isActive ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

