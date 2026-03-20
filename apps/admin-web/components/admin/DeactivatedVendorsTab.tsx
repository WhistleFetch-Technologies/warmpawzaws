'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Eye, Phone, RefreshCw, Search, X, User, Building2, Trash2,
  AlertTriangle, Calendar, MessageSquare,
} from 'lucide-react';
import { Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import { CustomDropdown } from './CustomDropdown';
import { VendorDetailsModal } from './VendorDetailsModal';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface DeactivatedVendor {
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
  vendorType: 'solo' | 'business';
  location: string | null;
  city: string;
  completedBookingsCount: number;
  totalRevenue: number;
  createdAt: string;
  updatedAt: string;
  // Deactivation info
  deactivatedAt: string | null;
  deactivatedBy: string | null;
  deactivationReason: string | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────────────────

export function DeactivatedVendorsTab() {
  const [vendors, setVendors] = useState<DeactivatedVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [cities, setCities] = useState<string[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reload when filters change
  useEffect(() => {
    loadDeactivatedVendors();
  }, [debouncedSearch, categoryFilter, cityFilter]);

  // ── Fetch deactivated vendors ──────────────────────────────────────────────

  const loadDeactivatedVendors = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '500' });
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (cityFilter !== 'all') params.append('city', cityFilter);

      const raw = await apiClient.get<any>(`/admin/vendors/deactivated?${params.toString()}`);
      const data = raw?.data ?? raw?.body ?? raw;
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      const list: DeactivatedVendor[] = parsed.vendors ?? [];

      // Extract unique cities for the filter dropdown (only on first load)
      if (cities.length === 0) {
        const unique = [...new Set(list.map((v) => v.city).filter(Boolean))].sort() as string[];
        if (unique.length > 0) setCities(unique);
      }

      setVendors(list);
    } catch (error) {
      console.error('[DeactivatedVendorsTab] Error loading vendors:', error);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, categoryFilter, cityFilter]);

  // ── Delete a vendor (soft delete) ────────────────────────────────────────────

  const handleDelete = async (vendor: DeactivatedVendor) => {
    const reason = prompt(
      `Enter reason for deleting "${vendor.businessName || vendor.ownerName}":\n\nThis will permanently delete the vendor account.`
    );
    if (!reason || reason.trim() === '') {
      return;
    }

    const confirmed = confirm(
      `⚠️ WARNING: Are you sure you want to permanently delete "${vendor.businessName || vendor.ownerName}"?\n\nThis action cannot be undone. The vendor will be soft-deleted (is_deleted = true).`
    );
    if (!confirmed) return;

    try {
      setDeletingId(vendor.id);
      await apiClient.post(`/admin/vendors/${vendor.id}/delete`, { reason: reason.trim() });
      alert(`${vendor.businessName || vendor.ownerName} has been deleted successfully.`);
      loadDeactivatedVendors();
    } catch (error: any) {
      console.error('Error deleting vendor:', error);
      alert(error.message || 'Failed to delete vendor');
    } finally {
      setDeletingId(null);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setCityFilter('all');
  };

  const hasActiveFilters = searchQuery || categoryFilter !== 'all' || cityFilter !== 'all';

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  };

  const getVendorTypeBadge = (vendorType: string) => {
    if (vendorType === 'solo') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700 border border-purple-200">
          <User className="w-3 h-3" /> Solo
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 border border-blue-200">
        <Building2 className="w-3 h-3" /> Business
      </span>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="text-sm text-gray-600 mb-4">Vendors that have been deactivated by admin</div>

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Deactivated Vendors
            <span className="text-sm font-normal text-gray-500 ml-2">({vendors.length})</span>
          </h3>
          <div className="flex gap-2">
            {hasActiveFilters && (
              <Button variant="outline" className="gap-2 text-gray-600" onClick={clearFilters}>
                <X className="w-4 h-4" /> Clear Filters
              </Button>
            )}
            <Button variant="outline" className="gap-2" onClick={loadDeactivatedVendors} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, email, or city..."
            className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg focus:border-red-400 focus:ring-2 focus:ring-red-400/20 outline-none transition-colors"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <CustomDropdown
            options={[
              { value: 'all', label: 'All Categories' },
              { value: 'vet', label: 'Veterinary' },
              { value: 'grooming', label: 'Grooming' },
              { value: 'walking', label: 'Walking' },
              { value: 'boarding', label: 'Boarding' },
              { value: 'training', label: 'Training' },
              { value: 'nutritionist', label: 'Nutritionist' },
              { value: 'diagnostics', label: 'Diagnostics' },
              { value: 'insurance', label: 'Insurance' },
            ]}
            value={categoryFilter}
            onChange={setCategoryFilter}
            placeholder="Category"
          />
          {cities.length > 0 && (
            <CustomDropdown
              options={[
                { value: 'all', label: 'All Cities' },
                ...cities.map((c) => ({ value: c, label: c })),
              ]}
              value={cityFilter}
              onChange={setCityFilter}
              placeholder="City"
            />
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="p-8 text-center text-gray-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-red-400" />
          Loading deactivated vendors...
        </div>
      ) : vendors.length === 0 ? (
        <div className="p-12 text-center text-gray-500 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No deactivated vendors found</p>
          <p className="text-sm text-gray-400 mt-1">All vendors are currently active</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vendors.map((vendor) => (
            <div
              key={vendor.id}
              className="bg-white border border-red-200 rounded-xl p-5 hover:shadow-lg hover:border-red-300 transition-all"
            >
              <div className="flex items-start justify-between">
                {/* Left — vendor info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold text-gray-900 text-lg">
                      {vendor.businessName || vendor.ownerName || 'Unknown'}
                    </h4>
                    <span className="px-2.5 py-1 text-xs font-medium rounded-full border bg-gray-100 text-gray-700 border-gray-200">
                      {vendor.roleDisplayName || vendor.roleName || vendor.category}
                    </span>
                    {getVendorTypeBadge(vendor.vendorType)}
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">
                      Deactivated
                    </span>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-4 gap-4 text-sm mb-2">
                    <div>
                      <span className="text-gray-500">Location:</span>
                      <span className="ml-2 text-gray-900 font-medium">{vendor.location || vendor.city || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Bookings:</span>
                      <span className="ml-2 text-gray-900 font-medium">{vendor.completedBookingsCount}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Revenue:</span>
                      <span className="ml-2 text-gray-900 font-medium">₹{vendor.totalRevenue.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Tier:</span>
                      <span className="ml-2 text-gray-900 font-medium">{vendor.tier}</span>
                    </div>
                  </div>

                  {/* Contact row */}
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                    {vendor.phone && <span>📞 {vendor.phone}</span>}
                    {vendor.email && <span>✉️ {vendor.email}</span>}
                  </div>

                  {/* Deactivation info */}
                  <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-lg text-sm">
                    <div className="flex items-center gap-2 text-red-700 font-medium mb-1">
                      <AlertTriangle className="w-4 h-4" />
                      Deactivation Details
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-gray-700">
                      <div>
                        <span className="text-gray-500">Reason: </span>
                        <span className="font-medium">{vendor.deactivationReason || 'No reason provided'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-gray-500">Date: </span>
                        <span className="font-medium">{formatDate(vendor.deactivatedAt)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">By: </span>
                        <span className="font-medium">{vendor.deactivatedBy || 'Admin'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right — action buttons */}
                <div className="flex flex-col gap-2 ml-6">
                  <Button
                    size="sm"
                    variant="outline"
                    className="hover:bg-gray-50"
                    onClick={() => setSelectedVendorId(vendor.id)}
                  >
                    <Eye className="w-4 h-4 mr-2" /> View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="hover:bg-green-50 hover:border-green-200 text-green-600"
                    onClick={() => {
                      const v = vendors.find((ven) => ven.id === vendor.id);
                      if (v?.phone) window.open(`tel:${v.phone}`, '_self');
                    }}
                  >
                    <Phone className="w-4 h-4 mr-2" /> Call
                  </Button>
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => handleDelete(vendor)}
                    disabled={deletingId === vendor.id}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {deletingId === vendor.id ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Vendor details modal */}
      {selectedVendorId && (
        <VendorDetailsModal
          isOpen={!!selectedVendorId}
          onClose={() => setSelectedVendorId(null)}
          vendorId={selectedVendorId}
        />
      )}
    </div>
  );
}
