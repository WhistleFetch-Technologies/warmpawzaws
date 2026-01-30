'use client';

import { useState, useEffect } from 'react';
import { Search, Eye, RefreshCw, Check, X, FileText, User, Building2 } from 'lucide-react';
import { Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import { getAdminId } from '@/lib/cognito-auth';
import { CustomDropdown } from './CustomDropdown';
import { ApplicationDetailModal } from './ApplicationDetailModal';
import { RejectVendorModal } from './RejectVendorModal';
import { RequestInfoModal } from './RequestInfoModal';

interface Vendor {
  id: string;
  fullName?: string;
  vendorName?: string;
  businessName?: string;
  ownerName?: string;
  vendorId: string;
  location?: string;
  city?: string;
  address?: string;
  priority?: 'high' | 'medium' | 'low';
  category: string;
  serviceCategory?: string;
  roleName?: string;
  experience: string;
  experienceYears?: number;
  progress?: number;
  progressPercentage?: number;
  applied?: string;
  submittedAt?: string;
  status: 'pending_approval' | 'approved' | 'rejected' | 'pending_reverification';
  phone?: string;
  mobile?: string;
  email?: string;
  serviceType?: string;
  vendorType?: 'solo' | 'business';
  vendor_type?: 'solo' | 'business';
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
  
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const [statusCounts, setStatusCounts] = useState({
    new_applications: 0,
    approved: 0,
    rejected: 0,
    reverification: 0
  });

  const [selectedApplication, setSelectedApplication] = useState<Vendor | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRequestInfoModal, setShowRequestInfoModal] = useState(false);
  const [rejectingApplication, setRejectingApplication] = useState<Vendor | null>(null);

  useEffect(() => {
    loadVendors();
  }, []);

  useEffect(() => {
    updateStatusCounts();
  }, [vendors]);

  const loadVendors = async () => {
    try {
      setLoading(true);
      const timestamp = new Date().getTime();
      
      // ✅ FIX: Try to load from both new and old endpoints
      let vendorsList: Vendor[] = [];
      
      try {
        // Try fixed pending applications endpoint first
        const pendingData = await apiClient.get<{ applications: Vendor[] }>(`/admin/vendors/pending-applications-fixed?t=${timestamp}`);
        console.log('✅ [ADMIN] Loaded from FIXED endpoint:', pendingData.applications?.length || 0);
        if (pendingData.applications && pendingData.applications.length > 0) {
          vendorsList = pendingData.applications;
        }
      } catch (fixedError) {
        console.warn('⚠️ [ADMIN] Fixed endpoint failed, trying original:', fixedError);
      }
      
      // Also try original endpoint and merge results
      try {
        const allData = await apiClient.get<{ vendors: Vendor[] }>(`/admin/vendors/all?t=${timestamp}`);
        console.log('✅ [ADMIN] Loaded from ORIGINAL endpoint:', allData.vendors?.length || 0);
        
        // Merge with fixed endpoint results (deduplicate by id)
        const existingIds = new Set(vendorsList.map(v => v.id));
        const newVendors = (allData.vendors || []).filter((v: Vendor) => !existingIds.has(v.id));
        vendorsList = [...vendorsList, ...newVendors];
      } catch (originalError) {
        console.warn('⚠️ [ADMIN] Original endpoint also failed:', originalError);
      }
      
      console.log('✅ [ADMIN] Total vendors loaded:', vendorsList.length);
      setVendors(vendorsList);
    } catch (error) {
      console.error('❌ [ADMIN] Error loading vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatusCounts = () => {
    const counts = {
      new_applications: vendors.filter(v => v.status === 'pending_approval' || (v.status as any) === 'pending').length,
      approved: vendors.filter(v => v.status === 'approved').length,
      rejected: vendors.filter(v => v.status === 'rejected').length,
      reverification: vendors.filter(v => v.status === 'pending_reverification').length
    };
    setStatusCounts(counts);
  };

  const handleApprove = async (vendorId: string) => {
    if (processingVendorIds.has(vendorId)) {
      return;
    }

    try {
      setProcessingVendorIds(prev => new Set(prev).add(vendorId));
      
      const vendor = vendors.find(v => v.vendorId === vendorId || v.id === vendorId);
      const appId = vendor?.id || vendorId;
      
      // Try onboarding review endpoint first (proper state machine)
      try {
        const adminId = getAdminId() || 'admin'; // Fallback to 'admin' if not available
        await apiClient.post(`/admin/vendor/onboarding/${appId}/review`, {
          action: 'APPROVE',
          admin_id: adminId,
          comments: 'Approved from admin portal'
        });
        alert('Vendor approved successfully');
        await loadVendors();
        return;
      } catch (onboardingError: any) {
        // Fallback to compatibility endpoint
        console.warn('Onboarding review endpoint failed, trying compatibility endpoint:', onboardingError);
        await apiClient.post(`/admin/vendor/application/${appId}/approve`, {
          reviewerName: 'Admin',
          notes: 'Approved'
        });
        alert('Vendor approved successfully');
        await loadVendors();
      }
    } catch (error: any) {
      console.error('Error approving vendor:', error);
      alert(error.message || 'Failed to approve vendor');
    } finally {
      setProcessingVendorIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(vendorId);
        return newSet;
      });
    }
  };

  const handleReject = (vendor: Vendor) => {
    setRejectingApplication(vendor);
    setShowRejectModal(true);
  };

  const handleRejectConfirm = async (reason: string, notes?: string) => {
    if (!rejectingApplication) return;

    try {
      const appId = rejectingApplication.id || rejectingApplication.vendorId;
      
      // Try onboarding review endpoint first (proper state machine)
      try {
        const adminId = getAdminId() || 'admin'; // Fallback to 'admin' if not available
        await apiClient.post(`/admin/vendor/onboarding/${appId}/review`, {
          action: 'REJECT',
          admin_id: adminId,
          rejection_reason: reason,
          comments: notes
        });
        alert('Vendor rejected');
        setShowRejectModal(false);
        setRejectingApplication(null);
        await loadVendors();
        return;
      } catch (onboardingError: any) {
        // Fallback to compatibility endpoint
        console.warn('Onboarding review endpoint failed, trying compatibility endpoint:', onboardingError);
        await apiClient.post(`/admin/vendor/application/${appId}/reject`, {
          reviewerName: 'Admin',
          reason,
          notes,
          allowResubmit: true
        });
        alert('Vendor rejected');
        setShowRejectModal(false);
        setRejectingApplication(null);
        await loadVendors();
      }
    } catch (error: any) {
      console.error('Error rejecting vendor:', error);
      alert(error.message || 'Failed to reject vendor');
    }
  };

  const handleRequestInfo = (vendor: Vendor) => {
    setSelectedApplication(vendor);
    setShowRequestInfoModal(true);
  };

  const handleRequestInfoConfirm = async (message: string) => {
    if (!selectedApplication) return;

    try {
      const appId = selectedApplication.id || selectedApplication.vendorId;
      
      // Try onboarding review endpoint first (proper state machine)
      try {
        const adminId = getAdminId() || 'admin'; // Fallback to 'admin' if not available
        await apiClient.post(`/admin/vendor/onboarding/${appId}/review`, {
          action: 'REQUEST_CLARIFICATION',
          admin_id: adminId,
          comments: message
        });
        alert('Information request sent');
        setShowRequestInfoModal(false);
        setSelectedApplication(null);
        await loadVendors();
        return;
      } catch (onboardingError: any) {
        // Fallback to compatibility endpoint
        console.warn('Onboarding review endpoint failed, trying compatibility endpoint:', onboardingError);
        await apiClient.post(`/admin/vendor/application/${appId}/request-clarification`, {
          reviewerName: 'Admin',
          notes: message
        });
        alert('Information request sent');
        setShowRequestInfoModal(false);
        setSelectedApplication(null);
        await loadVendors();
      }
    } catch (error: any) {
      console.error('Error requesting info:', error);
      alert(error.message || 'Failed to send request');
    }
  };

  const filteredVendors = vendors.filter(vendor => {
    // Status filter
    if (activeStatusTab === 'new_applications' && vendor.status !== 'pending_approval' && (vendor.status as string) !== 'pending') return false;
    if (activeStatusTab === 'approved' && vendor.status !== 'approved') return false;
    if (activeStatusTab === 'rejected' && vendor.status !== 'rejected') return false;
    if (activeStatusTab === 'reverification' && vendor.status !== 'pending_reverification') return false;

    // Role filter
    if (roleFilter !== 'all') {
      const vendorRole = vendor.category?.toLowerCase() || vendor.serviceCategory?.toLowerCase() || '';
      if (vendorRole !== roleFilter) return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !vendor.fullName?.toLowerCase().includes(query) &&
        !vendor.businessName?.toLowerCase().includes(query) &&
        !vendor.phone?.includes(query) &&
        !(vendor as any).email?.toLowerCase().includes(query)
      ) return false;
    }

    // Priority filter
    if (priorityFilter !== 'all' && vendor.priority !== priorityFilter) return false;

    return true;
  });

  return (
    <div>
      {/* Status Tabs */}
      <div className="mb-4 border-b border-gray-200">
        <div className="flex gap-4">
          {[
            { id: 'new_applications' as StatusTab, label: 'New Applications', count: statusCounts.new_applications },
            { id: 'approved' as StatusTab, label: 'Approved', count: statusCounts.approved },
            { id: 'rejected' as StatusTab, label: 'Rejected', count: statusCounts.rejected },
            { id: 'reverification' as StatusTab, label: 'Reverification', count: statusCounts.reverification }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveStatusTab(tab.id)}
              className={`px-4 py-0 text-sm border-b-2 transition-colors ${
                activeStatusTab === tab.id
                  ? 'border-[#FF8C42] text-[#FF8C42]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                  activeStatusTab === tab.id ? 'bg-[#FF8C42]/20' : 'bg-gray-100'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex gap-3 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-0/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search vendors..."
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            className="w-full pl-0 pr-4 py-0 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        
        <CustomDropdown
          options={[
            { value: 'all', label: 'All Roles' },
            { value: 'vet', label: 'Vet' },
            { value: 'grooming', label: 'Grooming' },
            { value: 'walking', label: 'Walking' },
            { value: 'boarding', label: 'Boarding' },
            { value: 'training', label: 'Training' }
          ]}
          value={roleFilter}
          onChange={(value) => setRoleFilter(value as RoleFilter)}
        />
        
        <CustomDropdown
          options={[
            { value: 'all', label: 'All Priorities' },
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' },
            { value: 'low', label: 'Low' }
          ]}
          value={priorityFilter}
          onChange={setPriorityFilter}
        />
        
        <Button variant="outline" size="sm" onClick={loadVendors}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Vendor List */}
      {loading ? (
        <div className="p-0 text-center text-gray-500">Loading applications...</div>
      ) : filteredVendors.length === 0 ? (
        <div className="p-0 text-center text-gray-500">No applications found</div>
      ) : (
        <div className="space-y-3">
          {filteredVendors.map((vendor) => {
            const isProcessing = processingVendorIds.has(vendor.vendorId || vendor.id);
            const vendorType = vendor.vendorType || vendor.vendor_type || 'business';
            
            return (
              <div key={vendor.id || vendor.vendorId} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-[#FF8C42]/30 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold text-gray-900 text-lg">
                        {vendor.fullName || vendor.businessName || vendor.ownerName || vendor.vendorName}
                      </h4>
                      {/* Vendor Type Badge */}
                      {vendorType === 'solo' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                          <User className="w-3 h-3" />
                          Solo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                          <Building2 className="w-3 h-3" />
                          Business
                        </span>
                      )}
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                        vendor.priority === 'high' ? 'bg-red-100 text-red-700 border border-red-200' :
                        vendor.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                        'bg-blue-100 text-blue-700 border border-blue-200'
                      }`}>
                        {vendor.priority || 'medium'}
                      </span>
                      {/* Role Name Badge */}
                      {vendor.roleName && (
                        <span className="px-2.5 py-1 text-xs font-medium bg-indigo-100 text-indigo-700 rounded-full border border-indigo-200">
                          Role: {vendor.roleName}
                        </span>
                      )}
                      <span className="px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full border border-gray-200">
                        {vendor.category || vendor.serviceCategory || vendor.roleName || 'N/A'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="text-gray-500">Phone:</span>
                        <span className="ml-2 font-medium">{vendor.phone || vendor.mobile || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Location:</span>
                        <span className="ml-2 font-medium">{vendor.city || vendor.location || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Experience:</span>
                        <span className="ml-2 font-medium">{vendor.experience || (vendor.experienceYears ? `${vendor.experienceYears} years` : 'N/A')}</span>
                      </div>
                      {vendor.email && (
                        <div>
                          <span className="text-gray-500">Email:</span>
                          <span className="ml-2 font-medium truncate">{vendor.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-3 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedApplication(vendor);
                        if (onViewDetails) onViewDetails(vendor);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View
                    </Button>
                    
                    {activeStatusTab === 'new_applications' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRequestInfo(vendor)}
                          className="text-blue-600 hover:bg-blue-50"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Request Info
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(vendor)}
                          className="text-red-600 hover:bg-red-50"
                          disabled={isProcessing}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(vendor.vendorId || vendor.id)}
                          disabled={isProcessing}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Check className="w-4 h-4 mr-2" />
                          {isProcessing ? 'Processing...' : 'Approve'}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {selectedApplication && (
        <ApplicationDetailModal
          isOpen={!!selectedApplication}
          onClose={() => setSelectedApplication(null)}
          application={selectedApplication}
          onApprove={loadVendors}
          onReject={loadVendors}
          onRequestClarification={loadVendors}
        />
      )}

      {showRejectModal && rejectingApplication && (
        <RejectVendorModal
          isOpen={showRejectModal}
          vendorName={rejectingApplication.fullName || rejectingApplication.businessName || 'Vendor'}
          onSubmit={handleRejectConfirm}
          onCancel={() => {
            setShowRejectModal(false);
            setRejectingApplication(null);
          }}
        />
      )}

      {showRequestInfoModal && selectedApplication && (
        <RequestInfoModal
          isOpen={showRequestInfoModal}
          vendorName={selectedApplication.fullName || selectedApplication.businessName || 'Vendor'}
          onSubmit={handleRequestInfoConfirm}
          onCancel={() => {
            setShowRequestInfoModal(false);
            setSelectedApplication(null);
          }}
        />
      )}
    </div>
  );
}

