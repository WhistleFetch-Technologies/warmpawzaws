'use client';

import React, { useState, useEffect } from 'react';
import { Package, MapPin, Loader2, Plus, Filter, Search } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { RegionalPackageList } from './catalog/RegionalPackageList';
import { CreateRegionalPackageModal } from './catalog/CreateRegionalPackageModal';

interface Region {
  regionId: string;
  regionName: string;
  regionCode: string;
  isActive: boolean;
}

interface RegionStats {
  totalPackages: number;
  activePackages: number;
  totalRevenue: number;
  avgPrice: number;
}

export function RegionalCatalogManager() {
  const [loading, setLoading] = useState(true);
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [stats, setStats] = useState<RegionStats | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadRegions();
  }, []);

  useEffect(() => {
    if (selectedRegion) {
      loadRegionStats(selectedRegion);
    }
  }, [selectedRegion]);

  const loadRegions = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/regions');
      const activeRegions = (data.regions || []).filter((r: Region) => r.isActive);
      setRegions(activeRegions);
      if (activeRegions.length > 0 && !selectedRegion) {
        setSelectedRegion(activeRegions[0].regionId);
      }
    } catch (error) {
      console.error('Error loading regions:', error);
      alert('Failed to load regions');
    } finally {
      setLoading(false);
    }
  };

  const loadRegionStats = async (regionId: string) => {
    try {
      const data = await apiClient.get<any>(`/admin/regions/${regionId}/packages/stats`);
      setStats(data.stats || null);
    } catch (error) {
      console.error('Error loading region stats:', error);
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
          <div className="p-0 bg-purple-100 rounded-xl">
            <Package className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Regional Catalog Manager</h1>
            <p className="text-sm text-gray-600">Manage packages and services by region</p>
          </div>
        </div>
        {selectedRegion && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-0 px-4 py-0 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            <Plus className="w-4 h-4" />
            Add Package
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
        <div className="flex items-center gap-0 mb-4">
          <MapPin className="w-5 h-5 text-gray-400" />
          <h2 className="font-semibold text-gray-900">Select Region</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-0">
          {regions.map((region) => (
            <button
              key={region.regionId}
              onClick={() => setSelectedRegion(region.regionId)}
              className={`px-4 py-0 rounded-lg font-medium transition-colors ${
                selectedRegion === region.regionId
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {region.regionCode}
            </button>
          ))}
        </div>
      </div>

      {selectedRegion && stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
            <p className="text-sm text-gray-600 mb-0">Total Packages</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalPackages}</p>
          </div>
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
            <p className="text-sm text-gray-600 mb-0">Active Packages</p>
            <p className="text-2xl font-bold text-green-600">{stats.activePackages}</p>
          </div>
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
            <p className="text-sm text-gray-600 mb-0">Total Revenue</p>
            <p className="text-2xl font-bold text-gray-900">₹{stats.totalRevenue.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
            <p className="text-sm text-gray-600 mb-0">Avg Price</p>
            <p className="text-2xl font-bold text-gray-900">₹{stats.avgPrice.toFixed(0)}</p>
          </div>
        </div>
      )}

      {selectedRegion && (
        <RegionalPackageList
          regionId={selectedRegion}
          onRefresh={() => loadRegionStats(selectedRegion)}
        />
      )}

      {showCreateModal && selectedRegion && (
        <CreateRegionalPackageModal
          isOpen={showCreateModal}
          regionId={selectedRegion}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadRegionStats(selectedRegion);
          }}
        />
      )}
    </div>
  );
}
