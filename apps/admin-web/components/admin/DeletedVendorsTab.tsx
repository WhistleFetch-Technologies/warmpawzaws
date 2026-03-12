'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Eye, Phone, RefreshCw, Search, User, Building2,
  AlertTriangle, Calendar, MessageSquare,
} from 'lucide-react';
import { Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import { CustomDropdown } from './CustomDropdown';
import { VendorDetailsModal } from './VendorDetailsModal';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface DeletedVendor {
  id: string;
  businessName: string;
  ownerName: string;
  phone: string;
  email: string;
  roleId: string;
  roleName: string;
  roleDisplayName: string;
  category: string;
  status: string;
  tier: string;
  isActive: boolean;
  isDeleted: boolean;
  vendorType: 'solo' | 'business';
  location: string | null;
  city: string;
  completedBookingsCount: number;
  totalRevenue: number;
  createdAt: string;
  updatedAt: string;
  // Deletion info
  deletedAt: string | null;
  deletedBy: string | null;
  deletionReason: string | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function DeletedVendorsTab() {
  const [vendors, setVendors] = useState<DeletedVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [cities, setCities] = useState<string[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reload when filters change
  useEffect(() => {
    loadDeletedVendors();
  }, [debouncedSearch, categoryFilter, cityFilter]);

  // ── Fetch deleted vendors ──────────────────────────────────────────────

  const loadDeletedVendors = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '500' });
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (cityFilter !== 'all') params.append('city', cityFilter);

      const raw = await apiClient.get<any>(`/admin/vendors/deleted?${params.toString()}`);
      const data = raw?.data ?? raw?.body ?? raw;
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      const list: DeletedVendor[] = parsed.vendors ?? [];

      // Extract unique cities for the filter dropdown (only on first load)
      if (cities.length === 0) {
        const unique = [...new Set(list.map((v) => v.city).filter(Boolean))].sort() as string[];
        if (unique.length > 0) setCities(unique);
      }

      setVendors(list);
    } catch (error) {
      console.error('[DeletedVendorsTab] Error loading vendors:', error);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, categoryFilter, cityFilter]);

  // ── View vendor details ────────────────────────────────────────────────

  const handleView = (vendorId: string) => {
    setSelectedVendorId(vendorId);
  };

  const handleCloseModal = () => {
    setSelectedVendorId(null);
  };

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading && vendors.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">Loading deleted vendors...</span>
      </div>
    );
  }

  if (vendors.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Deleted Vendors</h2>
            <p className="text-sm text-gray-600 mt-1">Vendors that have been soft-deleted from the system.</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No deleted vendors found</h3>
          <p className="text-gray-600">All vendors are currently active or deactivated.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Deleted Vendors</h2>
          <p className="text-sm text-gray-600 mt-1">
            Vendors that have been soft-deleted from the system. ({vendors.length})
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, phone, email, or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>

          {/* Category Filter */}
          <CustomDropdown
            label="All Categories"
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={[
              { value: 'all', label: 'All Categories' },
              ...Array.from(new Set(vendors.map((v) => v.category).filter(Boolean))).map((cat) => ({
                value: cat,
                label: cat,
              })),
            ]}
          />

          {/* City Filter */}
          {cities.length > 0 && (
            <CustomDropdown
              label="All Cities"
              value={cityFilter}
              onChange={setCityFilter}
              options={[
                { value: 'all', label: 'All Cities' },
                ...cities.map((city) => ({ value: city, label: city })),
              ]}
            />
          )}

          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={loadDeletedVendors}
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Vendor List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vendor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deletion Info
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stats
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {vendors.map((vendor) => (
                <tr key={vendor.id} className="hover:bg-gray-50 border-l-4 border-red-500">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        {vendor.vendorType === 'solo' ? (
                          <User className="w-8 h-8 text-gray-400" />
                        ) : (
                          <Building2 className="w-8 h-8 text-gray-400" />
                        )}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {vendor.businessName || vendor.ownerName || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {vendor.roleDisplayName || vendor.roleName || vendor.category}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            Deleted
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{vendor.phone}</div>
                    {vendor.email && (
                      <div className="text-sm text-gray-500">{vendor.email}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{vendor.city || 'N/A'}</div>
                    {vendor.location && (
                      <div className="text-sm text-gray-500">{vendor.location}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {vendor.deletedAt && (
                      <div className="text-sm text-gray-900">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {new Date(vendor.deletedAt).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                    {vendor.deletionReason && (
                      <div className="text-sm text-gray-500 mt-1 flex items-start gap-1">
                        <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">{vendor.deletionReason}</span>
                      </div>
                    )}
                    {vendor.deletedBy && (
                      <div className="text-xs text-gray-400 mt-1">By: {vendor.deletedBy}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {vendor.completedBookingsCount} bookings
                    </div>
                    <div className="text-sm text-gray-500">
                      ₹{vendor.totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleView(vendor.id)}
                      className="flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vendor Details Modal */}
      {selectedVendorId && (
        <VendorDetailsModal
          isOpen={!!selectedVendorId}
          onClose={handleCloseModal}
          vendorId={selectedVendorId}
        />
      )}
    </div>
  );
}
