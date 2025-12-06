import { useState, useEffect } from 'react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { 
  Package, 
  Plus, 
  Search, 
  Filter, 
  Globe, 
  DollarSign,
  Edit,
  Trash2,
  Eye,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { CreateRegionalPackageModal } from './CreateRegionalPackageModal';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner';

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

export function RegionalPackageList() {
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<RegionalPackage[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
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
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/regions`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setRegions(data.regions || []);
      }
    } catch (error) {
      console.error('Error loading regions:', error);
    }
  };

  const loadPackages = async () => {
    try {
      let url: string;
      
      if (selectedRegion === 'all') {
        // Load all packages
        url = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/packages/stats/by-region`;
      } else {
        // Load packages for specific region
        url = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/packages/by-region/${selectedRegion}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        if (selectedRegion === 'all') {
          // For 'all', we need to get actual packages differently
          // For now, show empty or implement a different endpoint
          setPackages([]);
        } else {
          setPackages(data.packages || []);
        }
      }
    } catch (error) {
      console.error('Error loading packages:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/packages/stats/by-region`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const filteredPackages = packages.filter(pkg => {
    // Search filter
    if (searchQuery && !pkg.packageName.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Category filter
    if (selectedCategory !== 'all' && pkg.category !== selectedCategory) {
      return false;
    }

    return true;
  });

  const categories = Array.from(new Set(packages.map(p => p.category)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl">Regional Packages</h2>
          <p className="text-gray-600 text-sm mt-1">
            Manage packages with region-specific pricing and availability
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-orange-600 hover:bg-orange-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Package
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 border-2 border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Packages</p>
                <p className="text-2xl mt-1">{stats.totals?.totalPackages || 0}</p>
              </div>
              <Package className="w-8 h-8 text-blue-600" />
            </div>
          </Card>

          <Card className="p-4 border-2 border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Regions</p>
                <p className="text-2xl mt-1">{stats.totals?.activeRegions || 0}</p>
              </div>
              <Globe className="w-8 h-8 text-green-600" />
            </div>
          </Card>

          <Card className="p-4 border-2 border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Regions</p>
                <p className="text-2xl mt-1">{stats.totals?.totalRegions || 0}</p>
              </div>
              <Globe className="w-8 h-8 text-orange-600" />
            </div>
          </Card>

          <Card className="p-4 border-2 border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg per Region</p>
                <p className="text-2xl mt-1">
                  {stats.totals?.activeRegions > 0
                    ? Math.round(stats.totals.totalPackages / stats.totals.activeRegions)
                    : 0}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-600" />
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="p-4 border-2 border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search packages..."
              className="pl-10"
            />
          </div>

          {/* Region Filter */}
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg"
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

          {/* Category Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg"
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
      </Card>

      {/* Package List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
        </div>
      ) : filteredPackages.length === 0 ? (
        <Card className="p-12 text-center border-2 border-dashed border-gray-300">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg mb-2">No packages found</h3>
          <p className="text-gray-600 mb-4">
            {selectedRegion !== 'all'
              ? `No packages available in this region yet`
              : `Create your first regional package to get started`}
          </p>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Package
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredPackages.map((pkg) => {
            const regionalPricing = selectedRegion !== 'all' 
              ? pkg.regionalPricing.find(p => p.regionId === selectedRegion)
              : null;

            return (
              <Card key={pkg.id} className="p-4 border-2 border-gray-200 hover:border-orange-300 transition-colors">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <Package className="w-6 h-6 text-orange-600" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-medium text-lg">{pkg.packageName}</h3>
                        {pkg.description && (
                          <p className="text-sm text-gray-600 mt-1">{pkg.description}</p>
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

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-4 mt-3">
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                        {pkg.category}
                      </span>

                      {pkg.regionalAvailability.mode === 'all' && (
                        <span className="flex items-center gap-1 text-xs text-gray-600">
                          <Globe className="w-3 h-3" />
                          All Regions
                        </span>
                      )}

                      {pkg.regionalAvailability.mode === 'specific' && (
                        <span className="flex items-center gap-1 text-xs text-gray-600">
                          <Globe className="w-3 h-3" />
                          {pkg.regionalAvailability.regions.length} Regions
                        </span>
                      )}

                      {pkg.isActive ? (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-red-600">
                          <XCircle className="w-3 h-3" />
                          Inactive
                        </span>
                      )}
                    </div>

                    {/* Regional Availability */}
                    <div className="mt-3 flex flex-wrap gap-1">
                      {pkg.regionalPricing.slice(0, 4).map(pricing => {
                        const region = regions.find(r => r.regionId === pricing.regionId);
                        if (!region) return null;
                        const flag = REGION_FLAGS[region.regionCode] || '🌍';
                        return (
                          <span
                            key={pricing.regionId}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs"
                            title={`${region.regionName}: ${pricing.symbol}${pricing.basePrice}`}
                          >
                            <span>{flag}</span>
                            <span>{pricing.symbol}{pricing.basePrice}</span>
                          </span>
                        );
                      })}
                      {pkg.regionalPricing.length > 4 && (
                        <span className="inline-flex items-center px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                          +{pkg.regionalPricing.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="View"
                    >
                      <Eye className="w-4 h-4 text-gray-600" />
                    </button>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4 text-blue-600" />
                    </button>
                    <button
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <CreateRegionalPackageModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          loadData();
          toast.success('Package created successfully!');
        }}
      />
    </div>
  );
}
