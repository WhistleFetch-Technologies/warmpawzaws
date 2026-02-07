'use client';

import { useState, useEffect } from 'react';
import { Button } from '@warmpawz/ui';
import { 
  Package, 
  Plus, 
  Search, 
  Filter, 
  Globe, 
  IndianRupee,
  Edit,
  Trash2,
  Eye,
  Loader2,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { CreateRegionalPackageModal } from './CreateRegionalPackageModal';

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

interface RegionalPackage {
  id: string;
  packageName: string;
  category: string;
  description: string;
  regionalAvailability: {
    mode: 'all' | 'specific' | 'exclude';
    regions: string[];
  };
  regionalPricing: Array<{
    regionId: string;
    basePrice: number;
    currency: string;
    symbol: string;
  }>;
  status: string;
  isActive: boolean;
  createdAt: string;
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

interface RegionalPackageListProps {
  regionId?: string;
  onRefresh?: () => void;
}

export function RegionalPackageList({ regionId, onRefresh }: RegionalPackageListProps = {}) {
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<RegionalPackage[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>(regionId || 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [selectedRegion]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadRegions(),
      loadPackages(),
      loadStats(),
    ]);
    setLoading(false);
  };

  const loadRegions = async () => {
    try {
      const data = await apiClient.get<any>('/admin/regions');
      setRegions(data.regions || []);
    } catch (error) {
      console.error('Error loading regions:', error);
    }
  };

  const loadPackages = async () => {
    try {
      let endpoint: string;
      
      if (selectedRegion === 'all') {
        endpoint = '/admin/packages/stats/by-region';
      } else {
        endpoint = `/packages/by-region/${selectedRegion}`;
      }

      const data = await apiClient.get<any>(endpoint);
      
      if (selectedRegion === 'all') {
        setPackages([]);
      } else {
        setPackages(data.packages || []);
      }
    } catch (error) {
      console.error('Error loading packages:', error);
    }
  };

  const loadStats = async () => {
    try {
      const data = await apiClient.get<any>('/admin/packages/stats/by-region');
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const filteredPackages = packages.filter(pkg => {
    if (searchQuery && !pkg.packageName.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (selectedCategory !== 'all' && pkg.category !== selectedCategory) {
      return false;
    }
    return true;
  });

  const categories = Array.from(new Set(packages.map(p => p.category)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Regional Packages</h2>
          <p className="text-gray-600 text-sm mt-0">
            Manage packages with region-specific pricing and availability
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-primary hover:bg-primary/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Package
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 border-2 border-gray-200 rounded-lg bg-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Packages</p>
                <p className="text-2xl mt-0 font-bold">{stats.totals?.totalPackages || 0}</p>
              </div>
              <Package className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="p-4 border-2 border-gray-200 rounded-lg bg-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Regions</p>
                <p className="text-2xl mt-0 font-bold">{stats.totals?.activeRegions || 0}</p>
              </div>
              <Globe className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="p-4 border-2 border-gray-200 rounded-lg bg-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Regions</p>
                <p className="text-2xl mt-0 font-bold">{stats.totals?.totalRegions || 0}</p>
              </div>
              <Globe className="w-8 h-8 text-orange-600" />
            </div>
          </div>

          <div className="p-4 border-2 border-gray-200 rounded-lg bg-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg per Region</p>
                <p className="text-2xl mt-0 font-bold">
                  {stats.totals?.activeRegions > 0
                    ? Math.round(stats.totals.totalPackages / stats.totals.activeRegions)
                    : 0}
                </p>
              </div>
              <IndianRupee className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>
      )}

      <div className="p-4 border-2 border-gray-200 rounded-lg bg-white">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-0/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              placeholder="Search packages..."
              className="w-full pl-0 pr-4 py-0 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div className="relative">
            <Globe className="absolute left-3 top-0/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={selectedRegion}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedRegion(e.target.value)}
              className="w-full pl-0 pr-4 py-0 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Regions</option>
              {regions.filter(r => r.isActive).map(region => {
                const flag = REGION_FLAGS[region.regionCode] || '🌍';
                const count = stats?.stats?.find((s: any) => s.regionId === region.regionId)?.totalPackages || 0;
                return (
                  <option key={region.regionId} value={region.regionId}>
                    {flag} {region.regionName} ({count} packages)
                  </option>
                );
              })}
            </select>
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-0/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={selectedCategory}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedCategory(e.target.value)}
              className="w-full pl-0 pr-4 py-0 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-0">
          <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
        </div>
      ) : filteredPackages.length === 0 ? (
        <div className="p-02 text-center border-2 border-dashed border-gray-300 rounded-lg bg-white">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-0">No packages found</h3>
          <p className="text-gray-600 mb-4">
            {selectedRegion !== 'all'
              ? `No packages available in this region yet`
              : `Create your first regional package to get started`}
          </p>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Package
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPackages.map((pkg) => {
            const regionalPricing = selectedRegion !== 'all' 
              ? pkg.regionalPricing.find(p => p.regionId === selectedRegion)
              : null;

            return (
              <div key={pkg.id} className="p-4 border-2 border-gray-200 rounded-lg bg-white hover:border-orange-300 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="p-1 bg-orange-100 rounded-lg">
                    <Package className="w-6 h-6 text-orange-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-medium text-lg text-gray-900">{pkg.packageName}</h3>
                        {pkg.description && (
                          <p className="text-sm text-gray-600 mt-0">{pkg.description}</p>
                        )}
                      </div>

                      {regionalPricing && (
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Price</div>
                          <div className="text-xl font-bold text-green-600">
                            {regionalPricing.symbol}{regionalPricing.basePrice}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 mt-0">
                      <span className="text-xs px-0 py-0 bg-blue-100 text-blue-700 rounded">
                        {pkg.category}
                      </span>

                      {pkg.regionalAvailability.mode === 'all' && (
                        <span className="flex items-center gap-3 text-xs text-gray-600">
                          <Globe className="w-3 h-3" />
                          All Regions
                        </span>
                      )}

                      {pkg.regionalAvailability.mode === 'specific' && (
                        <span className="flex items-center gap-3 text-xs text-gray-600">
                          <Globe className="w-3 h-3" />
                          {pkg.regionalAvailability.regions.length} Regions
                        </span>
                      )}

                      {pkg.isActive ? (
                        <span className="flex items-center gap-3 text-xs text-green-600">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-3 text-xs text-red-600">
                          <XCircle className="w-3 h-3" />
                          Inactive
                        </span>
                      )}
                    </div>

                    <div className="mt-0 flex flex-wrap gap-3">
                      {pkg.regionalPricing.slice(0, 4).map(pricing => {
                        const region = regions.find(r => r.regionId === pricing.regionId);
                        if (!region) return null;
                        const flag = REGION_FLAGS[region.regionCode] || '🌍';
                        return (
                          <span
                            key={pricing.regionId}
                            className="inline-flex items-center gap-3 px-0 py-0 bg-gray-100 rounded text-xs"
                            title={`${region.regionName}: ${pricing.symbol}${pricing.basePrice}`}
                          >
                            <span>{flag}</span>
                            <span>{pricing.symbol}{pricing.basePrice}</span>
                          </span>
                        );
                      })}
                      {pkg.regionalPricing.length > 4 && (
                        <span className="inline-flex items-center px-0 py-0 bg-gray-100 rounded text-xs text-gray-600">
                          +{pkg.regionalPricing.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      className="p-0 hover:bg-gray-100 rounded-lg transition-colors"
                      title="View"
                    >
                      <Eye className="w-4 h-4 text-gray-600" />
                    </button>
                    <button
                      className="p-0 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4 text-blue-600" />
                    </button>
                    <button
                      className="p-0 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateRegionalPackageModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          loadData();
          alert('Package created successfully!');
        }}
      />
    </div>
  );
}

