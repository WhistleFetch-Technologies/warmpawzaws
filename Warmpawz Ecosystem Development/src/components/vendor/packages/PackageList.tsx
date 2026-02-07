import { useState, useEffect } from 'react';
import { Package, Plus, Edit, Trash2, TrendingUp, Clock, CheckCircle, XCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Card } from '../../ui/card';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';

interface PackageItem {
  id: string;
  packageName: string;
  packageType: string;
  packagePrice: number;
  originalPrice: number;
  discountPercentage: number;
  status: 'pending' | 'approved' | 'rejected';
  isActive: boolean;
  totalPurchases: number;
  totalRevenue: number;
  activeSubscribers: number;
  createdAt: string;
  approvedAt?: string;
  adminNotes?: string;
}

export function PackageList({
  vendorId,
  onCreateNew,
  onBack
}: {
  vendorId: string;
  onCreateNew: () => void;
  onBack: () => void;
}) {
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadPackages();
  }, [vendorId]);

  const loadPackages = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${getApiBaseUrl()}/vendor/${vendorId}/packages`,
        {
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPackages(data.packages || []);
      }
    } catch (error) {
      console.error('Error loading packages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (packageId: string) => {
    if (!confirm('Are you sure you want to delete this package?')) return;

    try {
      const response = await fetch(
        `${getApiBaseUrl()}/vendor/${vendorId}/packages/${packageId}`,
        {
          method: 'DELETE',
          headers: getAuthHeaders()
        }
      );

      if (response.ok) {
        alert('✅ Package deleted successfully');
        loadPackages();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error deleting package:', error);
      alert('Failed to delete package');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getPackageTypeIcon = (type: string) => {
    switch (type) {
      case 'bundle': return '📦';
      case 'time_based': return '⏰';
      case 'appointment': return '📅';
      case 'membership': return '👑';
      case 'subscription': return '🔄';
      default: return '📦';
    }
  };

  const filteredPackages = filterStatus === 'all'
    ? packages
    : packages.filter(p => p.status === filterStatus);

  const stats = {
    total: packages.length,
    approved: packages.filter(p => p.status === 'approved').length,
    pending: packages.filter(p => p.status === 'pending').length,
    rejected: packages.filter(p => p.status === 'rejected').length,
    totalRevenue: packages.reduce((sum, p) => sum + (p.totalRevenue || 0), 0),
    totalSales: packages.reduce((sum, p) => sum + (p.totalPurchases || 0), 0)
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] p-4 text-white sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="p-1 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">My Packages</h1>
            <p className="text-sm text-white/90">Manage your service packages</p>
          </div>
          <Button
            onClick={onCreateNew}
            size="sm"
            className="bg-white text-[#FF8C42] hover:bg-gray-100"
          >
            <Plus className="w-4 h-4 mr-1" />
            Create
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2">
            <div className="text-lg font-bold">{stats.approved}</div>
            <div className="text-xs text-white/80">Live</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2">
            <div className="text-lg font-bold">{stats.totalSales}</div>
            <div className="text-xs text-white/80">Sales</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2">
            <div className="text-lg font-bold">₹{(stats.totalRevenue / 1000).toFixed(1)}k</div>
            <div className="text-xs text-white/80">Revenue</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-3 border-b sticky top-[180px] z-10">
        <div className="flex gap-2 overflow-x-auto">
          {['all', 'approved', 'pending', 'rejected'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filterStatus === status
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
              {status !== 'all' && (
                <span className="ml-1 text-xs">
                  ({stats[status as keyof typeof stats]})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Package List */}
      <div className="p-4 space-y-3 pb-20">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading packages...</div>
        ) : filteredPackages.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-900 mb-2">No Packages Found</h3>
            <p className="text-sm text-gray-600 mb-4">
              {filterStatus === 'all'
                ? 'Create your first package to get started'
                : `No ${filterStatus} packages`}
            </p>
            {filterStatus === 'all' && (
              <Button
                onClick={onCreateNew}
                className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Package
              </Button>
            )}
          </div>
        ) : (
          filteredPackages.map(pkg => (
            <Card key={pkg.id} className="p-4 hover:shadow-md transition-shadow">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{getPackageTypeIcon(pkg.packageType)}</span>
                    <h3 className="font-semibold text-gray-900">{pkg.packageName}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="capitalize">{pkg.packageType.replace('_', ' ')}</span>
                    <span>•</span>
                    <span>{new Date(pkg.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <Badge className={getStatusColor(pkg.status)}>
                  {getStatusIcon(pkg.status)}
                  <span className="ml-1 capitalize">{pkg.status}</span>
                </Badge>
              </div>

              {/* Pricing */}
              <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between">
                  <div>
                    {pkg.originalPrice > pkg.packagePrice && (
                      <div className="text-xs text-gray-500 line-through">
                        ₹{pkg.originalPrice}
                      </div>
                    )}
                    <div className="text-2xl font-bold text-gray-900">
                      ₹{pkg.packagePrice}
                    </div>
                  </div>
                  {pkg.discountPercentage > 0 && (
                    <div className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                      {pkg.discountPercentage}% OFF
                    </div>
                  )}
                </div>
              </div>

              {/* Analytics */}
              {pkg.status === 'approved' && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-blue-50 rounded-lg p-2 text-center">
                    <div className="text-sm font-bold text-blue-900">{pkg.totalPurchases || 0}</div>
                    <div className="text-xs text-blue-600">Sales</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2 text-center">
                    <div className="text-sm font-bold text-green-900">
                      ₹{((pkg.totalRevenue || 0) / 1000).toFixed(1)}k
                    </div>
                    <div className="text-xs text-green-600">Revenue</div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-2 text-center">
                    <div className="text-sm font-bold text-purple-900">{pkg.activeSubscribers || 0}</div>
                    <div className="text-xs text-purple-600">Active</div>
                  </div>
                </div>
              )}

              {/* Admin Notes (if rejected) */}
              {pkg.status === 'rejected' && pkg.adminNotes && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                  <div className="text-xs text-red-600 font-semibold mb-1">Rejection Reason:</div>
                  <div className="text-sm text-red-800">{pkg.adminNotes}</div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    // TODO: Navigate to analytics
                    alert('Analytics coming soon!');
                  }}
                >
                  <TrendingUp className="w-4 h-4 mr-1" />
                  Analytics
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    // TODO: Navigate to edit
                    alert('Edit coming soon!');
                  }}
                  disabled={pkg.status === 'pending'}
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => handleDelete(pkg.id)}
                  disabled={pkg.totalPurchases > 0}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
