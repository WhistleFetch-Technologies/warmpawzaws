'use client';

import { useState, useEffect, useCallback } from 'react';
import { Eye, Phone, RefreshCw, Plus, User, Building2, Power, PowerOff, AlertCircle, Search, X, FileText, Edit, Trash2, ExternalLink } from 'lucide-react';
import { Button, Input } from '@warmpawz/ui';
import { apiClient, getVendorWebBaseUrl } from '@/lib/api-client';
import { CustomDropdown } from './CustomDropdown';
import { VendorDetailsModal } from './VendorDetailsModal';
import { EditVendorDocumentsModal } from './EditVendorDocumentsModal';
import { EditVendorDetailsModal } from './EditVendorDetailsModal';

interface DiscoveryHealth {
  hasPhoto: boolean;
  hasAddress: boolean;
  hasAvailability: boolean;
  score: number;
  status: 'green' | 'amber' | 'red';
}

interface ActiveVendor {
  id: string;
  name: string;
  businessName: string;
  ownerName: string;
  tier: string;
  tierColor: string;
  location: string;
  experience: string;
  lastActive: string;
  category: string;
  rating: number;
  complaints: number;
  module: string;
  moduleTier: string;
  revenue: number;
  revenuePeriod: string;
  lastActiveDate: string;
  // ✅ NEW: Additional fields
  vendorType: 'solo' | 'business';
  roleId: string;
  roleName: string;
  roleDisplayName: string;
  phone: string;
  email: string;
  isActive: boolean;
  completedBookingsCount: number;
  activeServicesCount: number;
  reviewCount: number;
  discoveryHealth?: DiscoveryHealth;
}

