import { useState, useEffect } from 'react';
import { Search, Eye, RefreshCw, Check, X, FileText } from 'lucide-react';
import { Button } from '../ui/button';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { CustomDropdown } from './CustomDropdown';

interface Vendor {
  id: string;
  fullName?: string;
  vendorName?: string;
  businessName?: string;
  vendorId: string;
  location?: string;
  city?: string;
  address?: string;
  priority?: 'high' | 'medium' | 'low';
  category: string;
  serviceCategory?: string;
  roleName?: string;
  experience: string;
  progress?: number;
  progressPercentage?: number;
  applied?: string;
  submittedAt?: string;
  status: 'pending_approval' | 'approved' | 'rejected' | 'pending_reverification';
  phone?: string;
  mobile?: string;
  serviceType?: string;
}

type StatusTab = 'new_applications' | 'approved' | 'rejected' | 'reverification';
type RoleFilter = 'all' | 'vet' | 'grooming' | 'walking' | 'boarding' | 'training';

interface EnhancedPendingApplicationsTabProps {
  onViewDetails?: (vendor: Vendor) => void;
}

export function EnhancedPendingApplicationsTab({ onViewDetails }: EnhancedPendingApplicationsTabProps) {
  const [activeStatusTab, setActiveStatusTab] = useState<StatusTab>('new_applications');
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingVendorIds, setProcessingVendorIds] = useState<Set<string>>(new Set());
  
  // Search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Stats for tab badges
  const [statusCounts, setStatusCounts] = useState({
    new_applications: 0,
    approved: 0,
    rejected: 0,
    reverification: 0
  });

  useEffect(() => {
    loadVendors();
  }, []);

  useEffect(() => {
    updateStatusCounts();
  }, [vendors]);

  const loadVendors = async () => {
    try {
      setLoading(true);
      
      // Add cache-busting timestamp to force fresh data
      const timestamp = new Date().getTime();
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/all?t=${timestamp}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Cache-Control': 'no-cache'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Vendors loaded:', data.vendors?.length || 0);
        setVendors(data.vendors || []);
      } else {
        console.error('Failed to load vendors:', response.status);
        const errorText = await response.text();
        console.error('Error details:', errorText);
      }
    } catch (error) {
      console.error('Error loading vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatusCounts = () => {
    const counts = {
      new_applications: vendors.filter(v => v.status === 'pending_approval').length,
      approved: vendors.filter(v => v.status === 'approved').length,
      rejected: vendors.filter(v => v.status === 'rejected').length,
      reverification: vendors.filter(v => v.status === 'pending_reverification').length
    };
    setStatusCounts(counts);
  };

  const handleApprove = async (vendorId: string) => {
    // Prevent concurrent operations on the same vendor
    if (processingVendorIds.has(vendorId)) {
      console.log('⚠️ Already processing this vendor, skipping...');
      return;
    }

    try {
      // Mark vendor as processing
      setProcessingVendorIds(prev => new Set(prev).add(vendorId));

      // Fetch current vendor status from backend to verify it's still pending
      const statusCheckResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/${vendorId}?t=${Date.now()}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Cache-Control': 'no-cache'
          }
        }
      );

      if (statusCheckResponse.ok) {
        const statusData = await statusCheckResponse.json();
        const currentStatus = statusData.vendor?.status;
        
        // If already approved or rejected, just refresh and return
        if (currentStatus !== 'pending_approval' && currentStatus !== 'pending') {
          console.log(`⚠️ Vendor already processed with status: ${currentStatus}`);
          await loadVendors();
          setProcessingVendorIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(vendorId);
            return newSet;
          });
          return;
        }
      }

      // Optimistically update the UI
      setVendors(prevVendors => 
        prevVendors.map(v => 
          v.vendorId === vendorId ? { ...v, status: 'approved' as const } : v
        )
      );

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/applications/${vendorId}/approve`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            adminId: 'admin_1',
            adminName: 'Admin',
            notes: 'Approved from vendor administration'
          })
        }
      );
      
      const data = await response.json();
      
      if (response.ok) {
        console.log('✅ Vendor approved successfully');
      } else {
        console.error('❌ Failed to approve:', data);
        // Only show alert if vendor is NOT already approved
        if (data.currentStatus !== 'approved') {
          alert(`Failed to approve vendor: ${data.error || 'Unknown error'}`);
        } else {
          // Vendor is already approved, just log it
          console.log('ℹ️ Vendor was already approved, no action needed');
        }
      }
      
      // Always reload to sync with backend
      await loadVendors();
    } catch (error) {
      console.error('Error approving vendor:', error);
      alert('An error occurred while approving the vendor');
      await loadVendors();
    } finally {
      // Remove from processing set
      setProcessingVendorIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(vendorId);
        return newSet;
      });
    }
  };

  const handleReject = async (vendorId: string) => {
    // Prevent concurrent operations on the same vendor
    if (processingVendorIds.has(vendorId)) {
      console.log('⚠️ Already processing this vendor, skipping...');
      return;
    }

    try {
      // Mark vendor as processing
      setProcessingVendorIds(prev => new Set(prev).add(vendorId));

      // Fetch current vendor status from backend to verify it's still pending
      const statusCheckResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/${vendorId}?t=${Date.now()}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Cache-Control': 'no-cache'
          }
        }
      );

      if (statusCheckResponse.ok) {
        const statusData = await statusCheckResponse.json();
        const currentStatus = statusData.vendor?.status;
        
        // If already approved or rejected, just refresh and return
        if (currentStatus !== 'pending_approval' && currentStatus !== 'pending') {
          console.log(`⚠️ Vendor already processed with status: ${currentStatus}`);
          await loadVendors();
          setProcessingVendorIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(vendorId);
            return newSet;
          });
          return;
        }
      }

      // Optimistically update the UI
      setVendors(prevVendors => 
        prevVendors.map(v => 
          v.vendorId === vendorId ? { ...v, status: 'rejected' as const } : v
        )
      );

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/applications/${vendorId}/reject`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            adminId: 'admin_1',
            adminName: 'Admin',
            reason: 'Application rejected'
          })
        }
      );
      
      const data = await response.json();
      
      if (response.ok) {
        console.log('✅ Vendor rejected successfully');
      } else {
        console.error('❌ Failed to reject:', data);
        if (data.currentStatus !== 'rejected' && data.currentStatus !== 'approved') {
          alert(`Failed to reject vendor: ${data.error || 'Unknown error'}`);
        }
      }
      
      // Always reload to sync with backend
      await loadVendors();
    } catch (error) {
      console.error('Error rejecting vendor:', error);
      alert('An error occurred while rejecting the vendor');
      await loadVendors();
    } finally {
      // Remove from processing set
      setProcessingVendorIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(vendorId);
        return newSet;
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-orange-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getCategoryBadgeStyle = (category: string) => {
    const styles: any = {
      'vet': 'bg-blue-50 text-blue-700 border-blue-200',
      'groomer': 'bg-purple-50 text-purple-700 border-purple-200',
      'walker': 'bg-pink-50 text-pink-700 border-pink-200',
      'boarding': 'bg-indigo-50 text-indigo-700 border-indigo-200',
      'training': 'bg-orange-50 text-orange-700 border-orange-200',
      'grooming': 'bg-purple-50 text-purple-700 border-purple-200',
      'walking': 'bg-pink-50 text-pink-700 border-pink-200'
    };
    return styles[category.toLowerCase()] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  // Filter vendors based on active tab
  const getVendorsByStatus = () => {
    const statusMap: Record<StatusTab, string> = {
      'new_applications': 'pending_approval',
      'approved': 'approved',
      'rejected': 'rejected',
      'reverification': 'pending_reverification'
    };
    return vendors.filter(v => v.status === statusMap[activeStatusTab]);
  };

  // Apply search and role filters
  const filteredVendors = getVendorsByStatus().filter(vendor => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        vendor.fullName?.toLowerCase().includes(query) ||
        vendor.vendorName?.toLowerCase().includes(query) ||
        vendor.businessName?.toLowerCase().includes(query) ||
        vendor.phone?.toLowerCase().includes(query) ||
        vendor.mobile?.toLowerCase().includes(query);
      
      if (!matchesSearch) return false;
    }

    // Role filter
    if (roleFilter !== 'all') {
      const category = vendor.category?.toLowerCase() || '';
      const serviceCategory = vendor.serviceCategory?.toLowerCase() || '';
      const roleName = vendor.roleName?.toLowerCase() || '';
      const serviceType = vendor.serviceType?.toLowerCase() || '';
      
      if (roleFilter === 'grooming' && !category.includes('groom') && !serviceCategory.includes('groom') && !roleName.includes('groom') && !serviceType.includes('groom')) return false;
      if (roleFilter === 'vet' && !category.includes('vet') && !serviceCategory.includes('vet') && !roleName.includes('vet') && !serviceType.includes('vet')) return false;
      if (roleFilter === 'walking' && !category.includes('walk') && !serviceCategory.includes('walk') && !roleName.includes('walk') && !serviceType.includes('walk')) return false;
      if (roleFilter === 'boarding' && !category.includes('board') && !serviceCategory.includes('board') && !roleName.includes('board') && !serviceType.includes('board')) return false;
      if (roleFilter === 'training' && !category.includes('train') && !serviceCategory.includes('train') && !roleName.includes('train') && !serviceType.includes('train')) return false;
    }

    // Category filter
    if (categoryFilter !== 'all') {
      const vendorCategory = (vendor.category || vendor.serviceCategory || '').toLowerCase();
      if (vendorCategory !== categoryFilter.toLowerCase()) return false;
    }
    
    // Priority filter
    if (priorityFilter !== 'all' && vendor.priority !== priorityFilter) return false;

    return true;
  });

  const statusTabs = [
    { id: 'new_applications' as StatusTab, label: 'New Applications', count: statusCounts.new_applications },
    { id: 'approved' as StatusTab, label: 'Approved', count: statusCounts.approved },
    { id: 'rejected' as StatusTab, label: 'Rejected', count: statusCounts.rejected },
    { id: 'reverification' as StatusTab, label: 'Re-Verification', count: statusCounts.reverification }
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Status Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4 sm:gap-8 overflow-x-auto">
          {statusTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveStatusTab(tab.id)}
              className={`pb-3 sm:pb-4 px-1 relative transition-colors whitespace-nowrap ${
                activeStatusTab === tab.id
                  ? 'text-[#FF8C42]'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="text-xs sm:text-sm">
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 rounded-full text-xs ${
                    activeStatusTab === tab.id
                      ? 'bg-orange-100 text-[#FF8C42]'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </span>
              {activeStatusTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF8C42]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Header with count */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-gray-900">
            {statusTabs.find(t => t.id === activeStatusTab)?.label}
          </h3>
          <p className="text-sm text-gray-600">
            Showing {filteredVendors.length} of {getVendorsByStatus().length} vendors
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadVendors}
          className="gap-2 text-gray-600 hover:text-gray-900 self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by mobile number, name or business name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
          />
        </div>

        {/* Role Filter */}
        <CustomDropdown
          options={[
            { value: 'all', label: 'All Roles' },
            { value: 'vet', label: 'Healthcare Providers' },
            { value: 'grooming', label: 'Grooming & Day-care' },
            { value: 'walking', label: 'Walkers & Sitters' },
            { value: 'boarding', label: 'Boarding & Adoption' },
            { value: 'training', label: 'Training Services' }
          ]}
          value={roleFilter}
          onChange={(value) => setRoleFilter(value as RoleFilter)}
          placeholder="All Roles"
        />

        {/* Category Filter */}
        <CustomDropdown
          options={[
            { value: 'all', label: 'All Categories' },
            { value: 'vet', label: 'Healthcare Providers' },
            { value: 'groomer', label: 'Grooming & Day-care' },
            { value: 'walker', label: 'Walkers & Sitters' },
            { value: 'boarding', label: 'Boarding & Adoption' },
            { value: 'training', label: 'Sunset Services' }
          ]}
          value={categoryFilter}
          onChange={setCategoryFilter}
          placeholder="All Categories"
        />

        {/* Priority Filter */}
        <CustomDropdown
          options={[
            { value: 'all', label: 'All Priorities' },
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' },
            { value: 'low', label: 'Low' }
          ]}
          value={priorityFilter}
          onChange={setPriorityFilter}
          placeholder="All Priorities"
        />
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Table Header - Hidden on mobile */}
        <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 text-xs text-gray-500 border-b border-gray-200">
          <div className="col-span-3">Vendor Details</div>
          <div className="col-span-2">Service Category</div>
          <div className="col-span-1">Type</div>
          <div className="col-span-2">Progress</div>
          <div className="col-span-4">Actions</div>
        </div>

        {/* Table Body */}
        {loading ? (
          <div className="p-8 sm:p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42] mx-auto"></div>
            <p className="mt-4 text-sm text-gray-600">Loading vendors...</p>
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="p-8 sm:p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No vendors found</p>
            <p className="text-sm text-gray-500 mt-1">
              {searchQuery ? 'Try adjusting your search or filters' : 'No applications in this category'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredVendors.map((vendor, index) => (
              <div key={`${vendor.vendorId || vendor.id}-${vendor.status}-${index}`} className="lg:grid lg:grid-cols-12 gap-4 px-3 sm:px-6 py-4 hover:bg-gray-50 transition-colors">
                {/* Mobile Layout */}
                <div className="lg:hidden space-y-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${getPriorityColor(vendor.priority || 'medium')}`} />
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{vendor.fullName || vendor.vendorName || 'N/A'}</p>
                      {vendor.businessName && (
                        <p className="text-xs text-gray-500 mt-0.5">{vendor.businessName}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-0.5">{vendor.city || vendor.location || vendor.address || 'N/A'}</p>
                      {vendor.phone && (
                        <p className="text-xs text-gray-500 mt-0.5">{vendor.phone}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-block px-2 py-1 rounded text-xs border ${getCategoryBadgeStyle(vendor.category || vendor.serviceCategory || 'N/A')}`}>
                      {vendor.roleName || vendor.serviceCategory || vendor.category || 'N/A'}
                    </span>
                    <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                      service_provider
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-[#FF8C42] h-2 rounded-full transition-all"
                        style={{ width: `${vendor.progressPercentage || vendor.progress || 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600 min-w-[35px]">{vendor.progressPercentage || vendor.progress || 100}%</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {activeStatusTab === 'new_applications' && vendor.status === 'pending_approval' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(vendor.vendorId)}
                          className="bg-green-600 hover:bg-green-700 text-white gap-1 flex-1 sm:flex-initial"
                        >
                          <Check className="w-3 h-3" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(vendor.vendorId)}
                          className="border-red-300 text-red-600 hover:bg-red-50 gap-1 flex-1 sm:flex-initial"
                        >
                          <X className="w-3 h-3" />
                          Reject
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onViewDetails?.(vendor)}
                      className="gap-1 text-[#FF8C42] hover:text-[#FF7A2E] hover:bg-orange-50"
                    >
                      <Eye className="w-3 h-3" />
                      View
                    </Button>
                  </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden lg:contents">
                  {/* Vendor Details */}
                  <div className="col-span-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-2 ${getPriorityColor(vendor.priority || 'medium')}`} />
                      <div>
                        <p className="text-sm text-gray-900">{vendor.fullName || vendor.vendorName || 'N/A'}</p>
                        {vendor.businessName && (
                          <p className="text-xs text-gray-500 mt-0.5">{vendor.businessName}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-0.5">{vendor.city || vendor.location || vendor.address || 'N/A'}</p>
                        {vendor.phone && (
                          <p className="text-xs text-gray-500 mt-0.5">{vendor.phone}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Service Category */}
                  <div className="col-span-2">
                    <span className={`inline-block px-2 py-1 rounded text-xs border ${getCategoryBadgeStyle(vendor.category || vendor.serviceCategory || 'N/A')}`}>
                      {vendor.roleName || vendor.serviceCategory || vendor.category || 'N/A'}
                    </span>
                  </div>

                  {/* Type */}
                  <div className="col-span-1">
                    <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                      service_provider
                    </span>
                  </div>

                  {/* Progress */}
                  <div className="col-span-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-[#FF8C42] h-2 rounded-full transition-all"
                          style={{ width: `${vendor.progressPercentage || vendor.progress || 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 min-w-[35px]">{vendor.progressPercentage || vendor.progress || 100}%</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="col-span-4">
                    <div className="flex items-center gap-2">
                      {activeStatusTab === 'new_applications' && vendor.status === 'pending_approval' && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(vendor.vendorId)}
                            className="bg-green-600 hover:bg-green-700 text-white gap-1"
                          >
                            <Check className="w-3 h-3" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(vendor.vendorId)}
                            className="border-red-300 text-red-600 hover:bg-red-50 gap-1"
                          >
                            <X className="w-3 h-3" />
                            Reject
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onViewDetails?.(vendor)}
                        className="gap-1 text-[#FF8C42] hover:text-[#FF7A2E] hover:bg-orange-50"
                      >
                        <Eye className="w-3 h-3" />
                        View
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}