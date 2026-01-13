'use client';

import { useState, useEffect } from 'react';
import { Search, Eye, RefreshCw, Check, X, FileText } from 'lucide-react';
import { Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import { CustomDropdown } from './CustomDropdown';
import { ApplicationDetailModal } from './ApplicationDetailModal';
import { RejectVendorModal } from './RejectVendorModal';
import { RequestInfoModal } from './RequestInfoModal';

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
      const data = await apiClient.get<any>(`/admin/vendors/all?t=${timestamp}`);
      console.log('✅ Vendors loaded:', data.vendors?.length || 0);
      setVendors(data.vendors || []);
    } catch (error) {
      console.error('Error loading vendors:', error);
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
      
      const appId = vendors.find(v => v.vendorId === vendorId || v.id === vendorId)?.id || vendorId;
      await apiClient.post(`/admin/vendor/application/${appId}/approve`, {
        reviewerName: 'Admin',
        notes: 'Approved'
      });

      alert('Vendor approved successfully');
      await loadVendors();
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
      await apiClient.post(`/admin/vendor/application/${appId}/request-clarification`, {
        reviewerName: 'Admin',
        notes: message
      });

      alert('Information request sent');
      setShowRequestInfoModal(false);
      setSelectedApplication(null);
      await loadVendors();
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
      <div className="mb-4 flex gap-0 items-center">
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
          <RefreshCw className="w-4 h-4 mr-0" />
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
            
            return (
              <div key={vendor.id || vendor.vendorId} className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-0 mb-0">
                      <h4 className="font-semibold text-gray-900">
                        {vendor.fullName || vendor.businessName || vendor.vendorName}
                      </h4>
                      <span className={`px-0 py-0 text-xs rounded-full ${
                        vendor.priority === 'high' ? 'bg-red-100 text-red-700' :
                        vendor.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {vendor.priority || 'medium'}
                      </span>
                      <span className="px-0 py-0 text-xs bg-gray-100 text-gray-700 rounded-full">
                        {vendor.category || vendor.serviceCategory || 'N/A'}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="text-gray-500">Phone:</span> {vendor.phone || vendor.mobile || 'N/A'}
                      </div>
                      <div>
                        <span className="text-gray-500">Location:</span> {vendor.city || vendor.location || 'N/A'}
                      </div>
                      <div>
                        <span className="text-gray-500">Experience:</span> {vendor.experience || 'N/A'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-0 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedApplication(vendor);
                        if (onViewDetails) onViewDetails(vendor);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-0" />
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
                          <FileText className="w-4 h-4 mr-0" />
                          Request Info
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(vendor)}
                          className="text-red-600 hover:bg-red-50"
                          disabled={isProcessing}
                        >
                          <X className="w-4 h-4 mr-0" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(vendor.vendorId || vendor.id)}
                          disabled={isProcessing}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Check className="w-4 h-4 mr-0" />
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