export function ActiveVendorsTab() {
  const [vendors, setVendors] = useState<ActiveVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [performanceFilter, setPerformanceFilter] = useState('all');
  const [vendorTypeFilter, setVendorTypeFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const [editingDocumentsVendorId, setEditingDocumentsVendorId] = useState<string | null>(null);
  const [editingDocumentsVendorName, setEditingDocumentsVendorName] = useState<string>('');
  const [editingDetailsVendorId, setEditingDetailsVendorId] = useState<string | null>(null);
  const [editingDetailsVendorName, setEditingDetailsVendorName] = useState<string>('');
  const [totalCount, setTotalCount] = useState(0);
  const [cities, setCities] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [portalLoadingId, setPortalLoadingId] = useState<string | null>(null);

  // Debounce search to avoid too many API calls
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load vendors when filters change
  useEffect(() => {
    loadActiveVendors();
  }, [debouncedSearch, categoryFilter, performanceFilter, vendorTypeFilter, cityFilter, tierFilter]);

  const loadActiveVendors = useCallback(async () => {
    try {
      setLoading(true);
      // ✅ Prefer /admin/vendors/active first (same criteria as stats: approved + active, no "has published service" requirement)
      const activeParams = new URLSearchParams({ limit: '500' });
      if (debouncedSearch) activeParams.append('search', debouncedSearch);
      if (categoryFilter !== 'all') activeParams.append('category', categoryFilter);
      if (performanceFilter !== 'all') activeParams.append('performance', performanceFilter);
      if (vendorTypeFilter !== 'all') activeParams.append('vendorType', vendorTypeFilter);
      if (cityFilter !== 'all') activeParams.append('city', cityFilter);
      if (tierFilter !== 'all') activeParams.append('tier', tierFilter);
      const activeUrl = `/admin/vendors/active?${activeParams.toString()}`;
      const listParams = new URLSearchParams({ status: 'approved', isActive: 'true', limit: '500' });
      if (debouncedSearch) listParams.append('search', debouncedSearch);
      if (categoryFilter !== 'all') listParams.append('category', categoryFilter);
      if (cityFilter !== 'all') listParams.append('city', cityFilter);
      if (tierFilter !== 'all') listParams.append('tier', tierFilter);
      if (vendorTypeFilter !== 'all') listParams.append('vendorType', vendorTypeFilter);
      const listUrl = `/admin/vendors?${listParams.toString()}`;
      let data: any = { vendors: [], total: 0 };
      try {
        const activeData = await apiClient.get<any>(activeUrl);
        const ar = (activeData as any)?.data ?? (activeData as any)?.body ?? activeData;
        const aParsed = typeof ar === 'string' ? (() => { try { return JSON.parse(ar); } catch { return {}; } })() : ar;
        data = {
          vendors: aParsed.vendors ?? activeData.vendors ?? [],
          total: aParsed.total ?? activeData.total ?? (aParsed.vendors ?? activeData.vendors ?? []).length,
        };
        if ((data.vendors?.length ?? 0) === 0 && (data.total ?? 0) === 0) {
          throw new Error('Active endpoint returned empty');
        }
      } catch (e) {
        console.warn('[ActiveVendorsTab] /admin/vendors/active failed or empty, trying /admin/vendors:', e);
        try {
          const listData = await apiClient.get<any>(listUrl);
          const raw = (listData as any)?.data ?? (listData as any)?.body ?? listData;
          const parsed = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return {}; } })() : raw;
          data = {
            vendors: parsed.vendors ?? listData.vendors ?? [],
            total: parsed.total ?? listData.total ?? (parsed.vendors ?? listData.vendors ?? []).length,
          };
        } catch (e2) {
          console.error('[ActiveVendorsTab] Both endpoints failed:', e2);
        }
      }
      console.log('[ActiveVendorsTab] Loaded:', data.vendors?.length ?? 0, 'vendors, total:', data.total);
      
      // Extract unique cities for the city filter
      const uniqueCities = [...new Set((data.vendors || [])
        .map((v: any) => v.city)
        .filter((c: string) => c && c.trim())
      )].sort() as string[];
      
      if (cities.length === 0 && uniqueCities.length > 0) {
        setCities(uniqueCities);
      }

      // Map the vendor data to match the expected format
      const mappedVendors = (data.vendors || []).map((v: any) => {
        const roleId = (v.roleId ?? v.role_id ?? '').toString();
        return {
          id: v.id,
          name: v.businessName || v.ownerName || 'Unknown',
          businessName: v.businessName,
          ownerName: v.ownerName,
          tier: v.tier || 'Bronze',
          tierColor: (v.tier || 'Bronze').toLowerCase(),
          location: v.location || v.city || 'N/A',
          experience: v.experience || (v.experienceYears ? `${v.experienceYears} years` : 'N/A'),
          lastActive: v.lastActivity ? getRelativeTime(v.lastActivity) : 'Recently',
          category: v.category || v.roleName || 'General',
          rating: parseFloat(v.rating) || 0,
          complaints: 0,
          module: v.category || v.roleName || 'N/A',
          moduleTier: v.tier || 'Bronze',
          revenue: parseFloat(v.revenue) || parseFloat(v.revenue30Days) || 0,
          revenuePeriod: 'This month',
          lastActiveDate: v.lastActivity ? new Date(v.lastActivity).toLocaleDateString() : 'N/A',
          vendorType: v.vendorType || 'business',
          roleId,
          roleName: v.roleName ?? '',
          roleDisplayName: v.roleDisplayName ?? '',
          phone: v.phone ?? '',
          email: v.email ?? '',
          isActive: v.isActive ?? true,
          completedBookingsCount: v.completedBookingsCount || 0,
          activeServicesCount: v.activeServicesCount || 0,
          reviewCount: v.reviewCount || 0,
          discoveryHealth: v.discoveryHealth
        };
      });

      setVendors(mappedVendors);
      setTotalCount(data.total || mappedVendors.length);
    } catch (error) {
      console.error('Error loading active vendors:', error);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, categoryFilter, performanceFilter, vendorTypeFilter, cityFilter, tierFilter]);

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setPerformanceFilter('all');
    setVendorTypeFilter('all');
    setCityFilter('all');
    setTierFilter('all');
  };

  const hasActiveFilters = searchQuery || categoryFilter !== 'all' || performanceFilter !== 'all' || 
                           vendorTypeFilter !== 'all' || cityFilter !== 'all' || tierFilter !== 'all';

  // Helper function to get relative time
  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleViewVendor = (vendorId: string) => {
    setSelectedVendorId(vendorId);
  };

  const handleCallVendor = (vendorId: string) => {
    const vendor = vendors.find(v => v.id === vendorId);
    if (vendor?.phone) {
      window.open(`tel:${vendor.phone}`, '_self');
    } else {
      alert('Phone number not available');
    }
  };

  const handleOpenVendorPortal = async (vendorId: string) => {
    setPortalLoadingId(vendorId);
    try {
      const res = await apiClient.post<{ success?: boolean; code?: string; error?: string }>(
        `/admin/vendors/${vendorId}/vendor-portal-code`,
        {}
      );
      const raw = res as Record<string, unknown>;
      const code = (typeof raw?.code === 'string' ? raw.code : null) || null;
      if (!code) {
        const err = typeof raw?.error === 'string' ? raw.error : 'No portal code returned';
        alert(err);
        return;
      }
      const base = getVendorWebBaseUrl();
      window.open(
        `${base.replace(/\/+$/, '')}/session/from-admin?code=${encodeURIComponent(code)}`,
        '_blank',
        'noopener,noreferrer'
      );
    } catch (error: unknown) {
      console.error('Open vendor portal failed:', error);
      alert(error instanceof Error ? error.message : 'Failed to open vendor portal');
    } finally {
      setPortalLoadingId(null);
    }
  };

  const handleDeactivateVendor = async (vendorId: string, vendorName: string) => {
    const reason = prompt(`Enter reason for deactivating ${vendorName}:`);
    if (!reason) return;

    const confirmed = confirm(`Are you sure you want to deactivate ${vendorName}? This will remove them from customer listings.`);
    if (!confirmed) return;

    try {
      await apiClient.post(`/admin/vendors/${vendorId}/deactivate`, { reason });
      alert(`${vendorName} has been deactivated successfully.`);
      loadActiveVendors();
    } catch (error: any) {
      console.error('Error deactivating vendor:', error);
      alert(error.message || 'Failed to deactivate vendor');
    }
  };

  const handleDeleteVendor = async (vendorId: string, vendorName: string) => {
    const reason = prompt(
      `Enter reason for deleting "${vendorName}":\n\nThis will permanently delete the vendor account.`
    );
    if (!reason || reason.trim() === '') {
      return;
    }

    const confirmed = confirm(
      `⚠️ WARNING: Are you sure you want to permanently delete "${vendorName}"?\n\nThis action cannot be undone. The vendor will be soft-deleted (is_deleted = true).`
    );
    if (!confirmed) return;

    try {
      setDeletingId(vendorId);
      await apiClient.post(`/admin/vendors/${vendorId}/delete`, { reason: reason.trim() });
      alert(`${vendorName} has been deleted successfully.`);
      loadActiveVendors();
    } catch (error: any) {
      console.error('Error deleting vendor:', error);
      alert(error.message || 'Failed to delete vendor');
    } finally {
      setDeletingId(null);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: any = {
      'vet': 'bg-blue-100 text-blue-700 border-blue-200',
      'groomer': 'bg-purple-100 text-purple-700 border-purple-200',
      'walker': 'bg-pink-100 text-pink-700 border-pink-200',
      'boarding': 'bg-indigo-100 text-indigo-700 border-indigo-200',
      'training': 'bg-orange-100 text-orange-700 border-orange-200'
    };
    return colors[category.toLowerCase()] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getTierColor = (tierColor: string) => {
    const colors: any = {
      'gold': 'text-yellow-600',
      'silver': 'text-gray-600',
      'premium': 'text-purple-600',
      'platinum': 'text-purple-600',
      'standard': 'text-blue-600',
      'bronze': 'text-orange-600'
    };
    return colors[tierColor?.toLowerCase()] || 'text-gray-600';
  };

  const getVendorTypeBadge = (vendorType: string) => {
    if (vendorType === 'solo') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700 border border-purple-200">
          <User className="w-3 h-3" />
          Solo
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 border border-blue-200">
        <Building2 className="w-3 h-3" />
        Business
      </span>
    );
  };

  // Server-side filtering is now handled by the API, no need for client-side filtering
  const filteredVendors = vendors;

  return (
    <div className="p-4">
      <div className="mb-6">
        <div className="text-sm text-gray-600 mb-4">Manage Vendors Active Right Now</div>
        
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Active Vendors 
            <span className="text-sm font-normal text-gray-500 ml-2">
              ({vendors.length}{totalCount > vendors.length ? ` of ${totalCount}` : ''})
            </span>
          </h3>
          <div className="flex gap-2">
            {hasActiveFilters && (
              <Button variant="outline" className="gap-2 text-gray-600" onClick={clearFilters}>
                <X className="w-4 h-4" />
                Clear Filters
              </Button>
            )}
            <Button variant="outline" className="gap-2" onClick={loadActiveVendors} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button className="bg-[#FF8C42] hover:bg-[#FF7A2E] gap-2">
              <Plus className="w-4 h-4" />
              Add Vendor
            </Button>
          </div>
        </div>

        {/* ✅ Search Input */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, email, city, or category..."
            className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg focus:border-[#FF8C42] focus:ring-2 focus:ring-[#FF8C42]/20 outline-none transition-colors"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ✅ Filter Dropdowns */}
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
              { value: 'insurance', label: 'Insurance' }
            ]}
            value={categoryFilter}
            onChange={setCategoryFilter}
            placeholder="Category"
          />
          <CustomDropdown
            options={[
              { value: 'all', label: 'All Types' },
              { value: 'solo', label: 'Solo Providers' },
              { value: 'business', label: 'Business/Center' }
            ]}
            value={vendorTypeFilter}
            onChange={setVendorTypeFilter}
            placeholder="Vendor Type"
          />
          <CustomDropdown
            options={[
              { value: 'all', label: 'All Performance' },
              { value: 'high', label: 'High (4.5+)' },
              { value: 'medium', label: 'Medium (3.5-4.5)' },
              { value: 'low', label: 'Low (<3.5)' }
            ]}
            value={performanceFilter}
            onChange={setPerformanceFilter}
            placeholder="Performance"
          />
          <CustomDropdown
            options={[
              { value: 'all', label: 'All Tiers' },
              { value: 'platinum', label: 'Platinum' },
              { value: 'gold', label: 'Gold' },
              { value: 'silver', label: 'Silver' },
              { value: 'bronze', label: 'Bronze' }
            ]}
            value={tierFilter}
            onChange={setTierFilter}
            placeholder="Tier"
          />
          {cities.length > 0 && (
            <CustomDropdown
              options={[
                { value: 'all', label: 'All Cities' },
                ...cities.map(city => ({ value: city, label: city }))
              ]}
              value={cityFilter}
              onChange={setCityFilter}
              placeholder="City"
            />
          )}
        </div>

        {/* Active filters summary */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 mb-4 text-sm text-gray-600">
            <span>Active filters:</span>
            {searchQuery && (
              <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">
                Search: "{searchQuery}"
              </span>
            )}
            {categoryFilter !== 'all' && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs capitalize">
                {categoryFilter}
              </span>
            )}
            {vendorTypeFilter !== 'all' && (
              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs capitalize">
                {vendorTypeFilter}
              </span>
            )}
            {performanceFilter !== 'all' && (
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs capitalize">
                {performanceFilter} performance
              </span>
            )}
            {tierFilter !== 'all' && (
              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs capitalize">
                {tierFilter}
              </span>
            )}
            {cityFilter !== 'all' && (
              <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs">
                {cityFilter}
              </span>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#FF8C42]" />
          Loading vendors...
        </div>
      ) : filteredVendors.length === 0 ? (
        <div className="p-12 text-center text-gray-500 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <Eye className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No active vendors found</p>
          <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredVendors.map((vendor) => (
            <div key={vendor.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg hover:border-[#FF8C42]/30 transition-all">
                <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h4 className="font-semibold text-gray-900 text-lg">{vendor.name}</h4>
                    {/* Role Name Badge */}
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getCategoryColor(vendor.category)}`}>
                      {vendor.roleDisplayName || vendor.roleName || vendor.category}
                    </span>
                    {/* Vendor Type Badge (Solo/Business) */}
                    {getVendorTypeBadge(vendor.vendorType)}
                    <span className={`text-xs font-semibold ${getTierColor(vendor.tierColor)}`}>
                      {vendor.tier}
                    </span>
                    {/* Discovery health indicator (Phase 2) */}
                    {vendor.discoveryHealth && (
                      <span
                        title={`Photo: ${vendor.discoveryHealth.hasPhoto ? '✓' : '✗'}, Address: ${vendor.discoveryHealth.hasAddress ? '✓' : '✗'}, Availability: ${vendor.discoveryHealth.hasAvailability ? '✓' : '✗'}`}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                          vendor.discoveryHealth.status === 'green' ? 'bg-green-100 text-green-700' :
                          vendor.discoveryHealth.status === 'amber' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}
                      >
                        {vendor.discoveryHealth.score}/3 ready
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-5 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Location:</span>
                      <span className="ml-2 text-gray-900 font-medium">{vendor.location}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Rating:</span>
                      <span className="ml-2 text-gray-900 font-medium">
                        {typeof vendor.rating === 'number' ? vendor.rating.toFixed(1) : '0.0'} ⭐
                        {vendor.reviewCount > 0 && <span className="text-gray-400 text-xs ml-1">({vendor.reviewCount})</span>}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Revenue:</span>
                      <span className="ml-2 text-gray-900 font-medium">₹{vendor.revenue.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Bookings:</span>
                      <span className="ml-2 text-gray-900 font-medium">{vendor.completedBookingsCount}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Last Active:</span>
                      <span className="ml-2 text-gray-900 font-medium">{vendor.lastActive}</span>
                    </div>
                  </div>
                  
                  {/* Additional info row */}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    {vendor.roleName && <span className="font-medium text-gray-600">Role: {vendor.roleName}</span>}
                    {vendor.phone && <span>📞 {vendor.phone}</span>}
                    {vendor.email && <span>✉️ {vendor.email}</span>}
                    {vendor.activeServicesCount > 0 && <span>🛠️ {vendor.activeServicesCount} services</span>}
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 ml-6">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="hover:bg-gray-50"
                      onClick={() => handleViewVendor(vendor.id)}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="hover:bg-green-50 hover:border-green-200 text-green-600"
                      onClick={() => handleCallVendor(vendor.id)}
                    >
                      <Phone className="w-4 h-4 mr-2" />
                      Call
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="hover:bg-amber-50 hover:border-amber-200 text-amber-800"
                      onClick={() => handleOpenVendorPortal(vendor.id)}
                      disabled={portalLoadingId === vendor.id}
                      title="Opens vendor app in a new tab (admin session)"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      {portalLoadingId === vendor.id ? 'Opening…' : 'Open portal'}
                    </Button>
                  </div>
                  {/* ✅ NEW: Edit Documents button */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="hover:bg-blue-50 hover:border-blue-200 text-blue-600"
                    onClick={() => {
                      setEditingDocumentsVendorId(vendor.id);
                      setEditingDocumentsVendorName(vendor.name);
                    }}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Edit Documents
                  </Button>
                  {/* ✅ NEW: Edit Details button */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="hover:bg-purple-50 hover:border-purple-200 text-purple-600"
                    onClick={() => {
                      setEditingDetailsVendorId(vendor.id);
                      setEditingDetailsVendorName(vendor.name);
                    }}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Details
                  </Button>
                  {/* ✅ NEW: Deactivate button */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="hover:bg-red-50 hover:border-red-200 text-red-600"
                    onClick={() => handleDeactivateVendor(vendor.id, vendor.name)}
                  >
                    <PowerOff className="w-4 h-4 mr-2" />
                    Deactivate
                  </Button>
                  {/* ✅ NEW: Delete button */}
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => handleDeleteVendor(vendor.id, vendor.name)}
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

      {selectedVendorId && (
        <VendorDetailsModal
          isOpen={!!selectedVendorId}
          onClose={() => setSelectedVendorId(null)}
          vendorId={selectedVendorId}
        />
      )}

      {editingDocumentsVendorId && (
        <EditVendorDocumentsModal
          isOpen={!!editingDocumentsVendorId}
          onClose={() => {
            setEditingDocumentsVendorId(null);
            setEditingDocumentsVendorName('');
          }}
          vendorId={editingDocumentsVendorId}
          vendorName={editingDocumentsVendorName}
        />
      )}

      {editingDetailsVendorId && (
        <EditVendorDetailsModal
          isOpen={!!editingDetailsVendorId}
          onClose={() => {
            setEditingDetailsVendorId(null);
            setEditingDetailsVendorName('');
          }}
          vendorId={editingDetailsVendorId}
          vendorName={editingDetailsVendorName}
          onUpdate={loadActiveVendors}
        />
      )}
    </div>
  );
}

