'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { Package, Plus, Edit, Trash2, CheckCircle, XCircle, Loader2 } from 'lucide-react';

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
      const response = await apiClient.get<any>(`/vendor/${vendorId}/packages`);
      if (response.success && response.packages) {
        setPackages(response.packages);
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
      await apiClient.delete(`/vendor/${vendorId}/packages/${packageId}`);
      loadPackages();
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
      default: return null;
    }
  };

  const filteredPackages = filterStatus === 'all'
    ? packages
    : packages.filter(pkg => pkg.status === filterStatus);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">Packages</h1>
          <button
            onClick={onCreateNew}
            className="px-4 py-0 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-3 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New
          </button>
        </div>

        <div className="flex gap-3">
          {['all', 'approved', 'pending', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-0 py-0.5 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === status
                  ? 'bg-orange-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {filteredPackages.length === 0 ? (
          <div className="text-center py-0 bg-white rounded-lg border-2 border-gray-200">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-0" />
            <p className="text-gray-500">No packages found</p>
          </div>
        ) : (
          filteredPackages.map((pkg) => (
            <div key={pkg.id} className="bg-white rounded-lg border-2 border-gray-200 p-4">
              <div className="flex items-start justify-between mb-0">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-0">
                    <Package className="w-5 h-5 text-orange-600" />
                    <h3 className="font-semibold text-gray-900">{pkg.packageName}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-0">{pkg.packageType}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-semibold text-gray-900">₹{pkg.packagePrice}</span>
                    {pkg.originalPrice > pkg.packagePrice && (
                      <span className="text-gray-500 line-through">₹{pkg.originalPrice}</span>
                    )}
                    {pkg.discountPercentage > 0 && (
                      <span className="text-green-600 font-medium">{pkg.discountPercentage}% off</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleDelete(pkg.id)}
                    className="p-0 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-0 py-0 rounded-full flex items-center gap-3 ${getStatusColor(pkg.status)}`}>
                  {getStatusIcon(pkg.status)}
                  {pkg.status}
                </span>
                {pkg.isActive && (
                  <span className="text-xs px-0 py-0 rounded-full bg-green-100 text-green-700">
                    Active
                  </span>
                )}
              </div>
              <div className="mt-0 pt-0 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
                <span>{pkg.activeSubscribers} subscribers</span>
                <span>₹{pkg.totalRevenue} revenue</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
